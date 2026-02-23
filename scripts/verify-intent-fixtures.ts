#!/usr/bin/env tsx
/**
 * scripts/verify-intent-fixtures.ts
 * Phase 3 — Milestone 2: Intent Fixture Verification Script
 *
 * Runs each case in tests/fixtures/intent.valid.json and
 * tests/fixtures/intent.invalid.json through the validator and asserts
 * the expected results.
 *
 * Exit codes:
 *   0 — all cases passed
 *   1 — one or more cases failed (or file load error)
 *
 * Usage:
 *   npm run intent:verify
 */

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validateIntent } from '../lib/intent-validator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const VALID_PATH = path.join(REPO_ROOT, 'tests', 'fixtures', 'intent.valid.json');
const INVALID_PATH = path.join(REPO_ROOT, 'tests', 'fixtures', 'intent.invalid.json');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ValidExpect {
  ok: true;
  intent_name?: string;
  actions_length?: number;
}

interface InvalidExpect {
  ok: false;
  error_path_contains?: string;
  error_count_gte?: number;
}

interface FixtureCase {
  id: string;
  description: string;
  input: unknown;
  expect: ValidExpect | InvalidExpect;
}

// ---------------------------------------------------------------------------
// Assertion helper
// ---------------------------------------------------------------------------
interface AssertResult {
  pass: boolean;
  message: string;
}

function runAssertions(tc: FixtureCase): AssertResult[] {
  const result = validateIntent(tc.input);
  const e = tc.expect;
  const results: AssertResult[] = [];

  // ok flag
  results.push({
    pass: result.ok === e.ok,
    message: result.ok === e.ok
      ? ''
      : '[' + tc.id + '] ok: expected ' + e.ok + ', got ' + result.ok,
  });

  if (e.ok === true) {
    // Valid case assertions
    if (e.intent_name !== undefined) {
      const actual = result.intent?.name;
      const pass = actual === e.intent_name;
      results.push({
        pass,
        message: pass ? '' : '[' + tc.id + '] intent.name: expected "' + e.intent_name + '", got "' + actual + '"',
      });
    }
    if (e.actions_length !== undefined) {
      const actual = result.intent?.actions.length;
      const pass = actual === e.actions_length;
      results.push({
        pass,
        message: pass ? '' : '[' + tc.id + '] actions.length: expected ' + e.actions_length + ', got ' + actual,
      });
    }
  } else {
    // Invalid case assertions
    if (e.error_path_contains !== undefined) {
      const found = result.errors?.some((err) =>
        err.path.includes(e.error_path_contains!) || err.message.includes(e.error_path_contains!)
      ) ?? false;
      results.push({
        pass: found,
        message: found
          ? ''
          : '[' + tc.id + '] errors: expected an error referencing "' + e.error_path_contains + '"\n' +
            '  Actual errors: ' + JSON.stringify(result.errors),
      });
    }
    if (e.error_count_gte !== undefined) {
      const count = result.errors?.length ?? 0;
      const pass = count >= e.error_count_gte;
      results.push({
        pass,
        message: pass
          ? ''
          : '[' + tc.id + '] errors.length: expected >= ' + e.error_count_gte + ', got ' + count,
      });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Load and run fixtures
// ---------------------------------------------------------------------------
function loadFixtures(filePath: string, label: string): FixtureCase[] {
  if (!fs.existsSync(filePath)) {
    process.stderr.write('[verify-intent-fixtures] File not found: ' + filePath + '\n');
    process.exit(1);
  }
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as unknown;
    if (!Array.isArray(raw)) throw new Error(label + ' must be a JSON array');
    return raw as FixtureCase[];
  } catch (err) {
    process.stderr.write('[verify-intent-fixtures] Failed to load ' + label + ': ' + (err instanceof Error ? err.message : String(err)) + '\n');
    process.exit(1);
  }
}

function runSuite(cases: FixtureCase[], label: string): { passed: number; failed: number; failures: string[] } {
  let passed = 0;
  let failed = 0;
  const failures: string[] = [];

  process.stdout.write('\n--- ' + label + ' ---\n');

  for (const tc of cases) {
    const assertions = runAssertions(tc);
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

  return { passed, failed, failures };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main(): void {
  const validCases = loadFixtures(VALID_PATH, 'intent.valid.json');
  const invalidCases = loadFixtures(INVALID_PATH, 'intent.invalid.json');

  const v = runSuite(validCases, 'Valid fixtures (' + validCases.length + ' cases)');
  const i = runSuite(invalidCases, 'Invalid fixtures (' + invalidCases.length + ' cases)');

  const totalPassed = v.passed + i.passed;
  const totalFailed = v.failed + i.failed;
  const allFailures = [...v.failures, ...i.failures];
  const total = validCases.length + invalidCases.length;

  process.stdout.write('\n');
  process.stdout.write('Results: ' + totalPassed + ' passed, ' + totalFailed + ' failed out of ' + total + ' cases.\n');

  if (totalFailed > 0) {
    process.stdout.write('\nFailed assertions:\n');
    for (const f of allFailures) {
      process.stdout.write('  ' + f + '\n');
    }
    process.exit(1);
  }

  process.exit(0);
}

main();
