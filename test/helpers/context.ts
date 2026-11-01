import type { IHttpRequestOptions, INode, JsonObject } from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

/**
 * A fake n8n execution context good enough to drive `GenericFunctions`
 * (`socialmateApiRequest` / `socialmateApiRequestAllItems`). It reproduces the
 * two context members the request layer touches — `getCredentials` and
 * `helpers.httpRequestWithAuthentication` — and throws HTTP failures the way
 * real n8n does.
 *
 * Real n8n (n8n-core `request-helpers/authentication.js`) catches the raw
 * AxiosError from `httpRequest` and throws `new NodeApiError(node, error)`. That
 * wrapper keeps only:
 *   · `httpCode` — the status as a STRING ("429"), or the network code
 *     ("ECONNREFUSED") when there was no response;
 *   · `context.data` — the parsed JSON body;
 *   · `description` — `data.error.message`, when present.
 * It has no `statusCode`, no `response`, and (on current n8n, whose class-field
 * `cause` shadows the native one) no `cause` — so response headers are gone.
 * A node that reads `error.statusCode` / `error.response.body` sees nothing.
 *
 * `errorShape: 'cause'` simulates builds where the native `cause` survived, so
 * `cause.response` is the AxiosError's response (status, data, headers).
 */
export interface FakeContextOptions {
	baseUrl: string;
	apiKey?: string;
	errorShape?: 'n8n' | 'cause';
}

/** Stand-in for axios' AxiosError — NodeApiError detects it by constructor name. */
class AxiosError extends Error {
	readonly isAxiosError = true;
	code?: string;
	status?: number;
	response?: { status: number; statusText: string; data: unknown; headers: Record<string, string> };
	constructor(message: string, code?: string, response?: AxiosError['response']) {
		super(message);
		this.name = 'AxiosError';
		this.code = code;
		if (response) {
			this.response = response;
			this.status = response.status;
		}
	}
}

export const FAKE_NODE: INode = {
	id: 'test-node',
	name: 'SocialMate Test',
	type: 'n8n-nodes-socialmate.socialMate',
	typeVersion: 1,
	position: [0, 0],
	parameters: {},
};

function wrapLikeN8n(axiosError: AxiosError, shape: 'n8n' | 'cause'): NodeApiError {
	const wrapped = new NodeApiError(FAKE_NODE, axiosError as unknown as JsonObject);
	if (shape === 'cause') {
		Object.defineProperty(wrapped, 'cause', { value: axiosError, enumerable: false, configurable: true });
	}
	return wrapped;
}

function makeHttpError(status: number, body: unknown, headers: Record<string, string>, shape: 'n8n' | 'cause'): NodeApiError {
	// axios: 4xx → ERR_BAD_REQUEST, 5xx → ERR_BAD_RESPONSE.
	const code = status >= 500 ? 'ERR_BAD_RESPONSE' : 'ERR_BAD_REQUEST';
	return wrapLikeN8n(
		new AxiosError(`Request failed with status code ${status}`, code, { status, statusText: '', data: body, headers }),
		shape,
	);
}

export function makeFakeContext(opts: FakeContextOptions): {
	getCredentials: () => Promise<{ baseUrl: string; apiKey: string }>;
	getNode: () => INode;
	helpers: {
		httpRequestWithAuthentication: (credName: string, options: IHttpRequestOptions) => Promise<unknown>;
	};
} {
	const apiKey = opts.apiKey ?? 'test-key';
	const shape = opts.errorShape ?? 'n8n';

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
		let res: Response;
		try {
			res = await fetch(u, { method: options.method ?? 'GET', headers, body: bodyInit });
		} catch (e) {
			const netCode = ((e as { cause?: { code?: string } }).cause?.code ?? 'ECONNREFUSED') as string;
			throw wrapLikeN8n(new AxiosError(`connect ${netCode} ${u.host}`, netCode), shape);
		}
		const resHeaders: Record<string, string> = {};
		res.headers.forEach((val, k) => {
			resHeaders[k] = val;
		});

		if (options.encoding === 'arraybuffer') {
			const buf = Buffer.from(await res.arrayBuffer());
			if (!res.ok) throw makeHttpError(res.status, buf, resHeaders, shape);
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
		if (!res.ok) throw makeHttpError(res.status, parsed, resHeaders, shape);
		return parsed;
	}

	return {
		getCredentials: async () => ({ baseUrl: opts.baseUrl, apiKey }),
		getNode: () => FAKE_NODE,
		helpers: { httpRequestWithAuthentication },
	};
}
