import type { INodeProperties } from 'n8n-workflow';

export const accountOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['account'] } },
		options: [
			{ name: 'Get', value: 'get', action: 'Get an account', description: 'Get one account with connection state' },
			{ name: 'Get Many', value: 'getMany', action: 'Get many accounts', description: 'List all accounts with risk/warming stats' },
			{
				name: 'Get Anti-Ban Status',
				value: 'getAntiBan',
				action: 'Get anti ban status',
				description: 'Real-time rate limits, warming, pause and risk for the account',
			},
		],
		default: 'getMany',
	},
];

export const accountFields: INodeProperties[] = [];
