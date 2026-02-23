# ADR-002 — Entity Resolver Design

**Status:** Accepted  
**Date:** 2026-02-23  
**Branch:** feat/phase3-entity-resolver  
**Deciders:** DJRonG  

---

## Context

Phase 3 Step 2 introduces a resolver that maps human-friendly names (e.g., "Office Lights")
to Home Assistant entity IDs (e.g., `light.office_lights`). The resolver is consumed by:

- The CLI (`scripts/resolve-entity.ts`) for ad-hoc queries
- The automation generator (Step 3, future) which must never produce YAML with unverified entity references

The core design requirements are:

1. **Determinism** — identical inputs must always produce identical outputs, in identical order.
2. **Safety gate** — fuzzy matches must be flagged for human review before automation YAML is written.
3. **No side effects** — the resolver must never write to inventory or HA.

---

## Decision 1: Deterministic Scoring Is Required

### Why

Automation YAML that references entity IDs must be reproducible. If two runs of the same
query can return different entity IDs (due to unstable sort on equal confidence), the
generator would produce non-deterministic YAML — violating the GitOps contract of
stable, diffable commits.

### How

- Matches are sorted: **confidence descending**, then **entity_id ascending** (locale-aware).
- Confidence values are rounded to **3 decimal places** using `Math.round(v * 1000) / 1000`
  to prevent floating-point drift between runs.
- All string comparisons in scoring use `normalize()` (lowercase → strip punctuation →
  collapse whitespace) applied consistently to **both sides** of every comparison.

### Alternatives Rejected

- Sorting by `friendly_name` instead of `entity_id`: entity_id is the canonical HA
  identifier and is stable; friendly_name can change.
- Truncating to 2 decimal places: 3dp preserves the meaningful gap between stages
  (exact=1.00, casefold=0.98, alias_exact=0.95, normalized=0.92) without false ties.

---

## Decision 2: Fuzzy Matches Trigger `needs_review = true`

### Why

Match stages 4–6 (normalized, token_set, substring) are heuristic. They can produce
plausible-but-wrong entity mappings, particularly in homes with similarly-named entities
(e.g., "Office Lights" vs "Office Lights 2"). Writing automation YAML with a wrong
entity_id could silently control the wrong device.

### Contract

`needs_review = true` when and only when:

- `best` is not null (a match was found), AND
- `best.match_type` is NOT one of: `exact`, `casefold`, `alias_exact`

`needs_review = false` when `best` is null (`missing = true`). A missing result is a
**different failure mode** from an uncertain result and must not conflate the two.

### How Step 3 Uses This

The automation generator (ADR-004) must gate on both `missing` and `needs_review`:

- If `missing = true` OR `needs_review = true`: **do not generate YAML**, return a
  structured error with `suggested_aliases` so the user can add an alias and re-run.
- Only if both are `false`: proceed to YAML generation.

### Alternatives Rejected

- Always requiring human review: too conservative; exact/casefold matches on well-named
  entities should be trusted automatically.
- A pure confidence threshold (e.g., `< 0.85`): confidence is continuous and can be
  boosted by hints. A structural match_type check is more auditable and immune to
  hint-boost side effects.

---

## Decision 3: Resolver Never Writes Inventory

### Why

The resolver is a pure read function. Writing back to inventory would:

1. Create a feedback loop that could corrupt the canonical inventory with guessed data.
2. Require file-system permissions that scripts should not have in CI.
3. Violate the GitOps model — inventory changes must come from Step 1 snapshots only,
   committed via PR.

### How

- `loadInventory()` reads and validates but never writes.
- `resolveEntities()` takes an `Inventory` value (already loaded) and returns a
  `ResolveResponse` — no file I/O.
- Suggested aliases (`suggested_aliases[]`) are **proposals only** — they appear in the
  response JSON so the user can manually add them to HA and re-snapshot.

---

## Consequences

**Positive:**
- Step 3 can import `resolveEntities()` as a pure library with no side effects.
- Deterministic output means fixture tests can assert exact confidence values.
- `needs_review` provides a clear, auditable safety gate — no magic thresholds.

**Negative / Accepted Costs:**
- Aliases must be added to HA manually and a new snapshot run before fuzzy queries
  auto-resolve. This is intentional friction to ensure correctness.
- Token-set Jaccard scoring can be slow on very large inventories (1,000+ entities).
  Acceptable for current scale; a pre-built index can be added in a later ADR if needed.

---

## References

- `lib/entity-resolver.ts` — implementation
- `scripts/resolve-entity.ts` — CLI wrapper
- `scripts/verify-resolver-fixtures.ts` — fixture verification
- `tests/fixtures/resolve.cases.json` — test cases
- `tests/fixtures/resolve.sample.inventory.json` — fixture inventory
