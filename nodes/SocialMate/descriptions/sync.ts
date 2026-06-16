import type { INodeProperties } from 'n8n-workflow';

export const syncOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['sync'] } },
		options: [
			{ name: 'Trigger', value: 'trigger', action: 'Trigger a sync', description: 'Start a sync job (requires Pro)' },
			{ name: 'Get Status', value: 'getStatus', action: 'Get sync status', description: 'Recent sync jobs and their progress' },
		],
		default: 'trigger',
	},
];

export const syncFields: INodeProperties[] = [
	{
		displayName: 'Sync Type',
		name: 'syncType',
		type: 'options',
		default: 'full',
		options: [
			{ name: 'Full', value: 'full' },
			{ name: 'Contacts', value: 'contacts' },
			{ name: 'Messages', value: 'messages' },
			{ name: 'Chats', value: 'chats' },
		],
		displayOptions: { show: { resource: ['sync'], operation: ['trigger'] } },
	},
];
