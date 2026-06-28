import type {
	IDataObject,
	IExecuteFunctions,
	IHookFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	IPollFunctions,
	IWebhookFunctions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeOperationError, sleep } from 'n8n-workflow';

export const SOCIALMATE_CREDENTIAL = 'socialMateApi';
const DEFAULT_LOCAL_URL = 'http://127.0.0.1:3456';
const MAX_RATE_LIMIT_RETRIES = 3;

type RequestContext =
	| IExecuteFunctions
	| ILoadOptionsFunctions
	| IHookFunctions
	| IWebhookFunctions
	| IPollFunctions;

/** Strip whitespace + trailing slashes and ensure a scheme is present. */
export function normalizeBaseUrl(raw?: string | null): string {
	let url = (raw ?? '').trim();
	if (!url) return '';
	if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
	return url.replace(/\/+$/, '');
}

/**
 * Resolve the base URL for this run.
 *
 * Only stable addresses are supported: a localhost address (app + n8n on the
 * same machine) or a named-tunnel hostname. The value is simply the
 * credential's Server URL (normalised), or the localhost default. Rotating
 * quick tunnels (*.trycloudflare.com) are intentionally NOT supported — their
 * URL changes on every restart and would leave a stored credential stale.
 */
export async function resolveBaseUrl(this: RequestContext): Promise<string> {
	const creds = await this.getCredentials(SOCIALMATE_CREDENTIAL);
	return normalizeBaseUrl(creds.baseUrl as string) || DEFAULT_LOCAL_URL;
}

/** Unwrap the SocialMate v1.1 response envelope (`{ data: ... }`). */
function unwrapEnvelope(body: unknown): unknown {
	if (body && typeof body === 'object' && 'data' in (body as IDataObject) && !('error' in (body as IDataObject))) {
		return (body as IDataObject).data;
	}
	return body;
}

/** Map a SocialMate / transport error to a clear n8n error. */
function toNodeError(ctx: RequestContext, error: unknown): never {
	const err = error as {
		statusCode?: number;
		httpCode?: number | string;
		response?: { statusCode?: number; status?: number; body?: unknown; data?: unknown };
		cause?: { code?: string };
		code?: string;
		message?: string;
	};
	const status =
		err.statusCode ??
		err.response?.statusCode ??
		err.response?.status ??
		(typeof err.httpCode === 'number' ? err.httpCode : Number(err.httpCode)) ??
		0;
	const rawBody = (err.response?.body ?? err.response?.data ?? {}) as IDataObject;
	const inner = (rawBody.error ?? {}) as IDataObject;
	const code = err.cause?.code ?? err.code;

	if (code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
		throw new NodeApiError(ctx.getNode(), error as JsonObject, {
			message: 'Cannot reach the SocialMate server',
			description:
				'Check that SocialMate is running, the API is enabled, the tunnel is online, and the Server URL in your credential is correct.',
		});
	}
	if (status === 401) {
		throw new NodeApiError(ctx.getNode(), error as JsonObject, {
			message: 'Authentication failed — invalid or missing API key',
			description: 'Generate a key in SocialMate → Settings → API and update the credential.',
		});
	}
	if (status === 402) {
		const feature = (inner.feature as string) ?? 'this feature';
		throw new NodeApiError(ctx.getNode(), error as JsonObject, {
			message: `This operation requires SocialMate Pro (feature: ${feature})`,
			description: 'Upgrade to Pro in the SocialMate app, or use a Free-tier operation.',
		});
	}
	if (status === 403) {
		const required = (rawBody.required as string) ?? (inner.required as string) ?? 'a higher';
		throw new NodeApiError(ctx.getNode(), error as JsonObject, {
			message: `API key is missing the '${required}' scope`,
			description: 'Recreate the key in SocialMate → Settings → API with the required scope.',
		});
	}
	throw new NodeApiError(ctx.getNode(), error as JsonObject);
}

/** Read a Retry-After value (seconds) or the body's retryAfterMs from a 429. */
function getRetryDelayMs(error: unknown): number {
	const err = error as { response?: { headers?: IDataObject; body?: IDataObject } };
	const headers = err.response?.headers ?? {};
	const retryAfter = (headers['retry-after'] ?? headers['Retry-After']) as string | undefined;
	if (retryAfter && !Number.isNaN(Number(retryAfter))) return Math.max(1, Number(retryAfter)) * 1000;
	const inner = (err.response?.body?.error ?? {}) as IDataObject;
	const ms = inner.retryAfterMs as number | undefined;
	if (typeof ms === 'number' && ms > 0) return ms;
	return 2000;
}

interface SocialMateRequestOptions {
	/** Return the full envelope (`{ data, pagination }`) instead of unwrapping. */
	returnEnvelope?: boolean;
	/** Expect a binary/stream response (e.g. media file). */
	encoding?: 'arraybuffer';
	/** Extra headers (e.g. Range). */
	headers?: IDataObject;
}

/**
 * Core request helper. Authenticates via the SocialMate credential — the
 * `x-api-key` header is injected from the credential's `authenticate`
 * definition, never set manually here — resolves the base URL per-run, retries
 * on 429 honoring Retry-After, unwraps the v1.1 envelope, and maps errors to
 * friendly messages. Returns `data` by default.
 */
export async function socialmateApiRequest(
	this: RequestContext,
	method: IHttpRequestMethods,
	endpoint: string,
	body: IDataObject = {},
	qs: IDataObject = {},
	options: SocialMateRequestOptions = {},
): Promise<any> {
	const baseUrl = await resolveBaseUrl.call(this);

	const requestOptions: IHttpRequestOptions = {
		method,
		url: `${baseUrl}${endpoint}`,
		headers: {
			...(options.encoding ? {} : { Accept: 'application/json' }),
			...(options.headers ?? {}),
		},
		json: !options.encoding,
		returnFullResponse: false,
	};
	if (options.encoding) requestOptions.encoding = options.encoding;
	if (Object.keys(qs).length) requestOptions.qs = qs;
	if (Object.keys(body).length && method !== 'GET' && method !== 'DELETE') requestOptions.body = body;

	let attempt = 0;
	// eslint-disable-next-line no-constant-condition
	while (true) {
		try {
			const response = await this.helpers.httpRequestWithAuthentication.call(
				this,
				SOCIALMATE_CREDENTIAL,
				requestOptions,
			);
			if (options.encoding) return response; // raw binary buffer
			return options.returnEnvelope ? response : unwrapEnvelope(response);
		} catch (error) {
			const status =
				(error as { statusCode?: number }).statusCode ??
				(error as { response?: { statusCode?: number } }).response?.statusCode ??
				0;
			if (status === 429 && attempt < MAX_RATE_LIMIT_RETRIES) {
				attempt += 1;
				await sleep(getRetryDelayMs(error));
				continue;
			}
			toNodeError(this, error);
		}
	}
}

/**
 * Page through an offset/limit list endpoint until `pagination.total` is
 * reached (or `limit` items collected). SocialMate list responses are
 * `{ data: [...], pagination: { limit, offset, total } }`.
 */
export async function socialmateApiRequestAllItems(
	this: RequestContext,
	endpoint: string,
	qs: IDataObject = {},
	returnAll = true,
	hardLimit = 0,
): Promise<IDataObject[]> {
	const results: IDataObject[] = [];
	const pageSize = 200;
	let offset = 0;

	// eslint-disable-next-line no-constant-condition
	while (true) {
		const envelope = (await socialmateApiRequest.call(this, 'GET', endpoint, {}, { ...qs, limit: pageSize, offset }, {
			returnEnvelope: true,
		})) as IDataObject;
		const data = (envelope.data ?? envelope) as IDataObject[];
		const page = Array.isArray(data) ? data : [];
		results.push(...page);

		const pagination = envelope.pagination as { total?: number } | undefined;
		const total = pagination?.total;
		offset += page.length;

		if (!returnAll && hardLimit > 0 && results.length >= hardLimit) {
			return results.slice(0, hardLimit);
		}
		if (page.length < pageSize) break;
		if (typeof total === 'number' && offset >= total) break;
		if (page.length === 0) break;
	}
	return returnAll || hardLimit <= 0 ? results : results.slice(0, hardLimit);
}

/** Resolve a phone/JID input into the chatId the API expects (digits or JID). */
export function normalizeChatId(input: string): string {
	const value = (input ?? '').trim();
	if (!value) throw new Error('Chat ID / phone number is required');
	if (value.includes('@')) return value; // already a JID (e.g. group@g.us)
	return value.replace(/[^\d]/g, ''); // E.164 digits only for 1:1 chats
}

/** Guard a required string parameter with a clear node error. */
export function assertRequired(ctx: IExecuteFunctions, value: unknown, name: string, itemIndex: number): string {
	if (value === undefined || value === null || value === '') {
		throw new NodeOperationError(ctx.getNode(), `Parameter "${name}" is required`, { itemIndex });
	}
	return String(value);
}
