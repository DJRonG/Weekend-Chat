# Rollback Runbook: Entity Inventory Snapshot

**Runbook ID:** RB-001  
**Phase:** Phase 3 — Step 1  
**Component:** `scripts/snapshot-inventory.ts` + `.agent/inventory/entities.json`  
**Risk level:** Low — no HA writes occur at any point  
**Last reviewed:** 2026-02-23

---

## Overview

This runbook covers how to rollback or clean up the entity inventory snapshot.

The snapshot script (`scripts/snapshot-inventory.ts`) is **read-only with respect to
Home Assistant** — it only calls `GET /api/states` and writes a single local file.
There is nothing to undo on the HA side.

---

## What can go wrong

| Scenario | Impact | Recovery |
|----------|--------|----------|
| `entities.json` contains stale data | Resolver (Step 2) may return wrong entity_id | Re-run snapshot |
| `entities.json` accidentally staged for git | Token not present in file, but device topology exposed | Remove from index (see below) |
| Script exits non-zero | No file written or partial file present | Re-run; partial file is replaced atomically |
| HA unreachable | Script exits with network error | Restore network, re-run |
| Wrong HA_TOKEN | Script exits with HTTP 401 | Generate new token in HA, update .env.local |

---

## Rollback Step 1: Remove the generated inventory file

This is the primary rollback. It returns the local environment to pre-snapshot state.

```bash
# Step 1a: Delete the generated inventory
rm -f .agent/inventory/entities.json

# Step 1b: Confirm the file is gone
ls -la .agent/inventory/
# Expected: empty directory or "No such file or directory"

# Step 1c: Confirm nothing is staged
git status
# Expected: .agent/ is NOT listed (it is gitignored)
```

**Result:** Inventory no longer exists. Resolver and generator cannot be run until
the snapshot is re-taken. No HA state is affected.

---

## Rollback Step 2: Remove the entire .agent directory (optional)

If you want to clean up the full agent working directory:

```bash
# Remove all generated agent artefacts
rm -rf .agent/

# Confirm git status is clean
git status
# Expected: .agent/ is NOT listed
```

---

## Rollback Step 3: Remove the branch (if PR not yet merged)

If you want to abandon the entire Phase 3 Step 1 branch:

```bash
# From local repo
git checkout main
git branch -D feat/phase3-entity-inventory

# Remove remote branch
git push origin --delete feat/phase3-entity-inventory
```

Or via GitHub UI: go to the branch, click the branch selector → "View all branches"
→ find `feat/phase3-entity-inventory` → click the trash icon.

**Note:** This removes the schema (`schemas/entities.schema.json`), script
(`scripts/snapshot-inventory.ts`), and governance docs. It does NOT affect
`claude/push-weekend-agent-4B5V5` or PR #3.

---

## Rollback Step 4: If entities.json was accidentally staged

```bash
# If entities.json was somehow staged despite .gitignore
git rm --cached .agent/inventory/entities.json

# Confirm it is no longer tracked
git status
# Expected: file is untracked or absent

# Add to .gitignore if not already present (should already be there)
grep '.agent/' .gitignore
```

---

## Verification: Confirm no HA writes occurred

The snapshot script makes only one outbound request:

```
GET http://192.168.1.229:8123/api/states
Authorization: Bearer <token>
```

To verify no write occurred, check HA logs:

1. Open HA at http://192.168.1.229:8123
2. Go to **Settings → System → Logs**
3. Filter for the time window when the snapshot ran
4. Confirm: no `POST`, `PUT`, `PATCH`, or `DELETE` requests from the poller script

Alternatively, check HA logbook — no new automations, scene changes, or state
mutations should appear from this script.

---

## Re-running the snapshot after rollback

Once the environment is clean:

```bash
# Ensure .env.local is present and contains HA_URL and HA_TOKEN
cat .env.local | grep -E '^(HA_URL|HA_TOKEN)=' | sed 's/=.*/=<redacted>/'

# Re-run snapshot
npm run inventory:snapshot

# Confirm output
ls -lh .agent/inventory/entities.json
cat .agent/inventory/entities.json | head -20
```

---

## Related

- `docs/decisions/ADR-001-entity-inventory.md` — why the inventory exists
- `schemas/entities.schema.json` — the validated output contract
- `scripts/snapshot-inventory.ts` — the snapshot script
