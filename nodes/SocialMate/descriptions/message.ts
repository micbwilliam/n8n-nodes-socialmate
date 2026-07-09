import type { INodeProperties } from 'n8n-workflow';

export const messageOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['message'] } },
		options: [
			{
				name: 'Get AI Context',
				value: 'getAiContext',
				action: 'Get AI conversation context',
				description: 'Returns a chat\'s recent history as a role-mapped, token-windowed transcript (the contact = user, your account = assistant) ready to paste into an AI agent\'s prompt or memory. This is the recommended way to give an agent conversation memory before it replies. Returns {transcript, messages, meta}. Use this — not Search — to feed an LLM. Requires Pro.',
			},
			{
				name: 'Search / List',
				value: 'search',
				action: 'Search or list messages',
				description: 'Reads raw persisted message rows for a chat, optionally full-text searched. Returns message records (ID, sender, body, timestamp). Use to find or count specific messages; to give an AI agent conversation memory, use Get AI Context instead. Requires Pro.',
			},
			{
				name: 'Send Media',
				value: 'sendMedia',
				action: 'Send a media message',
				description: 'Sends an image, video, audio, document or sticker to a chat, from a URL, an input binary field, or base64. Returns the message ID and status. Use to send a file, photo or voice note. Requires Pro.',
			},
			{
				name: 'Send Text',
				value: 'sendText',
				action: 'Send a text message',
				description: 'Sends a plain-text WhatsApp message to one chat (a phone number or a group JID). Returns the message ID and delivery status. This is the primary way an agent replies to or notifies someone. For files use Send Media; for many recipients use Queue: Bulk Import. Available on every tier.',
			},
		],
		default: 'sendText',
	},
];

const chatIdProperty: INodeProperties = {
	displayName: 'Chat ID / Phone Number',
	name: 'chatId',
	type: 'string',
	default: '',
	required: true,
	placeholder: '+1 555 123 4567 or 123456789@g.us',
	description:
		'A phone number in international format including the country code — punctuation, a leading + and a 00 prefix are all accepted (e.g. +1 (555) 123-4567, 15551234567). The country code is required. For a group, pass its JID ending in @g.us.',
	displayOptions: { show: { resource: ['message'], operation: ['sendText', 'sendMedia', 'getAiContext'] } },
};

export const messageFields: INodeProperties[] = [
	chatIdProperty,

	// ── Send Text ──
	{
		displayName: 'Text',
		name: 'text',
		type: 'string',
		typeOptions: { rows: 3 },
		default: '',
		required: true,
		description: 'Message body (1–4096 characters)',
		displayOptions: { show: { resource: ['message'], operation: ['sendText'] } },
	},

	// ── Send Media ──
	{
		displayName: 'Media Type',
		name: 'mediaType',
		type: 'options',
		default: 'image',
		options: [
			{ name: 'Audio', value: 'audio' },
			{ name: 'Document', value: 'document' },
			{ name: 'Image', value: 'image' },
			{ name: 'Sticker', value: 'sticker' },
			{ name: 'Video', value: 'video' },
		],
		displayOptions: { show: { resource: ['message'], operation: ['sendMedia'] } },
	},
	{
		displayName: 'Media Source',
		name: 'mediaSource',
		type: 'options',
		default: 'url',
		options: [
			{ name: 'URL', value: 'url', description: 'A public HTTPS URL the server will fetch' },
			{ name: 'Binary Property', value: 'binary', description: 'Binary data from a previous node' },
			{ name: 'Base64', value: 'base64', description: 'A base64-encoded string' },
		],
		displayOptions: { show: { resource: ['message'], operation: ['sendMedia'] } },
	},
	{
		displayName: 'URL',
		name: 'mediaUrl',
		type: 'string',
		default: '',
		placeholder: 'https://example.com/photo.jpg',
		description: 'Public https URL of the file to send. The server fetches it. Preferred over base64: a rate-limited URL send can auto-queue on Pro.',
		displayOptions: { show: { resource: ['message'], operation: ['sendMedia'], mediaSource: ['url'] } },
	},
	{
		displayName: 'Input Binary Field',
		name: 'binaryPropertyName',
		type: 'string',
		default: 'data',
		hint: 'The name of the input binary field containing the file to send',
		displayOptions: { show: { resource: ['message'], operation: ['sendMedia'], mediaSource: ['binary'] } },
	},
	{
		displayName: 'Base64 Data',
		name: 'mediaBase64',
		type: 'string',
		default: '',
		description: 'The file encoded as a base64 string (max ~20 MB). Prefer a URL where possible — base64 sends cannot auto-queue if rate-limited.',
		displayOptions: { show: { resource: ['message'], operation: ['sendMedia'], mediaSource: ['base64'] } },
	},
	{
		displayName: 'Additional Fields',
		name: 'mediaOptions',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['message'], operation: ['sendMedia'] } },
		options: [
			{ displayName: 'Caption', name: 'caption', type: 'string', default: '', description: 'Caption shown with the media (≤4096 chars)' },
			{ displayName: 'File Name', name: 'filename', type: 'string', default: '', description: 'Override the file name' },
			{ displayName: 'MIME Type', name: 'mimetype', type: 'string', default: '', description: 'Override the detected MIME type' },
		],
	},

	// ── Shared send options ──
	{
		displayName: 'Options',
		name: 'sendOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: { resource: ['message'], operation: ['sendText', 'sendMedia'] } },
		options: [
			{
				displayName: 'Priority',
				name: 'priority',
				type: 'options',
				default: 2,
				description: 'Used if the message is auto-queued by the anti-ban pipeline (Pro)',
				options: [
					{ name: 'Urgent', value: 0 },
					{ name: 'High', value: 1 },
					{ name: 'Normal', value: 2 },
					{ name: 'Low', value: 3 },
				],
			},
			{
				displayName: 'Max Retries',
				name: 'maxRetries',
				type: 'number',
				typeOptions: { minValue: 0, maxValue: 10 },
				default: 3,
				description: 'Retries if auto-queued (Pro)',
			},
		],
	},

	// ── Search / List ──
	{
		displayName: 'Filters',
		name: 'searchFilters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: { resource: ['message'], operation: ['search'] } },
		options: [
			{ displayName: 'Chat ID', name: 'chatId', type: 'string', default: '', description: 'Restrict to one chat (phone digits or group JID)' },
			{ displayName: 'Search Text', name: 'search', type: 'string', default: '', description: 'Full-text search across messages' },
			{ displayName: 'After Timestamp (Ms)', name: 'afterTs', type: 'number', default: 0, description: 'Return only messages after this Unix-ms timestamp. Use as a poll cursor to fetch new arrivals since the last run (pass the newest timestamp you saw); 0 returns everything.' },
		],
	},
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		description: 'Whether to return all results or only up to a given limit',
		displayOptions: { show: { resource: ['message'], operation: ['search'] } },
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1 },
		default: 50,
		description: 'Max number of results to return',
		displayOptions: { show: { resource: ['message'], operation: ['search'], returnAll: [false] } },
	},

	// ── Get AI Context ──
	{
		displayName: 'Options',
		name: 'aiContextOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: { resource: ['message'], operation: ['getAiContext'] } },
		options: [
			{
				displayName: 'Before Timestamp (Unix Ms)',
				name: 'beforeTs',
				type: 'number',
				default: 0,
				description:
					'Exclude messages at/after this unix-ms. Pass the trigger message timestamp to drop the just-arrived message from the context.',
			},
			{
				displayName: 'Format',
				name: 'format',
				type: 'options',
				default: 'both',
				description: 'Which shape to return',
				options: [
					{ name: 'Both', value: 'both' },
					{ name: 'Messages Only', value: 'messages' },
					{ name: 'Transcript Only', value: 'transcript' },
				],
			},
			{
				displayName: 'Include Timestamps',
				name: 'includeTimestamps',
				type: 'boolean',
				default: false,
				description: 'Whether to prefix each transcript line with an ISO timestamp',
			},
			{
				displayName: 'Max Messages',
				name: 'maxMessages',
				type: 'number',
				typeOptions: { minValue: 1, maxValue: 500 },
				default: 50,
				description: 'Most-recent messages to consider (newest first)',
			},
			{
				displayName: 'Max Tokens',
				name: 'maxTokens',
				type: 'number',
				typeOptions: { minValue: 100, maxValue: 32000 },
				default: 4000,
				description: 'Approximate token budget for the included window',
			},
			{
				displayName: 'Order',
				name: 'order',
				type: 'options',
				default: 'oldest',
				description: 'Order of the returned messages/transcript',
				options: [
					{ name: 'Oldest First (Chronological)', value: 'oldest' },
					{ name: 'Newest First', value: 'newest' },
				],
			},
		],
	},
];
