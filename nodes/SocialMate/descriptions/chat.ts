import type { INodeProperties } from 'n8n-workflow';

export const chatOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['chat'] } },
		options: [
			{
				name: 'Get Many',
				value: 'getMany',
				action: 'Get many chats',
				description: 'List all chats (1:1, groups and broadcasts) for the account',
			},
		],
		default: 'getMany',
	},
];

export const chatFields: INodeProperties[] = [];
