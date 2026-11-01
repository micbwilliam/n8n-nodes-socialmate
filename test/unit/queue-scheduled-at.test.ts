import { describe, it, expect } from 'vitest';
import type { IHttpRequestOptions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { SocialMate } from '../../nodes/SocialMate/SocialMate.node';

/**
 * Scheduled At on Queue: Enqueue / Queue a Batch. An empty value means "send as
 * soon as possible" (scheduledAt: null). A value that does not parse as a
 * date-time must fail the item — sending null would silently turn a scheduled
 * send into an immediate one.
 */
interface Recorded {
	method: string;
	path: string;
	body?: Record<string, unknown>;
}

async function run(params: Record<string, unknown>): Promise<Recorded[]> {
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
				if (path === '/v1/accounts') return { data: [{ id: 'acc1' }] };
				calls.push({ method: o.method as string, path, ...(o.body ? { body: o.body as Record<string, unknown> } : {}) });
				return { data: { ok: true } };
			},
		},
	};
	await new SocialMate().execute.call(ctx as never);
	return calls;
}

const enqueue = (scheduledAt?: unknown) =>
	run({
		resource: 'queue',
		operation: 'enqueue',
		chatId: '201234567890',
		content: 'hi',
		enqueueOptions: scheduledAt === undefined ? {} : { scheduledAt },
	});

const importBatch = (scheduledAt?: unknown) =>
	run({
		resource: 'queue',
		operation: 'import',
		template: 'Hi {{name}}',
		rows: [{ phone: '201234567890', name: 'A' }],
		importOptions: scheduledAt === undefined ? {} : { scheduledAt },
	});

describe('Queue Scheduled At', () => {
	it('empty / unset Scheduled At sends scheduledAt: null (as soon as possible)', async () => {
		for (const call of [() => enqueue(), () => enqueue(''), () => importBatch(), () => importBatch('')]) {
			const calls = await call();
			expect(calls).toHaveLength(1);
			expect(calls[0].body?.scheduledAt).toBeNull();
		}
	});

	it('a valid date-time is sent as unix ms', async () => {
		const iso = '2030-01-02T03:04:05.000Z';
		const ms = Date.parse(iso);
		expect((await enqueue(iso))[0].body?.scheduledAt).toBe(ms);
		expect((await importBatch(iso))[0].body?.scheduledAt).toBe(ms);
	});

	it('an unparseable Scheduled At fails the item instead of sending now (Enqueue)', async () => {
		let calls: Recorded[] | undefined;
		const err = await enqueue('next tuesday-ish').then(
			(c) => {
				calls = c;
				return undefined;
			},
			(e: unknown) => e,
		);
		expect(calls).toBeUndefined();
		expect(err).toBeInstanceOf(NodeOperationError);
		expect((err as Error).message).toBe('Scheduled At is not a valid date-time');
	});

	it('an unparseable Scheduled At fails the item instead of sending now (Queue a Batch)', async () => {
		await expect(importBatch('not a date')).rejects.toThrow('Scheduled At is not a valid date-time');
		await expect(importBatch('not a date')).rejects.toBeInstanceOf(NodeOperationError);
	});
});
