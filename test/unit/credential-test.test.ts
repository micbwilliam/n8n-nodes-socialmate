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
		const caps = JSON.parse(JSON.stringify(CAPABILITIES));
		caps.data.tools[1].available = false;
		const res = await testSocialMateConnection('http://127.0.0.1:3456', 'k', answering(200, caps).request);
		expect(res.status).toBe('OK');
		expect(res.message).toMatch(/no admin scope/);
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
