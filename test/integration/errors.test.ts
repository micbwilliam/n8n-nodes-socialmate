import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { NodeApiError } from 'n8n-workflow';
import { readSocialMateError, socialmateApiRequest, SocialMateBlockedError } from '../../nodes/SocialMate/GenericFunctions';
import { SocialMate } from '../../nodes/SocialMate/SocialMate.node';
import { makeFakeContext } from '../helpers/context';
import { startMockServer, type MockServer } from '../helpers/mock-server';
import { API_ERRORS } from '../fixtures/api-error-envelopes';

/**
 * The error layer against the error shapes n8n really throws (a NodeApiError
 * wrapping an AxiosError — see test/helpers/context.ts) and the bodies the app
 * really sends (test/fixtures/api-error-envelopes.ts).
 *
 * Runs twice: `n8n` is current n8n (status only as the string `httpCode`, body
 * only in `context.data`, headers gone); `cause` is a build that keeps the
 * AxiosError on `cause`.
 */
let server: MockServer;
beforeAll(async () => {
	server = await startMockServer();
});
afterAll(async () => {
	await server.close();
});
beforeEach(() => server.reset());

async function failure(promise: Promise<unknown>): Promise<NodeApiError & { description?: string }> {
	try {
		await promise;
	} catch (e) {
		return e as NodeApiError & { description?: string };
	}
	throw new Error('expected the request to fail');
}

describe.each(['n8n', 'cause'] as const)('error mapping (%s error shape)', (errorShape) => {
	const ctx = (): ReturnType<typeof makeFakeContext> => makeFakeContext({ baseUrl: server.url, errorShape });
	const call = (path: string): Promise<unknown> => socialmateApiRequest.call(ctx() as never, 'GET', path);

	it('a warming 429 is a SocialMateBlockedError, not a generic failure, and is not retried', async () => {
		const e = await failure(
			socialmateApiRequest.call(ctx() as never, 'POST', '/v1/accounts/acc1/messages', { chatId: '15551234567', text: '__BLOCK_WARMING__' }),
		);
		expect(e).toBeInstanceOf(SocialMateBlockedError);
		const block = e as unknown as SocialMateBlockedError;
		expect(block.reason).toBe('warming');
		expect(block.retryAfterMs).toBe(3_600_000);
		expect(block.message).toBe(API_ERRORS.antiBanWarming.body.error.message);
		expect(server.counts['POST /v1/accounts/acc1/messages']).toBe(1);
	});

	it('Send Text returns { blocked: true } for a warming 429 so the IF-blocked branch can fire', async () => {
		const base = makeFakeContext({ baseUrl: server.url, errorShape });
		const params: Record<string, unknown> = {
			resource: 'message',
			operation: 'sendText',
			accountId: 'acc1',
			chatId: '15551234567',
			text: '__BLOCK_WARMING__',
		};
		const execCtx = {
			...base,
			getInputData: () => [{ json: {} }],
			getNodeParameter: (name: string, _i: number, fallback?: unknown) => (name in params ? params[name] : fallback),
			continueOnFail: () => false,
		};
		const [out] = await new SocialMate().execute.call(execCtx as never);
		expect(out[0].json).toMatchObject({ sent: false, blocked: true, reason: 'warming', retryAfterMs: 3_600_000 });
	});

	it('retries the per-key rate limiter and succeeds', async () => {
		const res = (await call('/v1/__error__/perKeyRateLimited?times=2')) as { recovered: boolean };
		expect(res.recovered).toBe(true);
		expect(server.counts['GET /v1/__error__/perKeyRateLimited']).toBe(3);
	});

	it('retries a short signal-lane 429 (react / mark read / typing)', async () => {
		const res = (await call('/v1/__error__/signalRateLimitShort?times=1')) as { recovered: boolean };
		expect(res.recovered).toBe(true);
		expect(server.counts['GET /v1/__error__/signalRateLimitShort']).toBe(2);
	});

	it('fails fast on an hourly signal cap instead of sleeping it', async () => {
		const started = Date.now();
		const e = await failure(call('/v1/__error__/signalRateLimitLong'));
		expect(e).toBeInstanceOf(SocialMateBlockedError);
		expect(e.message).toMatch(/Signal rate limit hit/);
		expect(server.counts['GET /v1/__error__/signalRateLimitLong']).toBe(1);
		expect(Date.now() - started).toBeLessThan(1000);
	});

	it('a 402 names the feature', async () => {
		const e = await failure(call('/v1/__error__/licenseRequired'));
		expect(e.message).toBe('This operation requires SocialMate Pro (feature: localMessageCache)');
		expect(e.httpCode).toBe('402');
	});

	it('a 402 from the trigger names the Pro events, not just the feature key', async () => {
		const e = await failure(call('/v1/__error__/webhookEventsRequirePro'));
		expect(e.message).toContain('These webhook events require Pro: message.delivered');
		const cap = await failure(call('/v1/__error__/webhookEndpointCap'));
		expect(cap.message).toContain('Free tier is limited to 2 webhook endpoints');
	});

	it('a 403 insufficient_scope names the missing scope', async () => {
		const e = await failure(call('/v1/__error__/insufficientScope'));
		expect(e.message).toBe("API key is missing the 'admin' scope");
		expect(e.description).toContain('API & Integrations');
	});

	it.each(['bulkImportDisabled', 'groupForbidden', 'accountScopeMismatch', 'accountSuspendedFree'] as const)(
		'a 403 %s surfaces the server message, not a scope message',
		async (name) => {
			const e = await failure(call(`/v1/__error__/${name}`));
			expect(e.message).toBe(API_ERRORS[name].body.error.message);
			expect(e.message).not.toMatch(/missing the .* scope/);
			expect(e.description).toBe(`SocialMate error code: ${API_ERRORS[name].body.error.code}`);
		},
	);

	it('a 401 points at API & Integrations', async () => {
		const e = await failure(call('/v1/__error__/unauthorized'));
		expect(e.message).toMatch(/Authentication failed/);
		expect(e.description).toBe('Generate a key in SocialMate → API & Integrations and update the credential.');
	});

	it('a 409 surfaces the server message instead of a generic status text', async () => {
		const e = await failure(call('/v1/__error__/accountNotConnected'));
		expect(e.message).toBe('Account is not connected');
	});

	it('a binary download (Download File) still surfaces the JSON error body', async () => {
		const e = await failure(
			socialmateApiRequest.call(ctx() as never, 'GET', '/v1/__error__/accountNotConnected', {}, {}, { encoding: 'arraybuffer' }),
		);
		expect(e.message).toBe('Account is not connected');
	});

	it('an unreachable server maps to "Cannot reach the SocialMate server"', async () => {
		const dead = makeFakeContext({ baseUrl: 'http://127.0.0.1:1', errorShape });
		const e = await failure(socialmateApiRequest.call(dead as never, 'GET', '/v1/capabilities'));
		expect(e.message).toBe('Cannot reach the SocialMate server');
	});

	it('a refused loopback URL also names the Docker case', async () => {
		const dead = makeFakeContext({ baseUrl: 'http://127.0.0.1:1', errorShape });
		const e = await failure(socialmateApiRequest.call(dead as never, 'GET', '/v1/capabilities'));
		expect(e.description).toMatch(/host\.docker\.internal:3456/);
		expect(e.description).toMatch(/--network host/);
	});

	for (const status of [401, 403, 429, 502, 504, 530]) {
		it(`a non-JSON ${status} page says SocialMate is not reachable at the URL, not a raw gateway error`, async () => {
			const e = await failure(call(`/v1/__html__/${status}`));
			expect(e.message).toBe(`SocialMate isn't reachable at ${server.url} (HTTP ${status}) — something other than SocialMate answered on that port`);
			expect(e.description).toMatch(/not from SocialMate/);
			// A Cloudflare Access 401 / WAF 403 is not "invalid API key" / a scope problem.
			expect(e.message).not.toMatch(/Authentication failed|scope/);
			// A foreign 429 (Cloudflare 1015) is not SocialMate's limiter: no retries.
			expect(server.counts[`GET /v1/__html__/${status}`]).toBe(1);
		});
	}

	it('a real JSON 429 is still retried (the foreign-page check does not swallow it)', async () => {
		const out = (await call('/v1/__error__/perKeyRateLimited?times=1')) as { recovered?: boolean };
		expect(out.recovered).toBe(true);
		expect(server.counts['GET /v1/__error__/perKeyRateLimited']).toBe(2);
	});

	it('a foreign 200 HTML page is an error, not data handed to the workflow', async () => {
		const e = await failure(call('/v1/__html__/200'));
		expect(e.message).toBe(`The Server URL did not return SocialMate JSON (${server.url}) — point it at the API root (e.g. http://127.0.0.1:3456), not the /admin console or n8n.`);
	});

	it('a binary download is never checked for JSON (Download File / Thumbnail bytes pass through)', async () => {
		const buf = await socialmateApiRequest.call(ctx() as never, 'GET', '/v1/__html__/200', {}, {}, { encoding: 'arraybuffer' });
		expect(Buffer.isBuffer(buf)).toBe(true);
	});
});

describe('an n8n build whose error wrapper drops the body (status only)', () => {
	const bare = (throws: () => unknown) => ({
		getCredentials: async () => ({ baseUrl: 'https://sm.example.com', apiKey: 'k' }),
		getNode: () => makeFakeContext({ baseUrl: 'https://sm.example.com' }).getNode(),
		helpers: { httpRequestWithAuthentication: async () => throws() },
	});

	it('readSocialMateError reports bodyKind none, not foreign', () => {
		expect(readSocialMateError({ httpCode: '401' }).bodyKind).toBe('none');
		expect(readSocialMateError({ statusCode: 502, response: { statusCode: 502, body: '<html></html>' } }).bodyKind).toBe('foreign');
		expect(readSocialMateError({ statusCode: 401, response: { statusCode: 401, data: Buffer.from('{"error":{"message":"x"}}') } }).bodyKind).toBe('json');
	});

	it('a bodiless 401 keeps the "Authentication failed" branch', async () => {
		const e = await failure(
			socialmateApiRequest.call(bare(() => { throw { httpCode: '401' }; }) as never, 'GET', '/v1/capabilities'),
		);
		expect(e.message).toBe('Authentication failed — invalid or missing API key');
	});

	it('a bodiless 429 is still retried', async () => {
		let hits = 0;
		const ctx = bare(() => {
			hits += 1;
			if (hits === 1) throw { httpCode: '429' };
			return { data: { ok: true } };
		});
		const out = await socialmateApiRequest.call(ctx as never, 'GET', '/v1/capabilities');
		expect(out).toEqual({ ok: true });
		expect(hits).toBe(2);
	}, 10_000);
});

describe('a foreign 2xx page', () => {
	it('carries no httpCode 200 (a 2xx is not an HTTP failure)', async () => {
		const ctx = {
			getCredentials: async () => ({ baseUrl: 'http://127.0.0.1:3456/admin', apiKey: 'k' }),
			getNode: () => makeFakeContext({ baseUrl: 'http://x' }).getNode(),
			helpers: { httpRequestWithAuthentication: async () => '<!DOCTYPE html><html></html>' },
		};
		const e = await failure(socialmateApiRequest.call(ctx as never, 'GET', '/v1/accounts'));
		expect(e.message).toMatch(/did not return SocialMate JSON/);
		expect(e.httpCode ?? undefined).not.toBe('200');
	});
});

describe('a quick-tunnel Server URL', () => {
	it('a Cloudflare 530 HTML page says the quick-tunnel URL changed when the app restarted', async () => {
		const base = 'https://old-words-here.trycloudflare.com';
		const ctx = {
			getCredentials: async () => ({ baseUrl: base, apiKey: 'k' }),
			getNode: () => makeFakeContext({ baseUrl: base }).getNode(),
			helpers: {
				httpRequestWithAuthentication: async () => {
					throw { statusCode: 530, response: { statusCode: 530, body: '<html>error code: 1033</html>' } };
				},
			},
		};
		const e = await failure(socialmateApiRequest.call(ctx as never, 'GET', '/v1/capabilities'));
		expect(e.message).toBe(`SocialMate isn't reachable at ${base} (HTTP 530) — if this is a quick-tunnel URL it changed when the app restarted`);
		expect(e.description).toMatch(/change every time SocialMate starts — use a named tunnel \(Pro\) or a local URL/);
	});
});
