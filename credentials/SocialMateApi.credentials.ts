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
				'Base URL of your SocialMate server. Use your named-tunnel hostname (recommended — never rotates) or http://127.0.0.1:3456 when n8n runs on the same machine. Do not include a trailing slash. Find this in SocialMate → Settings → API → "Connect to n8n".',
		},
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description:
				'API key generated in SocialMate → Settings → API. Use a key with the "admin" scope if you want the SocialMate Trigger to register its webhook automatically.',
		},
		{
			displayName: 'Prefer Live Tunnel URL From Trigger',
			name: 'preferTriggerUrl',
			type: 'boolean',
			default: true,
			description:
				'Whether to auto-heal a rotating quick-tunnel URL. When on, action nodes prefer the freshest tunnel URL cached by a SocialMate Trigger in the same workflow over a quick-tunnel URL stored above. A stable named-tunnel hostname is always used as-is.',
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
