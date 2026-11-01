## [2.8.0] — Unreleased

- **Send Event** takes an **Instruction** (the owner's words for the agent) and an **Audience** (customer, or the owner's own number).

Mirrors the **Claude Agent** — the WhatsApp AI agent built into the SocialMate app (Pro, license flag `aiEnabled`), built on Anthropic's Claude Agent SDK with the model of the customer's choice.
Every new operation and event is Pro; a Free server answers `402`.

### Added
- **Agent resource** (16 operations) over the app's `/v1/agents` API: **Get Many**, **Get**,
  **Update** (name, purpose, autonomy `observe`/`copilot`/`autopilot`/`autonomous`, custom prompt —
  with an optional **Config Version** for optimistic locking; a stale one returns `409
  version_conflict`), **Pause**, **Resume**, **Get Usage** (`today`/`7d`/`14d`/`30d`/`90d`),
  **Get Usage Summary**, **Get Approvals**, **Decide Approval**, **Get Handoffs**, **Take Over
  Chat**, **Release Chat**, **Reply in Chat**, **Send Event** (start an agent job from a site event:
  type, idempotency key, recipient, optional job, data JSON and consent), **Get Knowledge** and
  **Add Knowledge**. The agent is picked from a dropdown (new `getAgents` load-options method). Reads
  need a `read` key, Send Event a `send` key, every other write an `admin` key. Chat operations
  accept a JID or a phone number.
- **13 Pro trigger events** (35 → 48): `agent.reply_sent`, `agent.draft_created`,
  `agent.approval_requested`, `agent.approval_decided`, `agent.handoff_requested`,
  `agent.handoff_resolved`, `agent.paused`, `agent.resumed`, `agent.budget_warning`,
  `agent.injection_detected`, `agent.job_failed`, `agent.lead_captured`, `connector.revoked`.
- **Contract drift guard:** the fixture is synced to app 3.0.0 (99 endpoints, 48 events). App
  endpoints the node deliberately does not call (agent create/delete, run logs, conversations, chat
  messages, per-contact memory, knowledge delete, `/v1/ai/settings`, `/v1/ai/senses*`,
  `/v1/connectors/wordpress*`) sit in a commented exemption list, checked so it cannot go stale —
  "node ⊇ app" still fails on any new, unlisted endpoint.
- Wire-shape tests for every Agent operation (`test/unit/agent-execute.test.ts`).
- Error tests run against the error n8n really throws (a `NodeApiError` wrapping an AxiosError,
  in both the current shape and the `cause`-preserving one) and serve the app's real error bodies
  from `test/fixtures/api-error-envelopes.ts`, each copied from its `reply.code(N).send` in the
  app's `api-server.ts`.
- `test/unit/examples.test.ts` validates every `examples/*.json`: it parses, every node type exists
  (this package or n8n core), only Tool types feed an AI tool input, resources/operations/parameters
  are real, every node's typeVersion is one it accepts, and every Trigger expression resolves
  against the payload the app sends (`test/fixtures/webhook-message-received.ts`). Where an n8n
  install is reachable (global, or `N8N_NODE_MODULES`), the core node types and versions are also
  checked against the manifests n8n ships.

### Changed
- README: Agent row in the Free-vs-Pro table, agent events in the event list, Agent scopes in the
  scope list, and the MCP server's tool count (44 → 59, as `socialmate-mcp` gains the agent tools).
- The scheduled-reminders example is renamed `examples/scheduled-bulk-send.json` →
  `examples/scheduled-batch-send.json` (same workflow; "batch" is the product's word for it).

### Fixed
- **The credential Test warns about a missing admin scope on Free too.** It decided from the
  per-tool flags in `/v1/capabilities`, but on Free every admin tool is also tier-gated, so a
  read+send key tested green with no warning and the Trigger then failed to register its webhook
  (403 `insufficient_scope`). The Test now asks `GET /v1/webhooks` — admin scope on every tier, and
  changes nothing — and warns whenever the server answers `insufficient_scope`.
- **The credential Test explains two common Server URL typos.** A trailing `/v1` is named ("remove
  /v1", instead of `404 Route GET:/v1/v1/capabilities not found`), and an address typed without a
  scheme that answers plain HTTP suggests `http://…` instead of a raw OpenSSL "packet length too
  long" error.
- **Remote reach matches the 3.0 server.** The credential's Server URL help, the README, the Test's
  hints and the example notes said a remote n8n needs a named tunnel (Pro). A SocialMate *server*
  install is reached at its public address (its domain / `SOCIALMATE_PUBLIC_URL`) on every tier; the
  named tunnel (Pro) is for the desktop app.
- **An invalid Scheduled At no longer sends immediately.** On Queue: **Enqueue** and **Queue a
  Batch**, a Scheduled At that did not parse as a date-time was sent as `scheduledAt: null` — "as
  soon as possible" — so a mistyped schedule went out at once. The item now fails with "Scheduled
  At is not a valid date-time" and nothing is queued. An empty Scheduled At still means as soon as
  possible.
- **Error handling works inside real n8n.** n8n wraps every failed request in a `NodeApiError`
  whose status survives only as the string `httpCode` and whose body survives only as
  `context.data` — the node read `statusCode` / `response.body` and saw nothing. So an anti-ban
  block (e.g. the new-number warming cap) failed the workflow with "The service is receiving too
  many requests from you" instead of returning `{ blocked: true }`, per-key 429s were never
  retried, and 402/403 lost the feature and scope names. All of it now reads one normalised
  error (status, body, headers) and builds its own `NodeApiError`, so the messages survive.
- A **403** says what the server said. Only `insufficient_scope` is reported as a missing scope;
  batch sending switched off (`bulk_import_disabled`), not a group admin (`group_forbidden`), a key
  scoped to another account and a key whose accounts are suspended on Free surface the app's own
  message and error code. The 401/403 hints point at **API & Integrations**.
- A **402** includes the server's message — e.g. "These webhook events require Pro:
  message.delivered" instead of only `feature: webhookMaxEndpoints`.
- Other errors with a SocialMate message (e.g. `409 Account is not connected`) show it instead of
  n8n's generic status text; "Cannot reach the SocialMate server" fires for a refused connection.
- A **signal-lane 429** (React / Mark Read / Send Typing, `reason: signal_rate_limit`) is retried
  after its short `retryAfterMs` instead of failing the item; an hourly/daily signal cap still
  fails fast with the server's "try again in Ns" message.
- **Credential Test** requires a real SocialMate server. It used to pass for anything answering
  200 — n8n's own URL, or the server's `/admin` console address — and every node then failed
  (an HTML page was read as "719 accounts"). It now requires the `/v1/capabilities` handshake
  (`app: "SocialMate"`), names the `/admin` mistake, reports the tier, and warns when the key has
  no admin scope (the Trigger needs one to register its webhook). An operation run against a URL
  that returns HTML now fails with "did not return SocialMate JSON" instead of a bogus account
  count.
- **The Trigger never adopts an endpoint it did not create.** It used to take over any endpoint
  with its URL — one made by the app's n8n wizard, or one left behind when deactivating failed
  while the app was closed — without that endpoint's secret, which silently switched signature
  verification off and kept the old event list. Such an endpoint is now replaced with a fresh one
  (new secret, this node's events); the Trigger's own endpoint is re-pointed when the Events
  selection changed. With **Verify Signature** on and no stored secret, deliveries are refused
  (`401 no_signing_secret`) instead of accepted unchecked. Every other endpoint at the Trigger's
  URL is removed too, even when the Trigger's own one exists (with Verify Signature off each would
  start the workflow a second time per event), and an endpoint the app switched off after failed
  deliveries is switched back on when the workflow activates.
- On Free, the Trigger's Events help and the README now say what happens: picking a `(Pro)` event
  makes activation fail with a "requires Pro" error naming the event, and Free has 2 webhook
  endpoints in total (a "Listen for test event" listener takes one).
- Account → **Get Proxy** said "Requires Pro"; the read is available on every tier (read-scope
  key). **Clear Proxy** said it was never license-gated; like Set Proxy it requires Pro and an
  admin-scope key.
- `npm run test:live` printed `(?)` for the first account: it read `state`; the list returns `status`.
- **The AI-agent examples run.** `examples/ai-agent-tool.json` and `examples/mcp-server-trigger.json`
  wired the plain `socialMate` node into the agent's Tool input, so every run failed with "Node does
  not have a `supplyData` method defined". Tool nodes are now `socialMateTool` — the variant n8n
  generates for a `usableAsTool` node (in the editor: **SocialMate Tool**).
- The flagship agent example (and `docs/AI-AGENT-SYSTEM-PROMPT.md`) read
  `$('SocialMate Trigger').item.json.body.data.*`. The Trigger emits the delivered payload itself —
  there is no `body` key — so the threaded reply, Mark Read, Show Typing, React and Send Poll all
  failed. They read `item.json.data.*` now; every tool node also takes the account from the
  Trigger, and Search History searches the current chat for words the agent chooses.

## [2.7.1] — 2026-07-14

Documentation-only release — no operation, endpoint or event behaviour changed. A pre-launch audit
of the README against the app's source found six factual errors; a workflow built from the old text
could have been wired wrong.

### Fixed
- **The trigger event list was missing 3 of the 35 events** — `message.delivered`, `message.read`
  (delivery receipts) and `media.context_updated` (Agent Memory). The node's picker always offered
  all 35 with correct `(Pro)` labels; only the README under-listed them. Also corrected "the other
  **24** require Pro" → **26** (35 − 9).
- **`Account → Get Proxy` was shown as Pro.** It is **Free** (a masked read). Only **Set Proxy** and
  **Clear Proxy** are Pro — and both need an **`admin`**-scope key, which the scope table now says.
- **`Sync → Trigger` was documented as `send` scope.** It requires **`admin`**.
- **`Get AI Context`'s example put `tokenEstimate` at the top level.** It lives inside **`meta`** —
  the README contradicted its own field list four paragraphs earlier. The example now shows the real
  shape (`account`, `chat`, `messages`, `transcript`, `meta`).
- **The MCP server was described as exposing 38 tools.** It exposes **44**.
- Added an honesty note on delivery receipts: a contact with read receipts disabled never emits
  `message.read`, so its absence is not proof a message went unread.

## [2.7.0] — 2026-07-08

Production-hardening release: two correctness fixes on the most common paths, first-class AI-Agent
tool support, the node's first test suite, and the AI-agent productization (operation descriptions,
examples, the `afterTs` poll cursor). See
[`docs/CAPABILITY-AUDIT-AND-ROADMAP.md`](docs/CAPABILITY-AUDIT-AND-ROADMAP.md) for the full audit and
[`docs/AI-AGENT-TOOL-GUIDE.md`](docs/AI-AGENT-TOOL-GUIDE.md) for the agent guide.

> **Note.** An earlier draft of this file listed the AI-agent work below under a `[2.8.0]` heading.
> That version was never published — all of it shipped **inside 2.7.0**. The real 2.8.0 is the
> agent release above.

### Fixed
- **Send `429` anti-ban blocks no longer hang or fail opaquely.** A Free-tier send refused by the
  anti-ban engine was retried up to 3× while sleeping its `Retry-After` (hours during quiet hours),
  then thrown as a generic error that dropped the `reason`/`upgrade` detail. The node now
  distinguishes a transient per-key rate-limit (retried, capped backoff) from an anti-ban **block**,
  which **Send Text / Send Media** return immediately as structured data
  `{ blocked: true, reason, retryAfterMs, hint, upgrade }` — branch on it (e.g. route to
  **Queue → Enqueue** on Pro).
- **`Queue → Get Batches` with "Return All" no longer infinite-loops.** The batches endpoint returns
  a non-paginated array; it's now fetched with a single request, and the list pager gained a guard so
  no non-paginated response can loop.

### Added
- **`usableAsTool`** — every operation is now callable by an n8n **AI Agent**. Requires
  `N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true` on the instance. See the README.
- **Test suite** (`npm test`) — 31 tests with zero external deps: unit (phone/JID + base-URL parity
  with the app), a mock-SM4 integration harness (envelope, `402`, `429` retry vs anti-ban block,
  `202` queue, pagination + the Get-Batches no-loop guard), trigger **HMAC** verification, and a
  **contract-drift guard** against a vendored `product-facts.json`. Plus `npm run test:live` (opt-in
  smoke against a running app) and `npm run sync:contract`.
- **AI-grade operation descriptions.** Every operation rewritten so an AI Agent reliably selects and
  fills it — third person, what each returns, when-not-to-use, and sibling disambiguation (e.g. Get
  AI Context vs Search). Admin/diagnostic ops are prefixed "Administrative —" so a conversational
  agent deprioritizes them.
- **AI-Agent-tool + MCP examples:** [`examples/ai-agent-tool.json`](examples/ai-agent-tool.json)
  (SocialMate on an AI Agent's tool input, with `$fromAI`) and
  [`examples/mcp-server-trigger.json`](examples/mcp-server-trigger.json) (expose SocialMate to Claude
  Desktop / Cursor via n8n's MCP Server Trigger). Plus the deep guide + 11 use cases.
- **Discoverability:** node `alias` list (WhatsApp, AI, agent, chatbot, MCP…) and a control-surface
  node description.
- **Poll cursor for inbound (Message → Search / List):** a new **After Timestamp (`afterTs`)** filter
  returns only messages after a Unix-ms cursor — pass the newest timestamp you saw to fetch just
  what's new. This is the pull-side answer to "how does an agent know a message arrived" when it
  can't use the Trigger (e.g. a pure-MCP agent). The standalone `socialmate-mcp` server exposes it as
  `whatsapp_fetch_new_messages`.

### Changed
- Codex node-type identifier corrected (`n8n-nodes-base.*` → `n8n-nodes-socialmate.*`).
- **BREAKING (Group → Create):** the "Group Name" field key is renamed `name` → `groupName` so n8n's
  `$fromAI` ✦ button works (n8n#28261). The API still receives `{name}`. Re-enter the group name in
  any saved Group: Create step after upgrading.

## [2.6.0](https://github.com/micbwilliam/n8n-nodes-socialmate/compare/v2.5.0...v2.6.0) (2026-07-06)

### Features

* update descriptions for bulk import and reminders in README and examples ([5fda95f](https://github.com/micbwilliam/n8n-nodes-socialmate/commit/5fda95f87f8895fa91666482ad0e1cdeb5471fb0))

## [2.5.0](https://github.com/micbwilliam/n8n-nodes-socialmate/compare/v2.4.4...v2.5.0) (2026-06-29)

### Features

* enhance chat ID normalization and update descriptions for phone number formats ([38c9cc1](https://github.com/micbwilliam/n8n-nodes-socialmate/commit/38c9cc1484bd3fcf1174ca2e06fed53f61347959))

## [2.4.4](https://github.com/micbwilliam/n8n-nodes-socialmate/compare/v2.4.3...v2.4.4) (2026-06-28)

### Bug Fixes

* **ci:** strip devDependencies from the published package in the workflow ([5b2c5e9](https://github.com/micbwilliam/n8n-nodes-socialmate/commit/5b2c5e9d98cb8a825a35eff0a641846541d6d825))

## [2.4.3](https://github.com/micbwilliam/n8n-nodes-socialmate/compare/v2.4.2...v2.4.3) (2026-06-28)

### Bug Fixes

* clean published manifest + n8n verification compliance ([5abb059](https://github.com/micbwilliam/n8n-nodes-socialmate/commit/5abb059f5d0afa48292a1cd4ccf0118f32ba9f2e))

## [2.4.2](https://github.com/micbwilliam/n8n-nodes-socialmate/compare/v2.4.1...v2.4.2) (2026-06-28)

### Bug Fixes

* **ci:** remove setup-node registry-url that broke npm auth ([f4db432](https://github.com/micbwilliam/n8n-nodes-socialmate/commit/f4db43276a6ef76589e2bb0cb44d16329f911b5f))

# Changelog

All notable changes to **n8n-nodes-socialmate** are documented here. This project
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.4.1] — 2026-06-28

### Fixed
- **Group / Media Pro gating now matches the app.** The SocialMate server moved three
  write actions behind Pro (`apiWriteEnabled`): **Group → Leave**
  (`POST …/groups/:id/leave`), **Media → Force Download** (`POST …/media/:id/download`),
  and **Media → Delete** (`DELETE …/media/:id`). The operation descriptions already carried
  the "(requires Pro)" hint; this release also corrects the **README Free-vs-Pro matrix**,
  which still listed those three under Free. On Free they return a `402` naming
  `apiWriteEnabled` — same as the other group/media write actions.

> Documentation/labelling-only release — no operation, endpoint or event behaviour changed.
> Aligned with SocialMate app `1.0.0-rc.4` per its `docs/CROSS-REPO-CONTRACT.md`; coverage
> remains all 55 endpoints and all 29 trigger events.

## [2.4.0] — 2026-06-24

### Added
- **README — Request & response examples** for the action node: Send Text, Send Media,
  Get AI Context, Bulk Import, and Get Anti-Ban Status, each with a short "when to use" note
  (matching the in-app Docs and website use-case guidance).
- **Send outcomes** section documenting the `200` / `202` (Pro auto-queue) / `409` results and
  the `429`-vs-auto-queue difference between Free and Pro.

### Fixed / docs
- **Webhook envelope now shows the `timestamp` field** (`{ version, event, timestamp, tunnelUrl,
  data }`) in the description and the sample payload — it was previously omitted.
- **Get AI Context** documents the full option set (`format`, `includeTimestamps`, `beforeTs`
  in addition to `maxMessages` / `maxTokens` / `order`).
- Noted that the legacy `POST /v1/accounts/:id/messages/media` route is deprecated and
  intentionally not exposed as an operation (use **Send Media**).

> Documentation-only release — no operation/event behaviour changed. Aligned with SocialMate
> app `1.0.0-rc.4` per its `docs/CROSS-REPO-CONTRACT.md`; coverage remains all 55 endpoints and
> all 29 trigger events.

## [2.3.0] — 2026-06-24

### Added
- Four operations to cover the rest of the SocialMate API: **System → Get Network Status**
  (`GET /v1/network/status`), **Media → Download Thumbnail** (`GET …/media/:id/thumbnail`),
  **Media → Get Download Queue** (`GET /v1/media/queue`), and **Media → Run Cleanup**
  (`POST /v1/media/cleanup`, Pro).

### Fixed
- **Trigger tier labels now match the app.** `tunnel.started` is Pro (was unlabelled, so the
  picker implied 10 Free events — it is 9). The High-Volume Mode events are renamed to
  **High-Volume Mode Enabled/Disabled** (wire names `account.danger_mode_*` unchanged).
- **Queue / Media tier corrections** to match the server's actual gates: Queue **Get Items**
  and **Get Batches** are Free; Queue **Pause/Resume** require Pro; Media **Delete** is Free
  (only the new server-wide **Run Cleanup** is Pro). The six genuinely-Pro queue operations
  (cancel/retry item + batch, pause, resume) now carry a "(requires Pro)" hint.
- README Free-vs-Pro matrix and trigger-events list updated to match; the 9 Free webhook
  events are now listed explicitly.

> Aligned with SocialMate app `1.0.0-rc.4` per its `docs/CROSS-REPO-CONTRACT.md`.

## [2.2.0] — 2026-06-23

### Added
- Full **README reference**: per-operation Free vs Pro matrix, webhook-event payload
  shape, HTTP error-code reference (401/402/403/429), and API-key scopes (read/send/admin).
- Additional example workflows in `examples/` — a webhook-trigger auto-reply round-trip and
  a scheduled bulk send.
- `bugs` URL in `package.json` for support links.

### Fixed
- Corrected the `package.json` `repository` URL to the real
  `micbwilliam/n8n-nodes-socialmate` remote.
- Credential description now points to the current in-app path
  (**API & Integrations → n8n → New connection**).

### Changed
- Documentation only — no node behaviour changes. Safe drop-in over 2.1.0.

## [2.1.0]

### Added
- **Scope-aware Account picker.** The API key now carries its own account scope
  (This / Selected / All), set when you create the connection in the app. The
  **Account** dropdown lists only the accounts the key allows and auto-selects when the
  key is bound to a single account — no "Default Account ID" needed.
- **Message → Get AI Context** gained an `order` option (`oldest` | `newest`) so AI
  agents can take history newest-first.
- Real SocialMate logo as the node/credential icon.

### Changed
- Removed the URL **auto-heal / "Prefer Live Tunnel URL" beacon**. Only stable URLs are
  supported now: `http://127.0.0.1:3456` (same machine) or a **named-tunnel** hostname
  (Pro). Quick `*.trycloudflare.com` URLs rotate on restart and break a saved credential.

### Migration from 2.0
- An old credential's **Default Account ID** is still honored as a fallback, but you can
  clear it — the scope-aware Account picker replaces it. Re-test the credential after
  upgrading.

## [2.0.0]

### Added
- **Per-account connections.** Each connection is isolated to one account (or a scoped
  set) with its own API key and webhook, instead of a single shared default account.
- **Message → Get AI Context** operation — pulls a chat's history from the SocialMate DB
  as a role-mapped, token-windowed transcript + structured `messages` array for AI agents.

## [1.0.0]

### Added
- Initial release. The **SocialMate** action node (Message, Chat, Contact, Group, Media,
  Queue, Account, Sync, Webhook, API Key, System) and the **SocialMate Trigger** node
  (self-registering webhook, HMAC signature verification), with the **SocialMate API**
  credential.

[2.2.0]: https://github.com/micbwilliam/n8n-nodes-socialmate/releases
[2.1.0]: https://github.com/micbwilliam/n8n-nodes-socialmate/releases
[2.0.0]: https://github.com/micbwilliam/n8n-nodes-socialmate/releases
[1.0.0]: https://github.com/micbwilliam/n8n-nodes-socialmate/releases
