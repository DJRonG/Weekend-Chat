# docs/ — Weekend Agent Documentation Index

This folder contains all design, architecture, and operational documentation for the **Weekend Home Agent (WHA)** project.

---

## Contents

| File | Purpose |
|------|---------|
| [diagrams/home-model.mmd](diagrams/home-model.mmd) | Mermaid architecture diagram — canonical source of truth for the system model |
| [orchestration.md](orchestration.md) | Orchestration layer spec: data sources, world-state schema, engine pipeline, HA automation trigger points, and the full build checklist |
| [dashboard_inspiration.md](dashboard_inspiration.md) | Reddit dashboard design references and the UI/UX elements we are borrowing |

---

## Project Context

The Weekend Agent is a context-aware smart home microservice that:

1. **Reads** from Home Assistant (EV charge, garden valve, presence, biometrics via MQTT)
2. **Builds** a world-state snapshot combining HA data with weather, calendar, and conversation notes
3. **Runs** the Mobility Engine, Agenda Builder, and Emotion Parser against that snapshot
4. **Writes** recommendations back to the Turso/Supabase state store
5. **Fires** HA webhook automations when thresholds are crossed (low EV, rain alert, departure/arrival, etc.)

---

## HA Automation Build Status

See [orchestration.md](orchestration.md) for the full checklist. Quick summary:

- **Phase 1 — HA Sensor Integration** 🔲 In progress
- **Phase 2 — Webhook Dispatcher** 🔲 Not started
- **Phase 3 — MQTT Presence Pipeline** 🔲 Not started
- **Phase 4 — Notification Outputs** 🔲 Not started
- **Phase 5 — Calendar & Biometric Feeds** 🔲 Not started

---

## Related Files (repo root)

| File | Purpose |
|------|---------|
| [../home-status.ts](../home-status.ts) | Vercel API handler for GET/POST/PUT home_status |
| [../events.ts](../events.ts) | Vercel API handler for calendar events |
| [../conversation-notes.ts](../conversation-notes.ts) | Vercel API handler for Friday recap notes |
| [../mobility-engine.ts](../mobility-engine.ts) | Core walk/drive/rideshare scoring logic |
| [../1.sql](../1.sql) | Database schema (Turso / Cloudflare D1) |
| [../wha_readme.md](../wha_readme.md) | Full WHA v2.0 system documentation |
| [../DEPLOYMENT_GUIDE.md](../DEPLOYMENT_GUIDE.md) | Vercel + Cloudflare deployment steps |
| [../CLAUDE_CODE_HANDOFF.md](../CLAUDE_CODE_HANDOFF.md) | Step-by-step guide for Claude Code Chrome extension handoffs |

---

## How to Add a New HA Automation

1. Add the trigger condition to the table in [orchestration.md § 5](orchestration.md#5-ha-automation-trigger-points)
2. Create a new `webhook_id` in HA under **Settings → Automations → Create → Trigger: Webhook**
3. Add the `HA_WEBHOOK_<NAME>` env var to Vercel
4. Add the outbound call in `/api/ha-webhook.ts`
5. Test end-to-end: trigger condition → Vercel log → HA automation fires
6. Check the box in the Phase checklist in orchestration.md and commit
