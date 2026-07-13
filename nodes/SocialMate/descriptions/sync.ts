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
			{ name: 'Get Status', value: 'getStatus', action: 'Get sync status', description: 'Returns the 50 most recent sync jobs on the server, newest first — each as its ID and {accountId, type, status, progress, itemsDone, itemsTotal, error, startedAt, finishedAt}, where status is "pending", "running", "completed" or "failed". Use it to follow a run started by Trigger: poll until that job\'s status is "completed" (or "failed", where error says why), reading progress and itemsDone/itemsTotal in between. It is job telemetry only — it returns no contacts, chats or messages, so to read what a sync actually pulled in use Message: Search / List or Contact: Get Many. It is server-wide, not account-scoped: filter the returned rows by accountId yourself. Available on every tier.' },
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
