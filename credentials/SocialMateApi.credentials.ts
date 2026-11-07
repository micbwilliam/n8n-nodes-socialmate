import type {
	IAuthenticateGeneric,
	ICredentialType,
	INodeProperties,
	Icon,
} from 'n8n-workflow';

/**
 * SocialMate API credential.
 *
 * Connects n8n to a self-hosted SocialMate desktop server over its local HTTP
 * API (default `http://127.0.0.1:3456`; for remote reach, a server install's
 * public address or a desktop app's named-tunnel hostname (Pro)). Authentication is a single API key sent in the `x-api-key` header.
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
				'Base URL of your SocialMate server — the API address, without /v1 or /admin. Only stable URLs are supported: use http://127.0.0.1:3456 when n8n runs on the SAME machine as SocialMate. n8n in Docker on the same machine: the desktop app listens on this computer only (127.0.0.1), and inside a container 127.0.0.1 is the container itself — with Docker Desktop (any OS) use http://host.docker.internal:3456; with Docker Engine on Linux run the n8n container with --network host and keep http://127.0.0.1:3456. For n8n Cloud or another machine, use a SocialMate server\'s PUBLIC ADDRESS (its domain or SOCIALMATE_PUBLIC_URL — any tier) or a desktop app\'s NAMED-TUNNEL hostname (Pro). Quick/ephemeral tunnels (*.trycloudflare.com) are NOT supported — their URL rotates on every restart and breaks the saved connection. Do not include a trailing slash. Find this in SocialMate → API & Integrations → n8n → New connection.',
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

	// No declarative `test`: it passed for any server answering 2xx (the /admin
	// console and n8n itself answer every path with a 200 HTML page). The nodes
	// declare `testedBy: 'socialMateApiTest'`, which requires the SocialMate
	// handshake — see nodes/SocialMate/methods/credentialTest.ts.
}
