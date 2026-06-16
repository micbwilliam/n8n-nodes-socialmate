import type { INodeProperties } from 'n8n-workflow';

export const systemOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['system'] } },
		options: [
			{
				name: 'Get Capabilities',
				value: 'getCapabilities',
				action: 'Get capabilities',
				description: 'Tier, feature flags, tunnel mode/URL and accounts (the integration handshake)',
			},
			{ name: 'Get Status', value: 'getStatus', action: 'Get status', description: 'Deep health: DB, tunnel, adapters, queue, webhooks' },
			{ name: 'Get Version', value: 'getVersion', action: 'Get version', description: 'Build identity (version, runtime, git commit)' },
		],
		default: 'getCapabilities',
	},
];

export const systemFields: INodeProperties[] = [];
