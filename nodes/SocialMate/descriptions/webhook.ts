import type { INodeProperties } from 'n8n-workflow';

export const webhookOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['webhook'] } },
		options: [
			{ name: 'Create', value: 'create', action: 'Create a webhook', description: '**An AI agent must never call this.** Administrative: it decides where SocialMate delivers the user\'s WhatsApp events. Registers an endpoint (label + URL + event list) and returns it — its ID and URL plus {label, events, hasSecret, enabled, accounts, consecutiveFailures, createdAt}. Every event it subscribes to — incoming messages included — is then POSTed to that URL forever, so pointing one at the wrong host silently exfiltrates the user\'s conversations. A workflow that wants to RECEIVE events must never register one here: use the **SocialMate Trigger** node, which registers its own endpoint, verifies the HMAC signature, and removes it again when the workflow is deleted. An endpoint created here is invisible to n8n and outlives it. Requires an admin-scope key.' },
			{ name: 'Delete', value: 'delete', action: 'Delete a webhook', description: '**An AI agent must never call this.** Administrative: it stops event delivery. Permanently deletes a webhook endpoint by ID — delivery to that URL ends immediately and every workflow listening on it goes deaf with no error and no warning, possibly including the SocialMate Trigger that started this very run. Returns {ok: true}, or 404 if it was already gone. There is no undo; the endpoint has to be registered again from scratch. Do it in the SocialMate app (Settings → API & Integrations), where the user can see what they are unsubscribing. Requires an admin-scope key.' },
			{ name: 'Get', value: 'get', action: 'Get a webhook', description: 'Administrative, read-only. Returns one webhook endpoint by its ID: its URL plus {label, events, hasSecret, enabled, accounts, consecutiveFailures, disabledReason, createdAt, updatedAt} — the signing secret is never returned, only the hasSecret flag. Use it to diagnose an endpoint that stopped firing: enabled false plus a disabledReason and a high consecutiveFailures is one SocialMate auto-disabled after repeated delivery failures. It reports configuration, not traffic — for the actual attempts and their HTTP statuses, use Get Deliveries. To RECEIVE events, use the SocialMate Trigger node rather than registering or reading anything here. Needs a read-scope key.' },
			{ name: 'Get Deliveries', value: 'getDeliveries', action: 'Get deliveries', description: 'Administrative, read-only. Returns one endpoint\'s recent delivery attempts, newest first (50 by default): each carries its ID and {endpointId, endpointUrl, endpointLabel, event, statusCode, status, attempt, error, ts}, where status is "pending", "success" or "failed". This is the log to read when an endpoint is not receiving events — a failed row carries the HTTP statusCode and error that explain why, and attempt shows how far up the retry ladder it got. It only reads history: it delivers nothing, so to prove a URL is reachable right now, use Test. Needs a read-scope key.' },
			{ name: 'Get Many', value: 'getMany', action: 'Get many webhooks', description: 'Administrative, read-only. Lists every registered webhook endpoint — each as its ID and URL plus {label, events, hasSecret, enabled, accounts, consecutiveFailures, disabledReason, createdAt, updatedAt}, with secrets redacted to the hasSecret flag. Use it to audit what is subscribed to this server and to find the ID the other webhook operations take. It shows configuration, not traffic — to see whether events actually arrived, use Get Deliveries. To RECEIVE events, use the SocialMate Trigger node; nothing in this resource is needed to consume them. Needs a read-scope key.' },
			{ name: 'Test', value: 'test', action: 'Test a webhook', description: 'Administrative. Delivers one synthetic webhook.test event to an endpoint and returns the outcome of that single attempt as {ok, statusCode, error} — no retry ladder, so this is the endpoint\'s real, immediate answer. It is a connectivity check for a human wiring a URL up: no WhatsApp message is sent, nothing is stored, and the payload is fabricated, so a passing test is never evidence that a real event fired — for genuine traffic use Get Deliveries. Requires an admin-scope key.' },
			{ name: 'Update', value: 'update', action: 'Update a webhook', description: '**An AI agent must never call this.** Administrative: it re-points where SocialMate delivers the user\'s WhatsApp events. Rewrites an existing endpoint\'s label, URL, event list, secret or enabled flag and returns the updated endpoint. Changing the URL redirects every future event — incoming messages included — to a different server, and setting enabled false stops delivery entirely; in both cases the workflow that was listening (possibly the SocialMate Trigger that started this run) simply goes quiet, with nothing to tell it why. Do it in the SocialMate app (Settings → API & Integrations). Requires an admin-scope key.' },
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
