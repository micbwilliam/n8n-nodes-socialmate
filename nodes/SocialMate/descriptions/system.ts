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
				description: 'Returns the server\'s tier, feature flags, tunnel mode/URL, accounts — and a tools array saying, per tool, whether THIS caller can actually call it. Each entry carries {name, n8nNode, available, feature?, requiresAdminKey?, reason?}: available false with a feature means the licence tier is wrong (a call returns 402), while requiresAdminKey means the API key lacks admin scope (403 on any tier — Pro does not help). The integration handshake: call it first rather than discovering the limits by failing.',
			},
			{ name: 'Get Network Status', value: 'getNetworkStatus', action: 'Get network status', description: 'Administrative — returns only how the server is reachable: its tunnel URL and API port. A light connectivity probe for a setup workflow. It says nothing about tier, features or accounts — use Get Capabilities for those, or Get Status for a full health check.' },
			{ name: 'Get Status', value: 'getStatus', action: 'Get status', description: 'Administrative — a deep health check of the server itself. Returns an overall ok flag plus database, tunnel, per-account adapter, queue and webhook-failure status. Use in a monitoring workflow. Do not use it to decide what you may do — use Get Capabilities for tier and features, or Account: Get Anti-Ban Status for send headroom.' },
			{ name: 'Get Version', value: 'getVersion', action: 'Get version', description: 'Returns the build identity only — app version, Electron and Node runtime, git commit. Use to report or assert which SocialMate build a server runs. It says nothing about tier, health or accounts; use Get Capabilities for those.' },
		],
		default: 'getCapabilities',
	},
];

export const systemFields: INodeProperties[] = [];
