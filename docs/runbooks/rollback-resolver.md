# Runbook: Rollback — Entity Resolver (Phase 3, Milestone 1)

**Scope:** Reverts all files introduced in Milestone 1 of Phase 3 (entity resolver hardening).  
**Safe to run?** Yes. No HA writes, no DB changes, no secrets involved.  
**Blast radius:** Removes the resolver library, CLI, fixtures, verify script, and ADR.  
**Does NOT affect:** HA state, the inventory snapshot (Step 1), or any other feature branch.

---

## When to Roll Back

- The resolver returns incorrect entity IDs that would be written into automation YAML.
- The `needs_review` flag is incorrectly set (false positive or false negative) in a way
  that allows bad YAML to be generated.
- A regression in `lib/entity-resolver.ts` causes `npm run resolver:verify` to fail
  and the fix cannot be applied quickly.

---

## Option A — Revert the Entire Branch (preferred if not yet merged to main)

```bash
# Verify you are on the feature branch
git branch  # should show feat/phase3-entity-resolver

# Hard-reset to the last known-good commit before Milestone 1 changes
# Find that commit SHA:
git log --oneline | grep -i "Step 1\|snapshot\|inventory"

# Reset (replace <SHA> with the commit before Milestone 1):
git reset --hard <SHA>

# Force-push to remote to update the PR branch:
git push --force-with-lease origin feat/phase3-entity-resolver
```

> --force-with-lease is safer than --force: it fails if someone else pushed since your last fetch.

---

## Option B — Delete Only the Milestone 1 Files (surgical, if some later work must be kept)

```bash
# Remove resolver library
git rm lib/entity-resolver.ts

# Remove CLI
git rm scripts/resolve-entity.ts

# Remove verify script
git rm scripts/verify-resolver-fixtures.ts

# Remove fixtures
git rm tests/fixtures/resolve.cases.json
# Do NOT remove resolve.sample.inventory.json if Step 1 owns it.

# Remove governance docs
git rm docs/decisions/ADR-002-entity-resolver.md
git rm docs/runbooks/rollback-resolver.md

# Revert package.json changes (remove entity:resolve and resolver:verify scripts)
# Edit manually or use git checkout:
git checkout origin/main -- package.json

git commit -m "revert(resolver): remove Milestone 1 resolver files"
git push origin feat/phase3-entity-resolver
```

---

## Option C — Revert via GitHub PR (if branch is already in a PR)

1. Close the open PR without merging.
2. On your local machine, run Option A or B above.
3. Optionally, open a new PR that explicitly reverts the commit range.

---

## Verification After Rollback

```bash
# These should all return "not found" / error after rollback:
ls lib/entity-resolver.ts              # should not exist
ls scripts/resolve-entity.ts           # should not exist
ls scripts/verify-resolver-fixtures.ts # should not exist

# package.json should NOT contain these scripts:
grep "entity:resolve" package.json    # should return nothing
grep "resolver:verify" package.json   # should return nothing
```

---

## What Is NOT Rolled Back

| File | Reason |
|------|--------|
| `.agent/inventory/entities.json` | Owned by Step 1 snapshot; not part of this rollback |
| `tests/fixtures/resolve.sample.inventory.json` | Step 1 fixture; safe to keep |
| All React / UI files | Not touched in Milestone 1 |
| HA configuration | Never modified by this milestone |

---

## Contact

If rollback does not resolve the issue, file a GitHub issue on `DJRonG/Weekend-Chat`
with the label `phase3-resolver` and include the output of:

```bash
npm run resolver:verify 2>&1
```
