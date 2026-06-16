import type { INodeProperties } from 'n8n-workflow';

export const mediaOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['media'] } },
		options: [
			{ name: 'Delete', value: 'delete', action: 'Delete a media file', description: 'Delete the file (metadata is kept)' },
			{ name: 'Download File', value: 'getFile', action: 'Download a media file', description: 'Return the decrypted file as binary data' },
			{ name: 'Force Download', value: 'forceDownload', action: 'Force a download', description: 'Enqueue a download to pre-cache the file' },
			{ name: 'Get', value: 'get', action: 'Get media metadata', description: 'Get a single media item (metadata only)' },
			{ name: 'Get Many', value: 'getMany', action: 'Get many media items', description: 'List media with filters' },
			{ name: 'Get Stats', value: 'getStats', action: 'Get media stats', description: 'Counts and bytes by type for the account' },
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
	displayOptions: { show: { resource: ['media'], operation: ['get', 'getFile', 'forceDownload', 'delete'] } },
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
		displayOptions: { show: { resource: ['media'], operation: ['getFile'] } },
	},
	{
		displayName: 'Filters',
		name: 'mediaFilters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: { resource: ['media'], operation: ['getMany'] } },
		options: [
			{ displayName: 'Chat ID', name: 'chatId', type: 'string', default: '' },
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
