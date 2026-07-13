import type { INodeProperties } from 'n8n-workflow';

export const apiKeyOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['apiKey'] } },
		options: [
			{ name: 'Get Many', value: 'getMany', action: 'Get many API keys', description: '**An AI agent must never call this.** Administrative: it enumerates the credentials the workflow itself is running on. Lists every API key registered on this server — each one as its ID and {label, prefix, scopes, accounts, createdAt, lastUsedAt, revoked}. The secret is never returned, only its short prefix, so nothing here is usable for authentication; what it does hand over is the key IDs that Rotate and Delete destroy, which is exactly the footgun. An agent needs none of this to send or read messages — use System: Get Capabilities to learn what this server allows. Credential management belongs in the SocialMate app (Settings → API & Integrations), not in a workflow. Needs a read-scope key.' },
			{ name: 'Create', value: 'create', action: 'Create an API key', description: '**An AI agent must never call this.** Administrative: it mints a new credential with standing access to the user\'s WhatsApp. Creates an API key with the given label and scopes and returns {plaintext, key} — plaintext is the full secret, shown ONCE and never retrievable again. A workflow that logs it has leaked a live credential to whoever can read the execution; a workflow that drops it has created an orphan key nobody can use but that still authenticates. Neither is undoable from here. Create keys in the SocialMate app (Settings → API & Integrations). Requires an admin-scope key.' },
			{ name: 'Rotate', value: 'rotate', action: 'Rotate an API key', description: '**An AI agent must never call this.** Administrative: it revokes the credential the workflow itself may be running on. Issues a fresh secret for an existing key and kills the old one immediately — every integration still presenting it starts failing with 401, very possibly including this node\'s own credential, mid-run. Returns {plaintext, key} with the new secret shown ONCE; the old one cannot be restored. Rotate keys in the SocialMate app (Settings → API & Integrations), where the new secret can actually be copied into the integrations that need it. Requires an admin-scope key.' },
			{ name: 'Delete', value: 'delete', action: 'Delete an API key', description: '**An AI agent must never call this.** Administrative: it destroys the credential the workflow itself may be running on. Revokes and permanently deletes an API key — this workflow, the SocialMate Trigger, and every other integration authenticating with it stop working at once with 401, silently and with no way back: a deleted key cannot be restored, only replaced. Returns {ok: true}, or 404 if it was already gone. Delete keys in the SocialMate app (Settings → API & Integrations). Requires an admin-scope key.' },
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
