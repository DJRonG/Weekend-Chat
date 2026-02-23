/**
 * snapshot-inventory.ts
 * Phase 3 — Step 1: Entity Inventory Snapshot
 *
 * Reads ALL entity states from the Home Assistant REST API and writes a
 * validated, canonical inventory to .agent/inventory/entities.json.
 *
 * This file is tracked in git. The output file (.agent/inventory/entities.json)
 * is gitignored — it contains live state and must never be committed.
 *
 * Usage:
 *   npx tsx scripts/snapshot-inventory.ts
 *
 * Required env (in .env.local):
 *   HA_URL=http://192.168.1.229:8123
 *   HA_TOKEN=<long-lived access token>
 *
 * Safe by design:
 *   - Read-only: no writes to Home Assistant
 *   - Token is never logged or written to output
 *   - Output is constrained to .agent/inventory/ only
 *   - Exits non-zero on any validation or network failure
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// 0. Bootstrap — resolve repo root and load .env.local without extra deps
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

/**
 * Minimal .env.local loader — avoids requiring dotenv as a dependency.
 * Only reads KEY=VALUE lines; ignores comments and blank lines.
 * Never logs values.
 */
function loadEnvLocal(): void {
  const envPath = path.join(REPO_ROOT, '.env.local');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    const val = line.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (key && !(key in process.env)) {
      process.env[key] = val;
    }
  }
}

loadEnvLocal();

// ---------------------------------------------------------------------------
// 1. Validate required env — fail fast, never print the token value
// ---------------------------------------------------------------------------

const HA_URL = process.env['HA_URL'];
const HA_TOKEN = process.env['HA_TOKEN'];

if (!HA_URL) {
  console.error('[snapshot] ERROR: HA_URL is not set. Add it to .env.local');
  process.exit(1);
}
if (!HA_TOKEN) {
  console.error('[snapshot] ERROR: HA_TOKEN is not set. Add it to .env.local');
  process.exit(1);
}

// Normalise: strip trailing slash
const haBaseUrl = HA_URL.replace(/\/$/, '');
console.log('[snapshot] HA_URL:', haBaseUrl);
console.log('[snapshot] HA_TOKEN present:', true); // never log the value

// ---------------------------------------------------------------------------
// 2. Zod schemas — mirror of schemas/entities.schema.json
//    Used for runtime validation before writing the output file.
// ---------------------------------------------------------------------------

const EntityRecordSchema = z.object({
  entity_id: z
    .string()
    .regex(/^[a-z_]+\.[a-z0-9_]+$/, 'entity_id must match domain.object pattern'),
  friendly_name: z.string().min(1),
  domain: z.string().min(1),
  state: z.string().optional(),
  area: z.string().optional(),
  device_id: z.string().optional(),
  integration: z.string().optional(),
  platform: z.string().optional(),
  aliases: z.array(z.string().min(1)).default([]),
});

const InventorySchema = z.object({
  generated_at: z.string().datetime(),
  source: z.string(),
  ha_url: z.string().url(),
  entities: z.array(EntityRecordSchema),
});

type EntityRecord = z.infer<typeof EntityRecordSchema>;
type Inventory = z.infer<typeof InventorySchema>;

// ---------------------------------------------------------------------------
// 3. HA API types
// ---------------------------------------------------------------------------

interface HAState {
  entity_id: string;
  state: string;
  attributes: {
    friendly_name?: string;
    device_id?: string;
    integration?: string;
    platform?: string;
    // HA may expose area via attributes on some integrations
    area_id?: string;
    [key: string]: unknown;
  };
  context: { id: string };
  last_changed: string;
  last_updated: string;
}

// ---------------------------------------------------------------------------
// 4. Fetch all states from HA
// ---------------------------------------------------------------------------

async function fetchAllStates(baseUrl: string, token: string): Promise<HAState[]> {
  const url = baseUrl + '/api/states';
  console.log('[snapshot] Fetching', url);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        // Never log this header object — token is inside
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    // Cast to Error but never include headers in log
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[snapshot] Network error fetching /api/states:', msg);
    process.exit(1);
  }

  clearTimeout(timeout);

  if (!res.ok) {
    console.error('[snapshot] HA returned HTTP', res.status, 'for /api/states');
    if (res.status === 401) {
      console.error('[snapshot] Hint: check HA_TOKEN is a valid long-lived access token');
    }
    process.exit(1);
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    console.error('[snapshot] Failed to parse JSON response from HA');
    process.exit(1);
  }

  if (!Array.isArray(data)) {
    console.error('[snapshot] Expected array from /api/states, got:', typeof data);
    process.exit(1);
  }

  return data as HAState[];
}

// ---------------------------------------------------------------------------
// 5. Map HA state to EntityRecord
// ---------------------------------------------------------------------------

function mapStateToRecord(state: HAState): EntityRecord | null {
  const entity_id = state.entity_id;

  // Skip entities whose IDs don't match the canonical pattern
  // (some HA internal entities use uppercase or special chars)
  if (!/^[a-z_]+\.[a-z0-9_]+$/.test(entity_id)) {
    return null;
  }

  const domain = entity_id.split('.')[0] ?? '';
  const friendlyName = (state.attributes.friendly_name as string | undefined) ?? entity_id;

  const record: EntityRecord = {
    entity_id,
    friendly_name: friendlyName,
    domain,
    state: state.state,
    aliases: [],
  };

  // Include optional fields only when present — never guess or fabricate
  if (typeof state.attributes.device_id === 'string' && state.attributes.device_id) {
    record.device_id = state.attributes.device_id;
  }
  if (typeof state.attributes.integration === 'string' && state.attributes.integration) {
    record.integration = state.attributes.integration;
  }
  if (typeof state.attributes.platform === 'string' && state.attributes.platform) {
    record.platform = state.attributes.platform;
  }
  // area_id from attributes (set by some HA integrations; the area registry
  // requires a separate /api/config/area_registry call which is out of scope
  // for this read-only snapshot — stored as-is when available)
  if (typeof state.attributes.area_id === 'string' && state.attributes.area_id) {
    record.area = state.attributes.area_id;
  }

  return record;
}

// ---------------------------------------------------------------------------
// 6. Write output — constrained to .agent/inventory/ only
// ---------------------------------------------------------------------------

const OUTPUT_DIR = path.join(REPO_ROOT, '.agent', 'inventory');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'entities.json');

function writeInventory(inventory: Inventory): void {
  // Safety check: ensure we never write outside .agent/inventory/
  const resolved = path.resolve(OUTPUT_FILE);
  const allowed = path.resolve(OUTPUT_DIR);
  if (!resolved.startsWith(allowed)) {
    console.error('[snapshot] SAFETY: output path escapes .agent/inventory/ — aborting');
    process.exit(1);
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(inventory, null, 2) + '\n', 'utf-8');
}

// ---------------------------------------------------------------------------
// 7. Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  // Fetch
  const rawStates = await fetchAllStates(haBaseUrl, HA_TOKEN as string);
  console.log('[snapshot] Fetched', rawStates.length, 'raw entity states');

  // Map
  const entities: EntityRecord[] = [];
  let skipped = 0;
  for (const state of rawStates) {
    const record = mapStateToRecord(state);
    if (record === null) {
      skipped++;
    } else {
      entities.push(record);
    }
  }

  if (skipped > 0) {
    console.log('[snapshot] Skipped', skipped, 'entities (non-canonical entity_id pattern)');
  }

  // Sort for stable output (domain then object name)
  entities.sort((a, b) => a.entity_id.localeCompare(b.entity_id));

  const inventory: Inventory = {
    generated_at: new Date().toISOString(),
    source: 'GET /api/states',
    ha_url: haBaseUrl,
    entities,
  };

  // Validate against Zod schema before writing
  const parseResult = InventorySchema.safeParse(inventory);
  if (!parseResult.success) {
    console.error('[snapshot] Validation FAILED — inventory does not match schema:');
    console.error(parseResult.error.format());
    process.exit(1);
  }

  // Write
  writeInventory(parseResult.data);

  console.log('[snapshot] Written', entities.length, 'entities to', OUTPUT_FILE);
  console.log('[snapshot] Done.');
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error('[snapshot] Unexpected error:', msg);
  process.exit(1);
});
