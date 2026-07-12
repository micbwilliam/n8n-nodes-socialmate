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
				name: 'Get Poll Results',
				value: 'getPollResults',
				action: 'Get poll results',
				description: 'Reads back a poll\'s results by its message ID: every option, how many people picked each, and who voted for what. Use after Send Poll to find out whether it was answered — poll results are not pushed to you (the Trigger node\'s "Poll Vote" event fires per vote; this reads the current standing). Re-voting replaces a person\'s earlier choice, so the counts never double-count, and an option nobody picked is still listed at 0. Requires Pro.',
			},
			{
				name: 'Mark Read',
				value: 'markRead',
				action: 'Mark a chat read',
				description: 'Sends read receipts (blue ticks) for a chat, so the contact knows their message was seen. Leave Message IDs empty to acknowledge everything unread in the chat. Use after your workflow has handled an incoming message. Available on every tier — read receipts consume no message-send budget and do not raise the anti-ban risk score.',
			},
			{
				name: 'React',
				value: 'react',
				action: 'React to a message',
				description: 'Adds an emoji reaction to a message, or removes yours by passing an empty emoji. WhatsApp allows one reaction per sender per message, so a new emoji replaces your previous one. Use this to acknowledge a message without sending a reply. Available on every tier — reactions consume no message-send budget and do not raise the anti-ban risk score.',
			},
			{
				name: 'Search / List',
				value: 'search',
				action: 'Search or list messages',
				description: 'Reads raw persisted message rows for a chat, optionally full-text searched. Returns message records (ID, sender, body, timestamp). Use to find or count specific messages; to give an AI agent conversation memory, use Get AI Context instead. Requires Pro.',
			},
			{
				name: 'Send Contact',
				value: 'sendContact',
				action: 'Send a contact card',
				description: 'Sends one or more contact cards (vCards) to a chat, so the recipient can tap to save or message them. Use to hand a lead to a colleague or share a support number. Returns the message ID. Requires Pro.',
			},
			{
				name: 'Send Location',
				value: 'sendLocation',
				action: 'Send a location',
				description: 'Sends a location pin (latitude/longitude, with an optional place name and address) to a chat. Use for directions, meeting points or delivery addresses — the recipient can tap it to open maps. Returns the message ID. Requires Pro.',
			},
			{
				name: 'Send Media',
				value: 'sendMedia',
				action: 'Send a media message',
				description: 'Sends an image, video, audio, document or sticker to a chat, from a URL, an input binary field, or base64. Returns the message ID and status. Use to send a file, photo or voice note. Requires Pro.',
			},
			{
				name: 'Send Poll',
				value: 'sendPoll',
				action: 'Send a poll',
				description: 'Sends a multiple-choice poll (2–12 options) to a chat and returns the poll message ID. Use instead of an open question when you need a structured answer — WhatsApp renders tappable options. Votes arrive on the Trigger node\'s "Poll Vote" event as they are cast; to read the current standing at any time, use Get Poll Results with the returned message ID. Requires Pro.',
			},
			{
				name: 'Send Text',
				value: 'sendText',
				action: 'Send a text message',
				description: 'Sends a plain-text WhatsApp message to one chat (a phone number or a group JID). Returns the message ID and delivery status. This is the primary way an agent replies to or notifies someone. Set Reply To Message ID to quote a message. For files use Send Media; for many recipients use Queue: Bulk Import. Available on every tier.',
			},
			{
				name: 'Send Typing',
				value: 'sendTyping',
				action: 'Send a typing indicator',
				description: 'Shows or clears a "typing…" / "recording audio…" indicator in a chat. Send Composing before a slow reply so the contact sees you are responding, then send the message; WhatsApp expires the indicator after about 10 seconds. Available on every tier — presence consumes no message-send budget.',
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
	displayOptions: {
		show: {
			resource: ['message'],
			operation: ['sendText', 'sendMedia', 'sendPoll', 'sendLocation', 'sendContact', 'getAiContext', 'react', 'markRead', 'sendTyping'],
		},
	},
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
		displayOptions: { show: { resource: ['message'], operation: ['sendText', 'sendMedia', 'sendPoll', 'sendLocation', 'sendContact'] } },
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
			{
				displayName: 'Reply To Message ID',
				name: 'replyTo',
				type: 'string',
				default: '',
				description:
					'Quote an existing message so this send appears as a threaded reply to it. Pass a message ID from a Trigger event, Search or an earlier send.',
			},
		],
	},

	// ── Send Poll ──
	{
		displayName: 'Question',
		name: 'pollName',
		type: 'string',
		default: '',
		required: true,
		description: 'The poll question shown above the options',
		displayOptions: { show: { resource: ['message'], operation: ['sendPoll'] } },
	},
	{
		displayName: 'Options',
		name: 'pollOptions',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'Monday, Tuesday, Wednesday',
		description: 'Between 2 and 12 answer options, separated by commas',
		displayOptions: { show: { resource: ['message'], operation: ['sendPoll'] } },
	},
	{
		displayName: 'Selectable Count',
		name: 'pollSelectableCount',
		type: 'number',
		typeOptions: { minValue: 1, maxValue: 12 },
		default: 1,
		description: 'How many options a voter may pick. 1 = single-select.',
		displayOptions: { show: { resource: ['message'], operation: ['sendPoll'] } },
	},

	// ── Send Location ──
	{
		displayName: 'Latitude',
		name: 'latitude',
		type: 'number',
		typeOptions: { numberPrecision: 6 },
		default: 0,
		required: true,
		description: 'Latitude in decimal degrees (-90 to 90)',
		displayOptions: { show: { resource: ['message'], operation: ['sendLocation'] } },
	},
	{
		displayName: 'Longitude',
		name: 'longitude',
		type: 'number',
		typeOptions: { numberPrecision: 6 },
		default: 0,
		required: true,
		description: 'Longitude in decimal degrees (-180 to 180)',
		displayOptions: { show: { resource: ['message'], operation: ['sendLocation'] } },
	},
	{
		displayName: 'Additional Fields',
		name: 'locationOptions',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['message'], operation: ['sendLocation'] } },
		options: [
			{ displayName: 'Address', name: 'address', type: 'string', default: '', description: 'Street address shown under the pin' },
			{ displayName: 'Place Name', name: 'name', type: 'string', default: '', description: 'Place name shown on the pin' },
		],
	},

	// ── Send Contact ──
	{
		displayName: 'Contacts',
		name: 'contacts',
		type: 'fixedCollection',
		typeOptions: { multipleValues: true },
		default: {},
		required: true,
		description: 'The contact cards to send (1–10)',
		displayOptions: { show: { resource: ['message'], operation: ['sendContact'] } },
		options: [
			{
				displayName: 'Contact',
				name: 'contact',
				values: [
					{ displayName: 'Full Name', name: 'fullName', type: 'string', default: '', required: true, description: 'Display name on the card' },
					{
						displayName: 'Phone',
						name: 'phone',
						type: 'string',
						default: '',
						required: true,
						description: 'Phone number in full international format including the country code',
					},
					{ displayName: 'Organization', name: 'organization', type: 'string', default: '', description: 'Optional company name' },
				],
			},
		],
	},

	// ── Get Poll Results ──
	// No Chat ID: a poll is addressed by its message ID alone.
	{
		displayName: 'Message ID',
		name: 'messageId',
		type: 'string',
		default: '',
		required: true,
		description: 'The poll message to read results for — the message ID returned by Send Poll (or carried on a Poll Vote trigger event)',
		displayOptions: { show: { resource: ['message'], operation: ['getPollResults'] } },
	},

	// ── React ──
	{
		displayName: 'Message ID',
		name: 'messageId',
		type: 'string',
		default: '',
		required: true,
		description: 'The message to react to. Pass a message ID from a Trigger event, Search, or an earlier send.',
		displayOptions: { show: { resource: ['message'], operation: ['react'] } },
	},
	{
		displayName: 'Emoji',
		name: 'emoji',
		type: 'string',
		default: '',
		placeholder: '👍',
		description: 'A single emoji. Leave empty to remove your existing reaction.',
		displayOptions: { show: { resource: ['message'], operation: ['react'] } },
	},

	// ── Mark Read ──
	{
		displayName: 'Message IDs',
		name: 'messageIds',
		type: 'string',
		default: '',
		placeholder: 'ABC123, DEF456',
		description: 'Comma-separated message IDs to acknowledge. Leave empty to mark everything unread in the chat as read.',
		displayOptions: { show: { resource: ['message'], operation: ['markRead'] } },
	},

	// ── Send Typing ──
	{
		displayName: 'State',
		name: 'presenceState',
		type: 'options',
		default: 'composing',
		description: 'Which indicator to show, or Paused to clear it',
		options: [
			{ name: 'Composing (Typing…)', value: 'composing' },
			{ name: 'Paused (Clear)', value: 'paused' },
			{ name: 'Recording (Recording Audio…)', value: 'recording' },
		],
		displayOptions: { show: { resource: ['message'], operation: ['sendTyping'] } },
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
