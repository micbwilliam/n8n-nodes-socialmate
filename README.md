# n8n-nodes-socialmate

Official [n8n](https://n8n.io) community node for **[SocialMate](https://socialmate.app)** — the self-hosted desktop WhatsApp automation server.

Automate WhatsApp from n8n: send / schedule / bulk-import messages, manage chats, contacts, groups and media, and react to incoming messages and lifecycle events — all through your own SocialMate server.

## Installation

In n8n: **Settings → Community Nodes → Install** and enter `n8n-nodes-socialmate`.

Or self-hosted via npm:

```bash
npm install n8n-nodes-socialmate
```

## Account scope (v2.1)

Every SocialMate API key carries an **account scope**, chosen when you create the
connection in the app (**API & Integrations → n8n → New connection**):

| Scope | The key can act on | In the node |
|---|---|---|
| **This account** | exactly one account | the **Account** field auto-selects it — nothing to pick |
| **Selected accounts** | a chosen subset | the **Account** dropdown lists only those accounts; pick one per operation |
| **All accounts** | every account (incl. future) | the **Account** dropdown lists all; pick one per operation |

The credential is just two values — paste them from the wizard's bundle:

- **Server URL** → `baseUrl` (`http://127.0.0.1:3456` locally, or your named-tunnel hostname)
- **API Key** → `apiKey`

There is **no "Default Account ID"** anymore. The key already knows which
accounts it may use: `GET /v1/accounts` is filtered to that set server-side, so
the node's **Account** dropdown only ever shows accounts you can actually use,
and auto-resolves when the key is bound to a single account. A multi-account key
just asks you to pick the account on each operation.

The **SocialMate Trigger** registers its webhook with that same key, so the
server scopes deliveries to the key's accounts automatically — no manual filter
needed (an optional one exists to further narrow an "All accounts" key).

> Upgrading from v2.0: an old credential's `Default Account ID` is still honored
> as a fallback, but you can clear it — the scope-aware Account picker replaces it.

## Nodes

- **SocialMate** (action) — Message, Chat, Contact, Group, Media, Queue, Account, Sync, Webhook, API Key and System operations.
- **SocialMate Trigger** — fires your workflow on SocialMate events (`message.received`, `message.sent`, `account.*`, `queue.*`, `sync.*`, `tunnel.*`, `license.*`, …). It self-registers its webhook with the server and verifies the HMAC signature on every delivery.

### Build an AI agent with full chat memory — `Message → Get AI Context`

The Trigger only hands your workflow the **single new message**. To give an AI agent the
**whole conversation**, drop **`Message → Get AI Context`** between the Trigger and your
AI Agent. It reads the chat's history from the SocialMate DB and returns it AI-ready:

- `transcript` — a role-mapped, oldest→newest string to paste straight into the agent's
  system message: `Conversation so far:\n{{ $json.transcript }}`.
- `messages` — a structured `[{ role: 'user'|'assistant', name, content, ts }]` array for
  chat-model / memory nodes.
- `meta` — `{ totalMessages, returnedMessages, truncated, tokenEstimate, … }`.

It role-maps automatically (the contact = `user`, your account = `assistant`), windows the
history to a **token budget** (`maxTokens`, default 4000) and **message cap** (`maxMessages`,
default 50), and labels media (`[image]`, `[voice]`, …). No separate memory node needed —
each run pulls fresh, complete context. *(Requires SocialMate Pro — reading history.)* See
[`examples/real-estate-deepseek-agent.json`](examples/real-estate-deepseek-agent.json).

## Connecting

1. In the SocialMate app: **Settings → API → Connect to n8n**. Enable the API, start the tunnel, and create an API key (use an **admin**-scope key if you want the Trigger to register its webhook automatically).
2. In n8n, create a **SocialMate API** credential:
   - **Server URL** — your named-tunnel hostname (recommended; never rotates) or `http://127.0.0.1:3456` when n8n runs on the same machine.
   - **API Key** — the key from step 1.
3. Click **Test** — you should see your server version and license tier.

### Rotating quick-tunnel URLs (the "beacon")

A free **quick tunnel** gets a new `*.trycloudflare.com` URL on every restart. SocialMate broadcasts the current URL in the `tunnelUrl` field of every webhook. If you run a **SocialMate Trigger** in the same workflow with *"Prefer Live Tunnel URL"* enabled on the credential, action nodes auto-heal to the freshest URL — no manual reconfiguration. For production, prefer a **named tunnel** (Pro) so the URL is stable.

## License tiers

Some operations require **SocialMate Pro** (media send, groups, scheduling/bulk import, message history/search, sync). Free covers text send, reads (chats/contacts/accounts), live webhooks and webhook/API-key management. Pro-only calls return a clear "requires Pro" error.

Free is capped at 200 sends/day; Pro starts at 500/day per account and scales to **up to 5,000/day** in High-Volume Mode (after 72h warming) — so high-throughput workflows aren't bottlenecked.

## Development

```bash
npm install
npm run build      # tsc + copy icons to dist
npm run lint       # eslint-plugin-n8n-nodes-base
```

## License

[MIT](LICENSE)
