import type { INodeProperties } from 'n8n-workflow';

export const queueOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['queue'] } },
		options: [
			{ name: 'Cancel Batch', value: 'cancelBatch', action: 'Cancel a batch', description: 'Cancels every still-pending item in a queued batch, so nothing more goes out from it. Returns how many items were cancelled. Already-sent messages are unaffected and cannot be recalled. Use to abandon a batch for good; to stop it only temporarily, use Pause. Requires Pro.' },
			{ name: 'Cancel Item', value: 'cancelItem', action: 'Cancel an item', description: 'Cancels one pending queued message by its item ID (from Enqueue or Get Items), so it is never sent. Returns the item with status "cancelled". Use to withdraw a single scheduled send; for a whole batch use Cancel Batch, and to hold everything without dropping it use Pause. Requires Pro.' },
			{ name: 'Enqueue Message', value: 'enqueue', action: 'Enqueue a message', description: 'Queues one text message to send later, optionally at a scheduled time — the anti-ban engine drains it safely. Returns the queued item ID. Use for reminders, follow-ups and scheduled sends; for an immediate reply use Message: Send Text. Requires Pro.' },
			{ name: 'Get Batches', value: 'getBatches', action: 'Get batches', description: 'Lists queued batches, newest first, with the progress of each: its ID and {accountId, accountName, accountPhone, name, status, totalCount, pendingCount, processingCount, sentCount, deliveredCount, failedCount, cancelledCount, scheduledAt, createdAt, updatedAt}. Use it to follow a batch created by Queue a Batch — pendingCount and processingCount reaching 0 means it has finished draining — and to get the batch ID that Cancel Batch and Retry Batch take. It returns per-batch totals only, never the individual messages: for those use Get Items filtered by Batch ID, and for server-wide pending/failed counters use Get Status. Available on every tier.' },
			{ name: 'Get Items', value: 'getItems', action: 'Get queue items', description: 'Lists queued messages, optionally filtered by batch, status or search. Returns each item\'s ID, chat, status and scheduled time.' },
			{ name: 'Get Status', value: 'getStatus', action: 'Get queue status', description: 'Returns queue counters only — server-wide totals (pending, processing, sent, failed) plus each account\'s pending count and paused flag. Use to check whether the queue is draining or paused. It does not list the messages themselves — use Get Items for those, or Account: Get Anti-Ban Status for send headroom. Available on every tier.' },
			{ name: 'Pause', value: 'pause', action: 'Pause the queue', description: 'Holds queue processing so nothing further is sent — for the selected account (Scope: This Account) or for the whole server (Scope: Global). Returns {success, paused: true, accountId} — accountId is null when the pause is global. Nothing is lost: pending items stay queued and simply stop draining, and anything that comes due while paused goes out after Resume. Use it to stop sending temporarily, e.g. during an incident or while a human checks something. To abandon work permanently use Cancel Batch or Cancel Item instead — pausing cancels nothing. Note it only holds the QUEUE: Message: Send Text bypasses the queue and still sends. Requires Pro.' },
			{ name: 'Queue a Batch', value: 'import', action: 'Queue a batch of personalised messages', description: 'Creates one batch from a template + rows (e.g. from a spreadsheet): one individual, personalised message per person, each paced by the anti-ban engine. Returns the batch ID. Use it when several people who are already waiting on you need the same news — an order delay, a new pickup time. Only for people who contacted you or explicitly opted in; never a list you bought, scraped or guessed. This is not a broadcast: identical text to many contacts is blocked by the duplicate guard, so personalise every row. Never loop Message: Send Text over a list instead — that is the pattern that gets numbers banned. Off by default: switch on batch sending with consent in the app first (returns 403 until then). Requires Pro.' },
			{ name: 'Resume', value: 'resume', action: 'Resume the queue', description: 'Lifts a pause for the selected account (Scope: This Account) or the whole server (Scope: Global), and the anti-ban engine starts draining pending items again. Returns {success, paused: false, accountId} — accountId is null when global. It resumes, and does nothing else: failed items are not retried (use Retry Batch or Retry Item) and cancelled ones never come back. The backlog drains at the pipeline\'s own pace, not all at once, so expect the queue to empty gradually — check progress with Get Status or Get Batches rather than waiting on this call. Requires Pro.' },
			{ name: 'Retry Batch', value: 'retryBatch', action: 'Retry a batch', description: 'Re-queues every failed item in a batch so the anti-ban engine attempts them again. Returns how many were reset. Only failed items are touched — sent messages are never re-sent, and cancelled ones stay cancelled. Requires Pro.' },
			{ name: 'Retry Item', value: 'retryItem', action: 'Retry an item', description: 'Resets one failed queued message back to pending by its item ID, so it is attempted again. Returns the item with status "pending". Use once the cause of the failure is fixed; to reset every failure in a batch at once, use Retry Batch. Requires Pro.' },
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

	// ── Queue a Batch (the wire operation value stays `import` — internal key) ──
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
		description: 'Array of rows — one per person, each getting their own personalised message. Each row needs a chatId and a fields object matching the template placeholders. Map an incoming items array here with an expression. Only include people who contacted you or explicitly opted in.',
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
