import type {
	ICredentialsDecrypted,
	ICredentialTestFunctions,
	IDataObject,
	INodeCredentialTestResult,
} from 'n8n-workflow';

import {
	asObject,
	bodyKindOf,
	DOCKER_LOOPBACK_HINT,
	isLoopbackUrl,
	isQuickTunnelUrl,
	normalizeBaseUrl,
	QUICK_TUNNEL_HINT,
	readSocialMateError,
} from '../GenericFunctions';

type LegacyRequest = (options: IDataObject) => Promise<unknown>;

const API_ROOT_HINT =
	"Use the API address: http://127.0.0.1:3456 on the same machine, the server's public address (e.g. https://socialmate.example.com), or your named-tunnel hostname (Pro)";

/**
 * The TLS layer met a plain-HTTP answer ("packet length too long" / "wrong
 * version number"). Not every EPROTO / ERR_SSL_*: a handshake alert or a
 * certificate problem on a real HTTPS host also carries those codes, and
 * telling that user to switch to http:// would be wrong.
 */
function isPlainHttpOnTls(error: unknown, code: string | undefined): boolean {
	if (code === 'ERR_SSL_PACKET_LENGTH_TOO_LONG' || code === 'ERR_SSL_WRONG_VERSION_NUMBER') return true;
	const message = String((error as { message?: unknown })?.message ?? '');
	return /packet length too long|wrong version number/i.test(message);
}

/**
 * The credential "Test" button.
 *
 * A declarative test (GET /v1/capabilities, no rules) passed for ANY server
 * that answered 2xx — and the /admin console and n8n's own UI both answer every
 * path with a 200 HTML page. The user got a green test, then baffling errors on
 * every node. This check requires the SocialMate handshake itself
 * (`app: 'SocialMate'`), names the /admin mistake, and warns when the key cannot
 * register the Trigger's webhook.
 */
export async function testSocialMateConnection(
	rawBaseUrl: string,
	apiKey: string,
	request: LegacyRequest,
): Promise<INodeCredentialTestResult> {
	const base = normalizeBaseUrl(rawBaseUrl);
	if (!base) return { status: 'Error', message: `Enter the Server URL. ${API_ROOT_HINT}.` };

	let pathname = '';
	try {
		pathname = new URL(base).pathname;
	} catch {
		return { status: 'Error', message: `"${rawBaseUrl}" is not a valid URL. ${API_ROOT_HINT}.` };
	}
	if (/\/v1$/i.test(pathname)) {
		return {
			status: 'Error',
			message: `Remove /v1 from the end of the Server URL — the node adds it to every call. Use ${base.replace(/\/v1$/i, '')}.`,
		};
	}
	if (/(^|\/)admin(\/|$)/i.test(pathname)) {
		return {
			status: 'Error',
			message: `This is the SocialMate admin console address. Use the server root without /admin (e.g. ${base.replace(/\/admin(\/.*)?$/i, '')}).`,
		};
	}

	// Refused even when it answers right now: the saved credential would break on
	// the next app start, when the quick tunnel comes up under a new hostname.
	if (isQuickTunnelUrl(base)) {
		return { status: 'Error', message: `${QUICK_TUNNEL_HINT} ${API_ROOT_HINT}.` };
	}

	let response: { statusCode?: number; body?: unknown };
	try {
		response = (await request({
			method: 'GET',
			uri: `${base}/v1/capabilities`,
			headers: { 'x-api-key': apiKey, Accept: 'application/json' },
			json: true,
			simple: false,
			resolveWithFullResponse: true,
			timeout: 15_000,
		})) as { statusCode?: number; body?: unknown };
	} catch (error) {
		const info = readSocialMateError(error);
		const code = info.netCode ?? (error as { code?: string }).code;
		if (code === 'ECONNREFUSED') {
			return {
				status: 'Error',
				message: `${base} refused the connection. Check that SocialMate is running and its local API is on (API & Integrations).${isLoopbackUrl(base) ? ` ${DOCKER_LOOPBACK_HINT}` : ''}`,
			};
		}
		if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
			return { status: 'Error', message: `Cannot resolve the host in ${base}. Check the Server URL.` };
		}
		if (base.startsWith('https://') && isPlainHttpOnTls(error, code)) {
			const implicit = !/^\s*https:\/\//i.test(rawBaseUrl);
			return {
				status: 'Error',
				message: `${implicit ? 'The Server URL has no http:// or https://, so https:// was assumed — but this' : 'This'} address answers plain HTTP, not HTTPS. Use ${base.replace(/^https:\/\//, 'http://')}.`,
			};
		}
		return { status: 'Error', message: `Cannot reach SocialMate at ${base}: ${(error as Error).message}` };
	}

	const status = Number(response?.statusCode ?? 0);
	const body = asObject(response?.body) ?? {};
	const inner = asObject(body.error) ?? {};
	const serverMessage = typeof inner.message === 'string' ? inner.message : '';

	if (status >= 400 && bodyKindOf(response?.body) === 'foreign') {
		// SocialMate answers every error as JSON; an HTML/empty body is a proxy
		// (502/504), Cloudflare (530 / error 1033, an Access login 401, a WAF 403)
		// or another program on the port. Checked before 401/403, which would
		// otherwise blame the API key.
		return {
			status: 'Error',
			message: `SocialMate isn't reachable at ${base} (HTTP ${status}) — the answer did not come from SocialMate. Check that the app is running with its API on (API & Integrations) and that the Server URL points at it.`,
		};
	}
	if (status === 401) {
		return {
			status: 'Error',
			message: `Authorization failed — the API key was rejected${serverMessage ? ` (${serverMessage})` : ''}. Generate a key in SocialMate → API & Integrations.`,
		};
	}
	if (status === 403) {
		return { status: 'Error', message: serverMessage || 'SocialMate refused this API key (403).' };
	}

	const payload = asObject(body.data) ?? body;
	if (status >= 200 && status < 300 && payload.app === 'SocialMate') {
		const tier = typeof payload.tier === 'string' ? payload.tier : 'unknown';
		const version = typeof payload.version === 'string' ? ` ${payload.version}` : '';
		let message = `Connected to SocialMate${version} (${tier} tier).`;
		// The Trigger registers its webhook with POST /v1/webhooks (admin scope).
		// Reading the per-tool `available` flags from capabilities is not enough:
		// on Free every admin tool is ALSO tier-gated, so `available: false` can't
		// tell "no admin scope" from "not Pro". GET /v1/webhooks needs the same
		// admin scope on every tier and changes nothing, so ask it directly.
		if ((await probeAdminScope(base, apiKey, request)) === false) {
			message += ' This key has no admin scope, so the SocialMate Trigger cannot register its webhook; actions still work. Create an admin-scope key in SocialMate → API & Integrations if you use the Trigger.';
		}
		return { status: 'OK', message };
	}

	if (status >= 200 && status < 300) {
		return {
			status: 'Error',
			message: `This URL answered, but it is not a SocialMate server. ${API_ROOT_HINT} — not the /admin console or n8n's own address.`,
		};
	}
	return {
		status: 'Error',
		message: `SocialMate answered HTTP ${status || 'with no status'}${serverMessage ? `: ${serverMessage}` : ''}.`,
	};
}

/**
 * Whether the key has admin scope: `false` only on the server's explicit
 * 403 `insufficient_scope`; `true` on 2xx; `undefined` when the probe could not
 * tell (network error, an older server, anything else) — then we stay silent.
 */
async function probeAdminScope(base: string, apiKey: string, request: LegacyRequest): Promise<boolean | undefined> {
	try {
		const res = (await request({
			method: 'GET',
			uri: `${base}/v1/webhooks`,
			headers: { 'x-api-key': apiKey, Accept: 'application/json' },
			json: true,
			simple: false,
			resolveWithFullResponse: true,
			timeout: 15_000,
		})) as { statusCode?: number; body?: unknown };
		const status = Number(res?.statusCode ?? 0);
		if (status >= 200 && status < 300) return true;
		if (status === 403) {
			// v1.1 envelope `{ error: { code, required } }`, or the flat legacy shape.
			const body = asObject(res?.body) ?? {};
			const inner = asObject(body.error) ?? body;
			const code = typeof body.error === 'string' ? body.error : inner.code;
			return code === 'insufficient_scope' && (inner.required ?? 'admin') === 'admin' ? false : undefined;
		}
		return undefined;
	} catch {
		return undefined;
	}
}

/** `methods.credentialTest.socialMateApiTest` — wired via `testedBy` on both nodes. */
export async function socialMateApiTest(
	this: ICredentialTestFunctions,
	credential: ICredentialsDecrypted,
): Promise<INodeCredentialTestResult> {
	const data = (credential.data ?? {}) as IDataObject;
	return testSocialMateConnection(String(data.baseUrl ?? ''), String(data.apiKey ?? ''), (options) =>
		this.helpers.request(options),
	);
}
