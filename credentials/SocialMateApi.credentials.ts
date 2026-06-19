import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
	Icon,
} from 'n8n-workflow';

/**
 * SocialMate API credential.
 *
 * Connects n8n to a self-hosted SocialMate desktop server over its local HTTP
 * API (default `http://127.0.0.1:3456`, or a named-tunnel hostname for remote
 * reach). Authentication is a single API key sent in the `x-api-key` header.
 *
 * The API key carries its own **account scope** (This account / Selected / All),
 * set when the connection is created in the app. The node never needs a
 * "default account": each operation's Account dropdown is populated only with
 * the accounts the key allows, and auto-resolves when the key is bound to one.
 */
export class SocialMateApi implements ICredentialType {
	name = 'socialMateApi';

	displayName = 'SocialMate API';

	// Shown in the credentials list. The SVG ships next to this file in dist
	// (see gulpfile `build:icons`). Without it n8n renders a generic "?" tile.
	icon: Icon = 'file:socialmate.svg';

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
				'API key from the SocialMate connection wizard (API & Integrations → n8n → New connection). The key itself defines which WhatsApp accounts you can use — This account, Selected, or All accounts. On each operation the Account dropdown lists only the accounts this key allows (auto-selected when the key is bound to a single account), so there is nothing else to configure here.',
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
