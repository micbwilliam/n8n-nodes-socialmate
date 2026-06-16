import type { INodeProperties } from 'n8n-workflow';

export const queueOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['queue'] } },
		options: [
			{ name: 'Bulk Import', value: 'import', action: 'Bulk import messages', description: 'Create a batch from a template + rows, e.g. from a spreadsheet (requires Pro)' },
			{ name: 'Cancel Batch', value: 'cancelBatch', action: 'Cancel a batch', description: 'Cancel all pending items in a batch' },
			{ name: 'Cancel Item', value: 'cancelItem', action: 'Cancel an item', description: 'Cancel a pending/processing item' },
			{ name: 'Enqueue Message', value: 'enqueue', action: 'Enqueue a message', description: 'Queue a single text message, optionally scheduled (requires Pro)' },
			{ name: 'Get Batches', value: 'getBatches', action: 'Get batches', description: 'List import batches' },
			{ name: 'Get Items', value: 'getItems', action: 'Get queue items', description: 'List queued items with filters' },
			{ name: 'Get Status', value: 'getStatus', action: 'Get queue status', description: 'Global queue counters and per-account paused flags' },
			{ name: 'Pause', value: 'pause', action: 'Pause the queue', description: 'Pause processing (global or per account)' },
			{ name: 'Resume', value: 'resume', action: 'Resume the queue', description: 'Resume processing (global or per account)' },
			{ name: 'Retry Batch', value: 'retryBatch', action: 'Retry a batch', description: 'Retry all failed items in a batch' },
			{ name: 'Retry Item', value: 'retryItem', action: 'Retry an item', description: 'Reset a failed item to pending' },
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
