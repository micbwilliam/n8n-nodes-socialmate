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
				description: 'Returns the server\'s tier, feature flags, tunnel mode/URL and accounts — the integration handshake. Use to confirm connectivity and which Pro features are available.',
			},
			{ name: 'Get Network Status', value: 'getNetworkStatus', action: 'Get network status', description: 'Administrative — returns the tunnel URL and API port, a lighter probe than Get Status' },
			{ name: 'Get Status', value: 'getStatus', action: 'Get status', description: 'Administrative — deep health check: database, tunnel, adapters, queue and webhook status' },
			{ name: 'Get Version', value: 'getVersion', action: 'Get version', description: 'Returns the build identity (app version, runtime, git commit)' },
		],
		default: 'getCapabilities',
	},
];

export const systemFields: INodeProperties[] = [];
