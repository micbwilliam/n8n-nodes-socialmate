import type { INodeProperties } from 'n8n-workflow';

export const accountOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['account'] } },
		// n8n lints this list as alphabetized by `name`.
		options: [
			{
				name: 'Clear Proxy',
				value: 'clearProxy',
				action: 'Clear the account proxy',
				description: 'Removes the account\'s outbound proxy, so it connects directly from the host\'s own IP. Applies on the account\'s next connect. Requires Pro.',
			},
			{ name: 'Get', value: 'get', action: 'Get an account', description: 'Gets one WhatsApp account with its live connection state (connected/disconnected). Use to check an account is online before sending.' },
			{
				name: 'Get Anti-Ban Status',
				value: 'getAntiBan',
				action: 'Get anti ban status',
				description: 'Returns the account\'s real-time anti-ban status: rate-limit headroom, warming phase, pause state and risk score. Call before a burst of sends to see how much room is left before the number is throttled or cooled.',
			},
			{ name: 'Get Many', value: 'getMany', action: 'Get many accounts', description: 'Lists every WhatsApp account this API key can use, with live risk, warming and daily-count stats. Returns each account\'s ID to pass to account-scoped operations.' },
			{
				name: 'Get Proxy',
				value: 'getProxy',
				action: 'Get the account proxy',
				description: 'Returns the account\'s outbound proxy setting (host, port, whether it is enabled) — the password is never returned. Use to check which residential IP an account routes its WhatsApp traffic through. Requires Pro.',
			},
			{
				name: 'Set Proxy',
				value: 'setProxy',
				action: 'Set the account proxy',
				description: 'Routes this account\'s WhatsApp traffic through an outbound proxy, so a server-hosted account can present a residential IP from the same region as the phone. Applies on the account\'s next connect. Requires Pro.',
			},
		],
		default: 'getMany',
	},
];

export const accountFields: INodeProperties[] = [
	{
		displayName: 'Proxy URL',
		name: 'proxyUrl',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'socks5://user:pass@host:1080',
		description:
			'The proxy to route this account through, as a URL. Supported schemes: http, https, socks5. Credentials may be embedded (socks5://user:pass@host:1080); they are stored encrypted and never returned by Get Proxy.',
		displayOptions: { show: { resource: ['account'], operation: ['setProxy'] } },
	},
	{
		displayName: 'Enabled',
		name: 'proxyEnabled',
		type: 'boolean',
		default: true,
		description: 'Whether to use the proxy. Turn off to keep the proxy configured but connect directly.',
		displayOptions: { show: { resource: ['account'], operation: ['setProxy'] } },
	},
];
