import { describe, it, expect } from 'vitest';
import { createHmac } from 'crypto';
import { SocialMateTrigger } from '../../nodes/SocialMateTrigger/SocialMateTrigger.node';

// Mirrors the app's webhook-signature scheme: sha256= HMAC over
// `${timestamp}.${rawBody}` with headers x-socialmate-signature /
// x-socialmate-timestamp. If this drifts, every verified delivery 401s.
const SECRET = 'a'.repeat(48);

function sign(timestamp: string, rawBody: string): string {
	return 'sha256=' + createHmac('sha256', SECRET).update(`${timestamp}.${rawBody}`).digest('hex');
}

interface Captured {
	status?: number;
	json?: unknown;
}

function makeWebhookCtx(opts: {
	rawBody: string;
	body: Record<string, unknown>;
	signature: string;
	timestamp: string;
	verifySignature?: boolean;
	filterAccountId?: string;
	secret?: string;
}): { ctx: Record<string, unknown>; captured: Captured } {
	const captured: Captured = {};
	const ctx = {
		getRequestObject: () => ({ rawBody: opts.rawBody }),
		getHeaderData: () => ({
			'x-socialmate-signature': opts.signature,
			'x-socialmate-timestamp': opts.timestamp,
		}),
		getBodyData: () => opts.body,
		getNodeParameter: (name: string, fallback: unknown) =>
			name === 'options'
				? {
						verifySignature: opts.verifySignature ?? true,
						...(opts.filterAccountId ? { accountId: opts.filterAccountId } : {}),
				  }
				: fallback,
		getWorkflowStaticData: () => ({ secret: opts.secret ?? SECRET }),
		getResponseObject: () => ({
			status: (code: number) => {
				captured.status = code;
				return { json: (payload: unknown) => (captured.json = payload) };
			},
		}),
		helpers: { returnJsonArray: (arr: unknown[]) => arr.map((json) => ({ json })) },
	};
	return { ctx, captured };
}

describe('SocialMateTrigger.webhook — HMAC signature verification', () => {
	const trigger = new SocialMateTrigger();
	const timestamp = '1700000000000';
	const body = { version: 1, event: 'message.received', data: { accountId: 'acc1', body: 'hi' } };
	const rawBody = JSON.stringify(body);

	it('accepts a correctly signed delivery', async () => {
		const { ctx } = makeWebhookCtx({ rawBody, body, timestamp, signature: sign(timestamp, rawBody) });
		const res = await trigger.webhook.call(ctx as never);
		expect(res.workflowData).toBeDefined();
		expect(res.noWebhookResponse).toBeUndefined();
	});

	it('rejects a tampered signature with 401 (same length → exercises timingSafeEqual)', async () => {
		const good = sign(timestamp, rawBody);
		// Flip the last hex char, keep the length identical.
		const bad = good.slice(0, -1) + (good.endsWith('0') ? '1' : '0');
		const { ctx, captured } = makeWebhookCtx({ rawBody, body, timestamp, signature: bad });
		const res = await trigger.webhook.call(ctx as never);
		expect(res.noWebhookResponse).toBe(true);
		expect(captured.status).toBe(401);
		expect(captured.json).toEqual({ error: 'invalid_signature' });
	});

	it('rejects a body whose rawBody was altered after signing', async () => {
		const sig = sign(timestamp, rawBody);
		const tamperedRaw = JSON.stringify({ ...body, data: { accountId: 'attacker' } });
		const { ctx, captured } = makeWebhookCtx({ rawBody: tamperedRaw, body, timestamp, signature: sig });
		const res = await trigger.webhook.call(ctx as never);
		expect(res.noWebhookResponse).toBe(true);
		expect(captured.status).toBe(401);
	});

	it('drops events for a non-matching account filter (signature off)', async () => {
		const { ctx } = makeWebhookCtx({
			rawBody,
			body,
			timestamp,
			signature: '',
			verifySignature: false,
			filterAccountId: 'other-account',
		});
		const res = await trigger.webhook.call(ctx as never);
		expect(res.workflowData).toEqual([]);
	});
});
