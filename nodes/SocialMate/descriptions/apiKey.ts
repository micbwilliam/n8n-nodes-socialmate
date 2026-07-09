import type { INodeProperties } from 'n8n-workflow';

export const apiKeyOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['apiKey'] } },
		options: [
			{ name: 'Get Many', value: 'getMany', action: 'Get many API keys', description: 'Administrative — lists API keys (secret hashes redacted)' },
			{ name: 'Create', value: 'create', action: 'Create an API key', description: 'Administrative — creates a new API key with chosen scopes; the plaintext key is returned once. Requires an admin-scope key.' },
			{ name: 'Rotate', value: 'rotate', action: 'Rotate an API key', description: 'Administrative — issues a new secret for an existing key, invalidating the old one' },
			{ name: 'Delete', value: 'delete', action: 'Delete an API key', description: 'Administrative — revokes and deletes an API key' },
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
