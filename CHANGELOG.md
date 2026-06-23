# Changelog

All notable changes to **n8n-nodes-socialmate** are documented here. This project
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
