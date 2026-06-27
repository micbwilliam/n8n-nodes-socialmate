import type { INodeProperties } from 'n8n-workflow';

export const groupOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['group'] } },
		options: [
			{ name: 'Create', value: 'create', action: 'Create a group', description: 'Create a group (requires Pro)' },
			{ name: 'Get', value: 'get', action: 'Get a group', description: 'Get group metadata and participants' },
			{ name: 'Get Invite Link', value: 'getInvite', action: 'Get invite link', description: 'Get the group invite code and link' },
			{ name: 'Get Many', value: 'getMany', action: 'Get many groups', description: 'List all groups for the account' },
			{ name: 'Leave', value: 'leave', action: 'Leave a group', description: 'Leave the group (requires Pro)' },
			{ name: 'Set Description', value: 'setDescription', action: 'Set group description', description: 'Update the group description (requires Pro)' },
			{ name: 'Set Subject', value: 'setSubject', action: 'Set group subject', description: 'Rename the group (requires Pro)' },
			{ name: 'Update Participants', value: 'updateParticipants', action: 'Update participants', description: 'Add, remove, promote or demote members (requires Pro)' },
		],
		default: 'getMany',
	},
];

const groupIdProperty: INodeProperties = {
	displayName: 'Group Name or ID',
	name: 'groupId',
	type: 'options',
	typeOptions: { loadOptionsMethod: 'getGroups' },
	default: '',
	required: true,
	description: 'The group to act on. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
	displayOptions: {
		show: {
			resource: ['group'],
			operation: ['get', 'updateParticipants', 'setSubject', 'setDescription', 'getInvite', 'leave'],
		},
	},
};

export const groupFields: INodeProperties[] = [
	groupIdProperty,
	// ── Create ──
	{
		displayName: 'Group Name',
		name: 'name',
		type: 'string',
		default: '',
		required: true,
		description: 'Name (subject) of the new group (1–100 chars)',
		displayOptions: { show: { resource: ['group'], operation: ['create'] } },
	},
	{
		displayName: 'Participants',
		name: 'participants',
		type: 'string',
		default: '',
		required: true,
		placeholder: '15551234567, 15559876543',
		description: 'Comma-separated phone numbers or JIDs to add (1–256)',
		displayOptions: { show: { resource: ['group'], operation: ['create', 'updateParticipants'] } },
	},
	// ── Update participants ──
	{
		displayName: 'Action',
		name: 'participantAction',
		type: 'options',
		default: 'add',
		options: [
			{ name: 'Add', value: 'add' },
			{ name: 'Remove', value: 'remove' },
			{ name: 'Promote', value: 'promote' },
			{ name: 'Demote', value: 'demote' },
		],
		displayOptions: { show: { resource: ['group'], operation: ['updateParticipants'] } },
	},
	// ── Set subject / description ──
	{
		displayName: 'Subject',
		name: 'subject',
		type: 'string',
		default: '',
		required: true,
		displayOptions: { show: { resource: ['group'], operation: ['setSubject'] } },
	},
	{
		displayName: 'Description',
		name: 'description',
		type: 'string',
		typeOptions: { rows: 3 },
		default: '',
		displayOptions: { show: { resource: ['group'], operation: ['setDescription'] } },
	},
];
