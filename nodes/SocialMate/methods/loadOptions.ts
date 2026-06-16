import type { ILoadOptionsFunctions, INodePropertyOptions } from 'n8n-workflow';
import { socialmateApiRequest } from '../GenericFunctions';

/** Accounts dropdown — used by every resource that operates on one account. */
export async function getAccounts(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	const accounts = (await socialmateApiRequest.call(this, 'GET', '/v1/accounts')) as Array<{
		id: string;
		name?: string;
		phone?: string;
		status?: string;
	}>;
	return (accounts ?? []).map((a) => ({
		name: `${a.name || a.phone || a.id}${a.status ? ` — ${a.status}` : ''}`,
		value: a.id,
	}));
}

/** Chats dropdown for the currently-selected account. */
export async function getChats(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	const accountId = this.getNodeParameter('accountId', '') as string;
	if (!accountId) return [];
	const chats = (await socialmateApiRequest.call(this, 'GET', `/v1/accounts/${accountId}/chats`)) as Array<{
		id: string;
		name?: string;
		type?: string;
	}>;
	return (chats ?? []).map((c) => ({
		name: `${c.name || c.id}${c.type ? ` (${c.type})` : ''}`,
		value: c.id,
	}));
}

/** Groups dropdown for the currently-selected account. */
export async function getGroups(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	const accountId = this.getNodeParameter('accountId', '') as string;
	if (!accountId) return [];
	const groups = (await socialmateApiRequest.call(this, 'GET', `/v1/accounts/${accountId}/groups`)) as Array<{
		id: string;
		subject?: string;
		name?: string;
	}>;
	return (groups ?? []).map((g) => ({
		name: g.subject || g.name || g.id,
		value: g.id,
	}));
}
