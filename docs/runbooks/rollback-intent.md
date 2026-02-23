# Runbook: Rollback — Intent Contract (Phase 3, Milestone 2)

**Scope:** Reverts all files introduced in Milestone 2 (intent contract + validator).
**Safe to run?** Yes. No HA writes, no DB changes, no secrets involved.
**Blast radius:** Removes the schema, validator library, CLI, fixtures, verify script, ADR, and package.json script additions.
**Does NOT affect:** Milestone 1 (resolver), HA state, any live service, or main branch.

---

## When to Roll Back

- The intent schema shape is wrong and Step 3b (generator) cannot be started without a breaking contract change.
- The validator produces incorrect ok/error results for edge cases discovered during Step 3b implementation.
- A dependency (zod) breaks and cannot be pinned without affecting other code.

---

## Option A -- Revert the Entire Branch (preferred if not yet merged to main)

If PR #6 (feat/phase3-intent-contract) is open and not merged:

```bash
# Verify you are on the right branch
git branch  # should show feat/phase3-intent-contract

# Find the last-known-good commit SHA (should be the initial commit that created the branch)
git log --oneline | tail -5

# Hard-reset to that SHA (replace <SHA>):
git reset --hard <SHA>
git push --force-with-lease origin feat/phase3-intent-contract

# Then close PR #6 on GitHub without merging.
```

---

## Option B -- Delete Only the Milestone 2 Files (surgical)

```bash
# Remove schema
git rm schemas/intent.schema.json

# Remove validator library
git rm lib/intent-validator.ts

# Remove CLI
git rm scripts/validate-intent.ts

# Remove verify script
git rm scripts/verify-intent-fixtures.ts

# Remove fixtures
git rm tests/fixtures/intent.valid.json
git rm tests/fixtures/intent.invalid.json

# Remove governance docs
git rm docs/decisions/ADR-003-intent-contract.md
git rm docs/runbooks/rollback-intent.md

# Revert package.json to remove intent:validate and intent:verify
# Edit manually or restore from main:
git checkout origin/main -- package.json

git commit -m "revert(intent): remove Milestone 2 intent contract files"
git push origin feat/phase3-intent-contract
```

---

## Verification After Rollback

```bash
# These should all return "not found" after rollback:
ls schemas/intent.schema.json       # should not exist
ls lib/intent-validator.ts          # should not exist
ls scripts/validate-intent.ts       # should not exist
ls scripts/verify-intent-fixtures.ts # should not exist

# package.json should NOT contain these scripts:
grep "intent:validate" package.json   # should return nothing
grep "intent:verify" package.json     # should return nothing
```

---

## What Is NOT Rolled Back

| File | Reason |
|------|--------|
| lib/entity-resolver.ts | Milestone 1 -- independent branch (PR #5) |
| scripts/resolve-entity.ts | Milestone 1 -- independent branch (PR #5) |
| .agent/inventory/entities.json | Owned by Step 1 snapshot |
| All React / UI files | Not touched in Milestone 2 |
| HA configuration | Never modified by this milestone |

---

## Schema + Zod Sync Warning

If you modify schemas/intent.schema.json but NOT lib/intent-validator.ts
(or vice versa), the runtime behaviour will diverge from the documented contract.

After any rollback involving these two files, verify sync by running:

```bash
npm run intent:verify
```

Both files must be reverted or neither.

---

## Contact

If rollback does not resolve the issue, file a GitHub issue on DJRonG/Weekend-Chat
with the label phase3-intent and include the output of:

```bash
npm run intent:verify 2>&1
```
