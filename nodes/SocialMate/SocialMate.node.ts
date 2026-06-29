import type {
	IExecuteFunctions,
	IDataObject,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import {
	socialmateApiRequest,
	socialmateApiRequestAllItems,
	normalizeChatId,
	SOCIALMATE_CREDENTIAL,
} from './GenericFunctions';
import { getAccounts, getChats, getGroups } from './methods/loadOptions';
import { accountIdProperty } from './descriptions/common';
import { messageOperations, messageFields } from './descriptions/message';
import { chatOperations, chatFields } from './descriptions/chat';
import { contactOperations, contactFields } from './descriptions/contact';
import { groupOperations, groupFields } from './descriptions/group';
import { mediaOperations, mediaFields } from './descriptions/media';
import { queueOperations, queueFields } from './descriptions/queue';
import { accountOperations, accountFields } from './descriptions/account';
import { syncOperations, syncFields } from './descriptions/sync';
import { webhookOperations, webhookFields } from './descriptions/webhook';
import { apiKeyOperations, apiKeyFields } from './descriptions/apiKey';
import { systemOperations, systemFields } from './descriptions/system';

/** "Tue, 12:00" → unix ms (or null when empty). */
function toUnixMs(value: unknown): number | null {
	if (!value) return null;
	const ms = new Date(value as string).getTime();
	return Number.isNaN(ms) ? null : ms;
}

/**
 * Phone (any human format) → `<digits>@s.whatsapp.net`; JIDs pass through
 * unchanged. Reuses `normalizeChatId` so participants honor the same lenient
 * format rule (punctuation, `+`, `00` prefix) as the send recipient field.
 */
function toParticipantJid(token: string): string {
	const t = (token ?? '').trim();
	if (!t) return '';
	const normalized = normalizeChatId(t);
	return normalized.includes('@') ? normalized : `${normalized}@s.whatsapp.net`;
}

function splitCsv(value: string): string[] {
	return (value ?? '')
		.split(',')
		.map((s) => s.trim())
		.filter((s) => s.length > 0);
}

export class SocialMate implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'SocialMate',
		name: 'socialMate',
		icon: 'file:socialmate.svg',
		group: ['output'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Automate WhatsApp through your self-hosted SocialMate server',
		defaults: { name: 'SocialMate' },
		inputs: ['main'],
		outputs: ['main'],
		credentials: [{ name: 'socialMateApi', required: true }],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Account', value: 'account' },
					{ name: 'API Key', value: 'apiKey' },
					{ name: 'Chat', value: 'chat' },
					{ name: 'Contact', value: 'contact' },
					{ name: 'Group', value: 'group' },
					{ name: 'Media', value: 'media' },
					{ name: 'Message', value: 'message' },
					{ name: 'Queue', value: 'queue' },
					{ name: 'Sync', value: 'sync' },
					{ name: 'System', value: 'system' },
					{ name: 'Webhook', value: 'webhook' },
				],
				default: 'message',
			},
			...messageOperations,
			...chatOperations,
			...contactOperations,
			...groupOperations,
			...mediaOperations,
			...queueOperations,
			...accountOperations,
			...syncOperations,
			...webhookOperations,
			...apiKeyOperations,
			...systemOperations,
			accountIdProperty,
			...messageFields,
			...chatFields,
			...contactFields,
			...groupFields,
			...mediaFields,
			...queueFields,
			...accountFields,
			...syncFields,
			...webhookFields,
			...apiKeyFields,
			...systemFields,
		],
	};

	methods = {
		loadOptions: { getAccounts, getChats, getGroups },
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		// Account scope (v2.1): the API key defines which accounts it may use.
		// GET /v1/accounts is filtered server-side to exactly that set, so when an
		// operation's Account field is left empty we resolve it from the scope:
		// a single-account key auto-selects; a multi-account key requires a pick.
		// (Back-compat: an old credential's `accountId` still acts as the default.)
		const creds = await this.getCredentials(SOCIALMATE_CREDENTIAL);
		const legacyDefault = (creds.accountId as string) || '';
		let scopeDefault = legacyDefault;
		let scopeCount = legacyDefault ? 1 : -1;
		if (!legacyDefault) {
			try {
				const accs = (await socialmateApiRequest.call(this, 'GET', '/v1/accounts')) as Array<{ id: string }>;
				scopeCount = accs.length;
				if (accs.length === 1) scopeDefault = accs[0].id;
			} catch {
				// Leave unresolved — a per-operation error is clearer than failing the whole run here.
			}
		}

		for (let i = 0; i < items.length; i++) {
			try {
				const acc = (): string => {
					const explicit = (this.getNodeParameter('accountId', i, '') as string) || '';
					if (explicit) return explicit;
					if (scopeDefault) return scopeDefault;
					throw new NodeOperationError(
						this.getNode(),
						scopeCount > 1
							? `Select an Account — this API key can use ${scopeCount} accounts, so one can't be chosen automatically.`
							: 'No account is available for this API key. Check the connection in SocialMate → API & Integrations → n8n.',
						{ itemIndex: i },
					);
				};
				let responseData: unknown;
				let binary: INodeExecutionData['binary'];

				// ─── System ───────────────────────────────────────────────
				if (resource === 'system') {
					const systemPaths: Record<string, string> = {
						getCapabilities: '/v1/capabilities',
						getStatus: '/v1/status',
						getVersion: '/v1/version',
						getNetworkStatus: '/v1/network/status',
					};
					responseData = await socialmateApiRequest.call(this, 'GET', systemPaths[operation] ?? '/v1/version');
				}

				// ─── Account ──────────────────────────────────────────────
				else if (resource === 'account') {
					if (operation === 'getMany') responseData = await socialmateApiRequest.call(this, 'GET', '/v1/accounts');
					else if (operation === 'get') responseData = await socialmateApiRequest.call(this, 'GET', `/v1/accounts/${acc()}`);
					else responseData = await socialmateApiRequest.call(this, 'GET', `/v1/accounts/${acc()}/antiban`);
				}

				// ─── Chat ─────────────────────────────────────────────────
				else if (resource === 'chat') {
					responseData = await socialmateApiRequest.call(this, 'GET', `/v1/accounts/${acc()}/chats`);
				}

				// ─── Contact ──────────────────────────────────────────────
				else if (resource === 'contact') {
					if (operation === 'get') {
						const contactId = this.getNodeParameter('contactId', i) as string;
						responseData = await socialmateApiRequest.call(this, 'GET', `/v1/accounts/${acc()}/contacts/${contactId}`);
					} else {
						const search = this.getNodeParameter('search', i, '') as string;
						const qs: IDataObject = search ? { search } : {};
						const returnAll = this.getNodeParameter('returnAll', i, false) as boolean;
						const limit = returnAll ? 0 : (this.getNodeParameter('limit', i, 50) as number);
						responseData = await socialmateApiRequestAllItems.call(this, `/v1/accounts/${acc()}/contacts`, qs, returnAll, limit);
					}
				}

				// ─── Message ──────────────────────────────────────────────
				else if (resource === 'message') {
					if (operation === 'sendText' || operation === 'sendMedia') {
						const chatId = normalizeChatId(this.getNodeParameter('chatId', i) as string);
						const sendOptions = this.getNodeParameter('sendOptions', i, {}) as IDataObject;
						const body: IDataObject = { chatId, ...sendOptions };
						if (operation === 'sendText') {
							body.text = this.getNodeParameter('text', i) as string;
						} else {
							const mediaType = this.getNodeParameter('mediaType', i) as string;
							const mediaSource = this.getNodeParameter('mediaSource', i) as string;
							const extra = this.getNodeParameter('mediaOptions', i, {}) as IDataObject;
							const media: IDataObject = { type: mediaType, ...extra };
							if (mediaSource === 'url') {
								media.url = this.getNodeParameter('mediaUrl', i) as string;
							} else if (mediaSource === 'base64') {
								media.base64 = this.getNodeParameter('mediaBase64', i) as string;
							} else {
								const prop = this.getNodeParameter('binaryPropertyName', i) as string;
								const buffer = await this.helpers.getBinaryDataBuffer(i, prop);
								media.base64 = buffer.toString('base64');
								const meta = items[i].binary?.[prop];
								if (meta?.fileName && !media.filename) media.filename = meta.fileName;
								if (meta?.mimeType && !media.mimetype) media.mimetype = meta.mimeType;
							}
							body.media = media;
						}
						responseData = await socialmateApiRequest.call(this, 'POST', `/v1/accounts/${acc()}/messages`, body);
					} else if (operation === 'getAiContext') {
						const chatId = normalizeChatId(this.getNodeParameter('chatId', i) as string);
						const o = this.getNodeParameter('aiContextOptions', i, {}) as IDataObject;
						const qs: IDataObject = { chatId };
						if (o.maxMessages !== undefined) qs.maxMessages = o.maxMessages;
						if (o.maxTokens !== undefined) qs.maxTokens = o.maxTokens;
						if (o.format) qs.format = o.format;
						if (o.includeTimestamps !== undefined) qs.includeTimestamps = o.includeTimestamps ? '1' : '0';
						if (o.beforeTs) qs.beforeTs = o.beforeTs;
						if (o.order) qs.order = o.order;
						responseData = await socialmateApiRequest.call(this, 'GET', `/v1/accounts/${acc()}/ai-context`, {}, qs);
					} else {
						const filters = this.getNodeParameter('searchFilters', i, {}) as IDataObject;
						const returnAll = this.getNodeParameter('returnAll', i, false) as boolean;
						const limit = returnAll ? 0 : (this.getNodeParameter('limit', i, 50) as number);
						responseData = await socialmateApiRequestAllItems.call(this, `/v1/accounts/${acc()}/messages`, filters, returnAll, limit);
					}
				}

				// ─── Group ────────────────────────────────────────────────
				else if (resource === 'group') {
					const base = `/v1/accounts/${acc()}/groups`;
					if (operation === 'getMany') responseData = await socialmateApiRequest.call(this, 'GET', base);
					else if (operation === 'get') responseData = await socialmateApiRequest.call(this, 'GET', `${base}/${this.getNodeParameter('groupId', i)}`);
					else if (operation === 'create') {
						const participants = splitCsv(this.getNodeParameter('participants', i) as string).map(toParticipantJid);
						responseData = await socialmateApiRequest.call(this, 'POST', base, { name: this.getNodeParameter('name', i), participants });
					} else if (operation === 'updateParticipants') {
						const participants = splitCsv(this.getNodeParameter('participants', i) as string).map(toParticipantJid);
						responseData = await socialmateApiRequest.call(this, 'POST', `${base}/${this.getNodeParameter('groupId', i)}/participants`, {
							participants,
							action: this.getNodeParameter('participantAction', i),
						});
					} else if (operation === 'setSubject') {
						responseData = await socialmateApiRequest.call(this, 'PUT', `${base}/${this.getNodeParameter('groupId', i)}/subject`, { subject: this.getNodeParameter('subject', i) });
					} else if (operation === 'setDescription') {
						responseData = await socialmateApiRequest.call(this, 'PUT', `${base}/${this.getNodeParameter('groupId', i)}/description`, { description: this.getNodeParameter('description', i) });
					} else if (operation === 'getInvite') {
						responseData = await socialmateApiRequest.call(this, 'GET', `${base}/${this.getNodeParameter('groupId', i)}/invite`);
					} else {
						responseData = await socialmateApiRequest.call(this, 'POST', `${base}/${this.getNodeParameter('groupId', i)}/leave`);
					}
				}

				// ─── Media ────────────────────────────────────────────────
				else if (resource === 'media') {
					const base = `/v1/accounts/${acc()}/media`;
					if (operation === 'getMany') {
						const filters = this.getNodeParameter('mediaFilters', i, {}) as IDataObject;
						const qs: IDataObject = {};
						for (const [k, v] of Object.entries(filters)) if (v !== '' && v !== 'all') qs[k] = v;
						const returnAll = this.getNodeParameter('returnAll', i, false) as boolean;
						const limit = returnAll ? 0 : (this.getNodeParameter('limit', i, 50) as number);
						responseData = await socialmateApiRequestAllItems.call(this, base, qs, returnAll, limit);
					} else if (operation === 'getStats') {
						responseData = await socialmateApiRequest.call(this, 'GET', `${base}/stats`);
					} else if (operation === 'getDownloadQueue') {
						// Server-wide download queue — not account-scoped.
						responseData = await socialmateApiRequest.call(this, 'GET', '/v1/media/queue');
					} else if (operation === 'cleanup') {
						// Server-wide retention/quota sweep (Pro). 402 if Free.
						responseData = await socialmateApiRequest.call(this, 'POST', '/v1/media/cleanup');
					} else {
						const mediaId = this.getNodeParameter('mediaId', i) as string;
						if (operation === 'get') responseData = await socialmateApiRequest.call(this, 'GET', `${base}/${mediaId}`);
						else if (operation === 'forceDownload') responseData = await socialmateApiRequest.call(this, 'POST', `${base}/${mediaId}/download`);
						else if (operation === 'delete') responseData = await socialmateApiRequest.call(this, 'DELETE', `${base}/${mediaId}`);
						else if (operation === 'getThumbnail') {
							// Stream the inline JPEG thumbnail into a binary field.
							const buffer = (await socialmateApiRequest.call(this, 'GET', `${base}/${mediaId}/thumbnail`, {}, {}, { encoding: 'arraybuffer' })) as Buffer;
							const prop = this.getNodeParameter('binaryPropertyName', i) as string;
							binary = { [prop]: await this.helpers.prepareBinaryData(buffer, `${mediaId}.jpg`, 'image/jpeg') };
							responseData = { id: mediaId, thumbnail: true };
						} else {
							// getFile — fetch metadata for name/mime, then stream the bytes into a binary field.
							const meta = (await socialmateApiRequest.call(this, 'GET', `${base}/${mediaId}`)) as IDataObject;
							const buffer = (await socialmateApiRequest.call(this, 'GET', `${base}/${mediaId}/file`, {}, {}, { encoding: 'arraybuffer' })) as Buffer;
							const prop = this.getNodeParameter('binaryPropertyName', i) as string;
							const fileName = (meta.fileName as string) || `${mediaId}`;
							const mimeType = (meta.mimeType as string) || 'application/octet-stream';
							binary = { [prop]: await this.helpers.prepareBinaryData(buffer, fileName, mimeType) };
							responseData = meta;
						}
					}
				}

				// ─── Queue ────────────────────────────────────────────────
				else if (resource === 'queue') {
					if (operation === 'enqueue') {
						const opts = this.getNodeParameter('enqueueOptions', i, {}) as IDataObject;
						const body: IDataObject = {
							chatId: normalizeChatId(this.getNodeParameter('chatId', i) as string),
							content: this.getNodeParameter('content', i) as string,
						};
						if (opts.displayName) body.displayName = opts.displayName;
						if (opts.priority !== undefined) body.priority = opts.priority;
						if (opts.maxRetries !== undefined) body.maxRetries = opts.maxRetries;
						body.scheduledAt = toUnixMs(opts.scheduledAt);
						responseData = await socialmateApiRequest.call(this, 'POST', `/v1/accounts/${acc()}/queue/items`, body);
					} else if (operation === 'import') {
						const opts = this.getNodeParameter('importOptions', i, {}) as IDataObject;
						const rawRows = this.getNodeParameter('rows', i) as unknown;
						const rows = typeof rawRows === 'string' ? JSON.parse(rawRows) : rawRows;
						const body: IDataObject = {
							template: this.getNodeParameter('template', i) as string,
							rows,
							scheduledAt: toUnixMs(opts.scheduledAt),
						};
						if (opts.batchName) body.batchName = opts.batchName;
						if (opts.priority !== undefined) body.priority = opts.priority;
						if (opts.maxRetries !== undefined) body.maxRetries = opts.maxRetries;
						responseData = await socialmateApiRequest.call(this, 'POST', `/v1/accounts/${acc()}/queue/import`, body);
					} else if (operation === 'getStatus') {
						responseData = await socialmateApiRequest.call(this, 'GET', '/v1/queue/status');
					} else if (operation === 'getItems' || operation === 'getBatches') {
						const filters = operation === 'getItems' ? (this.getNodeParameter('itemFilters', i, {}) as IDataObject) : {};
						const qs: IDataObject = { ...filters };
						const accountId = (this.getNodeParameter('accountId', i, '') as string) || scopeDefault;
						if (accountId) qs.accountId = accountId;
						const endpoint = operation === 'getItems' ? '/v1/queue/items' : '/v1/queue/batches';
						const returnAll = this.getNodeParameter('returnAll', i, false) as boolean;
						const limit = returnAll ? 0 : (this.getNodeParameter('limit', i, 50) as number);
						responseData = await socialmateApiRequestAllItems.call(this, endpoint, qs, returnAll, limit);
					} else if (operation === 'cancelItem') {
						responseData = await socialmateApiRequest.call(this, 'DELETE', `/v1/queue/items/${this.getNodeParameter('itemId', i)}`);
					} else if (operation === 'retryItem') {
						responseData = await socialmateApiRequest.call(this, 'POST', `/v1/queue/items/${this.getNodeParameter('itemId', i)}/retry`);
					} else if (operation === 'cancelBatch') {
						responseData = await socialmateApiRequest.call(this, 'DELETE', `/v1/queue/batches/${this.getNodeParameter('batchId', i)}`);
					} else if (operation === 'retryBatch') {
						responseData = await socialmateApiRequest.call(this, 'POST', `/v1/queue/batches/${this.getNodeParameter('batchId', i)}/retry`);
					} else {
						// pause / resume
						const scope = this.getNodeParameter('pauseScope', i, 'account') as string;
						const body: IDataObject = {};
						if (scope === 'account') body.accountId = acc();
						responseData = await socialmateApiRequest.call(this, 'POST', `/v1/queue/${operation}`, body);
					}
				}

				// ─── Sync ─────────────────────────────────────────────────
				else if (resource === 'sync') {
					if (operation === 'trigger') {
						responseData = await socialmateApiRequest.call(this, 'POST', `/v1/accounts/${acc()}/sync`, { type: this.getNodeParameter('syncType', i, 'full') });
					} else {
						responseData = await socialmateApiRequest.call(this, 'GET', '/v1/sync/status');
					}
				}

				// ─── Webhook ──────────────────────────────────────────────
				else if (resource === 'webhook') {
					if (operation === 'getMany') responseData = await socialmateApiRequest.call(this, 'GET', '/v1/webhooks');
					else if (operation === 'get') responseData = await socialmateApiRequest.call(this, 'GET', `/v1/webhooks/${this.getNodeParameter('webhookId', i)}`);
					else if (operation === 'create') {
						responseData = await socialmateApiRequest.call(this, 'POST', '/v1/webhooks', {
							label: this.getNodeParameter('label', i),
							url: this.getNodeParameter('url', i),
							events: splitCsv(this.getNodeParameter('events', i, '') as string),
							enabled: true,
						});
					} else if (operation === 'update') {
						const fields = this.getNodeParameter('updateFields', i, {}) as IDataObject;
						const body: IDataObject = { ...fields };
						if (typeof fields.events === 'string') body.events = splitCsv(fields.events);
						responseData = await socialmateApiRequest.call(this, 'PATCH', `/v1/webhooks/${this.getNodeParameter('webhookId', i)}`, body);
					} else if (operation === 'delete') {
						responseData = await socialmateApiRequest.call(this, 'DELETE', `/v1/webhooks/${this.getNodeParameter('webhookId', i)}`);
					} else if (operation === 'test') {
						responseData = await socialmateApiRequest.call(this, 'POST', `/v1/webhooks/${this.getNodeParameter('webhookId', i)}/test`);
					} else {
						responseData = await socialmateApiRequest.call(this, 'GET', `/v1/webhooks/${this.getNodeParameter('webhookId', i)}/deliveries`);
					}
				}

				// ─── API Key ──────────────────────────────────────────────
				else if (resource === 'apiKey') {
					if (operation === 'getMany') responseData = await socialmateApiRequest.call(this, 'GET', '/v1/api-keys');
					else if (operation === 'create') {
						responseData = await socialmateApiRequest.call(this, 'POST', '/v1/api-keys', {
							label: this.getNodeParameter('label', i),
							scopes: this.getNodeParameter('scopes', i, ['read', 'send']),
						});
					} else if (operation === 'rotate') {
						responseData = await socialmateApiRequest.call(this, 'POST', `/v1/api-keys/${this.getNodeParameter('keyId', i)}/rotate`);
					} else {
						responseData = await socialmateApiRequest.call(this, 'DELETE', `/v1/api-keys/${this.getNodeParameter('keyId', i)}`);
					}
				}

				// ─── Collect ──────────────────────────────────────────────
				if (Array.isArray(responseData)) {
					for (const entry of responseData) {
						returnData.push({ json: entry as IDataObject, pairedItem: { item: i } });
					}
				} else {
					returnData.push({
						json: (responseData ?? {}) as IDataObject,
						...(binary ? { binary } : {}),
						pairedItem: { item: i },
					});
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}
