/**
 * lib/entity-resolver.ts
 * Phase 3 — Step 2: Entity Resolver  (hardened — Milestone 1)
 *
 * Deterministic, staged resolver that maps human-friendly names → entity_id
 * using the inventory snapshot at .agent/inventory/entities.json.
 *
 * This module is a pure library — no side effects, no HA writes, no network calls.
 * It reads the inventory file and returns structured JSON.
 *
 * Designed so Step 3 (YAML generator) can import resolveEntities() directly:
 *   import { resolveEntities } from '../lib/entity-resolver.js';
 *
 * Matching stages (deterministic, ordered):
 *   1. exact        — friendly_name === query (case-sensitive)            → 1.00
 *   2. casefold     — friendly_name.lower === query.lower                 → 0.98
 *   3. alias_exact  — any alias.lower === query.lower                     → 0.95
 *   4. normalized   — strip punctuation + collapse whitespace             → 0.92
 *   5. token_set    — Jaccard overlap on word tokens (floor: 0.20)        → overlap score
 *   6. substring    — normName includes normQuery (normalized both sides) → 0.70
 *
 * Hint boosts (applied after base score, clamped to 1.0):
 *   domain_hint match:  +0.05
 *   area_hint match:    +0.03
 *
 * Tie-breaker: entity_id ascending (deterministic for identical confidence).
 *
 * needs_review semantics (CORRECTED):
 *   true  when best.match_type is 'normalized', 'token_set', or 'substring'
 *         (fuzzy match — human should verify before automation is written)
 *   false when best is null (missing=true) or match_type is exact/casefold/alias_exact
 */

import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// 1. Inventory types (mirror of schemas/entities.schema.json)
// ---------------------------------------------------------------------------

const EntityRecordSchema = z.object({
  entity_id: z.string().regex(/^[a-z_]+\.[a-z0-9_]+$/),
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
  generated_at: z.string(),
  source: z.string(),
  ha_url: z.string(),
  entities: z.array(EntityRecordSchema),
});

export type EntityRecord = z.infer<typeof EntityRecordSchema>;
export type Inventory = z.infer<typeof InventorySchema>;

// ---------------------------------------------------------------------------
// 2. Request / Response types
// ---------------------------------------------------------------------------

export interface ResolveRequest {
  query: string;
  domain_hint?: string;
  area_hint?: string;
  limit?: number;
  min_confidence?: number;
}

export type MatchType =
  | 'exact'
  | 'casefold'
  | 'alias_exact'
  | 'normalized'
  | 'token_set'
  | 'substring'
  | 'none';

/** Match types that require no human review. */
const HIGH_CONFIDENCE_TYPES = new Set<MatchType>(['exact', 'casefold', 'alias_exact']);

/** Minimum Jaccard score for token_set to emit (avoids noise from shared stop-words). */
const TOKEN_SET_FLOOR = 0.2;

export interface Match {
  entity_id: string;
  friendly_name: string;
  domain: string;
  area?: string;
  confidence: number;
  match_type: MatchType;
  reason: string;
}

export interface AliasSuggestion {
  entity_id: string;
  add_alias: string;
}

export interface ResolveResponse {
  query: string;
  matches: Match[];
  best: Match | null;
  missing: boolean;
  needs_review: boolean;
  suggested_aliases: AliasSuggestion[];
}

// ---------------------------------------------------------------------------
// 3. Load inventory
// ---------------------------------------------------------------------------

export function loadInventory(inventoryPath: string): Inventory {
  if (!fs.existsSync(inventoryPath)) {
    throw new Error(
      `Inventory file not found: ${inventoryPath}\n` +
        `Run the Step 1 snapshot first:\n` +
        `  npm run inventory:snapshot`
    );
  }

  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(inventoryPath, 'utf-8'));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to parse inventory JSON at ${inventoryPath}: ${msg}`);
  }

  const result = InventorySchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `Inventory at ${inventoryPath} failed schema validation.\n` +
        `Run the Step 1 snapshot to regenerate it.\n` +
        JSON.stringify(result.error.format(), null, 2)
    );
  }
  return result.data;
}

// ---------------------------------------------------------------------------
// 4. Text normalization helpers
// ---------------------------------------------------------------------------

/** Lowercase + strip punctuation + collapse whitespace */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Split into unique lowercase tokens (operates on already-normalized string) */
function tokenize(s: string): Set<string> {
  return new Set(
    normalize(s)
      .split(' ')
      .filter((t) => t.length > 0)
  );
}

/** Jaccard similarity between two token sets */
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  const intersection = new Set([...a].filter((x) => b.has(x)));
  const union = new Set([...a, ...b]);
  return intersection.size / union.size;
}

/** Round to 3 decimal places for stable, deterministic output */
function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}

/** Clamp a value to [0, 1] */
function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

// ---------------------------------------------------------------------------
// 5. Core scoring for a single entity
// ---------------------------------------------------------------------------

interface RawScore {
  confidence: number;
  match_type: MatchType;
  reason: string;
}

function scoreEntity(entity: EntityRecord, queryRaw: string): RawScore {
  const queryLower = queryRaw.toLowerCase();
  const nameLower = entity.friendly_name.toLowerCase();

  // Stage 1: exact (case-sensitive)
  if (entity.friendly_name === queryRaw) {
    return {
      confidence: 1.0,
      match_type: 'exact',
      reason: `Exact match on friendly_name "${entity.friendly_name}"`,
    };
  }

  // Stage 2: casefold
  if (nameLower === queryLower) {
    return {
      confidence: 0.98,
      match_type: 'casefold',
      reason: `Case-insensitive match on friendly_name "${entity.friendly_name}"`,
    };
  }

  // Stage 3: alias exact (casefold)
  for (const alias of entity.aliases) {
    if (alias.toLowerCase() === queryLower) {
      return {
        confidence: 0.95,
        match_type: 'alias_exact',
        reason: `Exact match on alias "${alias}"`,
      };
    }
  }

  // Stage 4: normalized — normalize() applied consistently to both sides
  const normQuery = normalize(queryRaw);
  const normName = normalize(entity.friendly_name);

  if (normName === normQuery) {
    return {
      confidence: 0.92,
      match_type: 'normalized',
      reason: `Normalized match: "${normName}" === "${normQuery}"`,
    };
  }

  for (const alias of entity.aliases) {
    if (normalize(alias) === normQuery) {
      return {
        confidence: 0.92,
        match_type: 'normalized',
        reason: `Normalized alias match: "${normalize(alias)}" === "${normQuery}"`,
      };
    }
  }

  // Stage 5: token_set — Jaccard on normalized tokens; must meet TOKEN_SET_FLOOR
  const queryTokens = tokenize(queryRaw);
  let bestJaccard = jaccard(queryTokens, tokenize(entity.friendly_name));
  let jReason = `Token overlap with "${entity.friendly_name}"`;

  for (const alias of entity.aliases) {
    const j = jaccard(queryTokens, tokenize(alias));
    if (j > bestJaccard) {
      bestJaccard = j;
      jReason = `Token overlap with alias "${alias}"`;
    }
  }

  if (bestJaccard >= TOKEN_SET_FLOOR) {
    return {
      confidence: bestJaccard,
      match_type: 'token_set',
      reason: `${jReason} (Jaccard=${round3(bestJaccard).toFixed(3)})`,
    };
  }

  // Stage 6: substring — normalized name includes normalized query only
  // (not query-contains-name: avoids false positives when query is very long)
  if (normQuery.length > 0 && normName.includes(normQuery)) {
    return {
      confidence: 0.70,
      match_type: 'substring',
      reason: `Substring match: normalized query appears in "${entity.friendly_name}"`,
    };
  }

  for (const alias of entity.aliases) {
    const normAlias = normalize(alias);
    if (normQuery.length > 0 && normAlias.includes(normQuery)) {
      return {
        confidence: 0.70,
        match_type: 'substring',
        reason: `Substring match via alias "${alias}"`,
      };
    }
  }

  return { confidence: 0, match_type: 'none', reason: 'No match found' };
}

// ---------------------------------------------------------------------------
// 6. Apply hint boosts
// ---------------------------------------------------------------------------

function applyHints(
  score: RawScore,
  entity: EntityRecord,
  domainHint: string | undefined,
  areaHint: string | undefined
): number {
  let c = score.confidence;
  if (domainHint && entity.domain === domainHint) {
    c += 0.05;
  }
  // Normalize area for comparison (handles punctuation differences like "Bedroom & Loft")
  if (areaHint && entity.area && normalize(entity.area) === normalize(areaHint)) {
    c += 0.03;
  }
  return clamp01(c);
}

// ---------------------------------------------------------------------------
// 7. Main resolve function (exported for Step 3)
// ---------------------------------------------------------------------------

export function resolveEntities(
  inventory: Inventory,
  request: ResolveRequest
): ResolveResponse {
  const {
    query,
    domain_hint,
    area_hint,
    limit = 10,
    min_confidence = 0.8,
  } = request;

  const candidates: Match[] = [];

  for (const entity of inventory.entities) {
    const raw = scoreEntity(entity, query);
    if (raw.match_type === 'none') continue;

    const boostedConfidence = applyHints(raw, entity, domain_hint, area_hint);
    if (boostedConfidence < min_confidence) continue;

    candidates.push({
      entity_id: entity.entity_id,
      friendly_name: entity.friendly_name,
      domain: entity.domain,
      ...(entity.area !== undefined ? { area: entity.area } : {}),
      confidence: round3(boostedConfidence),
      match_type: raw.match_type,
      reason: raw.reason,
    });
  }

  // Sort: confidence desc, entity_id asc (stable locale-aware tie-breaker)
  candidates.sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return a.entity_id.localeCompare(b.entity_id, 'en', { sensitivity: 'base' });
  });

  const limited = candidates.slice(0, limit);
  const best = limited[0] ?? null;

  // needs_review: true when best used a fuzzy stage (normalized/token_set/substring).
  // Cannot be true when best is null — no match means missing=true, not needs_review.
  const needs_review = best !== null && !HIGH_CONFIDENCE_TYPES.has(best.match_type);

  // suggested_aliases: propose adding query as alias when match was fuzzy
  // and the query string isn't already the friendly_name or a known alias.
  const suggested_aliases: AliasSuggestion[] = [];
  if (best !== null && !HIGH_CONFIDENCE_TYPES.has(best.match_type)) {
    const inventoryEntity = inventory.entities.find(
      (e) => e.entity_id === best.entity_id
    );
    if (inventoryEntity) {
      const queryLower = query.toLowerCase();
      const alreadyKnown =
        inventoryEntity.friendly_name.toLowerCase() === queryLower ||
        inventoryEntity.aliases.some((a) => a.toLowerCase() === queryLower);
      if (!alreadyKnown) {
        suggested_aliases.push({ entity_id: best.entity_id, add_alias: query });
      }
    }
  }

  return {
    query,
    matches: limited,
    best,
    missing: limited.length === 0,
    needs_review,
    suggested_aliases,
  };
        }
