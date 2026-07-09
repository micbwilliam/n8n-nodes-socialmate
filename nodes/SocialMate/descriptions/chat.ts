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
				description: 'Lists every chat (1:1, group and broadcast) on the WhatsApp account. Returns each chat\'s ID, name, type and unread count. Use this to discover which conversations exist and to get a chat ID to pass as chatId to Send Text, Send Media or Get AI Context. Does not return message contents — use Message: Get AI Context or Search for that.',
			},
		],
		default: 'getMany',
	},
];

export const chatFields: INodeProperties[] = [];
