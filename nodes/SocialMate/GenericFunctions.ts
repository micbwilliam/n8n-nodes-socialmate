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
/** Cap any single 429 retry sleep so a large Retry-After can't hang a run. */
const MAX_RETRY_SLEEP_MS = 60_000;

/**
 * Thrown when a message send is refused by the server's anti-ban pipeline
 * (HTTP 429 carrying a `reason`, e.g. `rate_limit` / `cooling` / `night_mode`).
 * This is NOT a transport rate-limit — the send was deliberately blocked — so
 * the request helper never retries it. The Message send operation catches this
 * and surfaces it as a structured `{ blocked: true, ... }` result, parallel to
 * the 200 `{ sent }` and 202 `{ queued }` outcomes, so a workflow can branch on
 * it (e.g. enqueue on Pro) instead of failing or hanging.
 */
export class SocialMateBlockedError extends Error {
	readonly reason: string;
	readonly retryAfterMs: number | null;
	readonly hint?: string;
	readonly upgrade?: unknown;
	constructor(block: { reason: string; retryAfterMs: number | null; hint?: string; upgrade?: unknown; message: string }) {
		super(block.message);
		this.name = 'SocialMateBlockedError';
		this.reason = block.reason;
		this.retryAfterMs = block.retryAfterMs;
		this.hint = block.hint;
		this.upgrade = block.upgrade;
	}
}

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
 * same machine), a server install's public address, or a named-tunnel hostname. The value is simply the
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

/** What the request layer needs to know about a failed request. */
export interface SocialMateErrorInfo {
	/** HTTP status, or 0 when no response arrived. */
	status: number;
	/** Network failure code (ECONNREFUSED, ENOTFOUND, …) when no response arrived. */
	netCode?: string;
	/** Parsed response body (`{}` when there was none, or it was not JSON). */
	body: IDataObject;
	/** The v1.1 error object, `body.error`, when it is an object (else `{}`). */
	inner: IDataObject;
	/** Response headers, lower-cased. Usually empty under real n8n (see below). */
	headers: IDataObject;
	/**
	 * What the response body was: `json` (SocialMate's shape, or any JSON),
	 * `foreign` (a body that arrived and is NOT JSON — an HTML page, plain text,
	 * undecodable bytes) or `none` (no body reached us — e.g. an n8n build whose
	 * error wrapper drops it). Only `foreign` proves another program answered.
	 */
	bodyKind: 'json' | 'foreign' | 'none';
}

/** Classify one raw response-body candidate: JSON, a non-JSON body, or absent. */
export function bodyKindOf(value: unknown): 'json' | 'foreign' | 'none' {
	if (value === undefined || value === null) return 'none';
	if (Buffer.isBuffer(value) || value instanceof ArrayBuffer) {
		return isJsonText(Buffer.from(value as Buffer).toString('utf8')) ? 'json' : 'foreign';
	}
	if (typeof value === 'string') return isJsonText(value) ? 'json' : 'foreign';
	if (typeof value === 'object') return 'json';
	return 'none';
}

export function asObject(value: unknown): IDataObject | undefined {
	// A binary request (Download File) gets its JSON error body as raw bytes.
	if (Buffer.isBuffer(value) || value instanceof ArrayBuffer) return asObject(Buffer.from(value as Buffer).toString('utf8'));
	if (value && typeof value === 'object' && !Array.isArray(value)) return value as IDataObject;
	if (typeof value === 'string' && value.trim().startsWith('{')) {
		try {
			return asObject(JSON.parse(value));
		} catch {
			return undefined;
		}
	}
	return undefined;
}

function isJsonText(text: string): boolean {
	try {
		JSON.parse(text);
		return true;
	} catch {
		return false;
	}
}

function asStatus(value: unknown): number {
	const n = typeof value === 'number' ? value : typeof value === 'string' && /^\d{3}$/.test(value) ? Number(value) : 0;
	return n >= 100 && n <= 599 ? n : 0;
}

/**
 * Read status, body and headers out of whatever `httpRequestWithAuthentication`
 * threw.
 *
 * Real n8n (n8n-core `request-helpers/authentication.js`) never lets the raw
 * AxiosError through: it throws `new NodeApiError(node, axiosError)`. On current
 * n8n that wrapper has no `statusCode`, no `response` and no `cause` (the class
 * field shadows the native one): the status survives only as the STRING
 * `httpCode` ("429" — or "ECONNREFUSED" when nothing answered), the JSON body
 * only as `context.data`, and the headers not at all. Some builds keep the
 * AxiosError on `cause`, and older request helpers threw `{ statusCode,
 * response: { body } }` / `{ error: body }`. Every shape is read here, once, so
 * the classification below never silently sees status 0 and an empty body.
 */
export function readSocialMateError(error: unknown): SocialMateErrorInfo {
	type Loose = {
		statusCode?: unknown;
		status?: unknown;
		httpCode?: unknown;
		code?: unknown;
		error?: unknown;
		response?: { status?: unknown; statusCode?: unknown; data?: unknown; body?: unknown; headers?: unknown };
		cause?: unknown;
		errorResponse?: unknown;
		context?: { data?: unknown };
		description?: unknown;
	};
	const top = (error ?? {}) as Loose;
	const layers = [top, top.cause, top.errorResponse].filter(
		(l): l is Loose => !!l && typeof l === 'object',
	);

	let status = 0;
	let body: IDataObject | undefined;
	let headers: IDataObject | undefined;
	let netCode: string | undefined;
	let bodyKind: 'json' | 'foreign' | 'none' = 'none';
	const noteKind = (value: unknown): void => {
		const kind = bodyKindOf(value);
		if (kind === 'json' || (kind === 'foreign' && bodyKind === 'none')) bodyKind = kind;
	};
	for (const layer of layers) {
		const res = layer.response && typeof layer.response === 'object' ? layer.response : undefined;
		// `layer.error` is left out: it is a legacy body slot on some shapes but a
		// plain message on others, so a string there proves nothing.
		noteKind(res?.data);
		noteKind(res?.body);
		if (asObject(layer.error)) bodyKind = 'json';
		status ||= asStatus(res?.status) || asStatus(res?.statusCode) || asStatus(layer.statusCode) || asStatus(layer.status);
		body ??= asObject(res?.data) ?? asObject(res?.body) ?? asObject(layer.error);
		headers ??= asObject(res?.headers);
		if (!netCode && typeof layer.code === 'string' && /^E[A-Z_]+$/.test(layer.code) && !layer.code.startsWith('ERR_')) {
			netCode = layer.code;
		}
	}
	if (typeof top.httpCode === 'string' || typeof top.httpCode === 'number') {
		const fromHttpCode = asStatus(String(top.httpCode));
		if (!status && fromHttpCode) status = fromHttpCode;
		else if (!fromHttpCode && typeof top.httpCode === 'string' && /^E[A-Z_]+$/.test(top.httpCode)) netCode ??= top.httpCode;
	}
	noteKind(top.context?.data);
	body ??= asObject(top.context?.data) ?? {};
	// Current n8n (NodeApiError over an AxiosError) copies the body to
	// `context.data` ONLY when it is a plain object, and drops a string body
	// entirely. So a wrapper that has the `context` slot but no `data`, whose
	// description is still axios' own "Request failed with status code N" (no
	// body message to lift), got a NON-object body: an HTML/text page. A bare
	// `{ httpCode }` with no context slot stays `none` — that build may simply
	// not carry bodies, and a real SocialMate 401/429 must keep its branch.
	if (
		bodyKind === 'none' &&
		top.context &&
		typeof top.context === 'object' &&
		!('data' in top.context) &&
		typeof top.description === 'string' &&
		/^Request failed with status code \d{3}$/.test(top.description)
	) {
		bodyKind = 'foreign';
	}

	const lowered: IDataObject = {};
	for (const [k, v] of Object.entries(headers ?? {})) lowered[k.toLowerCase()] = v;

	return {
		status,
		netCode: status ? undefined : netCode,
		body,
		inner: asObject(body.error) ?? {},
		headers: lowered,
		bodyKind: status ? bodyKind : 'none',
	};
}

/**
 * Throw a NodeApiError carrying OUR message. It has to be built from a plain
 * object: `new NodeApiError(node, err, { message })` returns `err` untouched
 * when `err` is already a NodeApiError — which, under real n8n, it always is —
 * so the custom message would be dropped and the user would see n8n's generic
 * "Forbidden - perhaps check your credentials?".
 */
function throwApiError(ctx: RequestContext, info: SocialMateErrorInfo, message: string, description?: string): never {
	throw buildApiError(ctx, info, message, description);
}

function buildApiError(ctx: RequestContext, info: SocialMateErrorInfo, message: string, description?: string): NodeApiError {
	const httpCode = info.status ? String(info.status) : undefined;
	const code = typeof info.inner.code === 'string' ? info.inner.code : undefined;
	return new NodeApiError(
		ctx.getNode(),
		{ message, ...(description ? { description } : {}), ...(code ? { code } : {}), ...(httpCode ? { httpCode } : {}) } as JsonObject,
		{ message, description, ...(httpCode ? { httpCode } : {}) },
	);
}

/** Whether a URL's host is this machine's loopback (where a container's 127.0.0.1 is the container itself). */
export function isLoopbackUrl(url: string): boolean {
	try {
		const host = new URL(url).hostname.toLowerCase().replace(/^\[|\]$/g, '');
		return host === 'localhost' || host === '::1' || /^127(\.\d{1,3}){3}$/.test(host);
	} catch {
		return false;
	}
}

/** Whether a URL is a rotating Cloudflare quick tunnel (`*.trycloudflare.com`). */
export function isQuickTunnelUrl(url: string): boolean {
	try {
		const host = new URL(url).hostname.toLowerCase().replace(/\.$/, '');
		return host === 'trycloudflare.com' || host.endsWith('.trycloudflare.com');
	} catch {
		return false;
	}
}

export const DOCKER_LOOPBACK_HINT =
	'If n8n runs in Docker, 127.0.0.1 is the container, not this computer: with Docker Desktop (any OS) use http://host.docker.internal:3456; with Docker Engine on Linux run the n8n container with --network host.';

/**
 * Whether an HTTP error did NOT come from SocialMate, which answers every error
 * as JSON: an empty or non-JSON body is a Cloudflare 530 / 1033 page, Cloudflare
 * Access's 401 login page, a WAF 403, a Cloudflare 1015 429, a proxy's 502/504
 * or another program on the port.
 */
export function isForeignErrorBody(info: SocialMateErrorInfo): boolean {
	// `none` (no body reached us) is NOT foreign: on an n8n build that drops the
	// body, a genuine SocialMate 401/403/429 must keep its status branch + retries.
	return info.status > 0 && info.bodyKind === 'foreign';
}

const NOT_SOCIALMATE = Symbol('socialmate.notSocialMate');

/** Whether an error is the request layer's "something other than SocialMate answered". */
export function isNotSocialMateError(error: unknown): boolean {
	return !!error && typeof error === 'object' && (error as Record<symbol, unknown>)[NOT_SOCIALMATE] === true;
}

/** The "this is not SocialMate" error, for both a foreign error page and a foreign 200 page. */
function throwNotSocialMate(ctx: RequestContext, info: SocialMateErrorInfo, baseUrl: string): never {
	const where = baseUrl || 'the Server URL';
	const status = info.status;
	let error: NodeApiError;
	if (status >= 200 && status < 300) {
		// A 2xx page: the address answers, it is just not the API (the /admin
		// console, n8n's own UI, a captive portal).
		// A 2xx is not an HTTP failure — don't label it with httpCode 200.
		error = buildApiError(
			ctx,
			{ ...info, status: 0 },
			`The Server URL did not return SocialMate JSON (${where}) — point it at the API root (e.g. http://127.0.0.1:3456), not the /admin console or n8n.`,
			isQuickTunnelUrl(baseUrl) ? QUICK_TUNNEL_HINT : undefined,
		);
		(error as unknown as Record<symbol, unknown>)[NOT_SOCIALMATE] = true;
		throw error;
	}
	error = buildApiError(
		ctx,
		info,
		isLoopbackUrl(baseUrl)
			? `SocialMate isn't reachable at ${where} (HTTP ${status}) — something other than SocialMate answered on that port`
			: `SocialMate isn't reachable at ${where} (HTTP ${status}) — if this is a quick-tunnel URL it changed when the app restarted`,
		isQuickTunnelUrl(baseUrl)
			? `${QUICK_TUNNEL_HINT} Update the Server URL in your credential.`
			: 'The answer was not from SocialMate. Check that SocialMate is running with its API on (API & Integrations), and that the Server URL in your credential points at it — a quick-tunnel URL (*.trycloudflare.com) changes on every app start; use a named tunnel (Pro) or a local URL.',
	);
	(error as unknown as Record<symbol, unknown>)[NOT_SOCIALMATE] = true;
	throw error;
}

export const QUICK_TUNNEL_HINT =
	'Quick-tunnel URLs (*.trycloudflare.com) change every time SocialMate starts — use a named tunnel (Pro) or a local URL.';

/** Map a SocialMate / transport error to a clear n8n error. */
function toNodeError(
	ctx: RequestContext,
	error: unknown,
	info: SocialMateErrorInfo = readSocialMateError(error),
	baseUrl = '',
): never {
	const { status, inner, body } = info;
	const serverMessage =
		(typeof inner.message === 'string' && inner.message) || (typeof body.error === 'string' && body.error) || '';
	const errCode = typeof inner.code === 'string' ? inner.code : undefined;

	if (info.netCode === 'ECONNREFUSED' || info.netCode === 'ENOTFOUND' || info.netCode === 'EAI_AGAIN') {
		throwApiError(
			ctx,
			info,
			'Cannot reach the SocialMate server',
			[
				'Check that SocialMate is running, the API is enabled, the tunnel is online, and the Server URL in your credential is correct.',
				info.netCode === 'ECONNREFUSED' && isLoopbackUrl(baseUrl) ? DOCKER_LOOPBACK_HINT : '',
				isQuickTunnelUrl(baseUrl) ? QUICK_TUNNEL_HINT : '',
			]
				.filter((p) => p)
				.join(' '),
		);
	}
	// Before the status branches: a foreign 401 is not "invalid API key", a
	// foreign 403 is not a scope problem.
	if (isForeignErrorBody(info)) throwNotSocialMate(ctx, info, baseUrl);
	if (status === 401) {
		throwApiError(
			ctx,
			info,
			'Authentication failed — invalid or missing API key',
			'Generate a key in SocialMate → API & Integrations and update the credential.',
		);
	}
	if (status === 402) {
		const feature = (inner.feature as string) ?? 'this feature';
		// Say WHAT needs Pro. The server's message names it ("These webhook events
		// require Pro: message.delivered"); the feature key alone can mislead
		// (`webhookMaxEndpoints` also gates which events a Free trigger may pick).
		const generic = `Feature '${feature}' requires a Pro license`;
		throwApiError(
			ctx,
			info,
			serverMessage && serverMessage !== generic
				? `SocialMate Pro required (feature: ${feature}): ${serverMessage}`
				: `This operation requires SocialMate Pro (feature: ${feature})`,
			'Upgrade to Pro in the SocialMate app, or use a Free-tier option.',
		);
	}
	if (status === 403) {
		// Only `insufficient_scope` is about the key's scope. Every other 403 —
		// batch sending switched off, not a group admin, a key scoped to another
		// account, every scoped account suspended on Free — carries its own
		// server message, which says what to do; recreating the key fixes none.
		const required = (inner.required as string) ?? (body.required as string);
		if (errCode === 'insufficient_scope' || (!errCode && required)) {
			throwApiError(
				ctx,
				info,
				`API key is missing the '${required ?? 'a higher'}' scope`,
				'Recreate the key in SocialMate → API & Integrations with the required scope.',
			);
		}
		throwApiError(
			ctx,
			info,
			serverMessage || 'SocialMate refused this request (403)',
			errCode ? `SocialMate error code: ${errCode}` : undefined,
		);
	}
	if (serverMessage) {
		const hint = typeof inner.hint === 'string' ? inner.hint : '';
		const parts = [hint, errCode ? `SocialMate error code: ${errCode}` : ''].filter((p) => p);
		throwApiError(ctx, info, serverMessage, parts.length ? parts.join(' — ') : undefined);
	}
	if (error instanceof NodeApiError) throw error;
	throw new NodeApiError(ctx.getNode(), error as JsonObject);
}

/** The wait a retryable 429 asks for: body `retryAfterMs` (exact), then Retry-After (seconds), then 2s. */
function getRetryDelayMs(info: SocialMateErrorInfo): number {
	const ms = info.inner.retryAfterMs;
	if (typeof ms === 'number' && ms > 0) return ms;
	const retryAfter = info.headers['retry-after'] as string | undefined;
	if (retryAfter && !Number.isNaN(Number(retryAfter))) return Math.max(1, Number(retryAfter)) * 1000;
	return 2000;
}

/**
 * If a 429 is an anti-ban block (its wrapped error carries a `reason`), return
 * the block detail; otherwise null (the transient per-key rate limiter,
 * `{ code:'rate_limited' }` with no `reason`, which IS retryable).
 */
function parseAntiBanBlock(info: SocialMateErrorInfo): {
	reason: string;
	retryAfterMs: number | null;
	hint?: string;
	upgrade?: unknown;
	message: string;
} | null {
	const inner = Object.keys(info.inner).length ? info.inner : info.body;
	const reason = inner.reason;
	if (typeof reason !== 'string' || reason === '') return null;
	const message =
		(typeof inner.message === 'string' && inner.message) ||
		(typeof info.body.error === 'string' && info.body.error) ||
		'Send blocked by anti-ban protection';
	return {
		reason,
		retryAfterMs: typeof inner.retryAfterMs === 'number' ? inner.retryAfterMs : null,
		hint: typeof inner.hint === 'string' ? inner.hint : undefined,
		upgrade: inner.upgrade,
		message,
	};
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
		let response: unknown;
		try {
			response = await this.helpers.httpRequestWithAuthentication.call(
				this,
				SOCIALMATE_CREDENTIAL,
				requestOptions,
			);
		} catch (error) {
			const info = readSocialMateError(error);
			if (info.status === 429 && !isForeignErrorBody(info)) {
				// A 429 is one of three different things:
				//  • an anti-ban SEND BLOCK (carries `reason`/`upgrade`) — the send
				//    was refused, so retrying is wrong; blindly sleeping its
				//    Retry-After (hours for `night_mode`) would hang the run. Surface
				//    it so the Message op can branch on it.
				//  • a SIGNAL-lane limit (`reason:'signal_rate_limit'`, react / mark
				//    read / typing) — nothing was refused for good and the message
				//    budget is untouched, so a short wait is retried like the
				//    per-key limiter. An hourly/daily signal cap (a wait longer
				//    than the retry cap) still fails fast instead of hanging.
				//  • the transient per-key RATE LIMITER (`code:'rate_limited'`, no
				//    `reason`) — genuinely retryable, with a capped backoff.
				const block = parseAntiBanBlock(info);
				const retryableSignal =
					block?.reason === 'signal_rate_limit' && (block.retryAfterMs ?? 0) <= MAX_RETRY_SLEEP_MS;
				if (block && !retryableSignal) throw new SocialMateBlockedError(block);
				if (attempt < MAX_RATE_LIMIT_RETRIES) {
					attempt += 1;
					await sleep(Math.min(getRetryDelayMs(info), MAX_RETRY_SLEEP_MS));
					continue;
				}
			}
			toNodeError(this, error, info, baseUrl);
		}
		if (options.encoding) return response; // raw binary buffer (Download File / Thumbnail)
		// Every SocialMate JSON route answers JSON; a non-empty string that does not
		// parse is another program's 2xx page (n8n, the /admin console, a captive
		// portal) — never hand it to the workflow as data. Checked outside the try
		// so the catch above cannot re-map this error.
		if (typeof response === 'string' && response.trim() !== '' && !isJsonText(response)) {
			throwNotSocialMate(this, { status: 200, body: {}, inner: {}, headers: {}, bodyKind: 'foreign' }, baseUrl);
		}
		return options.returnEnvelope ? response : unwrapEnvelope(response);
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
		// Defense-in-depth: a response with no `pagination` metadata is not
		// offset/limit pageable (e.g. a bare array whose route ignores `offset`).
		// Take the single page and stop — never spin re-fetching page 0.
		if (!pagination) break;
		if (page.length < pageSize) break;
		if (typeof total === 'number' && offset >= total) break;
		if (page.length === 0) break;
	}
	return returnAll || hardLimit <= 0 ? results : results.slice(0, hardLimit);
}

/**
 * Resolve a phone/JID input into the chatId the API expects. Accepts almost
 * any human/CRM phone format — punctuation, a leading `+`, or a `00`
 * international access code — and mirrors the SocialMate server's own
 * `phoneOrGroupToJid` rule so both ends agree.
 *
 *   "+1 (555) 123-4567" → "15551234567"
 *   "0044 20 7946 0958" → "442079460958"           (00 intl prefix dropped)
 *   "12345@g.us"        → "12345@g.us"              (JID passthrough)
 *   "120363…-1609459200" → "120363…-1609459200"     (bare group id preserved)
 */
export function normalizeChatId(input: string): string {
	const value = (input ?? '').trim();
	if (!value) throw new Error('Chat ID / phone number is required');
	if (value.includes('@')) return value; // already a JID (e.g. group@g.us)
	if (/^\d{12,}-\d+$/.test(value)) return value; // bare legacy group id — keep hyphen
	let digits = value.replace(/[^\d]/g, ''); // E.164 digits only for 1:1 chats
	if (digits.startsWith('00')) digits = digits.slice(2); // 00 == leading '+'

	// A number that STILL begins with '0' is a NATIONAL number carrying a trunk
	// prefix, not an E.164 number: "01281839243" is how an Egyptian writes
	// +20 1281839243, and how a Brit writes +44 …. E.164 numbers never begin with
	// 0, so the JID built from it is always wrong — WhatsApp accepts it and the
	// message goes nowhere, silently.
	//
	// We must NOT guess the country: the same trunk prefix belongs to Egypt, the
	// UK, Germany and dozens more, so a wrong guess delivers a real message to a
	// different real person abroad. Fail with something the user can act on.
	//
	// MUST stay mirrored with SM4's `assertSendableRecipient`
	// (src/shared/formatting.ts) — the app and this node have to agree on exactly
	// which recipients are sendable, or a workflow succeeds here and dies there.
	if (digits.startsWith('0')) {
		throw new Error(
			`"${value}" looks like a national number: it starts with a trunk prefix (0) and carries no country code. ` +
				`WhatsApp needs the full international number — drop the leading 0 and add the country code ` +
				`(e.g. 01281839243 in Egypt is +20 1281839243).`,
		);
	}
	if (!digits) throw new Error(`"${value}" is not a WhatsApp recipient. Use a full international phone number (e.g. +20 1281839243) or a group id.`);

	return digits;
}

/** Guard a required string parameter with a clear node error. */
export function assertRequired(ctx: IExecuteFunctions, value: unknown, name: string, itemIndex: number): string {
	if (value === undefined || value === null || value === '') {
		throw new NodeOperationError(ctx.getNode(), `Parameter "${name}" is required`, { itemIndex });
	}
	return String(value);
}
