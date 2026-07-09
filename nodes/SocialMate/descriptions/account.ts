import type { INodeProperties } from 'n8n-workflow';

export const accountOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['account'] } },
		options: [
			{ name: 'Get', value: 'get', action: 'Get an account', description: 'Gets one WhatsApp account with its live connection state (connected/disconnected). Use to check an account is online before sending.' },
			{ name: 'Get Many', value: 'getMany', action: 'Get many accounts', description: 'Lists every WhatsApp account this API key can use, with live risk, warming and daily-count stats. Returns each account\'s ID to pass to account-scoped operations.' },
			{
				name: 'Get Anti-Ban Status',
				value: 'getAntiBan',
				action: 'Get anti ban status',
				description: 'Returns the account\'s real-time anti-ban status: rate-limit headroom, warming phase, pause state and risk score. Call before a burst of sends to see how much room is left before the number is throttled or cooled.',
			},
		],
		default: 'getMany',
	},
];

export const accountFields: INodeProperties[] = [];
