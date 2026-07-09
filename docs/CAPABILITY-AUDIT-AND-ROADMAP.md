# SocialMate n8n Node — Capability Audit & Roadmap

_Production final-release audit · target node version **2.7.0** · app snapshot `product-facts.json` v1.0.0-rc.6 · dated 2026-07-08_

This is the single source of truth for **what the node does today, what it is missing versus the
market, and exactly what must be built** (endpoint-by-endpoint, surface-by-surface) to close the
gaps. It was produced by auditing the node, the SM4 app HTTP API it mirrors, and live 2025-2026
research into what n8n users actually build for WhatsApp.

> **Architecture rule that shapes everything below.** The node is a **thin, strict mirror** of the
> SocialMate desktop app — it "never invents endpoints, events, parameters, or tier gates"
> (`CLAUDE.md`). The app's adapter interface (`IWhatsAppAdapter`) today exposes only `sendText` and
> `sendMedia` for sending. Therefore every "new capability" below is **app-first, full-stack work**
> (Baileys adapter → router → REST endpoint → webhook → _then_ the node), **except** the items in
> §2, which are node-only and ship now.

---

## 1. Verdict

**The node is in excellent contract shape and now production-ready for its current surface.** It
covers **55/55** authenticated app endpoints with correct method+path, mirrors all **29** webhook
events with the exact **9-Free / 20-Pro** split, and matches the app on the HMAC signature scheme,
the `{data}` envelope, and phone→JID normalization.

This release fixed **2 real correctness bugs**, added the **`usableAsTool` AI-agent capability** (the
single highest-value market gap, and node-only), and added the **test suite the node completely
lacked** (0 → 31 tests + a contract-drift guard).

The remaining market gaps are **conversational primitives** (typing, mark-read, reply, reaction,
poll, location, contact card) and **new inbound triggers** (reaction, poll-vote, group join/leave).
They are genuinely valuable and reliably supported by Baileys, but each is an **app-first feature**.
They are scheduled in §7.

---

## 2. Shipped

### v2.7.0 — node hardening
| # | Change | Type | Files |
|---|--------|------|-------|
| 1 | **Fix: send `429` anti-ban block no longer hangs/silently fails** | 🔴 Bug | `GenericFunctions.ts`, `SocialMate.node.ts` |
| 2 | **Fix: `Queue → Get Batches` "Return All" no longer infinite-loops** | 🟠 Bug | `SocialMate.node.ts`, `GenericFunctions.ts` |
| 3 | **`usableAsTool: true`** — every operation is now callable by an n8n AI Agent | ✨ Feature | `SocialMate.node.ts` |
| 4 | **Test suite** — 31 tests: unit, mock-server integration, HMAC, contract-drift guard + opt-in live smoke | ✅ Quality | `test/**`, `scripts/**`, `vitest.config.ts` |
| 5 | **Codex node-type prefix fixed** (`n8n-nodes-base.*` → `n8n-nodes-socialmate.*`) | 🧹 Fix | `*.node.json` |

### v2.8.0 — "best WhatsApp AI agent tool for n8n" productization
| # | Change | Type | Files |
|---|--------|------|-------|
| 6 | **All ~50 operation descriptions rewritten to the AI-tool bar** (returns/when-not-to-use/sibling disambiguation; admin ops de-prioritized) | ✨ | `descriptions/*.ts` |
| 7 | **`$fromAI` fix** — Group→Create field `name`→`groupName` (n8n#28261); node `alias` + control-surface description | ✨ | `descriptions/group.ts`, `SocialMate.node.ts`, `*.node.json` |
| 8 | **AI-Agent-tool + MCP examples + deep guide** | 📚 | `examples/ai-agent-tool.json`, `examples/mcp-server-trigger.json`, `docs/AI-AGENT-TOOL-GUIDE.md` |

### App (SM4) — standalone MCP server
| # | Change | Type | Files |
|---|--------|------|-------|
| 9 | **`socialmate-mcp`** — a native Model Context Protocol server (**30 WhatsApp tools**: messaging, memory, contacts, groups, full queue control, sync, anti-ban, capabilities) so Claude Desktop / Cursor / any MCP client controls WhatsApp. Thin translator over the REST API → reuses auth/scope/tier/anti-ban/audit. Integration-tested. | ✨ | `mcp/` (`index.mjs`, `tools.mjs`, `test.mjs`) |
| 9a | **Inbound-for-MCP** — MCP is pull-only (no push), so added a **`afterTs` poll cursor** to `GET /messages` (+ n8n `message:search` filter) and a `whatsapp_fetch_new_messages` MCP tool; documented the honest "poll or bridge via the Trigger/webhook" pattern everywhere. Renamed `get_conversation` → `get_ai_context` (deprecated alias kept). | ✨ | `mcp/tools.mjs`, SM4 `api-server.ts`/`sync.ts`, `descriptions/message.ts`, docs |
| 10 | **AI blog + support + integration catalog** now advertise the AI-agent-tool + MCP capability (incl. the pull-only/bridge nuance); "only native integration" hardcodes updated to "native n8n node + open MCP protocol" (still no per-service connector; AI generation still "coming soon"). New `/docs/mcp-server` page + the two GEO landing pages. | 📣 | `Copy.php`, `ProductContext.php`, `PostSchema.php`, `SupportContext.php`, `Docs.php`, `mcp-server.php`, `AiAgentTool.php` |

**Invariant update:** MCP is an **open-protocol surface** (like the REST API + webhooks), NOT a
per-service native connector. n8n remains the only native *node* integration.

### Next milestone — conversational primitives (app-first)
Not shipped anywhere (absent from the REST API, so absent from n8n and MCP). Each needs a new adapter
method → REST route → n8n op → MCP tool → docs, with anti-ban review:
**reply/quote** (quoted reply), **mark-read** (read receipts), **typing** (presence), **reaction**
(emoji react). These are the table-stakes primitives WAHA/Evolution ship and we don't (see §6/§7);
reply/quote + typing are the highest-value for natural agents and should land first.

See §4 for bug detail and §6/§7 for the remaining app-first conversational primitives.

---

## 3. Current capability inventory (what the node does today)

**2 nodes** (SocialMate action + SocialMate Trigger), **1 credential**, **11 resources**, **~50
operations**, **29 trigger events**.

| Resource | Operations | Tier notes |
|---|---|---|
| **Message** | Send Text · Send Media (image/video/audio/document/sticker; url/binary/base64 + caption) · **Get AI Context** (role-mapped transcript for LLMs) · Search/List history | Text = Free; Media/AI-Context/Search = Pro |
| **Chat** | Get Many | Free |
| **Contact** | Get · Get Many (search) | Free |
| **Group** | Get Many · Get · Get Invite Link · Create · Update Participants (add/remove/promote/demote) · Set Subject · Set Description · Leave | Reads Free; writes Pro |
| **Media** | Get Many · Get · Get Stats · Download File · Download Thumbnail · Get Download Queue · Force Download · Delete · Run Cleanup | Reads Free; writes/cleanup Pro |
| **Queue** (smart scheduling) | Enqueue · Bulk Import (mustache templating) · Get Status · Get Items · Get Batches · Cancel/Retry Item · Cancel/Retry Batch · Pause · Resume | Reads Free; writes Pro |
| **Account** | Get Many · Get · Get Anti-Ban Status | Free |
| **Sync** | Trigger · Get Status | Trigger Pro; status Free |
| **Webhook** | Full CRUD + Test + Deliveries | Free (Free delivery-capped) |
| **API Key** | Get Many · Create · Rotate · Delete | Free |
| **System** | Capabilities · Status · Version · Network Status | Free |
| **Trigger** | 29 webhook events (message.received/sent, account.\*, contacts.updated, tunnel.\*, sync.\*, media.\*, queue.\*, license.\*), HMAC-verified | 9 Free / 20 Pro |

**Where the node already _beats_ the competition:** a first-class **scheduling/queue engine** (bulk
import + pause/resume/retry), a **media archive**, an **AI-context (conversation memory) endpoint**,
and **anti-ban status** — none of WAHA / Evolution / the official node expose equivalents.

---

## 4. Bugs found & fixed

### 🔴 Bug #1 — send `429` anti-ban block was mishandled (HIGH)

The request helper retried **every** `429` up to 3× while sleeping its `Retry-After`. But the app
returns `429` for a Free-tier **anti-ban send block** carrying `{reason, retryAfterMs, hint,
upgrade}`, whose `Retry-After` for `night_mode` can be **hours**. The workflow would **hang** for up
to 3× that wait, then throw a **generic** error that discarded the `reason`/`upgrade` — the app's
deliberate "upgrade to Pro to auto-queue" signal.

**Fix:** the helper now distinguishes the transient **per-key rate limiter** (`code:'rate_limited'`,
no `reason` → retry, with a **60s sleep cap**) from an **anti-ban block** (`reason`/`upgrade`
present → never retried). A block is thrown as a typed `SocialMateBlockedError`, and the **Message
send** operation surfaces it as a structured `{ blocked:true, reason, retryAfterMs, hint, upgrade }`
result — parallel to the `200 {sent}` and `202 {queued}` outcomes — so a workflow can branch (e.g.
_if blocked → Queue: Enqueue_ on Pro). Covered by `test/integration/request.test.ts`.

### 🟠 Bug #2 — `Queue → Get Batches` "Return All" infinite loop (MODERATE)

`GET /v1/queue/batches` returns a **bare, non-paginated array**, but the node paged it through the
offset/limit pager, which assumes `{data, pagination:{total}}`. With Return All + ≥ a page of
batches, `offset` was ignored, the page never shrank, `total` was `undefined` → **infinite loop /
OOM / hung execution.**

**Fix:** `getBatches` now does a **single GET** with a client-side limit, and the pager gained a
**defense-in-depth guard** — a response with no `pagination` metadata is treated as one complete
page and never re-fetched. Covered by `test/integration/request.test.ts`.

---

## 5. Market gap analysis (2025-2026)

### 5.1 Most-requested n8n WhatsApp automations (ranked)

1. **AI chatbot / conversational agent** (OpenAI/LLM) — _dominant_; many official templates.
2. **Auto-reply / support bot** (FAQ + escalation).
3. **Lead capture → CRM + instant follow-up.**
4. **Order / shipping / payment notifications.**
5. **Appointment booking & reminders** (Cal.com/Calendar).
6. **Voice-note → transcription → AI reply** (multimodal).
7. **Broadcast / bulk campaigns** ← _our queue + bulk-import sweet spot._
8. **Support ticketing / omnichannel** (Chatwoot/Asana).
9. **RAG knowledge-base bot** (vector DB).
10. **Abandoned-cart recovery.**
11. Message archiving/logging · 12. Drip/nurture sequences · 13. Internal team alerts · 14.
Surveys/feedback/NPS · 15. OTP/verification · 16. Birthday/loyalty · 17. Group/community management ·
18. Review requests.

### 5.2 Capability → gap flags

| Capability | Needed by | Have? | Verdict |
|---|---|---|---|
| Incoming-message trigger | 1,2,8,9,14 | ✅ | core, covered |
| Send text / image / doc | nearly all | ✅ | covered |
| History / AI-context | 1,2,9,11 | ✅ | **differentiator** |
| Group management | 13,17 | ✅ | **we lead** |
| Scheduled / bulk queue | 7,12,15,16 | ✅ | **we lead** |
| **`usableAsTool`** | 1,2,5,9 | ✅ **(shipped this release)** | was the #1 gap |
| **Reply / quoted** | 2,8,13,14,17 | ❌ | 🟠 high — expected UX |
| **Typing + mark-read** | 1,2,8 | ❌ | 🟠 high — table stakes |
| **Poll** | 14,7,17 | ❌ | 🟡 medium, reliable |
| **Reaction (send + inbound)** | 2,14 | ❌ | 🟡 medium |
| **Location / contact vCard** | logistics, lead routing | ❌ | 🟢 easy, reliable |
| Interactive buttons / list | 2,5,15 | ❌ | ⚠️ **DO NOT BUILD** — deprecated on WhatsApp-Web (see §8) |
| Labels / tags | 3,8 | ❌ | ⚠️ Business-app-only, weak on multi-device |

### 5.3 Competitor operation matrix (what they have that we lack)

- **Official n8n WhatsApp Business Cloud** — Send, Send-and-Wait, Send Template; Media upload/download/delete. _No native buttons/list/location/reaction/contact ops_ (needs raw HTTP + approved templates); API-gated (business verification, 24h window, template approval) — the pain that drives users to Baileys nodes like ours.
- **WAHA (`n8n-nodes-waha`)** — text, image, file, voice, video, **buttons, poll, location, contact vCard, forward, seen (mark-read), reaction, star, typing**; chat archive/unread; contacts block/unblock; groups; **status/stories**; **channels/newsletters**.
- **Evolution API (`n8n-nodes-evolution-api`, Baileys-based — our closest architecture)** — text/media, **poll, contact, list, button, react, status**; chat **mark-read, archive, edit, delete, presence/typing, block, search**; full groups.
- **Generic `n8n-nodes-whatsapp*`** — mostly WAHA/Evolution wrappers.

**Recurring primitives competitors ship and we don't:** reply/quote, typing, mark-read, reaction,
poll, location, contact vCard, edit/delete, status.

### 5.4 Baileys reliability (what's safe to build)

**Reliable / current:** quoted-reply, mentions, forward; location; contact/vCard; **reactions**;
**polls**; edit; delete-for-everyone; **presence/typing** (`sendPresenceUpdate`) & **read receipts**
(`readMessages`) — _both already used privately in our adapter_; star/pin; groups; status/stories.

**Risky / deprecated — DO NOT build:** interactive **buttons & list messages** (removed across
Baileys-family libs; "may display but fail to function"). **Labels/tags** (Business-app feature,
unreliable on multi-device). All sends carry ban risk → keep gating behind anti-ban.

### 5.5 AI-agent integration

Two patterns dominate: (a) _trigger → AI Agent node (LLM + chat-memory keyed by phone) → send-text_
— **we already support this**; and (b) _the node exposed as an agent **tool**_ via
`usableAsTool: true` — **now shipped**. The AI-Context endpoint is a genuine differentiator now
reachable by agents. Requires the n8n instance env `N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true`
(documented in the README).

### 5.6 Trigger/event demand

Most-wanted inbound events we lack: **group participant join/leave**, **inbound message reaction**
(even the official node fails at this), **poll vote**. Scheduled in §7.

---

## 6. Missing endpoints & tools catalog (full-stack surfaces)

Everything the app+node must add to "do it all." Each row lists the **app-side** work (SM4 = source
of truth) and the **node-side** mirror. `Free?` is a **proposed** tier (product's call); all sends
still pass the anti-ban pipeline. Recipient inputs reuse `phoneOrGroupToJid` / `normalizeChatId`.

| Capability | Baileys call (adapter) | Proposed REST endpoint | Inbound webhook event | Node op | Tier |
|---|---|---|---|---|---|
| **Typing / presence** | `sendPresenceUpdate(state, jid)` — _already private_ | `POST /v1/accounts/:id/presence` `{chatId, state: composing\|recording\|paused}` | — | Message → Send Typing | Free (nicety) |
| **Mark as read** | `readMessages([key])` — _already private_ | `POST /v1/accounts/:id/messages/read` `{chatId, messageIds?}` | — | Message → Mark Read | Free |
| **Reply / quoted** | wire `SendOptions.replyTo` (dead today) into `sock.sendMessage(jid, content, {quoted})` | extend `POST /v1/accounts/:id/messages` with `quotedMessageId` | — | send option "Reply To Message ID" | same as send |
| **Send poll** | `sock.sendMessage(jid,{poll:{name,values,selectableCount}})` | extend `POST …/messages` with `poll{name,options[],selectableCount}` (or `POST …/polls`) | — | Message → Send Poll | Pro (apiWriteEnabled) |
| **Send reaction** | `sock.sendMessage(jid,{react:{text,key}})` (empty text = remove) | `POST /v1/accounts/:id/messages/:messageId/reaction` `{chatId, emoji}` | — | Message → React | Free |
| **Inbound reaction** | detect in `messages.upsert`/`.update` | — | **`message.reaction`** (new, Pro) | Trigger event | Pro |
| **Inbound poll vote** | decrypt `messages.update` pollUpdates | — | **`poll.vote`** (new, Pro) | Trigger event | Pro |
| **Send location** | `sock.sendMessage(jid,{location:{degreesLatitude,degreesLongitude,name,address}})` | extend `POST …/messages` with `location{latitude,longitude,name?,address?}` | — | Message → Send Location | Pro |
| **Send contact vCard** | `sock.sendMessage(jid,{contacts:{displayName,contacts[]}})` | extend `POST …/messages` with `contacts[{fullName,phone,…}]` | — | Message → Send Contact | Pro |
| **Group join/leave events** | `group-participants.update` | — | **`group.participants_updated`** (new, Pro) | Trigger event | Pro |
| **Edit message** | `sock.sendMessage(jid,{edit:key,text})` | `PATCH /v1/accounts/:id/messages/:messageId` `{chatId,text}` | — | Message → Edit | Pro |
| **Delete for everyone** | `sock.sendMessage(jid,{delete:key})` | `DELETE /v1/accounts/:id/messages/:messageId` `{chatId}` | — | Message → Delete | Pro |
| **Forward** | `sock.sendMessage(jid,{forward:msg})` | `POST /v1/accounts/:id/messages/:messageId/forward` `{toChatId}` | — | Message → Forward | Pro |
| **Status / stories** | `sock.sendMessage('status@broadcast', …)` | `POST /v1/accounts/:id/status` | — | Status → Post | Pro (⚠️ medium ban risk) |

**Every app-side row also requires** (integration checklist): a schema (Fastify JSON Schema) + API
scope + `requireProRest` gate where Pro + audit-log + `analyticsService.track` + drift-guarded
OpenAPI/`api-endpoints.ts` entries + **`npm run gen:product-facts`** + cross-repo propagation to the
website & this node (`docs/CROSS-REPO-CONTRACT.md`). The node side then adds the resource/op, updates
`test/fixtures/product-facts.json` via `npm run sync:contract`, and the drift test enforces parity.

---

## 7. Future-features roadmap (all planned)

Ordered by market coverage per unit of effort. Each phase = app-first build, then node mirror.

### Phase 1 — Conversational parity _(cheapest; unlocks native-feeling chatbots)_
- **Typing indicator + Mark-as-read.** The Baileys calls (`sendPresenceUpdate`, `readMessages`) are
  **already used privately** in `baileys-adapter.ts` — promote them to `IWhatsAppAdapter` methods,
  add the two endpoints, mirror as Message ops.
- **Reply / quoted message.** `SendOptions.replyTo` **already exists as dead type** at
  `router/types.ts:70` — wire it into `sock.sendMessage`, expose `quotedMessageId` on the send
  endpoint, add the send option.

### Phase 2 — Engagement _(reliable on Baileys; the safe answer to the "buttons" demand)_
- **Send poll** + **send reaction**.
- **Inbound `message.reaction`** and **`poll.vote`** trigger events (differentiators — the official
  node can't do reactions).

### Phase 3 — Rich content + triggers
- **Send location** · **Send contact vCard**.
- **`group.participants_updated`** trigger event (join/leave/promote/demote) — completes our
  group-management lead.

### Phase 4 — Nice-to-have
- Edit · Delete-for-everyone · Forward.
- Status/stories send (medium ban risk — gate hard behind anti-ban + a Danger-Zone-style warning).

---

## 8. Explicit exclusions (feasibility traps — do NOT build)

- **Interactive buttons / list menus.** Deprecated and unreliable across all Baileys-family
  libraries on the WhatsApp-Web protocol; competitors' "buttons" ops throw 400s in the wild. Market
  the **poll** primitive (Phase 2) and Cloud-API-style approved templates instead.
- **Labels / tags.** A WhatsApp _Business app_ feature; limited/unreliable over multi-device Baileys.

---

## 9. Testing

- `npm test` — **31 tests, zero external deps**: unit (JID/base-URL parity with the app), mock-SM4
  integration (envelope, 402, per-key-429 retry, **anti-ban-429 block**, 202-queue, pagination, the
  **Get-Batches no-loop** guard), trigger **HMAC** verify/reject, and a **contract-drift guard**
  against the vendored `product-facts.json`.
- `npm run sync:contract` — refresh the vendored snapshot from SM4; the drift test then flags
  anything the node must mirror.
- `npm run test:live` — opt-in smoke against a running app (`SOCIALMATE_BASE_URL` +
  `SOCIALMATE_API_KEY` [+ `SOCIALMATE_SEND_TO`]).

---

## 10. Sources (market research)

n8n templates & docs (WhatsApp Business Cloud node + trigger, AI/Tools Agent, community-node tool
usage, bug #26202), WAHA (`n8n-nodes-waha` docs), Evolution API (`n8n-nodes-evolution-api` README +
buttons-400 threads), Baileys repo/`baileys.wiki` + the buttons/lists deprecation writeup, and
community forum threads on reactions/poll-vote/group-event triggers. Competitor and Baileys claims
were taken from primary sources (official docs, GitHub READMEs) fetched during the audit.
