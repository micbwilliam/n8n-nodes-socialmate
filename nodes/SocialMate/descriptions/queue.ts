import type { INodeProperties } from 'n8n-workflow';

export const queueOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['queue'] } },
		options: [
			{ name: 'Bulk Import', value: 'import', action: 'Bulk import messages', description: 'Creates a batch of personalized messages from a template + rows (e.g. from a spreadsheet), sent safely over time by the anti-ban engine. Returns the batch ID. Opt-in Pro feature — off by default; enable it with consent in the app first (returns 403 until then).' },
			{ name: 'Cancel Batch', value: 'cancelBatch', action: 'Cancel a batch', description: 'Cancels all still-pending items in an import batch. Requires Pro.' },
			{ name: 'Cancel Item', value: 'cancelItem', action: 'Cancel an item', description: 'Cancels one pending or processing queued message by its item ID. Requires Pro.' },
			{ name: 'Enqueue Message', value: 'enqueue', action: 'Enqueue a message', description: 'Queues one text message to send later, optionally at a scheduled time — the anti-ban engine drains it safely. Returns the queued item ID. Use for reminders, follow-ups and scheduled sends; for an immediate reply use Message: Send Text. Requires Pro.' },
			{ name: 'Get Batches', value: 'getBatches', action: 'Get batches', description: 'Lists bulk-import batches with their progress. Returns each batch\'s ID, name and sent/failed totals.' },
			{ name: 'Get Items', value: 'getItems', action: 'Get queue items', description: 'Lists queued messages, optionally filtered by batch, status or search. Returns each item\'s ID, chat, status and scheduled time.' },
			{ name: 'Get Status', value: 'getStatus', action: 'Get queue status', description: 'Returns global queue counters (pending/processing/failed) and the per-account paused flags' },
			{ name: 'Pause', value: 'pause', action: 'Pause the queue', description: 'Pauses queue processing for this account or globally. Requires Pro.' },
			{ name: 'Resume', value: 'resume', action: 'Resume the queue', description: 'Resumes queue processing for this account or globally. Requires Pro.' },
			{ name: 'Retry Batch', value: 'retryBatch', action: 'Retry a batch', description: 'Re-queues all failed items in a batch. Requires Pro.' },
			{ name: 'Retry Item', value: 'retryItem', action: 'Retry an item', description: 'Resets one failed queued message back to pending by its item ID. Requires Pro.' },
		],
		default: 'enqueue',
	},
];

export const queueFields: INodeProperties[] = [
	// ── Enqueue ──
	{
		displayName: 'Chat ID / Phone Number',
		name: 'chatId',
		type: 'string',
		default: '',
		required: true,
		placeholder: '+1 555 123 4567 or 123456789@g.us',
		description:
			'A phone number in international format including the country code — punctuation, a leading + and a 00 prefix are all accepted. The country code is required. For a group, pass its JID ending in @g.us.',
		displayOptions: { show: { resource: ['queue'], operation: ['enqueue'] } },
	},
	{
		displayName: 'Content',
		name: 'content',
		type: 'string',
		typeOptions: { rows: 3 },
		default: '',
		required: true,
		description: 'Message text (1–4096 chars)',
		displayOptions: { show: { resource: ['queue'], operation: ['enqueue'] } },
	},
	{
		displayName: 'Options',
		name: 'enqueueOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: { resource: ['queue'], operation: ['enqueue'] } },
		options: [
			{ displayName: 'Display Name', name: 'displayName', type: 'string', default: '' },
			{
				displayName: 'Priority',
				name: 'priority',
				type: 'options',
				default: 2,
				options: [
					{ name: 'Urgent', value: 0 },
					{ name: 'High', value: 1 },
					{ name: 'Normal', value: 2 },
					{ name: 'Low', value: 3 },
				],
			},
			{ displayName: 'Scheduled At', name: 'scheduledAt', type: 'dateTime', default: '', description: 'When to send. Leave empty for as-soon-as-possible.' },
			{ displayName: 'Max Retries', name: 'maxRetries', type: 'number', typeOptions: { minValue: 0, maxValue: 10 }, default: 3 },
		],
	},

	// ── Bulk import ──
	{
		displayName: 'Template',
		name: 'template',
		type: 'string',
		typeOptions: { rows: 3 },
		default: '',
		required: true,
		placeholder: 'Hi {{name}}, your order {{orderId}} has shipped!',
		description: 'Message template. Use {{columnName}} placeholders filled from each row\'s fields.',
		displayOptions: { show: { resource: ['queue'], operation: ['import'] } },
	},
	{
		displayName: 'Rows',
		name: 'rows',
		type: 'json',
		default: '[\n  { "chatId": "15551234567", "fields": { "name": "Alice", "orderId": "A-1" } }\n]',
		required: true,
		description: 'Array of rows. Each row needs a chatId and a fields object matching the template placeholders. Map an incoming items array here with an expression.',
		displayOptions: { show: { resource: ['queue'], operation: ['import'] } },
	},
	{
		displayName: 'Options',
		name: 'importOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: { resource: ['queue'], operation: ['import'] } },
		options: [
			{ displayName: 'Batch Name', name: 'batchName', type: 'string', default: '' },
			{
				displayName: 'Priority',
				name: 'priority',
				type: 'options',
				default: 2,
				options: [
					{ name: 'Urgent', value: 0 },
					{ name: 'High', value: 1 },
					{ name: 'Normal', value: 2 },
					{ name: 'Low', value: 3 },
				],
			},
			{ displayName: 'Scheduled At', name: 'scheduledAt', type: 'dateTime', default: '' },
			{ displayName: 'Max Retries', name: 'maxRetries', type: 'number', typeOptions: { minValue: 0, maxValue: 10 }, default: 3 },
		],
	},

	// ── Item / batch id ──
	{
		displayName: 'Item ID',
		name: 'itemId',
		type: 'string',
		default: '',
		required: true,
		displayOptions: { show: { resource: ['queue'], operation: ['cancelItem', 'retryItem'] } },
	},
	{
		displayName: 'Batch ID',
		name: 'batchId',
		type: 'string',
		default: '',
		required: true,
		displayOptions: { show: { resource: ['queue'], operation: ['cancelBatch', 'retryBatch'] } },
	},

	// ── List items ──
	{
		displayName: 'Filters',
		name: 'itemFilters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: { resource: ['queue'], operation: ['getItems'] } },
		options: [
			{ displayName: 'Batch ID', name: 'batchId', type: 'string', default: '' },
			{ displayName: 'Status', name: 'status', type: 'string', default: '', description: 'Comma-separated: pending,processing,sent,delivered,failed,cancelled — or "all"' },
			{ displayName: 'Search', name: 'search', type: 'string', default: '' },
		],
	},
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		description: 'Whether to return all results or only up to a given limit',
		displayOptions: { show: { resource: ['queue'], operation: ['getItems', 'getBatches'] } },
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1 },
		default: 50,
		description: 'Max number of results to return',
		displayOptions: { show: { resource: ['queue'], operation: ['getItems', 'getBatches'], returnAll: [false] } },
	},

	// ── Pause / resume scope note ──
	{
		displayName: 'Scope',
		name: 'pauseScope',
		type: 'options',
		default: 'account',
		options: [
			{ name: 'This Account', value: 'account', description: 'Pause/resume only the selected account' },
			{ name: 'Global', value: 'global', description: 'Pause/resume the whole queue' },
		],
		displayOptions: { show: { resource: ['queue'], operation: ['pause', 'resume'] } },
	},
];
