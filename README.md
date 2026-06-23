# n8n-nodes-socialmate

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
| **Group** | Get Many · Get · Get Invite Link · Leave | Create · Update Participants · Set Subject · Set Description |
| **Media** | Get Many · Get · Get Stats · Download File · Force Download | Delete |
| **Queue** | Get Status · Pause · Resume | Enqueue · Bulk Import · Get Items · Get Batches · Cancel/Retry Item · Cancel/Retry Batch |
| **Account** | Get Many · Get · Get Anti-Ban Status | — |
| **Sync** | Get Status | Trigger |
| **Webhook** | Get Many · Get · Create · Update · Delete · Test · Get Deliveries | — |
| **API Key** | Get Many · Create · Rotate · Delete | — |
| **System** | Get Capabilities · Get Status · Get Version | — |

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
default 50), supports `order` (`oldest` | `newest`), and labels media (`[image]`, `[voice]`,
…). *(Requires SocialMate Pro — reading history.)* See
[`examples/real-estate-deepseek-agent.json`](examples/real-estate-deepseek-agent.json).

## Trigger events

The **SocialMate Trigger** covers all **29 events** (9 available on Free):

- **Messaging:** `message.received`, `message.sent`
- **Accounts:** `account.connected`, `account.disconnected`, `account.banned`, `contacts.updated`, `account.danger_mode_enabled`, `account.danger_mode_disabled`
- **Tunnel:** `tunnel.started`, `tunnel.url_changed`, `tunnel.stopped`
- **Sync:** `sync.started`, `sync.completed`, `sync.failed`
- **Media:** `media.discovered`, `media.downloaded`, `media.failed`, `media.deleted`
- **Smart queue:** `queue.item.enqueued`, `queue.item.processing`, `queue.item.sent`, `queue.item.failed`, `queue.item.cancelled`, `queue.batch.created`, `queue.batch.completed`, `queue.batch.cancelled`
- **License:** `license.activated`, `license.deactivated`, `license.tier_changed`

Every delivery is a JSON envelope: `{ "version", "event", "tunnelUrl", "data": { … } }`. A
`message.received` example:

```json
{
  "version": 1,
  "event": "message.received",
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
