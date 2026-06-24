# AGENTS.md — n8n-nodes-socialmate

This repo follows the instructions in **[`CLAUDE.md`](./CLAUDE.md)** — read it first.

**TL;DR for any AI agent working here:**

- This is the community **n8n node** for the **SocialMate** desktop app. It is a thin client over
  SocialMate's HTTP API + webhooks and **mirrors** the app — it never defines product behavior and
  never invents endpoints, events, parameters, or tier gates.
- The **source of truth is the app**, open in this workspace at `~/Desktop/SM4`. Before changing the
  node's surface, read `~/Desktop/SM4/docs/CROSS-REPO-CONTRACT.md` and diff against
  `~/Desktop/SM4/docs/product-facts.json`.
- When the app's API / webhook events / tiers / limits change, follow the **propagation checklist**
  in `CLAUDE.md`: update the relevant `descriptions/*.ts`, `SocialMate.node.ts` routing,
  `SocialMateTrigger` `EVENT_OPTIONS`, `README.md`, `CHANGELOG.md`, and bump `package.json`.
- Invariants: mirror don't invent; tier truth is the server's `402`; Free webhook subset = 9;
  "High-Volume Mode" is the customer-facing name (wire events stay `account.danger_mode_*`); stable
  URLs only; no AI generation (the app's AI is "coming soon").
- Build/lint: `npm run build && npm run lint`. Publishing to npm is a manual, human-authorized step.
