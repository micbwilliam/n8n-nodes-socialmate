import { describe, it, expect } from 'vitest';
import type { IHttpRequestOptions } from 'n8n-workflow';
import { SocialMate } from '../../nodes/SocialMate/SocialMate.node';

/**
 * Drives the Agent branch of SocialMate.execute() with a recording fake context
 * (no server) and asserts the exact method, path, query and body each operation
 * puts on the wire — the shapes the app's api-agents.ts handlers accept.
 */
interface Recorded {
	method: string;
	path: string;
	qs?: Record<string, unknown>;
	body?: Record<string, unknown>;
}

async function run(params: Record<string, unknown>): Promise<{ calls: Recorded[]; out: unknown[] }> {
	const calls: Recorded[] = [];
	const ctx = {
		getInputData: () => [{ json: {} }],
		getNodeParameter: (name: string, _i: number, fallback?: unknown) => (name in params ? params[name] : fallback),
		getCredentials: async () => ({ baseUrl: 'http://127.0.0.1:1', apiKey: 'k' }),
		getNode: () => ({ id: 't', name: 'SocialMate', type: 'n8n-nodes-socialmate.socialMate', typeVersion: 1, position: [0, 0], parameters: {} }),
		continueOnFail: () => false,
		helpers: {
			httpRequestWithAuthentication: async (_cred: string, o: IHttpRequestOptions) => {
				const path = new URL(o.url as string).pathname;
				// The account-scope probe at the top of execute() — not under test.
				if (path === '/v1/accounts') return { data: [{ id: 'acc1' }] };
				calls.push({
					method: o.method as string,
					path,
					...(o.qs ? { qs: o.qs as Record<string, unknown> } : {}),
					...(o.body ? { body: o.body as Record<string, unknown> } : {}),
				});
				return { data: { ok: true } };
			},
		},
	};
	const [out] = await new SocialMate().execute.call(ctx as never);
	return { calls, out };
}

describe('Agent resource → wire shapes', () => {
	it('Get Many / Get Usage Summary need no agent id', async () => {
		expect((await run({ resource: 'agent', operation: 'getMany' })).calls).toEqual([{ method: 'GET', path: '/v1/agents' }]);
		expect((await run({ resource: 'agent', operation: 'getUsageSummary' })).calls).toEqual([{ method: 'GET', path: '/v1/usage/summary' }]);
	});

	it('Update sends only added fields plus configVersion for the optimistic lock', async () => {
		const { calls } = await run({
			resource: 'agent',
			operation: 'update',
			agentId: 'ag1',
			agentUpdateFields: { autonomy: 'copilot', configVersion: 7, customPrompt: 'Be brief.' },
		});
		expect(calls).toEqual([{ method: 'PATCH', path: '/v1/agents/ag1', body: { autonomy: 'copilot', customPrompt: 'Be brief.', configVersion: 7 } }]);
	});

	it('Get Usage passes the range; approvals/handoffs pass status', async () => {
		expect((await run({ resource: 'agent', operation: 'getUsage', agentId: 'ag1', usageRange: '30d' })).calls[0]).toEqual({
			method: 'GET', path: '/v1/agents/ag1/usage', qs: { range: '30d' },
		});
		expect((await run({ resource: 'agent', operation: 'getApprovals', agentId: 'ag1', approvalStatus: 'all' })).calls[0].qs).toEqual({ status: 'all' });
		expect((await run({ resource: 'agent', operation: 'getHandoffs', agentId: 'ag1' })).calls[0].qs).toEqual({ status: 'open' });
	});

	it('Decide Approval posts {decision, note?, decidedBy?}', async () => {
		const { calls } = await run({
			resource: 'agent', operation: 'decideApproval', agentId: 'ag1', approvalId: 'ap1', decision: 'reject', decisionOptions: { note: 'wrong price' },
		});
		expect(calls).toEqual([{ method: 'POST', path: '/v1/agents/ag1/approvals/ap1', body: { decision: 'reject', note: 'wrong price' } }]);
	});

	it('chat ops turn a phone into a URL-encoded JID; a JID passes through', async () => {
		const take = await run({ resource: 'agent', operation: 'takeOverChat', agentId: 'ag1', agentChatId: '+1 555 123 0001' });
		expect(take.calls).toEqual([{ method: 'POST', path: '/v1/agents/ag1/chats/15551230001%40s.whatsapp.net/takeover' }]);
		const reply = await run({ resource: 'agent', operation: 'replyInChat', agentId: 'ag1', agentChatId: '123@lid', replyText: 'Hi, Sam here.' });
		expect(reply.calls).toEqual([{ method: 'POST', path: '/v1/agents/ag1/chats/123%40lid/reply', body: { text: 'Hi, Sam here.' } }]);
	});

	it('Send Event builds recipient, parses data JSON and converts dates', async () => {
		const { calls } = await run({
			resource: 'agent',
			operation: 'sendEvent',
			agentId: 'ag1',
			eventType: 'order.shipped',
			idempotencyKey: 'wc-order-1042-shipped',
			recipientPhone: '+1 555 123 0001',
			eventOptions: {
				recipientName: 'Jane',
				data: '{"orderNumber":"1042"}',
				consentSource: 'checkout box',
				consentAt: '2026-10-01T10:00:00.000Z',
				occurredAt: '2026-10-02T09:30:00.000Z',
			},
		});
		expect(calls).toEqual([{
			method: 'POST',
			path: '/v1/agents/ag1/events',
			body: {
				type: 'order.shipped',
				idempotencyKey: 'wc-order-1042-shipped',
				recipient: { phone: '+1 555 123 0001', name: 'Jane' },
				data: { orderNumber: '1042' },
				consent: { source: 'checkout box', at: Date.parse('2026-10-01T10:00:00.000Z') },
				occurredAt: '2026-10-02T09:30:00.000Z',
			},
		}]);
	});

	it('Send Event rejects non-object data before calling the app', async () => {
		await expect(run({
			resource: 'agent', operation: 'sendEvent', agentId: 'ag1', eventType: 'x', idempotencyKey: '12345678', recipientPhone: '+15551230001', eventOptions: { data: '[1,2]' },
		})).rejects.toThrow(/JSON object/);
	});

	it('Add Knowledge posts content with its options', async () => {
		const { calls } = await run({
			resource: 'agent', operation: 'addKnowledge', agentId: 'ag1', knowledgeContent: 'Q: Hours?\nA: 9-5.', knowledgeOptions: { kind: 'qa', title: 'Hours', shared: true },
		});
		expect(calls).toEqual([{ method: 'POST', path: '/v1/agents/ag1/knowledge', body: { content: 'Q: Hours?\nA: 9-5.', kind: 'qa', title: 'Hours', shared: true } }]);
	});

	it('Pause / Resume post with no body', async () => {
		expect((await run({ resource: 'agent', operation: 'pause', agentId: 'ag1' })).calls).toEqual([{ method: 'POST', path: '/v1/agents/ag1/pause' }]);
		expect((await run({ resource: 'agent', operation: 'resume', agentId: 'ag1' })).calls).toEqual([{ method: 'POST', path: '/v1/agents/ag1/resume' }]);
	});
});
