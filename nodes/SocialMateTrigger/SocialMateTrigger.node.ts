import type {
	IDataObject,
	IHookFunctions,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
} from 'n8n-workflow';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

import { socialmateApiRequest, normalizeBaseUrl } from '../SocialMate/GenericFunctions';

/** Every event SocialMate can deliver. Pro-only ones are labelled. */
const EVENT_OPTIONS: Array<{ name: string; value: string }> = [
	{ name: 'Message Received', value: 'message.received' },
	{ name: 'Message Sent', value: 'message.sent' },
	{ name: 'Account Connected', value: 'account.connected' },
	{ name: 'Account Disconnected', value: 'account.disconnected' },
	{ name: 'Account Banned (Pro)', value: 'account.banned' },
	{ name: 'Contacts Updated (Pro)', value: 'contacts.updated' },
	{ name: 'Tunnel Started', value: 'tunnel.started' },
	{ name: 'Tunnel URL Changed', value: 'tunnel.url_changed' },
	{ name: 'Tunnel Stopped', value: 'tunnel.stopped' },
	{ name: 'Sync Started (Pro)', value: 'sync.started' },
	{ name: 'Sync Completed (Pro)', value: 'sync.completed' },
	{ name: 'Sync Failed (Pro)', value: 'sync.failed' },
	{ name: 'Media Discovered (Pro)', value: 'media.discovered' },
	{ name: 'Media Downloaded (Pro)', value: 'media.downloaded' },
	{ name: 'Media Failed (Pro)', value: 'media.failed' },
	{ name: 'Media Deleted (Pro)', value: 'media.deleted' },
	{ name: 'Queue Item Enqueued (Pro)', value: 'queue.item.enqueued' },
	{ name: 'Queue Item Processing (Pro)', value: 'queue.item.processing' },
	{ name: 'Queue Item Sent (Pro)', value: 'queue.item.sent' },
	{ name: 'Queue Item Failed (Pro)', value: 'queue.item.failed' },
	{ name: 'Queue Item Cancelled (Pro)', value: 'queue.item.cancelled' },
	{ name: 'Queue Batch Created (Pro)', value: 'queue.batch.created' },
	{ name: 'Queue Batch Completed (Pro)', value: 'queue.batch.completed' },
	{ name: 'Queue Batch Cancelled (Pro)', value: 'queue.batch.cancelled' },
	{ name: 'Danger Mode Enabled (Pro)', value: 'account.danger_mode_enabled' },
	{ name: 'Danger Mode Disabled (Pro)', value: 'account.danger_mode_disabled' },
	{ name: 'License Activated', value: 'license.activated' },
	{ name: 'License Deactivated', value: 'license.deactivated' },
	{ name: 'License Tier Changed', value: 'license.tier_changed' },
];

export class SocialMateTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'SocialMate Trigger',
		name: 'socialMateTrigger',
		icon: 'file:socialmate.svg',
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["events"].join(", ")}}',
		description: 'Starts a workflow when SocialMate emits a webhook event (incoming messages, connection changes, queue/sync events, …)',
		defaults: { name: 'SocialMate Trigger' },
		inputs: [],
		outputs: ['main'],
		credentials: [{ name: 'socialMateApi', required: true }],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
		properties: [
			{
				displayName: 'Events',
				name: 'events',
				type: 'multiOptions',
				required: true,
				default: ['message.received'],
				description: 'Which SocialMate events should start this workflow. "(Pro)" events are only delivered when the server is on a Pro tier.',
				options: EVENT_OPTIONS,
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Verify Signature',
						name: 'verifySignature',
						type: 'boolean',
						default: true,
						description: 'Whether to reject deliveries whose HMAC signature does not match (recommended). Requires an admin-scope key so the trigger can register a signing secret.',
					},
					{
						displayName: 'Filter by Account ID',
						name: 'accountId',
						type: 'string',
						default: '',
						description: 'Only emit events for this account ID (leave empty for all accounts)',
					},
				],
			},
		],
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default');
				const staticData = this.getWorkflowStaticData('node');
				const endpoints = (await socialmateApiRequest.call(this, 'GET', '/v1/webhooks')) as Array<{ id: string; url: string }>;
				const existing = (endpoints ?? []).find((e) => e.url === webhookUrl);
				if (existing) {
					staticData.webhookId = existing.id;
					return true;
				}
				return false;
			},

			async create(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default');
				const events = this.getNodeParameter('events', []) as string[];
				const workflowName = this.getWorkflow().name ?? 'workflow';
				const staticData = this.getWorkflowStaticData('node');
				const secret = randomBytes(24).toString('hex');

				const created = (await socialmateApiRequest.call(this, 'POST', '/v1/webhooks', {
					label: `n8n: ${workflowName}`,
					url: webhookUrl,
					events,
					secret,
					enabled: true,
				})) as { id: string };

				staticData.webhookId = created.id;
				staticData.secret = secret;
				return true;
			},

			async delete(this: IHookFunctions): Promise<boolean> {
				const staticData = this.getWorkflowStaticData('node');
				const webhookId = staticData.webhookId as string | undefined;
				if (webhookId) {
					try {
						await socialmateApiRequest.call(this, 'DELETE', `/v1/webhooks/${webhookId}`);
					} catch {
						// Endpoint may already be gone — deletion is best-effort.
					}
					delete staticData.webhookId;
					delete staticData.secret;
				}
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const req = this.getRequestObject();
		const headers = this.getHeaderData() as IDataObject;
		const body = this.getBodyData() as IDataObject;
		const options = this.getNodeParameter('options', {}) as IDataObject;
		const nodeStaticData = this.getWorkflowStaticData('node');
		const secret = nodeStaticData.secret as string | undefined;

		// ── Signature verification ──
		const verify = options.verifySignature !== false;
		if (verify && secret) {
			const signature = (headers['x-socialmate-signature'] as string) ?? '';
			const timestamp = (headers['x-socialmate-timestamp'] as string) ?? '';
			const raw = (req as unknown as { rawBody?: Buffer | string }).rawBody;
			const rawBody = raw ? (Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw)) : JSON.stringify(body);
			const expected = 'sha256=' + createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
			const ok =
				signature.length === expected.length &&
				timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
			if (!ok) {
				const res = this.getResponseObject();
				res.status(401).json({ error: 'invalid_signature' });
				return { noWebhookResponse: true };
			}
		}

		// ── Beacon auto-heal: cache the current tunnel URL for action nodes ──
		const tunnelUrl = normalizeBaseUrl(body.tunnelUrl as string);
		if (tunnelUrl) {
			const globalData = this.getWorkflowStaticData('global');
			globalData.socialMateBaseUrl = tunnelUrl;
		}

		// ── Optional account filter ──
		const filterAccount = (options.accountId as string) ?? '';
		if (filterAccount) {
			const data = (body.data ?? {}) as IDataObject;
			const eventAccount = (data.accountId as string) ?? (data.account as string) ?? '';
			if (eventAccount && eventAccount !== filterAccount) {
				return { workflowData: [] };
			}
		}

		return { workflowData: [this.helpers.returnJsonArray([body])] };
	}
}
