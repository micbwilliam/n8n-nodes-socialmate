import type { INodeProperties } from 'n8n-workflow';

export const mediaOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['media'] } },
		options: [
			{ name: 'Delete', value: 'delete', action: 'Delete a media file', description: 'Administrative — permanently deletes a downloaded media file from local storage (its metadata row is kept). Requires Pro.' },
			{ name: 'Download File', value: 'getFile', action: 'Download a media file', description: 'Downloads one media item\'s decrypted bytes and returns them as binary data (default output field "data"). Needs the media ID from Get Many. Use to fetch an image, document or voice note for an agent to read or forward.' },
			{ name: 'Download Thumbnail', value: 'getThumbnail', action: 'Download a thumbnail', description: 'Returns a media item\'s inline JPEG thumbnail as binary data. Much lighter than Download File — use for a quick preview.' },
			{ name: 'Force Download', value: 'forceDownload', action: 'Force a download', description: 'Enqueues a media item to be downloaded now so its bytes are cached. Returns immediately; poll Get for the state. Requires Pro.' },
			{ name: 'Get', value: 'get', action: 'Get media metadata', description: 'Gets one media item\'s metadata only (type, size, caption, download state) by its ID — not the bytes. Use Download File to get the bytes.' },
			{ name: 'Get Download Queue', value: 'getDownloadQueue', action: 'Get the download queue', description: 'Administrative — returns the server-wide media-download backlog (active/pending/failed). Not account-scoped.' },
			{ name: 'Get Many', value: 'getMany', action: 'Get many media items', description: 'Lists media items with optional filters (chat, type, direction, state, search). Returns each item\'s ID, type, size and state — pass an ID to Download File. Use to find files shared in a chat.' },
			{ name: 'Get Stats', value: 'getStats', action: 'Get media stats', description: 'Returns media counts and total bytes by type for the account. Use to report local storage usage.' },
			{ name: 'Run Cleanup', value: 'cleanup', action: 'Run media cleanup', description: 'Administrative — applies retention/quota rules now to free disk, server-wide. Requires Pro.' },
		],
		default: 'getMany',
	},
];

const mediaIdProperty: INodeProperties = {
	displayName: 'Media ID',
	name: 'mediaId',
	type: 'string',
	default: '',
	required: true,
	description: 'The media item\'s ID, as returned by Get Many or a media.discovered trigger event',
	displayOptions: { show: { resource: ['media'], operation: ['get', 'getFile', 'getThumbnail', 'forceDownload', 'delete'] } },
};

export const mediaFields: INodeProperties[] = [
	mediaIdProperty,
	{
		displayName: 'Put Output File in Field',
		name: 'binaryPropertyName',
		type: 'string',
		default: 'data',
		required: true,
		hint: 'The name of the output binary field to put the downloaded file in',
		displayOptions: { show: { resource: ['media'], operation: ['getFile', 'getThumbnail'] } },
	},
	{
		displayName: 'Filters',
		name: 'mediaFilters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: { resource: ['media'], operation: ['getMany'] } },
		options: [
			{ displayName: 'Chat ID', name: 'chatId', type: 'string', default: '', description: 'Restrict to one chat — a phone number in international format (with country code) or a group JID ending in @g.us' },
			{
				displayName: 'Direction',
				name: 'direction',
				type: 'options',
				default: 'all',
				options: ['all', 'received', 'sent'].map((v) => ({ name: v, value: v })),
			},
			{ displayName: 'Search', name: 'search', type: 'string', default: '' },
			{
				displayName: 'Sort',
				name: 'sort',
				type: 'options',
				default: 'newest',
				options: ['newest', 'oldest', 'biggest', 'smallest'].map((v) => ({ name: v, value: v })),
			},
			{
				displayName: 'State',
				name: 'state',
				type: 'options',
				default: 'all',
				options: ['all', 'pending', 'queued', 'downloading', 'downloaded', 'failed', 'skipped', 'expired', 'deleted'].map((v) => ({ name: v, value: v })),
			},
			{
				displayName: 'Type',
				name: 'type',
				type: 'options',
				default: 'all',
				options: ['all', 'image', 'video', 'audio', 'voice', 'document', 'sticker'].map((v) => ({ name: v, value: v })),
			},
		],
	},
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		description: 'Whether to return all results or only up to a given limit',
		displayOptions: { show: { resource: ['media'], operation: ['getMany'] } },
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1 },
		default: 50,
		description: 'Max number of results to return',
		displayOptions: { show: { resource: ['media'], operation: ['getMany'], returnAll: [false] } },
	},
];
