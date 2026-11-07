import { describe, it, expect } from 'vitest';
import type { IDataObject } from 'n8n-workflow';
import { testSocialMateConnection } from '../../nodes/SocialMate/methods/credentialTest';
import { SocialMate } from '../../nodes/SocialMate/SocialMate.node';
import { SocialMateTrigger } from '../../nodes/SocialMateTrigger/SocialMateTrigger.node';
import { SocialMateApi } from '../../credentials/SocialMateApi.credentials';
import { API_ERRORS } from '../fixtures/api-error-envelopes';

/** A legacy `helpers.request` stand-in answering with `{ statusCode, body }` (simple:false). */
function answering(statusCode: number, body: unknown): { calls: IDataObject[]; request: (o: IDataObject) => Promise<unknown> } {
	const calls: IDataObject[] = [];
	return {
		calls,
		request: async (o) => {
			calls.push(o);
			return { statusCode, body };
		},
	};
}

type Answer = { status: number; body: unknown } | Error;

/** Answers per path: `/v1/capabilities` and the `/v1/webhooks` admin-scope probe. */
function routed(answers: { capabilities?: Answer; webhooks?: Answer }): { calls: IDataObject[]; request: (o: IDataObject) => Promise<unknown> } {
	const calls: IDataObject[] = [];
	return {
		calls,
		request: async (o) => {
			calls.push(o);
			const a = String(o.uri).endsWith('/v1/webhooks')
				? (answers.webhooks ?? { status: 200, body: { data: [] } })
				: (answers.capabilities ?? { status: 200, body: CAPABILITIES });
			if (a instanceof Error) throw a;
			return { statusCode: a.status, body: a.body };
		},
	};
}

const CAPABILITIES = {
	data: {
		app: 'SocialMate',
		version: '3.0.0',
		tier: 'free',
		features: { localMessageCache: false },
		tools: [
			{ name: 'send_text', available: true },
			{ name: 'create_webhook', available: true, requiresAdminKey: true },
		],
	},
};

describe('credential Test — requires a real SocialMate handshake', () => {
	it('passes for the SocialMate capabilities envelope and reports the tier', async () => {
		const { calls, request } = answering(200, CAPABILITIES);
		const res = await testSocialMateConnection('http://127.0.0.1:3456/', 'sm_key', request);
		expect(res.status).toBe('OK');
		expect(res.message).toContain('free tier');
		expect(calls[0].uri).toBe('http://127.0.0.1:3456/v1/capabilities');
		expect((calls[0].headers as IDataObject)['x-api-key']).toBe('sm_key');
	});

	it('fails for a 200 HTML page (n8n itself, or any web server)', async () => {
		const res = await testSocialMateConnection('http://127.0.0.1:5678', 'k', answering(200, '<!DOCTYPE html><html></html>').request);
		expect(res.status).toBe('Error');
		expect(res.message).toMatch(/not a SocialMate server/);
	});

	it('names the /admin console mistake without calling it', async () => {
		const { calls, request } = answering(200, '<html></html>');
		const res = await testSocialMateConnection('http://10.0.0.5:3456/admin/', 'k', request);
		expect(res.status).toBe('Error');
		expect(res.message).toMatch(/admin console/);
		expect(res.message).toContain('http://10.0.0.5:3456');
		expect(calls).toHaveLength(0);
	});

	it('reports a rejected key as an authorization failure', async () => {
		const res = await testSocialMateConnection('http://127.0.0.1:3456', 'bad', answering(401, API_ERRORS.unauthorized.body).request);
		expect(res.status).toBe('Error');
		expect(res.message).toMatch(/Authorization failed.*Invalid API key/);
	});

	it('warns when the key cannot register the Trigger webhook (no admin scope)', async () => {
		const res = await testSocialMateConnection('http://127.0.0.1:3456', 'k', routed({ webhooks: API_ERRORS.insufficientScope }).request);
		expect(res.status).toBe('OK');
		expect(res.message).toMatch(/no admin scope/);
	});

	it('warns on Free too, where every admin tool is also tier-gated in capabilities', async () => {
		// The walkthrough case: a read+send key on Free. Every requiresAdminKey tool
		// is feature-gated, so capabilities alone cannot tell scope from tier.
		const caps = {
			data: {
				...CAPABILITIES.data,
				features: { localMessageCache: false, scheduledMessages: false, apiWriteEnabled: false },
				tools: [
					{ name: 'send_text', available: true },
					{ name: 'schedule_message', available: false, feature: 'scheduledMessages', requiresAdminKey: true },
				],
			},
		};
		const { calls, request } = routed({ capabilities: { status: 200, body: caps }, webhooks: API_ERRORS.insufficientScope });
		const res = await testSocialMateConnection('http://127.0.0.1:3791', 'k', request);
		expect(res.status).toBe('OK');
		expect(res.message).toMatch(/no admin scope/);
		expect(calls.map((c) => c.uri)).toEqual(['http://127.0.0.1:3791/v1/capabilities', 'http://127.0.0.1:3791/v1/webhooks']);
		expect(calls[1].method).toBe('GET');
	});

	it('also reads the flat legacy 403 shape', async () => {
		const flat = { status: 403, body: { error: 'insufficient_scope', message: "Key requires 'admin' scope", required: 'admin' } };
		const res = await testSocialMateConnection('http://127.0.0.1:3456', 'k', routed({ webhooks: flat }).request);
		expect(res.message).toMatch(/no admin scope/);
	});

	it('stays silent for an admin key, and when the probe cannot tell', async () => {
		for (const webhooks of [
			{ status: 200, body: { data: [] } },
			{ status: 404, body: { error: { code: 'not_found', message: 'Route GET:/v1/webhooks not found' } } },
			{ status: 403, body: { error: { code: 'account_scope_mismatch', message: 'nope' } } },
			new Error('socket hang up'),
		]) {
			const res = await testSocialMateConnection('http://127.0.0.1:3456', 'k', routed({ webhooks }).request);
			expect(res.status).toBe('OK');
			expect(res.message).not.toMatch(/admin scope/);
		}
	});

	it('names a trailing /v1 without calling the server', async () => {
		const { calls, request } = answering(200, CAPABILITIES);
		const res = await testSocialMateConnection('http://localhost:3791/v1/', 'k', request);
		expect(res.status).toBe('Error');
		expect(res.message).toMatch(/Remove \/v1/);
		expect(res.message).toContain('http://localhost:3791.');
		expect(calls).toHaveLength(0);
	});

	it('suggests http:// when https:// was assumed and the server speaks plain HTTP', async () => {
		const tlsError = Object.assign(
			new Error('00AD95DC1E710000:error:0A0000C6:SSL routines:tls_get_more_records:packet length too long'),
			{ code: 'EPROTO' },
		);
		const res = await testSocialMateConnection('127.0.0.1:3791', 'k', async () => {
			throw tlsError;
		});
		expect(res.status).toBe('Error');
		expect(res.message).toMatch(/https:\/\/ was assumed/);
		expect(res.message).toContain('Use http://127.0.0.1:3791.');
		expect(res.message).not.toMatch(/SSL routines/);

		const explicit = await testSocialMateConnection('https://127.0.0.1:3791', 'k', async () => {
			throw new Error('write EPROTO ...:wrong version number');
		});
		expect(explicit.message).toMatch(/^This address answers plain HTTP/);
		expect(explicit.message).toContain('Use http://127.0.0.1:3791.');

		// A TLS handshake alert on a real HTTPS host is EPROTO too — not a plain-HTTP server.
		const alert = Object.assign(
			new Error('write EPROTO 00AD95DC1E710000:error:0A000410:SSL routines:ssl3_read_bytes:sslv3 alert handshake failure'),
			{ code: 'EPROTO' },
		);
		const handshake = await testSocialMateConnection('https://sm.example.com', 'k', async () => {
			throw alert;
		});
		expect(handshake.message).not.toMatch(/plain HTTP/);
		expect(handshake.message).toMatch(/^Cannot reach SocialMate at https:\/\/sm\.example\.com: /);
	});

	it('refuses a quick-tunnel URL without calling it, even one that answers right now', async () => {
		const { calls, request } = answering(200, CAPABILITIES);
		const res = await testSocialMateConnection('https://some-words.trycloudflare.com', 'k', request);
		expect(res.status).toBe('Error');
		expect(res.message).toMatch(/^Quick-tunnel URLs \(\*\.trycloudflare\.com\) change every time SocialMate starts — use a named tunnel \(Pro\) or a local URL\./);
		expect(calls).toHaveLength(0);
	});

	it('a refused 127.0.0.1 / localhost URL names the Docker case', async () => {
		for (const url of ['http://127.0.0.1:3456', 'http://localhost:3456']) {
			const res = await testSocialMateConnection(url, 'k', async () => {
				throw Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' });
			});
			expect(res.message).toMatch(/host\.docker\.internal:3456/);
			expect(res.message).toMatch(/--network host/);
		}
		const remote = await testSocialMateConnection('http://10.0.0.5:3456', 'k', async () => {
			throw Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' });
		});
		expect(remote.message).not.toMatch(/docker/i);
	});

	it('a non-JSON 401 / 403 / 502 / 530 page says SocialMate is not reachable instead of a bare status', async () => {
		for (const status of [401, 403, 502, 530]) {
			const res = await testSocialMateConnection('https://sm.example.com', 'k', answering(status, '<html>Bad gateway</html>').request);
			expect(res.status).toBe('Error');
			expect(res.message).toMatch(new RegExp(`^SocialMate isn't reachable at https://sm\\.example\\.com \\(HTTP ${status}\\)`));
			// A Cloudflare Access 401 / WAF 403 page is not a rejected key.
			expect(res.message).not.toMatch(/Authorization failed|refused this API key/);
		}
	});

	it('maps a refused connection', async () => {
		const res = await testSocialMateConnection('http://127.0.0.1:1', 'k', async () => {
			throw Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:1'), { code: 'ECONNREFUSED' });
		});
		expect(res.status).toBe('Error');
		expect(res.message).toMatch(/refused the connection/);
	});

	it('is wired: both nodes declare testedBy, expose the method, and the credential has no rule-less test', () => {
		for (const node of [new SocialMate(), new SocialMateTrigger()]) {
			const cred = node.description.credentials?.find((c) => c.name === 'socialMateApi');
			expect(cred?.testedBy).toBe('socialMateApiTest');
			expect(typeof node.methods?.credentialTest?.socialMateApiTest).toBe('function');
		}
		expect((new SocialMateApi() as unknown as { test?: unknown }).test).toBeUndefined();
	});
});

describe('execute — a Server URL that is not the API root', () => {
	it('fails clearly instead of counting the characters of an HTML page as accounts', async () => {
		const params: Record<string, unknown> = { resource: 'message', operation: 'sendText', chatId: '15551234567', text: 'hi' };
		const ctx = {
			getInputData: () => [{ json: {} }],
			getNodeParameter: (name: string, _i: number, fallback?: unknown) => (name in params ? params[name] : fallback),
			getCredentials: async () => ({ baseUrl: 'http://127.0.0.1:3456/admin', apiKey: 'k' }),
			getNode: () => ({ id: 't', name: 'SocialMate', type: 'n8n-nodes-socialmate.socialMate', typeVersion: 1, position: [0, 0], parameters: {} }),
			continueOnFail: () => false,
			helpers: { httpRequestWithAuthentication: async () => '<!DOCTYPE html>'.padEnd(719, ' ') },
		};
		await expect(new SocialMate().execute.call(ctx as never)).rejects.toThrow(/did not return SocialMate JSON/);
	});
});

describe('execute — a foreign answer on GET /v1/accounts', () => {
	const foreign502 = { statusCode: 502, response: { statusCode: 502, body: '<html>502 Bad Gateway</html>' } };
	const node = () => ({ id: 't', name: 'SocialMate', type: 'n8n-nodes-socialmate.socialMate', typeVersion: 1, position: [0, 0], parameters: {} });
	function ctxFor(params: Record<string, unknown>, continueOnFail: boolean, items = 2) {
		const calls: string[] = [];
		return {
			calls,
			ctx: {
				getInputData: () => Array.from({ length: items }, () => ({ json: {} })),
				getNodeParameter: (name: string, _i: number, fallback?: unknown) => (name in params ? params[name] : fallback),
				getCredentials: async () => ({ baseUrl: 'https://sm.example.com', apiKey: 'k' }),
				getNode: node,
				continueOnFail: () => continueOnFail,
				helpers: {
					httpRequestWithAuthentication: async (_c: string, o: { url: string }) => {
						calls.push(o.url);
						if (o.url.endsWith('/v1/accounts')) throw foreign502;
						return { data: { app: 'SocialMate', tier: 'free' } };
					},
				},
			},
		};
	}

	it('with continueOnFail on, each item that needs an account becomes an error item instead of aborting the run', async () => {
		const { ctx } = ctxFor({ resource: 'message', operation: 'sendText', chatId: '15551234567', text: 'hi' }, true);
		const [out] = await new SocialMate().execute.call(ctx as never);
		expect(out).toHaveLength(2);
		for (const item of out) expect(String(item.json.error)).toMatch(/^SocialMate isn't reachable at https:\/\/sm\.example\.com \(HTTP 502\)/);
	});

	it('an operation that needs no account still runs', async () => {
		const { ctx, calls } = ctxFor({ resource: 'system', operation: 'getCapabilities' }, false, 1);
		const [out] = await new SocialMate().execute.call(ctx as never);
		expect(out).toHaveLength(1);
		expect(out[0].json.app).toBe('SocialMate');
		expect(calls.some((u) => u.endsWith('/v1/capabilities'))).toBe(true);
	});

	it('with continueOnFail off, an item that needs an account fails with the not-SocialMate message', async () => {
		const { ctx } = ctxFor({ resource: 'message', operation: 'sendText', chatId: '15551234567', text: 'hi' }, false);
		await expect(new SocialMate().execute.call(ctx as never)).rejects.toThrow(/isn't reachable at https:\/\/sm\.example\.com \(HTTP 502\)/);
	});
});
