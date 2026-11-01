import { describe, it, expect } from 'vitest';
import type { IHttpRequestOptions } from 'n8n-workflow';
import { SocialMateTrigger } from '../../nodes/SocialMateTrigger/SocialMateTrigger.node';

const URL_ = 'https://n8n.example.com/webhook/abc/webhook';

interface Endpoint {
	id: string;
	url: string;
	events: string[];
}

/** An IHookFunctions stand-in over an in-memory /v1/webhooks store. */
function hookCtx(opts: { endpoints: Endpoint[]; staticData: Record<string, unknown>; events?: string[] }) {
	const calls: Array<{ method: string; path: string; body?: Record<string, unknown> }> = [];
	const ctx = {
		getNodeWebhookUrl: () => URL_,
		getWorkflowStaticData: () => opts.staticData,
		getNodeParameter: (name: string, fallback: unknown) => (name === 'events' ? opts.events ?? ['message.received'] : fallback),
		getWorkflow: () => ({ name: 'wf' }),
		getCredentials: async () => ({ baseUrl: 'http://127.0.0.1:3456', apiKey: 'k' }),
		getNode: () => ({ id: 't', name: 'SocialMate Trigger', type: 'n8n-nodes-socialmate.socialMateTrigger', typeVersion: 1, position: [0, 0], parameters: {} }),
		helpers: {
			httpRequestWithAuthentication: async (_c: string, o: IHttpRequestOptions) => {
				const path = new URL(o.url as string).pathname;
				const method = o.method as string;
				calls.push({ method, path, ...(o.body ? { body: o.body as Record<string, unknown> } : {}) });
				if (method === 'GET' && path === '/v1/webhooks') return { data: opts.endpoints };
				if (method === 'POST' && path === '/v1/webhooks') return { data: { id: 'wh_new' } };
				return { data: { ok: true } };
			},
		},
	};
	return { ctx, calls };
}

describe('SocialMateTrigger lifecycle — never adopt an endpoint without its secret', () => {
	const methods = new SocialMateTrigger().webhookMethods.default;

	it('an endpoint with our URL but no stored secret (wizard-created / orphaned) is replaced, not adopted', async () => {
		const staticData: Record<string, unknown> = {};
		const { ctx, calls } = hookCtx({ endpoints: [{ id: 'wh_wizard', url: URL_, events: ['message.sent'] }], staticData });
		expect(await methods.checkExists.call(ctx as never)).toBe(false);
		expect(calls).toContainEqual({ method: 'DELETE', path: '/v1/webhooks/wh_wizard' });

		// n8n then calls create(): a fresh secret and THIS node's events.
		expect(await methods.create.call(ctx as never)).toBe(true);
		const post = calls.find((c) => c.method === 'POST');
		expect(post?.body?.events).toEqual(['message.received']);
		expect(typeof post?.body?.secret).toBe('string');
		expect(staticData.secret).toBe(post?.body?.secret);
		expect(staticData.webhookId).toBe('wh_new');
	});

	it('an endpoint whose id differs from the one we created is not ours either', async () => {
		const staticData: Record<string, unknown> = { webhookId: 'wh_mine', secret: 's' };
		const { ctx } = hookCtx({ endpoints: [{ id: 'wh_other', url: URL_, events: ['message.received'] }], staticData });
		expect(await methods.checkExists.call(ctx as never)).toBe(false);
		expect(staticData.secret).toBeUndefined();
	});

	it('our own endpoint (same id, secret held) is kept', async () => {
		const staticData: Record<string, unknown> = { webhookId: 'wh_mine', secret: 's' };
		const { ctx, calls } = hookCtx({ endpoints: [{ id: 'wh_mine', url: URL_, events: ['message.received'] }], staticData });
		expect(await methods.checkExists.call(ctx as never)).toBe(true);
		expect(calls.filter((c) => c.method !== 'GET')).toEqual([]);
		expect(staticData.secret).toBe('s');
	});

	it('our own endpoint is re-pointed at the current Events selection', async () => {
		const staticData: Record<string, unknown> = { webhookId: 'wh_mine', secret: 's' };
		const { ctx, calls } = hookCtx({
			endpoints: [{ id: 'wh_mine', url: URL_, events: ['message.received'] }],
			staticData,
			events: ['message.received', 'message.sent'],
		});
		expect(await methods.checkExists.call(ctx as never)).toBe(true);
		expect(calls).toContainEqual({ method: 'PATCH', path: '/v1/webhooks/wh_mine', body: { events: ['message.received', 'message.sent'] } });
	});
});
