import type { INodeProperties } from 'n8n-workflow';

export const contactOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['contact'] } },
		options: [
			{
				name: 'Get',
				value: 'get',
				action: 'Get a contact',
				description: 'Gets one WhatsApp contact by its ID (obtained from Get Many or an incoming-message trigger). Returns the contact\'s name, phone number and JID. Use when you already have the ID; to look someone up by name or number, use Get Many with a search instead.',
			},
			{
				name: 'Get Many',
				value: 'getMany',
				action: 'Get many contacts',
				description: 'Finds WhatsApp contacts by name, phone or JID, or lists them all. Returns each contact\'s ID, name, phone and JID. Use this to resolve who to message before sending — pass a returned phone number or JID as the chatId of Send Text.',
			},
		],
		default: 'getMany',
	},
];

export const contactFields: INodeProperties[] = [
	{
		displayName: 'Contact ID',
		name: 'contactId',
		type: 'string',
		default: '',
		required: true,
		description: 'The contact\'s ID, as returned by Get Many or an incoming-message trigger payload (e.g. {{$JSON.data.senderId}}). Returns that contact\'s name, phone and JID.',
		displayOptions: { show: { resource: ['contact'], operation: ['get'] } },
	},
	{
		displayName: 'Search',
		name: 'search',
		type: 'string',
		default: '',
		description: 'Find contacts whose name, phone number or JID contains this text. Leave empty to list all contacts.',
		displayOptions: { show: { resource: ['contact'], operation: ['getMany'] } },
	},
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		description: 'Whether to return all results or only up to a given limit',
		displayOptions: { show: { resource: ['contact'], operation: ['getMany'] } },
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1 },
		default: 50,
		description: 'Max number of results to return',
		displayOptions: { show: { resource: ['contact'], operation: ['getMany'], returnAll: [false] } },
	},
];
