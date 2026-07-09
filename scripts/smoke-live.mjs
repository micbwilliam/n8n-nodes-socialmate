#!/usr/bin/env node
/**
 * Opt-in LIVE smoke test against a running SocialMate app. This is NOT part of
 * `npm test` (it needs a real app + a linked WhatsApp account) — run it by hand
 * before a release to confirm the node's requests work end-to-end.
 *
 *   SOCIALMATE_BASE_URL=http://127.0.0.1:3456 \
 *   SOCIALMATE_API_KEY=sm_live_xxx \
 *   [SOCIALMATE_SEND_TO=15551234567] \        # optional: self-number to text
 *   node scripts/smoke-live.mjs
 *
 * It exercises read endpoints on every tier, then (only if SOCIALMATE_SEND_TO is
 * set) sends one plain-text message so you can confirm delivery on your phone.
 */

const BASE = (process.env.SOCIALMATE_BASE_URL || 'http://127.0.0.1:3456').replace(/\/+$/, '');
const KEY = process.env.SOCIALMATE_API_KEY;
const SEND_TO = process.env.SOCIALMATE_SEND_TO;

if (!KEY) {
	console.error('✖ SOCIALMATE_API_KEY is required. Generate one in SocialMate → API & Integrations.');
	process.exit(2);
}

let failures = 0;

async function call(method, path, body) {
	const res = await fetch(`${BASE}${path}`, {
		method,
		headers: { 'x-api-key': KEY, ...(body ? { 'content-type': 'application/json' } : {}) },
		body: body ? JSON.stringify(body) : undefined,
	});
	const text = await res.text();
	let json;
	try {
		json = text ? JSON.parse(text) : {};
	} catch {
		json = text;
	}
	return { status: res.status, json };
}

function unwrap(json) {
	return json && typeof json === 'object' && 'data' in json ? json.data : json;
}

async function step(label, fn) {
	try {
		const out = await fn();
		console.log(`✔ ${label}${out ? ` — ${out}` : ''}`);
	} catch (e) {
		failures++;
		console.error(`✖ ${label} — ${e.message}`);
	}
}

console.log(`SocialMate live smoke → ${BASE}\n`);

let accountId;

await step('GET /v1/capabilities', async () => {
	const { status, json } = await call('GET', '/v1/capabilities');
	if (status !== 200) throw new Error(`status ${status} — ${JSON.stringify(json)}`);
	const caps = unwrap(json);
	return `tier=${caps.tier} accounts=${(caps.accounts || []).length}`;
});

await step('GET /v1/accounts', async () => {
	const { status, json } = await call('GET', '/v1/accounts');
	if (status !== 200) throw new Error(`status ${status}`);
	const accounts = unwrap(json) || [];
	if (!accounts.length) throw new Error('no accounts in this key’s scope');
	accountId = accounts[0].id;
	return `first account = ${accountId} (${accounts[0].state ?? '?'})`;
});

await step('GET /v1/accounts/:id/chats', async () => {
	if (!accountId) throw new Error('skipped (no account)');
	const { status, json } = await call('GET', `/v1/accounts/${accountId}/chats`);
	if (status !== 200) throw new Error(`status ${status}`);
	return `${(unwrap(json) || []).length} chats`;
});

if (SEND_TO) {
	await step(`POST /v1/accounts/:id/messages → ${SEND_TO}`, async () => {
		if (!accountId) throw new Error('skipped (no account)');
		const { status, json } = await call('POST', `/v1/accounts/${accountId}/messages`, {
			chatId: SEND_TO,
			text: `SocialMate n8n smoke test ✅ (${new Date().toISOString()})`,
		});
		const data = unwrap(json);
		if (status === 200 && data.sent) return `sent, messageId=${data.messageId}`;
		if (status === 202 && data.queued) return `auto-queued (Pro), itemId=${data.itemId}`;
		if (status === 429) return `blocked by anti-ban (reason=${data?.error?.reason ?? data.reason ?? '?'}) — expected on Free / during cooldown`;
		throw new Error(`unexpected status ${status} — ${JSON.stringify(json)}`);
	});
} else {
	console.log('… (set SOCIALMATE_SEND_TO=<your number> to also test a live send)');
}

console.log(`\n${failures ? `✖ ${failures} check(s) failed` : '✔ all checks passed'}`);
process.exit(failures ? 1 : 0);
