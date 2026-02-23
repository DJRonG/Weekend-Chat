# Claude Code Handoff Guide

This file is the exact workflow for using **Claude** (via the Claude Code Chrome extension or claude.ai) to continue development on this repo. Hand this to Claude at the start of each session.

---

## Quick Context (paste this to Claude at session start)

> "You are continuing work on the **Weekend Home Agent (WHA)** — a context-aware smart home microservice for DJRonG/Weekend-Chat on GitHub. The active branch is `claude/push-weekend-agent-4B5V5`. The project uses React 19 + Vite frontend, Vercel serverless functions (TypeScript), and Turso (SQLite) as the database. Home Assistant runs at `http://192.168.1.229:8123`. Read `docs/orchestration.md` and `docs/README.md` first for full context."

---

## Session Workflow

### 1. Open the right branch

```
https://github.com/DJRonG/Weekend-Chat/tree/claude/push-weekend-agent-4B5V5
```

### 2. Check open PR

```
https://github.com/DJRonG/Weekend-Chat/pull/3
```

The PR title is **"Docs: orchestration + dashboard model"** and is the running PR for all documentation + HA automation work.

### 3. Read the key docs first

| File | What to read |
|------|-------------|
| `docs/README.md` | Overview and HA automation build status |
| `docs/orchestration.md` | Full HA automation pipeline + Phase checklist |
| `docs/diagrams/home-model.mmd` | System architecture |
| `docs/dashboard_inspiration.md` | Dashboard design references |
| `wha_readme.md` | Full WHA v2.0 system documentation |

### 4. Current build priority

Work through the phases in `docs/orchestration.md § 6`:

**Phase 1 — HA Sensor Integration** (start here)
- Create `/api/ha-poller.ts` — polls HA REST API every 60 s, writes to `home_status` table
- Verify `sensor.ev_battery_level` and `binary_sensor.garden_valve` entities exist in HA
- Add `HA_URL` and `HA_TOKEN` to Vercel environment variables

**Phase 2 — Webhook Dispatcher** (after Phase 1)
- Create `/api/ha-webhook.ts`
- Create HA automations for each webhook trigger in the trigger table

### 5. Commit conventions

```
feat: <description>       # new feature
fix: <description>        # bug fix
docs: <description>       # documentation only
chore: <description>      # tooling / config
ha: <description>         # Home Assistant automation changes
```

### 6. PR / branch rules

- All work goes on `claude/push-weekend-agent-4B5V5`
- PR #3 is the target — just push commits; the PR auto-updates
- Do NOT merge to main without human review

---

## Key File Map

```
Weekend-Chat/
├── docs/
│   ├── README.md                    ← docs index + HA build status
│   ├── orchestration.md             ← HA automation pipeline (THIS IS THE GUIDE)
│   ├── dashboard_inspiration.md     ← UI/UX design references
│   └── diagrams/
│       └── home-model.mmd           ← Mermaid architecture diagram
├── home-status.ts                   ← GET/POST/PUT /api/home-status
├── events.ts                        ← GET/POST /api/events
├── conversation-notes.ts            ← GET/POST /api/conversation-notes
├── mobility-engine.ts               ← Walk/drive/rideshare scoring
├── recommendation.ts                ← POST /api/recommendation
├── 1.sql                            ← Database schema
├── wha_readme.md                    ← Full WHA v2.0 docs
├── DEPLOYMENT_GUIDE.md              ← Vercel deployment steps
└── CLAUDE_CODE_HANDOFF.md           ← THIS FILE
```

---

## Environment Variables Needed

See `docs/orchestration.md § 7` for the full list. Critical ones:

| Variable | Where to set | Status |
|----------|-------------|--------|
| `HA_URL` | Vercel env | 🔲 TODO |
| `HA_TOKEN` | Vercel env | 🔲 TODO |
| `TURSO_DATABASE_URL` | Vercel env | ✅ Set |
| `TURSO_AUTH_TOKEN` | Vercel env | ✅ Set |
| `MQTT_BROKER_URL` | Vercel env | 🔲 TODO |

---

## Home Assistant Details

- **HA URL:** `http://192.168.1.229:8123`
- **Key entities to verify:**
  - `sensor.ev_battery_level` — EV charge %
  - `binary_sensor.garden_valve` — garden watering state
  - `person.ron` — presence/location tracking
  - `weather.home` — local weather state
- **Integration tab:** `http://192.168.1.229:8123/config/integrations/dashboard`

---

## What Was Built in the Last Session (Feb 18 2026)

1. Synced branch with main (resolved README.md conflict)
2. Created `docs/diagrams/home-model.mmd` — Mermaid architecture diagram
3. Updated `README.md` with `## Home Model (Source of Truth)` section
4. Created `docs/dashboard_inspiration.md` with 3 Reddit design references
5. Created `docs/orchestration.md` — full HA automation pipeline + Phase checklist
6. Created `docs/README.md` — documentation index
7. Updated PR #3 title to "Docs: orchestration + dashboard model"

---

## Next Session Starting Point

1. Open HA at `http://192.168.1.229:8123` and confirm entity IDs
2. Generate a Long-Lived Access Token in HA (Profile → Security)
3. Add `HA_URL` and `HA_TOKEN` to Vercel project settings
4. Create `/api/ha-poller.ts` (Phase 1, step 1 in orchestration.md)
5. Test: call the poller, verify `home_status` table is updated in Turso
