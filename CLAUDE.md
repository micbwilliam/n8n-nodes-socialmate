# n8n-nodes-socialmate — Claude Code Instructions

## Identity & prime directive

This is the **community n8n node for SocialMate** — a self-hosted WhatsApp automation desktop
app. The node is a thin client over SocialMate's local **HTTP API + webhooks**.

> **Prime directive: this node MIRRORS the SocialMate desktop app. It never defines product
> behavior and never invents endpoints, events, parameters, or tier gates.** On any ambiguity,
> diff against the real app source — never guess.

**The app is the source of truth, and it is open in this same workspace at `~/Desktop/SM4`.**
Read its cross-repo contract first:

- **`~/Desktop/SM4/docs/CROSS-REPO-CONTRACT.md`** — the anchor map ("if X changed in the app,
  update Y here").
- **`~/Desktop/SM4/docs/product-facts.json`** — a machine-readable snapshot of every anchor
  (version, tiers, rate limits, **webhook events + Free subset**, **REST endpoints** with
  method/path/scope/Pro gate). Diff your mirrors against this.
- App anchor files: `src/shared/constants.ts` (`WEBHOOK_EVENTS`, `FREE_WEBHOOK_EVENTS`, rate
  limits, `DANGER_ZONE`), `src/shared/license-features.ts` (tiers), `src/main/services/api-server.ts`
  + `src/renderer/src/lib/const/api-endpoints.ts` (REST), `src/main/services/ai-context.ts`.

## Repo map

```
nodes/SocialMate/
  SocialMate.node.ts          # the action node — execute() routes resource+operation → API path
  descriptions/*.ts           # per-resource operation lists + fields (11 resources)
  GenericFunctions.ts         # base URL, x-api-key auth, { data } envelope unwrap, 401/402/403/429
  methods/loadOptions.ts      # dynamic dropdowns (accounts, chats, groups)
nodes/SocialMateTrigger/
  SocialMateTrigger.node.ts   # webhook trigger — EVENT_OPTIONS = the 29 events (Free unlabelled, Pro = "(Pro)")
credentials/
  SocialMateApi.credentials.ts# baseUrl (default http://127.0.0.1:3456), apiKey; test = GET /v1/capabilities
README.md, CHANGELOG.md       # user-facing docs — drift-prone, update on every API/event/tier change
```

Resources (action node): **account, chat, contact, group, media, message, queue, sync, webhook,
apiKey, system**. Trigger: a single webhook node listening to the 29 events.

## Propagation checklist — when the app changes

| App change | Update here |
|---|---|
| REST route added / changed / removed | `descriptions/<resource>.ts` (option + fields) **and** `SocialMate.node.ts` execute() routing + `README.md` matrix + `CHANGELOG.md` + bump `package.json` version |
| Webhook event added / removed | `SocialMateTrigger.node.ts` `EVENT_OPTIONS` (value **and** `(Pro)` label — unlabelled = Free) + `README.md` events list |
| License tier / feature flag changed | which operations carry a "(requires Pro)" hint in `descriptions/*.ts` + `GenericFunctions.ts` 402 message + `README.md` Free-vs-Pro matrix |
| Rate-limit / High-Volume numbers changed | `README.md` "License tiers & limits" |
| ai-context params changed | `descriptions/message.ts` ("Get AI Context") + `README.md` |

After any of these: verify the node's surface still matches `~/Desktop/SM4/docs/product-facts.json`
(webhook event list + Free subset, endpoint method/path/scope/Pro).

## Invariants (never violate)

- **Mirror, don't invent.** Every `/v1/...` path the node calls must exist in the app's
  `api-endpoints.ts`. Every trigger event must exist in the app's `WEBHOOK_EVENTS`.
- **Tier truth comes from the server.** The node doesn't hard-block Pro at the request layer — it
  relies on the server's `402`. Labels ("(requires Pro)", `(Pro)`) are guidance and must match the
  app's actual gate (`requireProRest` / `LICENSE_FEATURES`), not a guess.
- **Free webhook subset = exactly 9** (`message.received`, `message.sent`, `account.connected`,
  `account.disconnected`, `tunnel.url_changed`, `tunnel.stopped`, `license.activated`,
  `license.deactivated`, `license.tier_changed`). Everything else — incl. `tunnel.started` and the
  `account.danger_mode_*` events — is Pro.
- **Branding:** the customer-facing name is **"High-Volume Mode"**; the wire event names stay
  `account.danger_mode_enabled` / `_disabled`. Label with the customer-facing name; never rename the
  event value.
- **Stable URLs only.** Credentials accept `localhost`/`127.0.0.1` or a **named** Cloudflare tunnel.
  Quick tunnels (`*.trycloudflare.com`) rotate and are unsupported.
- **No AI generation.** "Get AI Context" exports a transcript for *your* LLM; the app ships no AI
  replies/summaries ("coming soon"). Never add an operation that implies otherwise.

## Conventions to preserve

- Auth header: **`x-api-key`** (`GenericFunctions.ts`). Scopes: `read` / `send` / `admin`.
- Responses are unwrapped from a `{ data }` envelope; lists paginate via `offset`/`limit` with
  `pagination.total`. Honor `Retry-After` on `429` (3 retries). Map `402` → a "needs Pro" message.
- Binary downloads (Download File / Download Thumbnail) fetch with `{ encoding: 'arraybuffer' }`
  and `prepareBinaryData`.

## Build / lint / release

```bash
npm run build       # tsc → dist/ + gulp build:icons (copies svg/png + *.node.json)
npm run lint        # eslint nodes credentials package.json
npm run lintfix
npm run release:dry # preview the next version + release notes locally (no publish)
```

**Releases are fully automated** via semantic-release (`.releaserc.json` +
`.github/workflows/release.yml`). Do **not** hand-edit `package.json` `version` or `CHANGELOG.md`
— the bot owns both. To cut a release, land a
[Conventional Commit](https://www.conventionalcommits.org/) on `main`:

- `fix: …` → patch · `feat: …` → minor · `feat!:` / `BREAKING CHANGE:` in the body → major
- `docs:` / `chore:` / `ci:` / `refactor:` / `test:` → **no** release

On push to `main` the workflow versions, tags (`vX.Y.Z`), publishes to npm (with provenance),
regenerates `CHANGELOG.md`, and cuts the matching GitHub Release. The node keeps its **own semver —
not pinned to the app version**; mention the app version it was aligned to in the commit body so it
flows into the changelog + release notes.
