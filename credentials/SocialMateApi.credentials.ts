import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

/**
 * SocialMate API credential.
 *
 * Connects n8n to a self-hosted SocialMate desktop server over its local HTTP
 * API (default `http://127.0.0.1:3456`, or a Cloudflare tunnel URL for remote
 * reach). Authentication is a single API key sent in the `x-api-key` header.
 *
 * Connection strategy (see the node's `resolveBaseUrl`): a **named-tunnel
 * hostname** entered here is stable and always used. A rotating quick-tunnel
 * URL is auto-healed at run time from the SocialMate Trigger (which caches the
 * `tunnelUrl` carried in every webhook), provided "Prefer live tunnel URL" is
 * on.
 */
export class SocialMateApi implements ICredentialType {
	name = 'socialMateApi';

	displayName = 'SocialMate API';

	documentationUrl = 'https://socialmate.app/docs';

	properties: INodeProperties[] = [
		{
			displayName: 'Server URL',
			name: 'baseUrl',
			type: 'string',
			default: 'http://127.0.0.1:3456',
			placeholder: 'https://api.your-domain.com',
			required: true,
			description:
				'Base URL of your SocialMate server. Only stable URLs are supported: use http://127.0.0.1:3456 when n8n runs on the SAME machine as the app, or your NAMED-TUNNEL hostname (Pro) for a remote n8n. Quick/ephemeral tunnels (*.trycloudflare.com) are NOT supported — their URL rotates on every restart and breaks the saved connection. Do not include a trailing slash. Find this in SocialMate → Settings → API → "Connect to n8n".',
		},
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description:
				'API key for this connection. The SocialMate connection wizard (API & Integrations → n8n → New connection) mints an account-scoped key with read+send+admin scope — paste it here. Account-scoped keys only work against their bound account; a global key can act on any account.',
		},
		{
			displayName: 'Default Account ID',
			name: 'accountId',
			type: 'string',
			default: '',
			description:
				'The WhatsApp account this connection is bound to (from the connection wizard\'s credential bundle). When set, node operations default to this account if their "Account" field is left empty. Optional for a global (unscoped) key.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'x-api-key': '={{$credentials.apiKey}}',
			},
		},
	};

	// Verifies reachability + key validity in one round-trip. /v1/capabilities
	// also returns the tier so the credential test surfaces it to the user.
	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl.replace(new RegExp("/+$"), "")}}',
			url: '/v1/capabilities',
			method: 'GET',
		},
	};
}
