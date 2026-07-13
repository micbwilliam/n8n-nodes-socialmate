import type { INodeProperties } from 'n8n-workflow';

export const webhookOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['webhook'] } },
		options: [
			{ name: 'Create', value: 'create', action: 'Create a webhook', description: 'Administrative. **An AI agent must never call this.** Registers a webhook endpoint (URL + event list) and returns it. To receive events, use the SocialMate Trigger node instead — it registers and cleans up its own endpoint. Requires an admin-scope key.' },
			{ name: 'Delete', value: 'delete', action: 'Delete a webhook', description: 'Administrative. **An AI agent must never call this.** Permanently deletes a webhook endpoint by its ID — delivery to that URL stops at once, silently breaking whatever workflow was listening. Returns {ok}. Do it in the SocialMate app. Requires an admin-scope key.' },
			{ name: 'Get', value: 'get', action: 'Get a webhook', description: 'Administrative — returns one webhook endpoint by its ID: label, URL, subscribed events, enabled flag and consecutive-failure count. Read-only diagnostics for a human operator. To receive events, use the SocialMate Trigger node rather than registering anything.' },
			{ name: 'Get Deliveries', value: 'getDeliveries', action: 'Get deliveries', description: 'Administrative — returns recent delivery attempts for one endpoint (event name, HTTP status, attempt number, timestamp). Read-only. Use to debug why an endpoint is not receiving events; it changes nothing.' },
			{ name: 'Get Many', value: 'getMany', action: 'Get many webhooks', description: 'Administrative — lists every registered webhook endpoint with its ID, label, URL, events, enabled flag and failure count. Read-only. Use to audit what is subscribed; to receive events, use the SocialMate Trigger node.' },
			{ name: 'Test', value: 'test', action: 'Test a webhook', description: 'Administrative — sends a synthetic (not real) event to one endpoint and returns the HTTP status it answered with. For a human verifying a URL is reachable while wiring delivery up; no WhatsApp message is sent and nothing is changed.' },
			{ name: 'Update', value: 'update', action: 'Update a webhook', description: 'Administrative. **An AI agent must never call this.** Rewrites an existing endpoint\'s label, URL, event list or enabled flag — i.e. re-points where SocialMate delivers events. Returns the updated endpoint. Do it in the SocialMate app. Requires an admin-scope key.' },
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
