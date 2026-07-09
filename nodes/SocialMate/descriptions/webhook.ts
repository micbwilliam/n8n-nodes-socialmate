import type { INodeProperties } from 'n8n-workflow';

export const webhookOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['webhook'] } },
		options: [
			{ name: 'Create', value: 'create', action: 'Create a webhook', description: 'Administrative — registers a webhook endpoint that receives SocialMate events. Prefer the SocialMate Trigger node, which self-registers. Requires an admin-scope key.' },
			{ name: 'Delete', value: 'delete', action: 'Delete a webhook', description: 'Administrative — deletes a webhook endpoint by its ID' },
			{ name: 'Get', value: 'get', action: 'Get a webhook', description: 'Administrative — gets one webhook endpoint by its ID' },
			{ name: 'Get Deliveries', value: 'getDeliveries', action: 'Get deliveries', description: 'Administrative — lists recent delivery attempts (status codes, errors) for one endpoint' },
			{ name: 'Get Many', value: 'getMany', action: 'Get many webhooks', description: 'Administrative — lists all registered webhook endpoints' },
			{ name: 'Test', value: 'test', action: 'Test a webhook', description: 'Administrative — sends a synthetic test event to one endpoint to verify it is reachable' },
			{ name: 'Update', value: 'update', action: 'Update a webhook', description: 'Administrative — updates a webhook endpoint\'s label, URL, events or enabled flag' },
		],
		default: 'getMany',
	},
];

const webhookIdProperty: INodeProperties = {
	displayName: 'Webhook ID',
	name: 'webhookId',
	type: 'string',
	default: '',
	required: true,
	displayOptions: { show: { resource: ['webhook'], operation: ['get', 'update', 'delete', 'test', 'getDeliveries'] } },
};

export const webhookFields: INodeProperties[] = [
	webhookIdProperty,
	{
		displayName: 'Label',
		name: 'label',
		type: 'string',
		default: '',
		required: true,
		displayOptions: { show: { resource: ['webhook'], operation: ['create'] } },
	},
	{
		displayName: 'URL',
		name: 'url',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'https://my-server.com/hook',
		displayOptions: { show: { resource: ['webhook'], operation: ['create'] } },
	},
	{
		displayName: 'Events',
		name: 'events',
		type: 'string',
		default: '',
		description: 'Comma-separated event names to subscribe to (empty = all allowed events)',
		displayOptions: { show: { resource: ['webhook'], operation: ['create'] } },
	},
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['webhook'], operation: ['update'] } },
		options: [
			{ displayName: 'Label', name: 'label', type: 'string', default: '' },
			{ displayName: 'URL', name: 'url', type: 'string', default: '' },
			{ displayName: 'Events (CSV)', name: 'events', type: 'string', default: '' },
			{ displayName: 'Enabled', name: 'enabled', type: 'boolean', default: true },
		],
	},
];
