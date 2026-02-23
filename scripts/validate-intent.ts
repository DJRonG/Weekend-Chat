#!/usr/bin/env tsx
/**
 * scripts/validate-intent.ts
 * Phase 3 — Milestone 2: Intent Validator CLI
 *
 * Reads an intent JSON from --file <path> or from stdin, validates it
 * against the intent contract, and writes a JSON result to stdout.
 *
 * Usage:
 *   npm run intent:validate -- --file intent.json
 *   echo '{"v":1,"kind":"automation",...}' | npm run intent:validate
 *   cat tests/fixtures/intent.valid.json | npm run intent:validate
 *
 * Exit codes:
 *   0  — intent is valid
 *   2  — intent failed schema / contract validation (invalid)
 *   1  — operational error (file not found, not valid JSON, missing --file content)
 *
 * Output (stdout): JSON only.
 *   Valid:   { "ok": true, "intent": { ...normalized intent... } }
 *   Invalid: { "ok": false, "errors": [ { "path": "...", "message": "..." } ] }
 *   Error:   written to stderr only; stdout is empty on exit 1.
 */

import fs from 'node:fs';
import { validateIntent } from '../lib/intent-validator.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function die(msg: string, code: 1 | 2 = 1): never {
  process.stderr.write('[validate-intent] ' + msg + '\n');
  process.exit(code);
}

function parseArgs(argv: string[]): { file?: string } {
  const args = argv.slice(2);
  const idx = args.indexOf('--file');
  if (idx !== -1) {
    const val = args[idx + 1];
    if (!val || val.startsWith('--')) {
      die('--file requires a path argument');
    }
    return { file: val };
  }
  return {};
}

async function readInput(file?: string): Promise<string> {
  if (file !== undefined) {
    if (!fs.existsSync(file)) {
      die('File not found: ' + file);
    }
    try {
      return fs.readFileSync(file, 'utf-8');
    } catch (err) {
      die('Failed to read file ' + file + ': ' + (err instanceof Error ? err.message : String(err)));
    }
  }

  // Read from stdin
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    process.stdin.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    process.stdin.on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  const { file } = parseArgs(process.argv);

  let raw: string;
  try {
    raw = await readInput(file);
  } catch (err) {
    die('Failed to read input: ' + (err instanceof Error ? err.message : String(err)));
  }

  if (raw.trim() === '') {
    die('Input is empty. Provide a JSON intent via --file or stdin.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    die(
      'Input is not valid JSON: ' + (err instanceof Error ? err.message : String(err)) +
      '\n  Hint: check for trailing commas, missing quotes, or encoding issues.'
    );
  }

  const result = validateIntent(parsed);

  // Always write JSON result to stdout
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');

  // Exit code signals valid vs invalid vs error
  process.exit(result.ok ? 0 : 2);
}

main().catch((err) => {
  process.stderr.write('[validate-intent] Unexpected error: ' + (err instanceof Error ? err.message : String(err)) + '\n');
  process.exit(1);
});
