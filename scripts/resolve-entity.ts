/**
 * scripts/resolve-entity.ts
 * Phase 3 — Step 2: Entity Resolver CLI
 *
 * Thin CLI wrapper around lib/entity-resolver.ts.
 * Parses command-line arguments, runs the resolver, and prints JSON to stdout.
 *
 * Usage:
 *   npm run entity:resolve -- --query "Office Lights"
 *   npm run entity:resolve -- --query "kitchen fridge" --domain_hint switch
 *   npm run entity:resolve -- --query "loft fan" --area_hint "Bedroom & Loft" --limit 5
 *   npm run entity:resolve -- --query "motion sensor" --min_confidence 0.7
 *
 * Test mode (use a fixture inventory):
 *   npm run entity:resolve -- --query "Office Lights" --inventory tests/fixtures/resolve.sample.inventory.json
 *
 * Flags:
 *   --query <string>           Required. Human-friendly name to resolve.
 *   --domain_hint <string>     Optional. Domain preference (+0.05 boost).
 *   --area_hint <string>       Optional. Area preference (+0.03 boost).
 *   --limit <number>           Optional. Max results (default: 10).
 *   --min_confidence <number>  Optional. Min confidence threshold (default: 0.80).
 *   --inventory <path>         Optional. Path to inventory file. Defaults to .agent/inventory/entities.json.
 *
 * Exit codes:
 *   0  — success (including missing=true responses — those are valid empty results)
 *   1  — operational error (missing inventory file, parse failure, invalid args)
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadInventory, resolveEntities } from '../lib/entity-resolver.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const DEFAULT_INVENTORY = path.join(REPO_ROOT, '.agent', 'inventory', 'entities.json');

// ---------------------------------------------------------------------------
// Minimal arg parser — avoids adding a new dependency
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        result[key] = next;
        i += 2;
      } else {
        result[key] = 'true';
        i += 1;
      }
    } else {
      i += 1;
    }
  }
  return result;
}

function fail(message: string): never {
  process.stderr.write(`[resolve-entity] ERROR: ${message}\n`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);

  // --query is required
  if (!args['query']) {
    fail(
      `--query is required.\n` +
        `Usage: npm run entity:resolve -- --query "Office Lights"\n` +
        `       npm run entity:resolve -- --query "kitchen fridge" --domain_hint switch`
    );
  }

  const query = args['query'];
  const domain_hint = args['domain_hint'];
  const area_hint = args['area_hint'];
  const inventoryPath = args['inventory'] ?? DEFAULT_INVENTORY;

  let limit: number | undefined;
  if (args['limit'] !== undefined) {
    limit = parseInt(args['limit'], 10);
    if (isNaN(limit) || limit < 1) {
      fail(`--limit must be a positive integer, got: ${args['limit']}`);
    }
  }

  let min_confidence: number | undefined;
  if (args['min_confidence'] !== undefined) {
    min_confidence = parseFloat(args['min_confidence']);
    if (isNaN(min_confidence) || min_confidence < 0 || min_confidence > 1) {
      fail(`--min_confidence must be a number between 0 and 1, got: ${args['min_confidence']}`);
    }
  }

  // Load inventory — exits non-zero with actionable error if missing
  let inventory;
  try {
    inventory = loadInventory(inventoryPath);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    fail(msg);
  }

  // Resolve
  const response = resolveEntities(inventory, {
    query,
    domain_hint,
    area_hint,
    limit,
    min_confidence,
  });

  // Output JSON to stdout (no markdown, no extra text)
  process.stdout.write(JSON.stringify(response, null, 2) + '\n');

  // Exit 0 always on successful resolution (missing=true is a valid result)
  process.exit(0);
}

main();
