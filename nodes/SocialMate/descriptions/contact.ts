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
			{
				name: 'Update',
				value: 'update',
				action: 'Update a contact',
				description: 'Saves what your AI agent learned about a contact — a custom name, notes, email, company, tags — into SocialMate (Agent Memory). The name then shows in every future transcript and the app, so the agent never re-asks. Creates the contact if the ID is a brand-new number. SocialMate stores what you learned; it does not generate it. Requires SocialMate Pro. A left-empty field is not changed.',
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
		displayName: 'Contact ID',
		name: 'contactId',
		type: 'string',
		default: '',
		required: true,
		description: 'The contact to enrich — an ID from Get Many / a trigger payload (e.g. {{$JSON.data.senderId}}), or a plain phone number in full international format. A group ID is rejected. Unknown numbers are created.',
		displayOptions: { show: { resource: ['contact'], operation: ['update'] } },
	},
	{
		displayName: 'Fields to Save',
		name: 'enrichment',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		description: 'What your agent learned about this contact. Only the fields you add are changed; the rest are left as-is.',
		displayOptions: { show: { resource: ['contact'], operation: ['update'] } },
		options: [
			{ displayName: 'Company', name: 'company', type: 'string', default: '', description: 'Company or organization' },
			{ displayName: 'Custom Name', name: 'customName', type: 'string', default: '', description: 'Agent-set display name (e.g. "Jane (VIP)"). Wins the display label everywhere; a WhatsApp sync can never overwrite it.' },
			{ displayName: 'Email', name: 'email', type: 'string', placeholder: 'name@email.com', default: '', description: 'Contact email address' },
			{ displayName: 'Notes', name: 'notes', type: 'string', typeOptions: { rows: 2 }, default: '', description: 'Free-form notes about the contact' },
			{ displayName: 'Tags', name: 'tags', type: 'string', default: '', description: 'Comma-separated tags, e.g. "vip, lead" (up to 32)' },
		],
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
