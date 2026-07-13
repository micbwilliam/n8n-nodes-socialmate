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
				description: 'Removes the account\'s outbound proxy, so its WhatsApp traffic goes back out over the host\'s own IP. Returns {success: true}. It applies on the account\'s NEXT connect — an already-open session keeps using the old route until it reconnects, so reconnect the account to make it take effect now. Use it to undo a proxy for good, or to fall back to a direct connection when the proxy itself is failing. To keep the proxy configured but stop routing through it, use Set Proxy with Enabled off instead — that preserves the host and the stored credentials, which this operation discards. Clearing is never license-gated (setting a proxy is what requires Pro), but it needs an admin-scope key.',
			},
			{ name: 'Get', value: 'get', action: 'Get an account', description: 'Gets one WhatsApp account by its ID. Returns the stored account plus its live vitals: its ID and {phone, name, status, state, riskLevel, riskScore, messagesToday, dailyLimit, warmingDay}. The field to check before sending is state — the live socket, "connected" or "disconnected"; sending from a disconnected account fails. It does NOT carry rate-limit headroom, the pause flag or a cooling reason, so to find out how much room is left before the number is throttled or cooled, use Get Anti-Ban Status. To discover account IDs in the first place, use Get Many. Available on every tier.' },
			{
				name: 'Get Anti-Ban Status',
				value: 'getAntiBan',
				action: 'Get anti ban status',
				description: 'Returns the account\'s real-time anti-ban status: rate-limit headroom, warming phase, pause state and risk score. Call before a burst of sends to see how much room is left before the number is throttled or cooled.',
			},
			{ name: 'Get Many', value: 'getMany', action: 'Get many accounts', description: 'Lists every WhatsApp account this API key is allowed to use — a key scoped to one account sees only that one. Each carries its ID and {phone, name, status, riskLevel, riskScore, messagesToday, dailyLimit, warmingDay} — and that ID is what every account-scoped operation takes. Start here to discover which number to send from: status says whether it is connected, and messagesToday against dailyLimit shows roughly how much of today\'s budget is left. For one account\'s live headroom, pause state and cooling before a burst of sends, use Get Anti-Ban Status — these figures are a snapshot, not a send-safety check. Available on every tier.' },
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
