# n8n-nodes-socialmate

<p align="center">
  <img src="https://raw.githubusercontent.com/micbwilliam/n8n-nodes-socialmate/main/assets/logo.png" width="96" alt="SocialMate" />
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/n8n-nodes-socialmate"><img src="https://img.shields.io/npm/v/n8n-nodes-socialmate.svg?color=2563eb" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/n8n-nodes-socialmate"><img src="https://img.shields.io/npm/dm/n8n-nodes-socialmate.svg?color=2563eb" alt="npm downloads" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/npm/l/n8n-nodes-socialmate.svg" alt="license" /></a>
  <img src="https://img.shields.io/node/v/n8n-nodes-socialmate.svg" alt="node version" />
</p>

Official [n8n](https://n8n.io) community node for **[SocialMate](https://socialmate.app)** — the self-hosted WhatsApp automation server. Run it as a desktop app (Windows/macOS/Linux) or headless on your own VPS with Docker; this node talks to either the same way.

Automate WhatsApp from n8n: send and schedule personalized messages, queue and batch-import to opted-in contacts (an opt-in Pro feature), manage chats, contacts, groups and media, and react to incoming messages and lifecycle events — all through your own SocialMate server.

- **Docs:** https://socialmate.app/docs/n8n
- **Changelog:** [CHANGELOG.md](CHANGELOG.md)

## Installation

In n8n: **Settings → Community Nodes → Install** and enter `n8n-nodes-socialmate`.

Or self-hosted via npm:

```bash
npm install n8n-nodes-socialmate
```

## Connecting

1. In the SocialMate app: **API & Integrations → n8n → New connection**. Pick the account
   scope, and SocialMate mints an API key (and a self-registering webhook) for it. Use an
   **admin**-scope key if you want the Trigger to register its webhook automatically.
2. In n8n, create a **SocialMate API** credential:
   - **Server URL** — `http://127.0.0.1:3456` when n8n runs on the **same machine** as the
     app, or your **named-tunnel** hostname (Pro) for a remote n8n. No trailing slash.
   - **API Key** — the key from step 1.
3. Click **Test** — you should see your server version and license tier.

> **Quick tunnels are not supported.** A free quick tunnel gets a new
> `*.trycloudflare.com` URL on every restart, which breaks a saved credential. Run n8n on
> the same machine as the app (localhost) or use a stable **named tunnel** (Pro).

## Account scope (v2.1+)

Every SocialMate API key carries an **account scope**, chosen when you create the
connection in the app:

| Scope | The key can act on | In the node |
|---|---|---|
| **This account** | exactly one account | the **Account** field auto-selects it — nothing to pick |
| **Selected accounts** | a chosen subset | the **Account** dropdown lists only those accounts; pick one per operation |
| **All accounts** | every account (incl. future) | the **Account** dropdown lists all; pick one per operation |

There is **no "Default Account ID"** — the key already knows which accounts it may use:
`GET /v1/accounts` is filtered to that set server-side, so the node's **Account** dropdown
only ever shows accounts you can actually use, and auto-resolves when the key is bound to a
single account. The **SocialMate Trigger** registers its webhook with the same key, so the
server scopes deliveries automatically (an optional account filter exists to further narrow
an "All accounts" key).

> Upgrading from v2.0: an old credential's `Default Account ID` is still honored as a
> fallback, but you can clear it — the scope-aware Account picker replaces it.

## Nodes

- **SocialMate** (action) — Message, Chat, Contact, Group, Media, Queue, Account, Sync, Webhook, API Key and System operations.
- **SocialMate Trigger** — fires your workflow on SocialMate events. It self-registers its webhook with the server and verifies the HMAC signature on every delivery.

### Operations — Free vs Pro

Operations marked **Pro** require a SocialMate Pro license; on Free they return a clear
`402` naming the missing feature.

| Resource | Free | Pro |
|---|---|---|
| **Message** | Send Text (with Reply To) · React · Mark Read · Send Typing | Send Media · Send Poll · Send Location · Send Contact · Get AI Context · Search / List history |
| **Chat** | Get Many | — |
| **Contact** | Get · Get Many | Update (Agent Memory — save a name/notes/tags your agent learned) |
| **Group** | Get Many · Get · Get Invite Link | Create · Update Participants · Set Subject · Set Description · Leave |
| **Media** | Get Many · Get · Get Stats · Download File · Download Thumbnail · Get Download Queue | Force Download · Delete · Run Cleanup · Set Context (Agent Memory — cache an AI description) |
| **Queue** | Get Status · Get Items · Get Batches | Enqueue · Bulk Import · Pause · Resume · Cancel/Retry Item · Cancel/Retry Batch |
| **Account** | Get Many · Get · Get Anti-Ban Status | — |
| **Sync** | Get Status | Trigger |
| **Webhook** | Get Many · Get · Create · Update · Delete · Test · Get Deliveries | — |
| **API Key** | Get Many · Create · Rotate · Delete | — |
| **System** | Get Capabilities · Get Status · Get Network Status · Get Version | — |

Every send still passes through SocialMate's anti-ban engine (rate limits, jitter, warming,
risk checks), so a runaway workflow can't burn your number.

### Build an AI agent with full chat memory — `Message → Get AI Context`

The Trigger only hands your workflow the **single new message**. To give an AI agent the
**whole conversation**, drop **`Message → Get AI Context`** between the Trigger and your
AI Agent. It reads the chat's history from the SocialMate DB and returns it AI-ready:

- `transcript` — a role-mapped string to paste straight into the agent's system message:
  `Conversation so far:\n{{ $json.transcript }}`.
- `messages` — a structured `[{ role: 'user'|'assistant', name, content, ts }]` array for
  chat-model / memory nodes.
- `meta` — `{ totalMessages, returnedMessages, truncated, tokenEstimate, … }`.

It role-maps automatically (the contact = `user`, your account = `assistant`), windows the
history to a **token budget** (`maxTokens`, default 4000) and **message cap** (`maxMessages`,
default 50), supports `order` (`oldest` | `newest`), `format` (`both` | `messages` |
`transcript`), `includeTimestamps`, and `beforeTs` (window to messages before a Unix-ms time),
and labels media (`[image]`, `[voice]`,
…). *(Requires SocialMate Pro — reading history.)* See
[`examples/real-estate-deepseek-agent.json`](examples/real-estate-deepseek-agent.json).

## Use SocialMate as an AI Agent tool

Every SocialMate operation is exposed as an **AI Agent tool** (`usableAsTool`), so an n8n **AI
Agent** can call them on its own — _"send this reply", "look up the contact", "fetch the last 20
messages", "queue a reminder"_ — choosing the operation from its description.

**Enable it on your n8n instance** (required for _any_ community node used as a tool):

```bash
N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true
```

Then add **SocialMate** as a tool on an **AI Agent** node and pick the operation. Pair it with
**`Message → Get AI Context`** (the conversation-memory tool) so the agent can read a whole thread
before replying — a combination no official / Business-API node offers.

> Some n8n versions have an open bug where certain community-node tools hand the agent an empty
> observation ([n8n#26202](https://github.com/n8n-io/n8n/issues/26202)). If you hit it, upgrade n8n,
> call the operation from a normal (non-agent) node, or use **MCP** (below), which bypasses it.

**Prefer MCP (Claude Desktop / Cursor / any client)?** SocialMate ships a native **Model Context
Protocol** server, `socialmate-mcp`, exposing 30 WhatsApp tools (see **API & Integrations → MCP** in
the app for the copy-paste config), plus an n8n MCP Server Trigger recipe. One thing to know: MCP is
request/response with **no inbound push**, so to auto-react to incoming messages you either poll the
`whatsapp_fetch_new_messages` tool or drive the loop from the **SocialMate Trigger** below. Full
walkthrough + the `$fromAI` pattern + 11 use cases in
**[docs/AI-AGENT-TOOL-GUIDE.md](docs/AI-AGENT-TOOL-GUIDE.md)**. Importable examples:
[`examples/ai-agent-tool.json`](examples/ai-agent-tool.json) and
[`examples/mcp-server-trigger.json`](examples/mcp-server-trigger.json).

### Make it behave like a human

A drop-in **System Message** that teaches an agent the human reply cadence — *mark read →
recall the thread → show typing → react or reply (threaded)* — plus the full tool inventory,
the tier and anti-ban error contract (`402` / `blocked` / `queueable:false` /
`signal_rate_limit`), what the agent genuinely **cannot** do (no edit/delete/forward, it can't
see the contact typing, buttons are deprecated → send a poll), and the consent + honesty rules:

**[docs/AI-AGENT-SYSTEM-PROMPT.md](docs/AI-AGENT-SYSTEM-PROMPT.md)**

`examples/ai-agent-tool.json` ships with it pre-loaded and the tools wired
(*Mark Read · Show Typing · React · Send Poll · Get Conversation Memory · Check My Limits*).
Reactions, read receipts and the typing indicator are **free on every tier** and consume no
send budget — an agent can be human without spending its message allowance.

## Trigger events

The **SocialMate Trigger** covers all **33 events**. **9 are available on Free** —
`message.received`, `message.sent`, `account.connected`, `account.disconnected`,
`tunnel.url_changed`, `tunnel.stopped`, `license.activated`, `license.deactivated`,
`license.tier_changed`; the other 24 (incl. `tunnel.started`, the conversational events
`message.reaction` / `poll.vote` / `group.participants_updated`, the Agent Memory
`media.context_updated` event, and the High-Volume Mode `account.danger_mode_*` events)
require Pro and are labelled `(Pro)` in the picker:

- **Messaging:** `message.received`, `message.sent`, `message.reaction` (Pro), `poll.vote` (Pro)
- **Groups:** `group.participants_updated` (Pro) — join, leave, promote, demote
- **Accounts:** `account.connected`, `account.disconnected`, `account.banned`, `contacts.updated`, `account.danger_mode_enabled`, `account.danger_mode_disabled`
- **Tunnel:** `tunnel.started`, `tunnel.url_changed`, `tunnel.stopped`
- **Sync:** `sync.started`, `sync.completed`, `sync.failed`
- **Media:** `media.discovered`, `media.downloaded`, `media.failed`, `media.deleted`
- **Smart queue:** `queue.item.enqueued`, `queue.item.processing`, `queue.item.sent`, `queue.item.failed`, `queue.item.cancelled`, `queue.batch.created`, `queue.batch.completed`, `queue.batch.cancelled`
- **License:** `license.activated`, `license.deactivated`, `license.tier_changed`

Every delivery is a JSON envelope: `{ "version", "event", "timestamp", "tunnelUrl", "data": { … } }`. A
`message.received` example:

```json
{
  "version": 1,
  "event": "message.received",
  "timestamp": "2026-06-03T12:00:00.000Z",
  "tunnelUrl": "https://your-name.example.com",
  "data": {
    "accountId": "acc_123",
    "messageId": "ABCD1234",
    "chatId": "15551234567",
    "senderId": "15551234567",
    "body": "Is my order shipped?",
    "type": "text",
    "timestamp": 1750000000000,
    "fromMe": false
  }
}
```

In a workflow, read fields as `{{ $json.data.body }}`, `{{ $json.data.chatId }}`, etc.

## Request & response examples

The action node builds these requests for you; the JSON below shows the underlying SocialMate
API shapes (handy when mapping fields). Responses are wrapped in the `{ "data": … }` envelope.

**Message → Send Text** — when to use: the default outbound path; works on every tier.

```json
// request
{ "chatId": "15551234567", "text": "Hello from n8n 👋" }
// 200
{ "data": { "sent": true, "messageId": "msg_abc", "chatId": "15551234567@s.whatsapp.net", "status": "sent" } }
```

**Message → Send Media** (Pro) — prefer a `url` so a rate-limited send can auto-queue (202):

```json
{ "chatId": "15551234567", "media": { "type": "image", "url": "https://example.com/p.jpg", "caption": "Invoice" } }
```

**Message → Get AI Context** (Pro) — when to use: give an AI agent the whole thread in one call:

```json
{ "data": { "account": { "id": "acct_1", "name": "Sales" }, "chat": { "id": "15551234567", "name": "Jane" }, "messages": [ { "role": "user", "content": "Hi" } ], "transcript": "Jane: Hi", "tokenEstimate": 8 } }
```

**Queue → Bulk Import** (Pro; opt-in, off by default) — when to use: queue one batch of templated, *personalized* messages (e.g. reminders/notifications) to contacts who opted in — up to 5000 rows:

```json
{
  "template": "Hi {{name}}, your order {{order}} shipped 🚚",
  "batchName": "June shipping notices",
  "rows": [ { "chatId": "15551234567", "displayName": "Jane", "fields": { "name": "Jane", "order": "A-1001" } } ]
}
```

**Account → Get Anti-Ban Status** — when to use: check headroom before a burst; if `paused` or a
counter is near its `max`, back off (sending anyway just auto-queues on Pro or returns `429` on Free).

## API-key scopes

Keys carry one or more scopes; an operation that needs more than the key has returns `403`:

- **read** — all `GET` operations (accounts, chats, contacts, media, status…).
- **send** — sending messages and triggering downloads/sync.
- **admin** — managing webhooks and API keys (the Trigger needs this to self-register).

## Errors

| Status | Meaning |
|---|---|
| `401` | Missing or invalid API key. |
| `402` | A Pro feature on a Free license — the response names the required feature. |
| `403` | The key lacks the required scope (read / send / admin). |
| `429` | Rate-limited. A transient per-key limit is retried automatically (up to 3×, capped backoff); an **anti-ban send block** is surfaced as data instead — see *Send outcomes*. |

### Send outcomes

A **Send Text / Send Media** call resolves one of these ways. The first three are returned as
**data you can branch on** (no error thrown), so one workflow can handle every case:

- **Sent** — delivered immediately (`{ sent: true, messageId, … }`).
- **Queued** *(Pro)* — anti-ban deferred it, so SocialMate **auto-queued** it and the worker
  retries when the number is eligible (`{ queued: true, itemId, … }`).
- **Blocked** *(typically Free)* — anti-ban refused it and there's no auto-queue, so the node
  returns `{ blocked: true, reason, retryAfterMs, hint, upgrade }`. Branch on `blocked` to back
  off, notify, or (on Pro) route to **Queue → Enqueue**. The node **returns immediately** — it
  never sleeps on the block's `Retry-After` (which can be hours during quiet hours).
- **`409`** — the account isn't connected; link it in the app first.

> The legacy **`POST /v1/accounts/:id/messages/media`** route is **deprecated** (no auto-queue,
> sends a `Sunset` header) and is intentionally **not** exposed as an operation — use **Send
> Media** (the unified endpoint) instead.

## License tiers & limits

Free covers text send, reads (chats/contacts/accounts/media), live webhooks, and
webhook/API-key management — one account. Pro adds media send, group management,
scheduling and opt-in bulk import, message history/search, sync, the smart queue, unlimited accounts
and a stable named tunnel.

Free is capped at **200 sends/day**; Pro starts at **500/day** per account and scales to
**up to 5,000/day** in High-Volume Mode (after 72h warming).

## Examples

Importable workflows live in [`examples/`](examples/):

- [`ai-agent-tool.json`](examples/ai-agent-tool.json) — **SocialMate as an AI Agent tool**: an AI Agent that marks read, recalls the thread, shows a typing indicator, then reacts or replies (threaded). Ships with the human-cadence system prompt pre-loaded. See [docs/AI-AGENT-SYSTEM-PROMPT.md](docs/AI-AGENT-SYSTEM-PROMPT.md) and [docs/AI-AGENT-TOOL-GUIDE.md](docs/AI-AGENT-TOOL-GUIDE.md).
- [`mcp-server-trigger.json`](examples/mcp-server-trigger.json) — **WhatsApp MCP server built in n8n**: expose SocialMate to Claude Desktop / Cursor via the MCP Server Trigger.
- [`real-estate-deepseek-agent.json`](examples/real-estate-deepseek-agent.json) — a WhatsApp AI concierge (Trigger → Get AI Context → DeepSeek → reply).
- [`auto-reply-trigger.json`](examples/auto-reply-trigger.json) — a minimal Trigger → Send Text auto-reply round-trip.
- [`scheduled-bulk-send.json`](examples/scheduled-bulk-send.json) — schedule a daily batch of queued, personalized reminders to opted-in contacts via the smart queue (Pro).
- [`keyword-router.json`](examples/keyword-router.json) — Trigger → IF on the message text → route to different replies (extend with more branches).
- [`drip-onboarding-sequence.json`](examples/drip-onboarding-sequence.json) — Trigger → three scheduled Queue Enqueues that drip a welcome sequence over a few days (Pro).
- [`order-confirmation-webhook.json`](examples/order-confirmation-webhook.json) — your store's order webhook → Send Text order confirmation.
- [`new-lead-alert.json`](examples/new-lead-alert.json) — Trigger → forward a short summary of each inbound message to your team group.
- [`vision-memory-loop.json`](examples/vision-memory-loop.json) — **Agent Memory (Pro):** `media.discovered` → skip already-described items → Download File → *your* vision/transcription model → Set Media Context. Each photo/voice note is described **once** and then comes back as `[image: …]` inside Get AI Context — no re-analysis, fewer tokens.

## Development

```bash
npm install
npm run build      # tsc + copy icons to dist
npm run lint       # eslint-plugin-n8n-nodes-base
```

## License

[MIT](LICENSE)
