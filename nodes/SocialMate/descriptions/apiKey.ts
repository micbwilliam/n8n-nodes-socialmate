import type { INodeProperties } from 'n8n-workflow';

export const apiKeyOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['apiKey'] } },
		options: [
			{ name: 'Get Many', value: 'getMany', action: 'Get many API keys', description: 'Administrative. **An AI agent must never call this.** Lists the API keys that can reach this server — each key\'s ID, label, prefix, scopes and last-used time; the secret itself is never returned. Credential management belongs in the SocialMate app, not in a workflow. Requires an admin-scope key.' },
			{ name: 'Create', value: 'create', action: 'Create an API key', description: 'Administrative. **An AI agent must never call this.** Mints a new API key with the chosen scopes and returns its plaintext secret once — it can never be read again. Creating credentials belongs in the SocialMate app, not in a workflow. Requires an admin-scope key.' },
			{ name: 'Rotate', value: 'rotate', action: 'Rotate an API key', description: 'Administrative. **An AI agent must never call this.** Issues a new secret for an existing key and invalidates the old one immediately, breaking every integration still using it — possibly including this workflow. Returns the new plaintext secret once. Do it in the SocialMate app. Requires an admin-scope key.' },
			{ name: 'Delete', value: 'delete', action: 'Delete an API key', description: 'Administrative. **An AI agent must never call this.** Revokes and permanently deletes an API key; anything authenticating with it stops working at once — possibly including this workflow. Returns {ok}. Do it in the SocialMate app. Requires an admin-scope key.' },
		],
		default: 'getMany',
	},
];

export const apiKeyFields: INodeProperties[] = [
	{
		displayName: 'Key ID',
		name: 'keyId',
		type: 'string',
		default: '',
		required: true,
		displayOptions: { show: { resource: ['apiKey'], operation: ['rotate', 'delete'] } },
	},
	{
		displayName: 'Label',
		name: 'label',
		type: 'string',
		default: '',
		required: true,
		displayOptions: { show: { resource: ['apiKey'], operation: ['create'] } },
	},
	{
		displayName: 'Scopes',
		name: 'scopes',
		type: 'multiOptions',
		default: ['read', 'send'],
		options: [
			{ name: 'Read', value: 'read' },
			{ name: 'Send', value: 'send' },
			{ name: 'Admin', value: 'admin' },
		],
		displayOptions: { show: { resource: ['apiKey'], operation: ['create'] } },
	},
];
