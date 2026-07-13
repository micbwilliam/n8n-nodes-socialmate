import type { INodeProperties } from 'n8n-workflow';

export const groupOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['group'] } },
		options: [
			{
				name: 'Create',
				value: 'create',
				action: 'Create a group',
				description: 'Creates a new WhatsApp group with a name (1–100 characters) and one or more starting participants, and returns the group\'s live metadata from WhatsApp — its ID (a JID ending in @g.us), subject and participant list. Pass that ID as the Chat ID to message the group, or to any other Group operation. The account must be connected (409 otherwise) and becomes the group\'s admin. Creating a group adds people to it immediately and visibly on their phones, so only include people who agreed to be in one. To add people to a group that already exists, use Update Participants instead — this always makes a NEW group. Requires Pro.',
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get a group',
				description: 'Gets one group\'s live metadata by its ID (a @g.us JID from Get Many). Returns the subject, description, participant list and which participants are admins.',
			},
			{
				name: 'Get Invite Link',
				value: 'getInvite',
				action: 'Get invite link',
				description:
					'Gets the shareable invite code and https://chat.whatsapp.com link for a group. Returns the invite link so people can join without being added manually.',
			},
			{
				name: 'Get Many',
				value: 'getMany',
				action: 'Get many groups',
				description: 'Lists every WhatsApp group the account belongs to. Returns each group\'s ID (a @g.us JID), subject and size. Use a returned ID for the other Group operations, or as a chatId to send a message to the group.',
			},
			{
				name: 'Leave',
				value: 'leave',
				action: 'Leave a group',
				description:
					'Leaves a WhatsApp group; the account stops receiving its messages. Requires Pro. Cannot be undone without a fresh invite.',
			},
			{
				name: 'Set Description',
				value: 'setDescription',
				action: 'Set group description',
				description: 'Rewrites a group\'s description — the "about" text shown under its name to every member (up to 512 characters). Returns {success: true} only; it does not echo the group back, so re-read Group: Get to confirm the new text. This does not rename the group — for the title, use Set Subject. The account must be connected and must itself be an admin of the group: WhatsApp refuses otherwise and the call fails with a 502, not a permission message. Requires Pro.',
			},
			{
				name: 'Set Subject',
				value: 'setSubject',
				action: 'Set group subject',
				description: 'Renames a group — changes the subject/title (1–100 characters) that every member sees, and WhatsApp announces the change in the chat as a system message. Returns {success: true} only; it does not echo the group back, so re-read Group: Get to confirm. This changes the group\'s name, not its "about" text — for that, use Set Description. The account must be connected and must itself be an admin of the group: WhatsApp refuses otherwise and the call fails with a 502, not a permission message. Requires Pro.',
			},
			{
				name: 'Update Participants',
				value: 'updateParticipants',
				action: 'Update participants',
				description:
					'Adds, removes, promotes (to admin) or demotes members of an existing group — Action picks which, and Participants is the list of phone numbers or JIDs it applies to. Returns {success: true} and nothing else: there is NO per-number outcome in the response, so a number that WhatsApp silently refused (privacy settings can block being added) looks identical to one that worked. Re-read Group: Get to see who is actually in the group afterwards. The account must be connected and must itself be an admin of the group, or the call fails with a 502. Adding someone puts the group on their phone immediately — only add people who agreed to be in it. To make a new group rather than change this one, use Create. Requires Pro.',
			},
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
	description: 'The group to act on — its ID/JID ending in @g.us (from Group: Get Many). Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
	displayOptions: {
		show: {
			resource: ['group'],
			operation: ['get', 'updateParticipants', 'setSubject', 'setDescription', 'getInvite', 'leave'],
		},
	},
};

export const groupFields: INodeProperties[] = [
	groupIdProperty,
	// ── Create ── (field is `groupName`, not `name`: a field literally named
	// `name` disables n8n's "let the model set this" ($fromAI) button — see
	// n8n#28261. The API body key stays `name`.)
	{
		displayName: 'Group Name',
		name: 'groupName',
		type: 'string',
		default: '',
		required: true,
		description: 'Name (subject) of the new group (1–100 characters)',
		displayOptions: { show: { resource: ['group'], operation: ['create'] } },
	},
	{
		displayName: 'Participants',
		name: 'participants',
		type: 'string',
		default: '',
		required: true,
		placeholder: '15551234567, 15559876543',
		description: 'Comma-separated phone numbers (full international format) or JIDs to add — 1 to 256 recipients',
		displayOptions: { show: { resource: ['group'], operation: ['create', 'updateParticipants'] } },
	},
	// ── Update participants ──
	{
		displayName: 'Action',
		name: 'participantAction',
		type: 'options',
		default: 'add',
		description: 'What to do with the listed participants',
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
		description: 'The group\'s new name/subject (1–100 characters)',
		displayOptions: { show: { resource: ['group'], operation: ['setSubject'] } },
	},
	{
		displayName: 'Description',
		name: 'description',
		type: 'string',
		typeOptions: { rows: 3 },
		default: '',
		description: 'The group\'s new description text',
		displayOptions: { show: { resource: ['group'], operation: ['setDescription'] } },
	},
];
