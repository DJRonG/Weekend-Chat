# ADR-001: Entity Inventory as Prerequisite for Resolver and Generator

**Status:** Accepted  
**Date:** 2026-02-23  
**Phase:** Phase 3 — Intelligent Agent Layer  
**Step:** 1 of N  
**Deciders:** DJRonG  
**Relates to:** Phase 3 Step 2 (Entity Resolver), Phase 3 Step 3 (YAML Generator)

---

## Context

Phase 3 of the HA Agent Stack introduces an Intelligent Agent Layer on top of the existing
Home Assistant environment. The agent must be able to accept natural-language intent (e.g.
"turn off the office lights at midnight") and convert it into validated Home Assistant
automation YAML that can be reviewed in a PR before being applied.

The agent layer has three ordered concerns:

1. **Inventory** — know what entities exist and what their canonical IDs are
2. **Resolver** — map a fuzzy friendly name or alias to a stable entity_id
3. **Generator** — produce valid HA automation YAML using resolved entity_ids

Without a reliable inventory, the resolver has no ground truth. Without the resolver,
the generator risks emitting automations referencing entity IDs that do not exist in HA,
which would silently fail or produce invalid configuration.

The inventory must therefore be produced and validated **before** any resolver or
generator logic is implemented or executed.

---

## Decision

We will produce a canonical, read-only **Entity Inventory Snapshot** as the first
deliverable of Phase 3.

The inventory is produced by `scripts/snapshot-inventory.ts`, which:

1. Calls `GET /api/states` on the Home Assistant REST API (read-only)
2. Maps each entity state to a structured `EntityRecord`
3. Validates the full output against `schemas/entities.schema.json` using Zod
4. Writes the validated inventory to `.agent/inventory/entities.json`
5. Exits non-zero on any failure — no partial writes

The schema (`schemas/entities.schema.json`) is the contract between the snapshot script
and all downstream consumers (resolver, generator, audit logger).

---

## Why entities.json is gitignored

`.agent/inventory/entities.json` represents **live state** from Home Assistant at the
moment the snapshot was taken. It contains entity states, area names, and integration
metadata that change over time as devices are added, renamed, or removed.

Committing live state to git would:

- Create a false impression that the inventory is stable across environments
- Risk exposing device topology in public commit history
- Cause merge conflicts whenever two developers run the snapshot at different times
- Couple the git history to operational state, violating GitOps separation of concerns

The **schema** (`schemas/entities.schema.json`) is committed because it is stable
and describes the contract. The **snapshot** (`.agent/inventory/entities.json`) is
regenerated on demand and lives only on the local machine.

---

## Refresh Cadence

The inventory snapshot should be refreshed:

- **Before any Phase 3 Step 2 or Step 3 session** — to ensure resolver and generator
  operate against current HA state
- **After any significant device or integration change** in Home Assistant
- **On a periodic basis** (recommended: weekly) if the agent is actively used

Refresh is a single local command:
```bash
npm run inventory:snapshot
```

---

## Security Considerations

- The HA long-lived access token is stored in `.env.local` only, which is gitignored
- The snapshot script never logs the token value — it logs only `token present: true/false`
- The script never logs the full request headers object
- Error handlers log only `err.message`, not `err` (which may contain request context)
- Output is constrained to `.agent/inventory/` via a path-safety check before every write
- The `.agent/` directory is entirely gitignored, providing defence-in-depth against
  accidental commits of generated artefacts

---

## Consequences

**Positive:**
- Resolver (Step 2) has a typed, validated entity registry to query
- Generator (Step 3) can assert entity existence before emitting YAML
- Audit log (any step) can reference canonical entity_ids
- Schema is version-controlled — breaking changes require a PR

**Negative / Trade-offs:**
- The inventory is stale the moment it is generated; agents must be aware of this
- Running the snapshot requires network access to HA — not possible in CI without mocking
- Area information from the `/api/states` endpoint is limited; a full area registry
  snapshot would require a separate `/api/config/area_registry` call (deferred to later step)

---

## Rollback

See `docs/runbooks/rollback-inventory.md` for exact rollback steps.

**Summary:** Delete `.agent/inventory/entities.json`. No HA state is modified.
The schema and script are pure code with no side effects and can remain in the repo.
