import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { NodeApiError } from 'n8n-workflow';
import { socialmateApiRequest, SocialMateBlockedError } from '../../nodes/SocialMate/GenericFunctions';
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
});
