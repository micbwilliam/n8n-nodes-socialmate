import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { EVENT_OPTIONS } from '../../nodes/SocialMateTrigger/SocialMateTrigger.node';

/**
 * Contract-drift guard. `test/fixtures/product-facts.json` is a vendored
 * snapshot of the app's canonical `docs/product-facts.json` (refresh it with
 * `npm run sync:contract`). If the app moves an endpoint/event and the snapshot
 * is re-synced, these assertions fail until the node is brought back into
 * lockstep — surfacing exactly the drift the node is supposed to mirror.
 */
interface ProductFacts {
	version: string;
	endpoints: Array<{ method: string; path: string; deprecated: boolean }>;
	webhookEvents: { all: string[]; free: string[] };
}

const facts: ProductFacts = JSON.parse(
	readFileSync(resolve(process.cwd(), 'test/fixtures/product-facts.json'), 'utf8'),
);

// Every REST endpoint the SocialMate action node actually calls, with the app's
// `:id`-style path placeholders. Keep this in lockstep with the execute() switch
// in nodes/SocialMate/SocialMate.node.ts.
const NODE_ENDPOINTS: string[] = [
	'GET /v1/capabilities',
	'GET /v1/status',
	'GET /v1/version',
	'GET /v1/network/status',
	'GET /v1/accounts',
	'GET /v1/accounts/:id',
	'GET /v1/accounts/:id/antiban',
	'GET /v1/accounts/:id/chats',
	'GET /v1/accounts/:id/contacts',
	'GET /v1/accounts/:id/contacts/:contactId',
	'PATCH /v1/accounts/:id/contacts/:contactId',
	'GET /v1/accounts/:id/messages',
	'POST /v1/accounts/:id/messages',
	'POST /v1/accounts/:id/messages/read',
	'POST /v1/accounts/:id/messages/:messageId/reaction',
	'GET /v1/accounts/:id/polls/:messageId',
	'GET /v1/accounts/:id/proxy',
	'PUT /v1/accounts/:id/proxy',
	'DELETE /v1/accounts/:id/proxy',
	'POST /v1/accounts/:id/presence',
	'GET /v1/accounts/:id/ai-context',
	'GET /v1/accounts/:id/groups',
	'POST /v1/accounts/:id/groups',
	'GET /v1/accounts/:id/groups/:groupId',
	'POST /v1/accounts/:id/groups/:groupId/participants',
	'PUT /v1/accounts/:id/groups/:groupId/subject',
	'PUT /v1/accounts/:id/groups/:groupId/description',
	'GET /v1/accounts/:id/groups/:groupId/invite',
	'POST /v1/accounts/:id/groups/:groupId/leave',
	'GET /v1/accounts/:id/media',
	'GET /v1/accounts/:id/media/stats',
	'GET /v1/accounts/:id/media/:mediaId',
	'GET /v1/accounts/:id/media/:mediaId/file',
	'GET /v1/accounts/:id/media/:mediaId/thumbnail',
	'POST /v1/accounts/:id/media/:mediaId/download',
	'PUT /v1/accounts/:id/media/:mediaId/context',
	'DELETE /v1/accounts/:id/media/:mediaId',
	'GET /v1/media/queue',
	'POST /v1/media/cleanup',
	'POST /v1/accounts/:id/queue/items',
	'POST /v1/accounts/:id/queue/import',
	'GET /v1/queue/status',
	'GET /v1/queue/items',
	'GET /v1/queue/batches',
	'DELETE /v1/queue/items/:itemId',
	'POST /v1/queue/items/:itemId/retry',
	'DELETE /v1/queue/batches/:batchId',
	'POST /v1/queue/batches/:batchId/retry',
	'POST /v1/queue/pause',
	'POST /v1/queue/resume',
	'POST /v1/accounts/:id/sync',
	'GET /v1/sync/status',
	'GET /v1/webhooks',
	'GET /v1/webhooks/:id',
	'POST /v1/webhooks',
	'PATCH /v1/webhooks/:id',
	'DELETE /v1/webhooks/:id',
	'POST /v1/webhooks/:id/test',
	'GET /v1/webhooks/:id/deliveries',
	'GET /v1/api-keys',
	'POST /v1/api-keys',
	'POST /v1/api-keys/:id/rotate',
	'DELETE /v1/api-keys/:id',
	// Native AI agent (Pro `aiEnabled`) — the Agent resource.
	'GET /v1/agents',
	'GET /v1/agents/:id',
	'PATCH /v1/agents/:id',
	'POST /v1/agents/:id/pause',
	'POST /v1/agents/:id/resume',
	'GET /v1/agents/:id/usage',
	'GET /v1/usage/summary',
	'GET /v1/agents/:id/approvals',
	'POST /v1/agents/:id/approvals/:aid',
	'GET /v1/agents/:id/handoffs',
	'POST /v1/agents/:id/chats/:chatId/takeover',
	'POST /v1/agents/:id/chats/:chatId/release',
	'POST /v1/agents/:id/chats/:chatId/reply',
	'POST /v1/agents/:id/events',
	'GET /v1/agents/:id/knowledge',
	'POST /v1/agents/:id/knowledge',
];

/**
 * App endpoints the node DELIBERATELY does not call. Every entry needs a reason;
 * "node ⊇ app" is checked against NODE_ENDPOINTS + this list, so a NEW app
 * endpoint still fails the test until it is either wired up or listed here.
 */
const DELIBERATELY_UNCALLED: Record<string, string> = {
	// Agent lifecycle is set up in the app (provider, model, persona); a workflow
	// creating or deleting agents is a footgun, not an automation.
	'POST /v1/accounts/:id/agent': 'agent creation is done in the app',
	'DELETE /v1/agents/:id': 'irreversible; done in the app',
	// Debug / audit views — large, run-by-run payloads meant for the app's UI.
	'GET /v1/agents/:id/runs': 'run log is an app debugging view',
	'GET /v1/agents/:id/runs/:runId': 'run log is an app debugging view',
	'GET /v1/agents/:id/conversations': 'inbox view; Get Handoffs/Approvals cover the workflow cases',
	// Message history already has a first-class path (Message → Search / Get AI Context).
	'GET /v1/agents/:id/chats/:chatId/messages': 'covered by Message → Search / Get AI Context',
	// Per-contact agent memory is the agent's own state, not workflow data.
	'GET /v1/agents/:id/memory/:chatId': 'agent-internal memory',
	'POST /v1/agents/:id/memory/:chatId': 'agent-internal memory',
	'DELETE /v1/agents/:id/knowledge/:kid': 'destructive; knowledge is pruned in the app',
	// Global agent settings: an admin key for ALL accounts, server configuration.
	'GET /v1/ai/settings': 'global kill switch / spend cap is app configuration',
	'PUT /v1/ai/settings': 'global kill switch / spend cap is app configuration',
	'GET /v1/ai/senses': 'voice/photo provider setup is app configuration',
	'PUT /v1/ai/senses': 'voice/photo provider setup is app configuration',
	'POST /v1/ai/senses/test': 'voice/photo provider setup is app configuration',
	// WordPress connector pairing is driven by the SocialMate Agent Connect plugin.
	'POST /v1/connectors/wordpress': 'owned by the WordPress plugin',
	'POST /v1/connectors/wordpress/:id/verify': 'owned by the WordPress plugin',
	'POST /v1/connectors/wordpress/:id/manifest': 'owned by the WordPress plugin',
	'PATCH /v1/connectors/wordpress/:id': 'owned by the WordPress plugin',
	'DELETE /v1/connectors/wordpress/:id': 'owned by the WordPress plugin',
};

const fixtureActive = facts.endpoints.filter((e) => !e.deprecated).map((e) => `${e.method} ${e.path}`);
const fixtureDeprecated = facts.endpoints.filter((e) => e.deprecated).map((e) => `${e.method} ${e.path}`);

describe('REST endpoint drift vs the app (product-facts.json)', () => {
	it('covers every ACTIVE app endpoint (node ⊇ app active set, minus the deliberate exemptions)', () => {
		const missing = fixtureActive.filter((e) => !NODE_ENDPOINTS.includes(e) && !(e in DELIBERATELY_UNCALLED));
		expect(missing, `node is missing endpoints the app exposes: ${missing.join(', ')}`).toEqual([]);
	});

	it('keeps the exemption list honest (every entry is a real app endpoint the node does not call)', () => {
		const all = facts.endpoints.map((e) => `${e.method} ${e.path}`);
		for (const e of Object.keys(DELIBERATELY_UNCALLED)) {
			expect(all, `stale exemption: ${e}`).toContain(e);
			expect(NODE_ENDPOINTS, `exempted but called: ${e}`).not.toContain(e);
		}
	});

	it('calls no endpoint the app does not expose (node ⊆ app set)', () => {
		const all = facts.endpoints.map((e) => `${e.method} ${e.path}`);
		const phantom = NODE_ENDPOINTS.filter((e) => !all.includes(e));
		expect(phantom, `node calls endpoints not in the app: ${phantom.join(', ')}`).toEqual([]);
	});

	it('does NOT call the deprecated /messages/media endpoint', () => {
		for (const dep of fixtureDeprecated) {
			expect(NODE_ENDPOINTS).not.toContain(dep);
		}
		// Sanity: the fixture still carries the known deprecated route.
		expect(fixtureDeprecated).toContain('POST /v1/accounts/:id/messages/media');
	});
});

describe('Webhook event drift vs the app', () => {
	const nodeAll = EVENT_OPTIONS.map((e) => e.value);
	const nodeFree = EVENT_OPTIONS.filter((e) => !e.name.includes('(Pro)')).map((e) => e.value);

	it('exposes exactly the app\'s 48 events', () => {
		expect(nodeAll.length).toBe(48);
		expect([...nodeAll].sort()).toEqual([...facts.webhookEvents.all].sort());
	});

	it('marks exactly the app\'s 9 Free events as unlabelled (Free)', () => {
		expect(nodeFree.length).toBe(9);
		expect([...nodeFree].sort()).toEqual([...facts.webhookEvents.free].sort());
	});
});
