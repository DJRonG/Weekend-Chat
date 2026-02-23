#!/usr/bin/env tsx
/**
 * scripts/verify-resolver-fixtures.ts
 * Phase 3 — Milestone 1: Fixture Verification Script
 *
 * Runs each case in tests/fixtures/resolve.cases.json against the resolver
 * using tests/fixtures/resolve.sample.inventory.json as the inventory.
 *
 * Exit codes:
 *   0 — all cases passed
 *   1 — one or more cases failed (or file load error)
 *
 * Usage:
 *   npm run resolver:verify
 */

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadInventory, resolveEntities } from '../lib/entity-resolver.js';
import type { ResolveResponse } from '../lib/entity-resolver.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const INVENTORY_PATH = path.join(REPO_ROOT, 'tests', 'fixtures', 'resolve.sample.inventory.json');
const CASES_PATH = path.join(REPO_ROOT, 'tests', 'fixtures', 'resolve.cases.json');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface CaseExpect {
  missing?: boolean;
  needs_review?: boolean;
  best_entity_id?: string;
  best_match_type?: string;
  best_confidence?: number;
  best_is_null?: boolean;
  matches_empty?: boolean;
  matches_length_lte?: number;
  suggested_aliases_empty?: boolean;
  suggested_aliases_non_empty?: boolean;
  suggested_aliases_contains?: string;
  matches_order_deterministic?: boolean;
}

interface TestCase {
  id: string;
  description: string;
  request: {
    query: string;
    domain_hint?: string;
    area_hint?: string;
    limit?: number;
    min_confidence?: number;
  };
  expect: CaseExpect;
}

// ---------------------------------------------------------------------------
// Assertion helpers
// ---------------------------------------------------------------------------
interface AssertResult {
  pass: boolean;
  message: string;
}

function check(caseId: string, label: string, actual: unknown, expected: unknown): AssertResult {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  return {
    pass,
    message: pass
      ? ''
      : '[' + caseId + '] ' + label + ': expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual),
  };
}

function runAssertions(tc: TestCase, res: ResolveResponse): AssertResult[] {
  const results: AssertResult[] = [];
  const e = tc.expect;

  if (e.missing !== undefined) {
    results.push(check(tc.id, 'missing', res.missing, e.missing));
  }
  if (e.needs_review !== undefined) {
    results.push(check(tc.id, 'needs_review', res.needs_review, e.needs_review));
  }
  if (e.best_entity_id !== undefined) {
    results.push(check(tc.id, 'best.entity_id', res.best?.entity_id ?? null, e.best_entity_id));
  }
  if (e.best_match_type !== undefined) {
    results.push(check(tc.id, 'best.match_type', res.best?.match_type ?? null, e.best_match_type));
  }
  if (e.best_confidence !== undefined) {
    results.push(check(tc.id, 'best.confidence', res.best?.confidence ?? null, e.best_confidence));
  }
  if (e.best_is_null === true) {
    results.push(check(tc.id, 'best is null', res.best, null));
  }
  if (e.matches_empty === true) {
    results.push(check(tc.id, 'matches.length', res.matches.length, 0));
  }
  if (e.matches_length_lte !== undefined) {
    const pass = res.matches.length <= e.matches_length_lte;
    results.push({
      pass,
      message: pass
        ? ''
        : '[' + tc.id + '] matches.length: expected <= ' + e.matches_length_lte + ', got ' + res.matches.length,
    });
  }
  if (e.suggested_aliases_empty === true) {
    results.push(check(tc.id, 'suggested_aliases.length', res.suggested_aliases.length, 0));
  }
  if (e.suggested_aliases_non_empty === true) {
    const pass = res.suggested_aliases.length > 0;
    results.push({
      pass,
      message: pass ? '' : '[' + tc.id + '] suggested_aliases: expected non-empty, got empty',
    });
  }
  if (e.suggested_aliases_contains !== undefined) {
    const found = res.suggested_aliases.some(
      (a) => a.add_alias.toLowerCase() === e.suggested_aliases_contains!.toLowerCase()
    );
    results.push({
      pass: found,
      message: found
        ? ''
        : '[' + tc.id + '] suggested_aliases: expected to contain alias "' + e.suggested_aliases_contains + '"',
    });
  }
  if (e.matches_order_deterministic === true) {
    // Run the same query twice and verify results are identical
    // (Already deterministic by design — this verifies stable sort)
    // We just verify the matches array is sorted: confidence desc, entity_id asc
    let sorted = true;
    for (let i = 1; i < res.matches.length; i++) {
      const prev = res.matches[i - 1];
      const curr = res.matches[i];
      if (prev.confidence < curr.confidence) {
        sorted = false;
        break;
      }
      if (prev.confidence === curr.confidence && prev.entity_id > curr.entity_id) {
        sorted = false;
        break;
      }
    }
    results.push({
      pass: sorted,
      message: sorted
        ? ''
        : '[' + tc.id + '] matches are not sorted (confidence desc, entity_id asc)',
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main(): void {
  // Load inventory
  let inventory;
  try {
    inventory = loadInventory(INVENTORY_PATH);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write('[verify-resolver-fixtures] Failed to load inventory: ' + msg + '\n');
    process.exit(1);
  }

  // Load cases
  let cases: TestCase[];
  try {
    const raw = JSON.parse(fs.readFileSync(CASES_PATH, 'utf-8')) as unknown;
    if (!Array.isArray(raw)) throw new Error('resolve.cases.json must be a JSON array');
    cases = raw as TestCase[];
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write('[verify-resolver-fixtures] Failed to load cases: ' + msg + '\n');
    process.exit(1);
  }

  let passed = 0;
  let failed = 0;
  const failures: string[] = [];

  for (const tc of cases) {
    const res = resolveEntities(inventory, tc.request);
    const assertions = runAssertions(tc, res);
    const allPass = assertions.every((a) => a.pass);

    if (allPass) {
      passed++;
      process.stdout.write('  PASS  [' + tc.id + '] ' + tc.description + '\n');
    } else {
      failed++;
      process.stdout.write('  FAIL  [' + tc.id + '] ' + tc.description + '\n');
      for (const a of assertions.filter((x) => !x.pass)) {
        process.stdout.write('         > ' + a.message + '\n');
        failures.push(a.message);
      }
    }
  }

  process.stdout.write('\n');
  process.stdout.write('Results: ' + passed + ' passed, ' + failed + ' failed out of ' + cases.length + ' cases.\n');

  if (failed > 0) {
    process.stdout.write('\nFailed assertions:\n');
    for (const f of failures) {
      process.stdout.write('  ' + f + '\n');
    }
    process.exit(1);
  }

  process.exit(0);
}

main();
