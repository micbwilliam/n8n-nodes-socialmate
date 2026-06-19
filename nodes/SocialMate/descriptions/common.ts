import type { INodeProperties } from 'n8n-workflow';

/** Resources that operate against a specific WhatsApp account. */
export const ACCOUNT_SCOPED_RESOURCES = [
	'message',
	'chat',
	'contact',
	'group',
	'media',
	'sync',
	'queue',
	'account',
];

/**
 * Shared account picker. Shown for every account-scoped resource. A few
 * operations (account:getMany, queue global controls) ignore it; the node's
 * execute() only reads it where the endpoint needs it, so leaving it set is
 * harmless.
 */
export const accountIdProperty: INodeProperties = {
	displayName: 'Account Name or ID',
	name: 'accountId',
	type: 'options',
	typeOptions: { loadOptionsMethod: 'getAccounts' },
	default: '',
	description: 'WhatsApp account to run this operation on. The list shows only accounts your API key is allowed to use; leave it empty to auto-select when the key is bound to a single account (a multi-account key requires a choice). Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
	displayOptions: {
		show: { resource: ACCOUNT_SCOPED_RESOURCES },
		hide: { resource: ['account'], operation: ['getMany'] },
	},
};

/** Standard "Return All / Limit" pair for list operations. */
export const returnAllProperty: INodeProperties = {
	displayName: 'Return All',
	name: 'returnAll',
	type: 'boolean',
	default: false,
	description: 'Whether to return all results or only up to a given limit',
};

export const limitProperty: INodeProperties = {
	displayName: 'Limit',
	name: 'limit',
	type: 'number',
	typeOptions: { minValue: 1 },
	default: 50,
	description: 'Max number of results to return',
};
