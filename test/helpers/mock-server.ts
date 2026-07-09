import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'http';
import type { AddressInfo } from 'net';

/**
 * A tiny in-process mock of the SocialMate (SM4) API that reproduces the parts
 * of the contract the node's request layer depends on:
 *
 *  • the v1.1 `{ data }` success envelope and `{ error: { code, message, … } }`
 *    error envelope,
 *  • the unified send's three outcomes — 200 `{ sent }`, 202 `{ queued }`, and a
 *    429 anti-ban BLOCK (carries `reason`/`upgrade`),
 *  • the transient per-key rate-limiter 429 (`code:'rate_limited'`, NO `reason`)
 *    that IS retryable,
 *  • an offset/limit paginated list (`/v1/queue/items`) vs a bare, NON-paginated
 *    array (`/v1/queue/batches`) — the shape that used to hang the pager,
 *  • a 402 Pro-gate.
 *
 * It records how many requests each path received so tests can prove the node
 * did (or did NOT) retry.
 */
export interface MockServer {
	url: string;
	/** requests received, keyed by `METHOD path` (no query string). */
	counts: Record<string, number>;
	reset(): void;
	close(): Promise<void>;
}

const PAGE_TOTAL_ITEMS = 450; // /v1/queue/items pages this many
const BATCH_COUNT = 250; // /v1/queue/batches returns this many in ONE bare array

export async function startMockServer(): Promise<MockServer> {
	const counts: Record<string, number> = {};

	const server: Server = createServer((req: IncomingMessage, res: ServerResponse) => {
		const method = (req.method ?? 'GET').toUpperCase();
		const parsed = new URL(req.url ?? '/', 'http://localhost');
		const path = parsed.pathname;
		const key = `${method} ${path}`;
		counts[key] = (counts[key] ?? 0) + 1;

		const chunks: Buffer[] = [];
		req.on('data', (c) => chunks.push(c as Buffer));
		req.on('end', () => {
			let body: Record<string, unknown> = {};
			if (chunks.length) {
				try {
					body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
				} catch {
					body = {};
				}
			}
			route(method, path, parsed, body, counts, res);
		});
	});

	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const port = (server.address() as AddressInfo).port;

	return {
		url: `http://127.0.0.1:${port}`,
		counts,
		reset() {
			for (const k of Object.keys(counts)) delete counts[k];
		},
		close: () =>
			new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve()))),
	};
}

function sendJson(res: ServerResponse, status: number, payload: unknown, headers: Record<string, string> = {}): void {
	const s = JSON.stringify(payload);
	res.writeHead(status, { 'content-type': 'application/json', ...headers });
	res.end(s);
}

/** v1.1 success envelope. */
function ok(res: ServerResponse, data: unknown, status = 200): void {
	sendJson(res, status, { data });
}

/** v1.1 error envelope: `{ error: { code, message, ...extra } }`. */
function err(
	res: ServerResponse,
	status: number,
	code: string,
	message: string,
	extra: Record<string, unknown> = {},
	headers: Record<string, string> = {},
): void {
	sendJson(res, status, { error: { code, message, ...extra } }, headers);
}

function route(
	method: string,
	path: string,
	parsed: URL,
	body: Record<string, unknown>,
	counts: Record<string, number>,
	res: ServerResponse,
): void {
	// ── Handshake / reads ──────────────────────────────────────────────────
	if (method === 'GET' && path === '/v1/capabilities') {
		return ok(res, { app: 'SocialMate', version: '1.0.0-test', tier: 'pro', features: {}, keyScope: 'admin', accounts: [{ id: 'acc1' }] });
	}
	if (method === 'GET' && path === '/v1/accounts') {
		return ok(res, [{ id: 'acc1', name: 'Test', state: 'connected' }]);
	}

	// ── Unified send: 200 sent / 202 queued / 429 anti-ban BLOCK ────────────
	if (method === 'POST' && /^\/v1\/accounts\/[^/]+\/messages$/.test(path)) {
		const text = String(body.text ?? '');
		const chatId = String(body.chatId ?? '');
		if (text === '__BLOCK_NIGHT__') {
			// Anti-ban block — huge Retry-After (as `night_mode` would be). The
			// node MUST surface this as SocialMateBlockedError and NOT sleep-retry.
			return err(
				res,
				429,
				'rate_limited',
				'Sending is paused during quiet hours',
				{
					reason: 'night_mode',
					retryAfterMs: 3_600_000,
					hint: 'Upgrade to Pro to auto-queue this send and deliver it when quiet hours end.',
					upgrade: { tier: 'pro', feature: 'apiSmartQueue' },
				},
				{ 'retry-after': '3600' },
			);
		}
		if (text === '__QUEUE__') {
			return ok(res, { queued: true, itemId: 'q-1', reason: 'rate_limit', retryAfterMs: 30_000, priority: 2 }, 202);
		}
		return ok(res, { sent: true, messageId: 'm-1', chatId, timestamp: 1_700_000_000_000, status: 'sent' });
	}

	// ── Transient per-key rate-limiter that clears after 2 tries ────────────
	// First two GETs → 429 rate_limited (no `reason` → retryable); then 200.
	if (method === 'GET' && path === '/v1/__ratelimited__') {
		const hits = counts['GET /v1/__ratelimited__'];
		if (hits <= 2) {
			return err(res, 429, 'rate_limited', 'Per-key request rate exceeded', { retryAfterMs: 5 });
		}
		return ok(res, { recovered: true, hits });
	}

	// ── 402 Pro gate ────────────────────────────────────────────────────────
	if (method === 'GET' && path === '/v1/__pro__') {
		return err(res, 402, 'license_required', 'This feature requires Pro', { feature: 'localMessageCache', tier: 'pro' });
	}

	// ── Paginated list (offset/limit + pagination.total) ────────────────────
	if (method === 'GET' && path === '/v1/queue/items') {
		const limit = Number(parsed.searchParams.get('limit') ?? '200');
		const offset = Number(parsed.searchParams.get('offset') ?? '0');
		const slice = [];
		for (let i = offset; i < Math.min(offset + limit, PAGE_TOTAL_ITEMS); i++) slice.push({ id: `item-${i}` });
		return sendJson(res, 200, { data: slice, pagination: { limit, offset, total: PAGE_TOTAL_ITEMS } });
	}

	// ── Bare, NON-paginated array (the /queue/batches shape) ────────────────
	// No `pagination`, ignores offset. A naive offset-pager would loop forever.
	if (method === 'GET' && path === '/v1/queue/batches') {
		const batches = [];
		for (let i = 0; i < BATCH_COUNT; i++) batches.push({ id: `batch-${i}` });
		return ok(res, batches);
	}

	// ── Fallback ─────────────────────────────────────────────────────────────
	return err(res, 404, 'not_found', `No mock route for ${method} ${path}`);
}
