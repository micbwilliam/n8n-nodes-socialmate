import type {
	ICredentialsDecrypted,
	ICredentialTestFunctions,
	IDataObject,
	INodeCredentialTestResult,
} from 'n8n-workflow';

import { asObject, normalizeBaseUrl, readSocialMateError } from '../GenericFunctions';

type LegacyRequest = (options: IDataObject) => Promise<unknown>;

const API_ROOT_HINT = 'Use the API address, e.g. http://127.0.0.1:3456 or your named-tunnel hostname';

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
	if (/(^|\/)admin(\/|$)/i.test(pathname)) {
		return {
			status: 'Error',
			message: `This is the SocialMate admin console address. Use the server root without /admin (e.g. ${base.replace(/\/admin(\/.*)?$/i, '')}).`,
		};
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
				message: `${base} refused the connection. Check that SocialMate is running and its local API is on (API & Integrations).`,
			};
		}
		if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
			return { status: 'Error', message: `Cannot resolve the host in ${base}. Check the Server URL.` };
		}
		return { status: 'Error', message: `Cannot reach SocialMate at ${base}: ${(error as Error).message}` };
	}

	const status = Number(response?.statusCode ?? 0);
	const body = asObject(response?.body) ?? {};
	const inner = asObject(body.error) ?? {};
	const serverMessage = typeof inner.message === 'string' ? inner.message : '';

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
		// Capabilities reports, per tool, whether THIS key may call it.
		const features = asObject(payload.features) ?? {};
		const tools = Array.isArray(payload.tools) ? (payload.tools as IDataObject[]) : [];
		const adminTool = tools.find(
			(t) => t.requiresAdminKey === true && (!t.feature || Boolean(features[t.feature as string])),
		);
		if (adminTool && adminTool.available === false) {
			message += ' This key has no admin scope, so the SocialMate Trigger cannot register its webhook; actions still work.';
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
