# ADR-003 — Intent Contract Design

**Status:** Accepted
**Date:** 2026-02-23
**Branch:** feat/phase3-intent-contract
**Deciders:** DJRonG

---

## Context

Phase 3 Step 3a introduces a formal contract for automation intents. An intent is a
machine-readable description of what a user (or LLM) wants to automate, expressed in
human terms (friendly names, service calls) before any HA entity IDs are resolved.

The contract governs what Step 3b (the YAML generator) is allowed to accept. Without a
versioned, validated contract sitting between input and generation, the generator would
need to defend itself against arbitrary JSON, making it fragile and untestable.

---

## Decision 1: Contract Precedes Generator and UI/LLM Parsing

### Why

Generator-first design collapses three concerns into one file: input parsing, validation,
and generation. When any of those concerns changes (new schema version, new field, new
error message) the whole generator changes, making diffs large and hard to review.

With a contract-first model:

1. The schema (schemas/intent.schema.json) is the single source of truth.
2. The validator (lib/intent-validator.ts) translates validation results into
   typed, normalized structures -- independent of where the JSON came from (UI, LLM, test).
3. The generator (Step 3b) only receives NormalizedIntent objects -- it never touches
   raw strings and never needs to handle malformed input.

### Forward compatibility

The v: 1 field allows breaking changes in a future v: 2 without requiring a flag day.
The kind: "automation" field reserves space for "scene" and "theme" which have
different action shapes. Adding a new kind requires only a new validator branch, not a
refactor of the existing generator.

The triggers and conditions arrays are intentionally permissive (schema uses
additionalProperties: true on each item, requiring only one required field). This lets
the schema accept HA-native trigger/condition syntax verbatim without needing to model
every HA platform -- the generator passes these through as YAML blocks.

---

## Decision 2: Zod for Validation (No New Runtime Dependencies)

### Why

The repo already has zod ^3.24.3 in dependencies. Using it for the validator adds
zero new runtime deps and zero new footprint.

### Alternatives considered

| Option | Status | Reason rejected |
|--------|--------|----------------|
| Raw JSON Schema + ajv | Rejected | ajv is not in deps; adds ~100KB bundle cost |
| Hand-written validation | Rejected | Boilerplate, no type inference, harder to test |
| zod (chosen) | Accepted | Already in deps, generates TypeScript types, safeParse gives structured errors |

### JSON Schema is still present

schemas/intent.schema.json exists as a documentation artifact and for tooling
that can use it (IDEs, external validators). The zod schema in lib/intent-validator.ts
is the authoritative runtime implementation. Both must be kept in sync when the contract
changes -- this is noted in the rollback runbook.

---

## Decision 3: How This Gates Step 3b YAML Generation

The automation generator (ADR-004, not yet written) must follow this call sequence:

1. Read intent JSON (file or stdin)
2. Call validateIntent(raw) to get ValidationResult
   - If ok=false: exit 2, emit errors JSON, DO NOT call resolver
3. Call resolveEntities() for each action's targets
   - If missing=true OR needs_review=true: exit 0, emit resolution guidance, DO NOT generate YAML
4. Generate YAML only when:
   - validateIntent returned ok=true AND
   - all targets resolved without missing/needs_review

This means the generator cannot bypass the validator -- the validator is a required
type gate, not an optional check.

---

## Decision 4: additionalProperties: false at Top Level, Not Nested

Top-level unknown keys must be locked to prevent undocumented fields silently entering
the generator pipeline.

Nested objects inside data (service call payload) intentionally allow
additionalProperties: true because HA service call data is domain-specific and this
layer should not try to model every HA service.

---

## Consequences

**Positive:**
- Generator (Step 3b) only ever receives validated, normalized types -- no defensive coding.
- Fixtures (intent.valid.json, intent.invalid.json) form a regression suite runnable
  in CI without an HA instance.
- Future LLM-generated intents can be pipe-validated: llm-generate | npm run intent:validate

**Negative / Accepted Costs:**
- Schema and zod definition must be kept manually in sync. A future ADR may add a codegen
  step to derive one from the other.
- kind: "scene" and kind: "theme" are not yet implemented. PRs adding them must
  update the schema, the zod definition, and both fixture files.

---

## References

- schemas/intent.schema.json -- JSON Schema (Draft-07, documentation artifact)
- lib/intent-validator.ts -- authoritative runtime validator
- scripts/validate-intent.ts -- CLI wrapper
- tests/fixtures/intent.valid.json -- 6 valid fixture cases
- tests/fixtures/intent.invalid.json -- 11 invalid fixture cases
- ADR-002 -- Entity Resolver (depends-on)
- ADR-004 -- Automation Generator (future, depends-on this ADR)
