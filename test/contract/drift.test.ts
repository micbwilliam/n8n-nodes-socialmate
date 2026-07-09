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
	'GET /v1/accounts/:id/messages',
	'POST /v1/accounts/:id/messages',
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
];

const fixtureActive = facts.endpoints.filter((e) => !e.deprecated).map((e) => `${e.method} ${e.path}`);
const fixtureDeprecated = facts.endpoints.filter((e) => e.deprecated).map((e) => `${e.method} ${e.path}`);

describe('REST endpoint drift vs the app (product-facts.json)', () => {
	it('covers every ACTIVE app endpoint (node ⊇ app active set)', () => {
		const missing = fixtureActive.filter((e) => !NODE_ENDPOINTS.includes(e));
		expect(missing, `node is missing endpoints the app exposes: ${missing.join(', ')}`).toEqual([]);
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

	it('exposes exactly the app\'s 29 events', () => {
		expect(nodeAll.length).toBe(29);
		expect([...nodeAll].sort()).toEqual([...facts.webhookEvents.all].sort());
	});

	it('marks exactly the app\'s 9 Free events as unlabelled (Free)', () => {
		expect(nodeFree.length).toBe(9);
		expect([...nodeFree].sort()).toEqual([...facts.webhookEvents.free].sort());
	});
});
