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
