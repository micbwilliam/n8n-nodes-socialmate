import type { INodeProperties } from 'n8n-workflow';

export const contactOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['contact'] } },
		options: [
			{ name: 'Get', value: 'get', action: 'Get a contact', description: 'Get a single contact by ID' },
			{ name: 'Get Many', value: 'getMany', action: 'Get many contacts', description: 'List/search contacts with pagination' },
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
		description: 'ID of the contact to retrieve',
		displayOptions: { show: { resource: ['contact'], operation: ['get'] } },
	},
	{
		displayName: 'Search',
		name: 'search',
		type: 'string',
		default: '',
		description: 'Filter contacts by name, phone or JID',
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
