import type { INodeProperties } from 'n8n-workflow';

/**
 * Native WhatsApp AI agent (SocialMate Pro, license flag `aiEnabled`). One agent
 * per WhatsApp account, run inside the app. Routes live in the app's
 * `src/main/services/api-agents.ts`. Scopes: reads are `read`, Send Event is
 * `send`, every other write is `admin`.
 */
const AGENT_OPS_WITH_ID = [
	'get',
	'update',
	'pause',
	'resume',
	'getUsage',
	'getApprovals',
	'decideApproval',
	'getHandoffs',
	'takeOverChat',
	'releaseChat',
	'replyInChat',
	'sendEvent',
	'getKnowledge',
	'addKnowledge',
];

export const agentOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['agent'] } },
		options: [
			{ name: 'Add Knowledge', value: 'addKnowledge', action: 'Add a knowledge entry', description: 'Stores one knowledge entry (facts, a Q&A pair, a page\'s text or a model reply) that the agent can look up when it answers. Returns the stored entry with its ID and a token estimate. Use it to sync FAQs, policies or product notes from your CMS; the content is stored exactly as sent and no URL is fetched. Needs an admin-scope key. Requires Pro.' },
			{ name: 'Decide Approval', value: 'decideApproval', action: 'Approve or reject a held action', description: 'Approves or rejects an action the agent is holding for a person to check (an approval ID from Get Approvals). Approve sends the held messages through the anti-ban pipeline or runs the website action; reject drops it. Returns {ok, message}; a 409 means someone already decided or the approval expired. Needs an admin-scope key. Requires Pro.' },
			{ name: 'Get', value: 'get', action: 'Get an agent', description: 'Returns one agent\'s full configuration: persona, rules, hours, escalation, budget, senses, jobs, tool policies, connectors, plus jobCatalog (every job it can be given) and configVersion. Keep configVersion to send with Update so you never overwrite a change made elsewhere. Provider secrets are never returned. Requires Pro.' },
			{ name: 'Get Approvals', value: 'getApprovals', action: 'Get approvals', description: 'Lists actions the agent is holding for approval, each with what it wants to do (summary, preview), the chat and when it expires. Decide them with Decide Approval. Use it to build an approval queue outside the app (Slack, email, your own screen). Requires Pro.' },
			{ name: 'Get Handoffs', value: 'getHandoffs', action: 'Get handoffs', description: 'Lists chats the agent handed to a person, with the reason and trigger (keyword, failures, agent, budget or takeover). Hand a chat back with Release Chat, or answer it with Reply in Chat. Requires Pro.' },
			{ name: 'Get Knowledge', value: 'getKnowledge', action: 'Get knowledge entries', description: 'Lists what the agent can look up when it answers: its own entries plus entries shared across the account (agentId null), each with a token estimate. Requires Pro.' },
			{ name: 'Get Many', value: 'getMany', action: 'Get many agents', description: 'Lists the agents this API key can see (one per WhatsApp account) with status, autonomy, model and today\'s numbers (conversations, replies, tokens, cost), plus open hand-offs and pending approvals. Use it to find an agent ID. Requires Pro.' },
			{ name: 'Get Usage', value: 'getUsage', action: 'Get usage for an agent', description: 'Reports what one agent did and cost over a window: totals (runs, conversations, replies, hand-offs, tokens, cost, resolution rate, latency, prompt-injection attempts), a per-day series, spend per model and the most-used tools. monthCostUsd is always this calendar month. Requires Pro.' },
			{ name: 'Get Usage Summary', value: 'getUsageSummary', action: 'Get usage across all agents', description: 'One call for a spend dashboard: number of agents, today\'s totals across all of them, this month\'s cost and a per-day series for the last 14 days. Limited to the agents the key can see. Requires Pro.' },
			{ name: 'Pause', value: 'pause', action: 'Pause an agent', description: 'Stops one agent replying (for example while staff handle a busy period) and fires the agent.paused webhook. Returns the agent\'s summary row. To stop it in a single chat only, use Take Over Chat. Needs an admin-scope key. Requires Pro.' },
			{ name: 'Release Chat', value: 'releaseChat', action: 'Hand a chat back to the agent', description: 'Hands a chat back to the agent after a person is done: the chat becomes active again and its open hand-offs are resolved (fires agent.handoff_resolved). Returns {ok: true}. Needs an admin-scope key. Requires Pro.' },
			{ name: 'Reply in Chat', value: 'replyInChat', action: 'Reply in a chat as a person', description: 'Answers a customer as a person: the chat is taken over first (the agent goes quiet there), then the text is sent through the anti-ban pipeline as a human message. Returns {ok: true}. Release the chat when you are done. Needs an admin-scope key. Requires Pro.' },
			{ name: 'Resume', value: 'resume', action: 'Resume an agent', description: 'Turns a paused or draft agent on and fires the agent.resumed webhook. Returns the summary row. A 409 not_configured means no AI provider and model have been chosen in the app yet. The global kill switch in the app still wins if it is on. Needs an admin-scope key. Requires Pro.' },
			{ name: 'Send Event', value: 'sendEvent', action: 'Send an event to an agent job', description: 'Tells the agent something happened (order shipped, booking tomorrow, cart abandoned) so it writes that customer one message about it. The recipient always comes from the event, never from the model. Returns {status: "queued"} when accepted, or status duplicate/skipped with a reason (agent_paused, no_enabled_job_for_event, no_consent, frequency_cap, opted_out, handed_off…) when nothing will be sent. Order updates and booking/payment reminders need no opt-in; other jobs need a recorded opt-in or a Consent Source. Requires Pro.' },
			{ name: 'Take Over Chat', value: 'takeOverChat', action: 'Take a chat over from the agent', description: 'A person takes this customer over: the agent stops replying in that chat (any pending reply is cancelled) and a hand-off stays open until Release Chat. Returns {ok: true}. Needs an admin-scope key. Requires Pro.' },
			{ name: 'Update', value: 'update', action: 'Update an agent', description: 'Changes an agent\'s name, purpose, autonomy or extra instructions. Only the fields you add change. Send Config Version (from Get) to refuse the update with a 409 if the agent was changed elsewhere since you read it. Status cannot be changed here: use Pause and Resume. Returns the full updated agent. Needs an admin-scope key. Requires Pro.' },
		],
		default: 'getMany',
	},
];

export const agentFields: INodeProperties[] = [
	// ── Agent picker ──
	{
		displayName: 'Agent Name or ID',
		name: 'agentId',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getAgents' },
		default: '',
		required: true,
		description: 'The agent to act on (one per WhatsApp account). Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
		displayOptions: { show: { resource: ['agent'], operation: AGENT_OPS_WITH_ID } },
	},

	// ── Update ──
	{
		displayName: 'Update Fields',
		name: 'agentUpdateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['agent'], operation: ['update'] } },
		options: [
			{
				displayName: 'Autonomy',
				name: 'autonomy',
				type: 'options',
				default: 'autopilot',
				description: 'How freely the agent acts',
				options: [
					{ name: 'Observe', value: 'observe', description: 'Drafts only; nothing is sent' },
					{ name: 'Copilot', value: 'copilot', description: 'Every action waits for approval' },
					{ name: 'Autopilot', value: 'autopilot', description: 'Low-risk actions run; risky ones wait for approval' },
					{ name: 'Autonomous', value: 'autonomous', description: 'Everything runs except tools set to "approve"' },
				],
			},
			{
				displayName: 'Config Version',
				name: 'configVersion',
				type: 'number',
				typeOptions: { minValue: 1 },
				default: 1,
				description: 'The configVersion you last read with Get. If the agent changed since, the update is refused with 409 version_conflict (the error carries currentVersion). Leave it out to skip the check.',
			},
			{
				displayName: 'Custom Prompt',
				name: 'customPrompt',
				type: 'string',
				typeOptions: { rows: 4 },
				default: '',
				description: 'Extra instructions appended to the built-in prompt (up to 12,000 characters)',
			},
			{ displayName: 'Name', name: 'name', type: 'string', default: '', description: 'Agent name (up to 80 characters)' },
			{
				displayName: 'Purpose',
				name: 'purpose',
				type: 'string',
				typeOptions: { rows: 3 },
				default: '',
				description: 'What the agent is for, in plain words (up to 4,000 characters)',
			},
		],
	},

	// ── Usage ──
	{
		displayName: 'Range',
		name: 'usageRange',
		type: 'options',
		default: '7d',
		options: [
			{ name: 'Last 14 Days', value: '14d' },
			{ name: 'Last 30 Days', value: '30d' },
			{ name: 'Last 7 Days', value: '7d' },
			{ name: 'Last 90 Days', value: '90d' },
			{ name: 'Today', value: 'today' },
		],
		description: 'Window: since local midnight, or the last N days',
		displayOptions: { show: { resource: ['agent'], operation: ['getUsage'] } },
	},

	// ── Approvals ──
	{
		displayName: 'Status',
		name: 'approvalStatus',
		type: 'options',
		default: 'pending',
		options: [
			{ name: 'Pending', value: 'pending', description: 'Waiting for a decision' },
			{ name: 'All', value: 'all', description: 'Include approved, rejected and expired (newest 100)' },
		],
		displayOptions: { show: { resource: ['agent'], operation: ['getApprovals'] } },
	},
	{
		displayName: 'Approval ID',
		name: 'approvalId',
		type: 'string',
		default: '',
		required: true,
		description: 'The approval ID from Get Approvals',
		displayOptions: { show: { resource: ['agent'], operation: ['decideApproval'] } },
	},
	{
		displayName: 'Decision',
		name: 'decision',
		type: 'options',
		default: 'approve',
		options: [
			{ name: 'Approve', value: 'approve', description: 'Send or perform the held action' },
			{ name: 'Reject', value: 'reject', description: 'Drop the held action' },
		],
		displayOptions: { show: { resource: ['agent'], operation: ['decideApproval'] } },
	},
	{
		displayName: 'Options',
		name: 'decisionOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: { resource: ['agent'], operation: ['decideApproval'] } },
		options: [
			{ displayName: 'Decided By', name: 'decidedBy', type: 'string', default: '', description: 'Who decided, for the audit log (up to 120 characters)' },
			{ displayName: 'Note', name: 'note', type: 'string', default: '', description: 'A short note kept with the decision in the audit log (up to 500 characters)' },
		],
	},

	// ── Handoffs ──
	{
		displayName: 'Status',
		name: 'handoffStatus',
		type: 'options',
		default: 'open',
		options: [
			{ name: 'Open', value: 'open', description: 'Not yet resolved (includes claimed)' },
			{ name: 'All', value: 'all', description: 'Include resolved (newest 100)' },
		],
		displayOptions: { show: { resource: ['agent'], operation: ['getHandoffs'] } },
	},

	// ── Takeover / release / reply ──
	{
		displayName: 'Chat ID / Phone Number',
		name: 'agentChatId',
		type: 'string',
		default: '',
		required: true,
		placeholder: '15551230001@s.whatsapp.net or +1 555 123 0001',
		description: 'The chat, as a WhatsApp JID (from Get Handoffs, Get Approvals or a webhook payload) or a phone number in international format including the country code',
		displayOptions: { show: { resource: ['agent'], operation: ['takeOverChat', 'releaseChat', 'replyInChat'] } },
	},
	{
		displayName: 'Text',
		name: 'replyText',
		type: 'string',
		typeOptions: { rows: 3 },
		default: '',
		required: true,
		description: 'The message to send as a person (up to 4,000 characters)',
		displayOptions: { show: { resource: ['agent'], operation: ['replyInChat'] } },
	},

	// ── Send Event ──
	{
		displayName: 'Event Type',
		name: 'eventType',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'order.shipped',
		description: 'What happened, e.g. order.status_changed, order.paid, order.created, order.shipped, booking.reminder, booking.created, form.submitted, cart.abandoned, stock.back_in. It picks the matching job the agent has enabled.',
		displayOptions: { show: { resource: ['agent'], operation: ['sendEvent'] } },
	},
	{
		displayName: 'Idempotency Key',
		name: 'idempotencyKey',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'wc-order-1042-shipped',
		description: 'Unique per event (8–200 characters). A repeat with the same key returns status "duplicate" and sends nothing, so build it from your own IDs.',
		displayOptions: { show: { resource: ['agent'], operation: ['sendEvent'] } },
	},
	{
		displayName: 'Recipient Phone',
		name: 'recipientPhone',
		type: 'string',
		default: '',
		required: true,
		placeholder: '+1 555 123 0001',
		description: 'The customer\'s phone number in international format including the country code. Groups are refused.',
		displayOptions: { show: { resource: ['agent'], operation: ['sendEvent'] } },
	},
	{
		displayName: 'Options',
		name: 'eventOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: { resource: ['agent'], operation: ['sendEvent'] } },
		options: [
			{ displayName: 'Consent At', name: 'consentAt', type: 'dateTime', default: '', description: 'When the customer opted in' },
			{ displayName: 'Consent Source', name: 'consentSource', type: 'string', default: '', description: 'Where the customer opted in (records the opt-in for this job). Needed for jobs other than order updates and booking/payment reminders unless an opt-in is already recorded.' },
			{
				displayName: 'Data (JSON)',
				name: 'data',
				type: 'json',
				default: '{}',
				description: 'Facts the agent may use in the message (order number, items, tracking link…). It only uses what you send.',
			},
			{ displayName: 'Job', name: 'job', type: 'string', default: '', description: 'Force a specific event job ID (it must be enabled on the agent)' },
			{ displayName: 'Occurred At', name: 'occurredAt', type: 'dateTime', default: '', description: 'When the event happened' },
			{ displayName: 'Recipient Locale', name: 'recipientLocale', type: 'string', default: '', placeholder: 'en', description: 'Customer language, e.g. en or ar' },
			{ displayName: 'Recipient Name', name: 'recipientName', type: 'string', default: '', description: 'Customer name' },
		],
	},

	// ── Knowledge ──
	{
		displayName: 'Content',
		name: 'knowledgeContent',
		type: 'string',
		typeOptions: { rows: 4 },
		default: '',
		required: true,
		description: 'The text the agent can search (up to 200,000 characters)',
		displayOptions: { show: { resource: ['agent'], operation: ['addKnowledge'] } },
	},
	{
		displayName: 'Options',
		name: 'knowledgeOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: { resource: ['agent'], operation: ['addKnowledge'] } },
		options: [
			{
				displayName: 'Kind',
				name: 'kind',
				type: 'options',
				default: 'text',
				options: [
					{ name: 'Text', value: 'text', description: 'Facts or policy' },
					{ name: 'Q&A', value: 'qa', description: 'A question and its answer' },
					{ name: 'URL', value: 'url', description: 'A page\'s text (stored as sent; nothing is fetched)' },
					{ name: 'Example', value: 'example', description: 'A model reply' },
				],
			},
			{ displayName: 'Shared', name: 'shared', type: 'boolean', default: false, description: 'Whether to store it for the whole account instead of this agent only' },
			{ displayName: 'Title', name: 'title', type: 'string', default: '', description: 'Short title (up to 200 characters)' },
		],
	},
];
