import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
	socialmateApiRequest,
	socialmateApiRequestAllItems,
	SocialMateBlockedError,
} from '../../nodes/SocialMate/GenericFunctions';
import { makeFakeContext } from '../helpers/context';
import { startMockServer, type MockServer } from '../helpers/mock-server';

let server: MockServer;
let ctx: ReturnType<typeof makeFakeContext>;

beforeAll(async () => {
	server = await startMockServer();
	ctx = makeFakeContext({ baseUrl: server.url });
});
afterAll(async () => {
	await server.close();
});
beforeEach(() => server.reset());

describe('socialmateApiRequest — envelope + error mapping', () => {
	it('unwraps the { data } success envelope', async () => {
		const res = (await socialmateApiRequest.call(ctx as never, 'GET', '/v1/capabilities')) as { app: string; tier: string };
		expect(res.app).toBe('SocialMate');
		expect(res.tier).toBe('pro');
	});

	it('maps a 402 to a clear "requires Pro" error', async () => {
		await expect(socialmateApiRequest.call(ctx as never, 'GET', '/v1/__pro__')).rejects.toThrow(/Pro.*localMessageCache|localMessageCache/i);
	});
});

describe('unified send — 200 / 202 / 429-block branching', () => {
	it('returns { sent } on a normal 200 send', async () => {
		const res = (await socialmateApiRequest.call(ctx as never, 'POST', '/v1/accounts/acc1/messages', {
			chatId: '15551234567',
			text: 'hello',
		})) as { sent: boolean; messageId: string };
		expect(res.sent).toBe(true);
		expect(res.messageId).toBe('m-1');
	});

	it('surfaces a 202 auto-queue as data (Pro smart-queue)', async () => {
		const res = (await socialmateApiRequest.call(ctx as never, 'POST', '/v1/accounts/acc1/messages', {
			chatId: '15551234567',
			text: '__QUEUE__',
		})) as { queued: boolean; itemId: string };
		expect(res.queued).toBe(true);
		expect(res.itemId).toBe('q-1');
	});

	// ── Bug #1 regression: an anti-ban BLOCK must throw SocialMateBlockedError
	//    immediately and NOT sleep-retry (old code retried 3× on a 3600s
	//    Retry-After → multi-hour hang, then dropped reason/upgrade). ──
	it('throws SocialMateBlockedError on an anti-ban 429 WITHOUT retrying', async () => {
		const started = Date.now();
		let caught: unknown;
		try {
			await socialmateApiRequest.call(ctx as never, 'POST', '/v1/accounts/acc1/messages', {
				chatId: '15551234567',
				text: '__BLOCK_NIGHT__',
			});
		} catch (e) {
			caught = e;
		}
		expect(caught).toBeInstanceOf(SocialMateBlockedError);
		const block = caught as SocialMateBlockedError;
		expect(block.reason).toBe('night_mode');
		expect(block.retryAfterMs).toBe(3_600_000);
		expect(block.upgrade).toEqual({ tier: 'pro', feature: 'apiSmartQueue' });
		// Proof it did NOT retry: exactly one request reached the server…
		expect(server.counts['POST /v1/accounts/acc1/messages']).toBe(1);
		// …and it returned fast rather than sleeping the (capped) Retry-After.
		expect(Date.now() - started).toBeLessThan(1000);
	});
});

describe('per-key rate-limiter 429 — retryable (no reason)', () => {
	it('retries a transient rate_limited 429 and eventually succeeds', async () => {
		const res = (await socialmateApiRequest.call(ctx as never, 'GET', '/v1/__ratelimited__')) as { recovered: boolean };
		expect(res.recovered).toBe(true);
		// Two 429s + one 200 = three requests total.
		expect(server.counts['GET /v1/__ratelimited__']).toBe(3);
	});
});

describe('socialmateApiRequestAllItems — pagination', () => {
	it('pages a proper offset/limit list to completion', async () => {
		const all = await socialmateApiRequestAllItems.call(ctx as never, '/v1/queue/items', {}, true, 0);
		expect(all).toHaveLength(450);
		// 200 + 200 + 50 → three page requests.
		expect(server.counts['GET /v1/queue/items']).toBe(3);
	});

	// ── Bug #2 regression: a bare, NON-paginated array (the /queue/batches
	//    shape) must NOT loop. Old pager re-fetched page 0 forever. ──
	it('does NOT loop on a non-paginated bare array (Get Batches)', async () => {
		const all = await socialmateApiRequestAllItems.call(ctx as never, '/v1/queue/batches', {}, true, 0);
		expect(all).toHaveLength(250);
		// Exactly one request — the missing `pagination` metadata stops the pager.
		expect(server.counts['GET /v1/queue/batches']).toBe(1);
	});
});
