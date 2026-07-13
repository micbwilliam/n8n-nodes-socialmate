# Use SocialMate as an AI Agent Tool

**SocialMate is the WhatsApp "hands and memory" your AI agent uses.** Attach it to an n8n **AI
Agent** (or any **MCP** client like Claude Desktop or Cursor) and the model can send and read
WhatsApp messages, look up contacts, manage groups, download media, queue a paced batch of
personalised messages, and recall a whole conversation — deciding on its own which action to take.

> SocialMate doesn't *contain* an AI. It gives your AI (Claude, GPT, Gemini, any LLM) a safe,
> self-hosted WhatsApp it can operate. Every action still passes SocialMate's anti-ban engine.

There are two ways to wire it up.

---

## Option A — n8n AI Agent tool (`usableAsTool`)

Every SocialMate operation is exposed to n8n's **AI Agent** node as a callable tool.

### 1. Enable community-node tools

On your n8n instance set:

```bash
N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true
```

This is **required** — without it, no community node (SocialMate included) can be used as a tool.

### 2. Create the SocialMate credential

In the SocialMate desktop app go to **API & Integrations → n8n**, copy the base URL and an API key
(use an **admin**-scoped key if you want the Trigger to self-register its webhook), and paste them
into a new **SocialMate API** credential in n8n. This one credential is shared by both the action
node and the Trigger node.

### 3. Build the workflow — **start with the Trigger**

Import [`examples/ai-agent-tool.json`](../examples/ai-agent-tool.json), or wire it yourself:

```
SocialMate Trigger ─main→ AI Agent ─main→ Reply on WhatsApp (SocialMate: Send Text)
   (message.received)       ├─ ai_languageModel ─ Chat Model (OpenAI / Claude / …)
                            ├─ ai_memory ─────── Simple Memory (session = chatId)
                            ├─ ai_tool ───────── SocialMate: Get AI Context
                            └─ ai_tool ───────── SocialMate: Look Up Contact
```

The **SocialMate Trigger** (set to `message.received`) is what *starts* the workflow when a WhatsApp
message arrives — attaching tools only lets the agent *act*, so without the Trigger the agent never
fires on inbound messages. It self-registers its webhook on the app (admin scope), so there is no URL
to copy. Wire the AI Agent's `main` output into **Message → Send Text** to send the reply.

Then add a SocialMate node on the Agent's **Tool** input for each capability you want the model to
have. Set the node's Resource + Operation; leave the input parameters for the model to fill (next
section).

### 4. Let the model fill parameters — `$fromAI()`

On any tool parameter, click the ✦ ("Defined automatically by the model") button, or type:

```
={{ $fromAI('chat_id', 'Recipient: full international phone number, no + or spaces (e.g. 14155551234), or a group JID ending in @g.us', 'string') }}
```

Signature: `$fromAI(key, description, type, defaultValue)` — `type` is `string | number | boolean |
json`. The **description is what the model reads to decide the value**, so make it specific.

> **Gotcha:** a parameter literally named `name` disables the ✦ button (n8n bug #28261). SocialMate
> already renames the group-create field to **Group Name** (`groupName`) for this reason.

### The #26202 caveat

Some n8n versions hand the agent an *empty observation* from community-node tools
([n8n#26202](https://github.com/n8n-io/n8n/issues/26202)). If a tool "runs but the agent sees
nothing", either upgrade n8n, wrap the call in a **sub-workflow** exposed via the native **Call n8n
Workflow Tool**, or use **Option B (MCP)** below, which bypasses n8n's internal tool queue entirely.

---

## Option B — MCP (Model Context Protocol)

MCP is the agent-native standard: expose WhatsApp as tools that **any** MCP client can call —
**Claude Desktop, Cursor, Cline, Goose**, or n8n's own **MCP Client Tool**. Two ways to serve it.

### B1 — SocialMate's native MCP server, `socialmate-mcp` (no n8n needed)

SocialMate ships a native MCP server that any client can spawn. It's a thin translator over the
app's local REST API, so there is **nothing to enable in the app** — just create an API key
(**API & Integrations**) and make sure the Local API server is running.

- **Local (stdio)** — for Claude Desktop / Cursor on the same machine. Add to the client's MCP config
  (see **API & Integrations → MCP** in the app for a copy-paste snippet):

  ```json
  {
    "mcpServers": {
      "socialmate": {
        "command": "npx",
        "args": ["socialmate-mcp"],
        "env": { "SOCIALMATE_API_KEY": "sm_live_xxx", "SOCIALMATE_BASE_URL": "http://127.0.0.1:3456" }
      }
    }
  }
  ```

- **Remote** — for an agent on another machine, run the same `socialmate-mcp` next to the agent and
  set `SOCIALMATE_BASE_URL` to your **Pro named tunnel** host (e.g. `https://<your-tunnel>`); the
  `x-api-key` auth applies over the wire.

Every MCP tool respects the API key's **scope** (read / send / admin) and your **tier** exactly like
the REST API — Free gets read + text send; Pro adds media, history, Get AI Context and the queue.

### Reacting to incoming messages over MCP

MCP is **request/response — there is no inbound push**. The server can't notify Claude/Cursor that a
message arrived, so a client only acts when you ask it to. Two ways to make an MCP agent react to
messages as they arrive:

1. **Poll** — call `whatsapp_fetch_new_messages` on a loop, passing the newest `timestamp` you've
   seen as `since` to get only what's new (Pro — it reads synced history).
2. **Bridge** — start the loop from the n8n **SocialMate Trigger** (`message.received`) or a webhook
   to your own code, then let the agent act back through the MCP tools. Works on Free too.

### B2 — MCP server built in n8n

Import [`examples/mcp-server-trigger.json`](../examples/mcp-server-trigger.json): an **MCP Server
Trigger** with SocialMate tool nodes attached. Activate it, copy the node's SSE URL, and connect
Claude Desktop with `npx mcp-remote <SSE_URL> --header "Authorization: Bearer <token>"`.

---

## What the agent can do (tool catalog)

| Do this | SocialMate op | Tier |
|---|---|---|
| Reply to / notify someone | Message → **Send Text** | Free |
| Send a photo, document, voice note | Message → **Send Media** | Pro |
| **Remember the whole conversation** | Message → **Get AI Context** | Pro |
| Find or count past messages | Message → Search / List | Pro |
| Poll for new messages since a cursor | Message → Search / List (`afterTs`) · MCP `whatsapp_fetch_new_messages` | Pro |
| Look up who's messaging | Contact → Get / Get Many | Free |
| See all conversations | Chat → Get Many | Free |
| Create / manage a group | Group → Create / Update Participants / … | Pro |
| Read a shared file | Media → Download File | Free |
| Schedule one message for later | Queue → **Enqueue** | Pro |
| Tell several waiting customers the same news, one personalised message each | Queue → **Queue a Batch** | Pro |
| Check anti-ban headroom before a burst | Account → Get Anti-Ban Status | Free |

**Get AI Context is the standout** — one call returns a whole thread, role-mapped
(`user`/`assistant`) and token-windowed, so the agent has perfect recall without a fragile memory
node. No competitor exposes an equivalent.

---

## Use cases

1. **Autonomous support agent** — answers FAQs and order status 24/7, escalates to a human when stuck.
2. **AI concierge / front desk** — checks a calendar, books, and confirms appointments over chat.
3. **AI sales SDR** — qualifies inbound leads, enriches them, books meetings, runs follow-ups.
4. **Voice-note assistant** — transcribes an incoming voice note and acts on it, replies in text.
5. **E-commerce order tracker** — pulls status/ETA from Shopify and messages the customer proactively.
6. **Appointment reminders** — validates slots to avoid double-booking, sends timed nudges.
7. **Human-in-the-loop approvals** — the agent pings *you* on WhatsApp for a yes/no before acting.
8. **Group community manager** — reads group history, summarizes, answers in the group.
9. **Customer-notice agent** — something changed (an order is late, a pickup time moved) and the people who already ordered need to know: drafts **one personalised message each**, queues them, and lets the anti-ban engine pace them. Opted-in contacts and open orders only — never a bought or scraped list. SocialMate is not a broadcast tool, and identical text to many contacts is blocked by the duplicate guard.
10. **Multimodal intake** — reads incoming invoices/IDs (PDF/image), extracts fields, routes them.
11. **Multi-tool orchestrator** — one agent uses WhatsApp + CRM + Calendar + a knowledge base end to end.

---

## Best practices

- **Give the agent Get AI Context** so it never re-asks what the customer already said.
- **Scope the key** to `read`+`send` for a support bot; reserve `admin` for workflows that manage
  webhooks/keys. MCP and n8n tools both honor the scope.
- **Keep anti-ban in the loop** — a Free send blocked by anti-ban returns `{ blocked: true, … }` you
  can branch on (route to Queue → Enqueue on Pro). Never disable the guard.
- **Write for the model** — each operation's description already tells the agent what it does, what
  it returns, and when *not* to use it. Keep custom `$fromAI` descriptions equally specific.
