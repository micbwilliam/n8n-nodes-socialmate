import type { IHttpRequestOptions } from 'n8n-workflow';

/**
 * A fake n8n execution context good enough to drive `GenericFunctions`
 * (`socialmateApiRequest` / `socialmateApiRequestAllItems`). It reproduces the
 * two context members the request layer touches — `getCredentials` and
 * `helpers.httpRequestWithAuthentication` — and, crucially, throws HTTP errors
 * shaped the way n8n's real helper does (so `error.statusCode` /
 * `error.response.body` / `error.response.headers` all resolve), so the node's
 * 429-classification and error-mapping run against realistic inputs.
 */
export interface FakeContextOptions {
	baseUrl: string;
	apiKey?: string;
}

interface HttpError extends Error {
	statusCode: number;
	httpCode: number;
	response: { statusCode: number; status: number; body: unknown; data: unknown; headers: Record<string, string> };
}

function makeHttpError(status: number, body: unknown, headers: Record<string, string>): HttpError {
	let message = `HTTP ${status}`;
	if (body && typeof body === 'object') {
		const inner = (body as { error?: unknown }).error;
		if (inner && typeof inner === 'object' && typeof (inner as { message?: unknown }).message === 'string') {
			message = (inner as { message: string }).message;
		} else if (typeof inner === 'string') {
			message = inner;
		}
	}
	const err = new Error(message) as HttpError;
	err.statusCode = status;
	err.httpCode = status;
	err.response = { statusCode: status, status, body, data: body, headers };
	return err;
}

export function makeFakeContext(opts: FakeContextOptions): {
	getCredentials: () => Promise<{ baseUrl: string; apiKey: string }>;
	getNode: () => Record<string, unknown>;
	helpers: {
		httpRequestWithAuthentication: (credName: string, options: IHttpRequestOptions) => Promise<unknown>;
	};
} {
	const apiKey = opts.apiKey ?? 'test-key';

	async function httpRequestWithAuthentication(_credName: string, options: IHttpRequestOptions): Promise<unknown> {
		const u = new URL(options.url as string);
		if (options.qs) {
			for (const [k, v] of Object.entries(options.qs as Record<string, unknown>)) {
				u.searchParams.set(k, String(v));
			}
		}
		const headers: Record<string, string> = { ...((options.headers as Record<string, string>) ?? {}), 'x-api-key': apiKey };
		let bodyInit: string | undefined;
		if (options.body !== undefined) {
			headers['content-type'] = 'application/json';
			bodyInit = JSON.stringify(options.body);
		}
		const res = await fetch(u, { method: options.method ?? 'GET', headers, body: bodyInit });
		const resHeaders: Record<string, string> = {};
		res.headers.forEach((val, k) => {
			resHeaders[k] = val;
		});

		if (options.encoding === 'arraybuffer') {
			const buf = Buffer.from(await res.arrayBuffer());
			if (!res.ok) throw makeHttpError(res.status, buf, resHeaders);
			return buf;
		}
		const text = await res.text();
		let parsed: unknown = {};
		if (text) {
			try {
				parsed = JSON.parse(text);
			} catch {
				parsed = text;
			}
		}
		if (!res.ok) throw makeHttpError(res.status, parsed, resHeaders);
		return parsed;
	}

	return {
		getCredentials: async () => ({ baseUrl: opts.baseUrl, apiKey }),
		getNode: () => ({
			id: 'test-node',
			name: 'SocialMate Test',
			type: 'n8n-nodes-socialmate.socialMate',
			typeVersion: 1,
			position: [0, 0],
			parameters: {},
		}),
		helpers: { httpRequestWithAuthentication },
	};
}
