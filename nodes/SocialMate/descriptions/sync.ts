import type { INodeProperties } from 'n8n-workflow';

export const syncOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['sync'] } },
		options: [
			{ name: 'Trigger', value: 'trigger', action: 'Trigger a sync', description: 'Administrative — starts a background job that pulls contacts, chats and/or message history from WhatsApp into the local database. Returns a job status immediately. Requires Pro. Rarely needed from an agent — history syncs automatically.' },
			{ name: 'Get Status', value: 'getStatus', action: 'Get sync status', description: 'Returns the most recent sync jobs and their progress. Use to check whether a sync has finished.' },
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
