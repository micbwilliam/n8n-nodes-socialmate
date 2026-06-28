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

Official [n8n](https://n8n.io) community node for **[SocialMate](https://socialmate.app)** — the self-hosted desktop WhatsApp automation server.

Automate WhatsApp from n8n: send / schedule / bulk-import messages, manage chats, contacts, groups and media, and react to incoming messages and lifecycle events — all through your own SocialMate server.

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
| **Message** | Send Text | Send Media · Get AI Context · Search / List history |
| **Chat** | Get Many | — |
| **Contact** | Get · Get Many | — |
| **Group** | Get Many · Get · Get Invite Link | Create · Update Participants · Set Subject · Set Description · Leave |
| **Media** | Get Many · Get · Get Stats · Download File · Download Thumbnail · Get Download Queue | Force Download · Delete · Run Cleanup |
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

## Trigger events

The **SocialMate Trigger** covers all **29 events**. **9 are available on Free** —
`message.received`, `message.sent`, `account.connected`, `account.disconnected`,
`tunnel.url_changed`, `tunnel.stopped`, `license.activated`, `license.deactivated`,
`license.tier_changed`; the other 20 (incl. `tunnel.started` and the High-Volume Mode
`account.danger_mode_*` events) require Pro and are labelled `(Pro)` in the picker:

- **Messaging:** `message.received`, `message.sent`
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

**Queue → Bulk Import** (Pro) — when to use: campaigns; one batch of up to 5000 templated rows:

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
| `429` | Rate-limited — the node retries up to 3 times and honours `Retry-After`. |

### Send outcomes

A **Send Text / Send Media** call resolves one of three ways:

- **`200`** — sent immediately (`{ sent: true, messageId, … }`).
- **`202`** — anti-ban deferred it, so SocialMate **auto-queued** it and the worker retries
  when the number is eligible (`{ queued: true, itemId, … }`). *Pro only* — on Free a blocked
  send returns `429` instead (it is not queued).
- **`409`** — the account isn't connected; link it in the app first.

> The legacy **`POST /v1/accounts/:id/messages/media`** route is **deprecated** (no auto-queue,
> sends a `Sunset` header) and is intentionally **not** exposed as an operation — use **Send
> Media** (the unified endpoint) instead.

## License tiers & limits

Free covers text send, reads (chats/contacts/accounts/media), live webhooks, and
webhook/API-key management — one account. Pro adds media send, group management,
scheduling/bulk import, message history/search, sync, the smart queue, unlimited accounts
and a stable named tunnel.

Free is capped at **200 sends/day**; Pro starts at **500/day** per account and scales to
**up to 5,000/day** in High-Volume Mode (after 72h warming).

## Examples

Importable workflows live in [`examples/`](examples/):

- [`real-estate-deepseek-agent.json`](examples/real-estate-deepseek-agent.json) — a WhatsApp AI concierge (Trigger → Get AI Context → DeepSeek → reply).
- [`auto-reply-trigger.json`](examples/auto-reply-trigger.json) — a minimal Trigger → Send Text auto-reply round-trip.
- [`scheduled-bulk-send.json`](examples/scheduled-bulk-send.json) — schedule a daily bulk send via the smart queue (Pro).

## Development

```bash
npm install
npm run build      # tsc + copy icons to dist
npm run lint       # eslint-plugin-n8n-nodes-base
```

## License

[MIT](LICENSE)
