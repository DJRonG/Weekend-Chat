/**
 * lib/intent-validator.ts
 * Phase 3 — Milestone 2: Intent Contract Validator
 *
 * Validates a parsed JSON value against the intent contract defined in
 * schemas/intent.schema.json.
 *
 * Design principles:
 * - Pure library — no file I/O, no resolver calls, no HA writes.
 * - Structured result (ok + errors[]) so callers can format output appropriately.
 * - Normalization (trim name, coerce v to number) happens only on valid intents.
 * - Uses zod (already in deps) for schema validation — no new runtime deps.
 *
 * Consumed by:
 * - scripts/validate-intent.ts (CLI)
 * - lib/automation-generator.ts (Step 3b, future) — must validate before resolving
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// 1. Zod schema (mirrors schemas/intent.schema.json)
// ---------------------------------------------------------------------------

/**
 * Regex for HA service strings: domain.service (e.g. "light.turn_on")
 * Mirrors the pattern in intent.schema.json.
 */
const HA_SERVICE_RE = /^[a-z_]+\.[a-z_]+$/;

/**
 * Regex for fully-qualified HA entity IDs (e.g. "light.office_lights")
 */
const HA_ENTITY_ID_RE = /^[a-z_]+\.[a-z0-9_]+$/;

const ActionSchema = z
  .object({
    service: z
      .string()
      .regex(HA_SERVICE_RE, 'service must be in domain.service format (e.g. "light.turn_on")'),
    targets: z.array(z.string().min(1, 'target name must be non-empty')).min(1).optional(),
    entity_ids: z
      .array(z.string().regex(HA_ENTITY_ID_RE, 'entity_id must be in domain.entity format'))
      .min(1)
      .optional(),
    data: z.record(z.unknown()).optional(),
  })
  .refine(
    (a) => a.targets !== undefined || a.entity_ids !== undefined,
    {
      message: 'Each action must have at least one of: targets, entity_ids',
      path: [],
    }
  );

const TriggerSchema = z
  .object({ platform: z.string().min(1) })
  .passthrough(); // permissive for forward compatibility

const ConditionSchema = z
  .object({ condition: z.string().min(1) })
  .passthrough(); // permissive for forward compatibility

const MetadataSchema = z
  .object({
    area_hint: z.string().min(1).optional(),
    domain_hint: z.string().min(1).optional(),
    source_ui: z.string().min(1).optional(),
  })
  .strict(); // no extra fields in metadata

const IntentSchema = z
  .object({
    v: z.literal(1),
    kind: z.literal('automation'),
    name: z.string().min(1, 'name must be non-empty').max(255),
    description: z.string().max(1024).optional(),
    actions: z.array(ActionSchema).min(1, 'actions must contain at least one action'),
    triggers: z.array(TriggerSchema).optional(),
    conditions: z.array(ConditionSchema).optional(),
    metadata: MetadataSchema.optional(),
  })
  .strict(); // no unknown top-level keys

// ---------------------------------------------------------------------------
// 2. Public types
// ---------------------------------------------------------------------------

/** A single validation error with a dot-path and human-readable message. */
export interface ValidationError {
  path: string;
  message: string;
}

/** Normalized (trimmed, coerced) intent shape — only present when ok=true. */
export interface NormalizedIntent {
  v: 1;
  kind: 'automation';
  name: string;
  description?: string;
  actions: NormalizedAction[];
  triggers?: z.infer<typeof TriggerSchema>[];
  conditions?: z.infer<typeof ConditionSchema>[];
  metadata?: z.infer<typeof MetadataSchema>;
}

export interface NormalizedAction {
  service: string;
  targets?: string[];
  entity_ids?: string[];
  data?: Record<string, unknown>;
}

export interface ValidationResult {
  ok: boolean;
  intent?: NormalizedIntent;
  errors?: ValidationError[];
}

// ---------------------------------------------------------------------------
// 3. Core validator
// ---------------------------------------------------------------------------

/**
 * Validate a parsed JSON value against the intent contract.
 *
 * @param raw  Any value (typically parsed JSON). Must NOT be a string —
 *             callers are responsible for JSON.parse() before calling this.
 * @returns    ValidationResult with ok=true + normalized intent, or
 *             ok=false + structured errors[].
 *
 * @example
 * const result = validateIntent(JSON.parse(fs.readFileSync('intent.json', 'utf-8')));
 * if (!result.ok) { console.error(result.errors); process.exit(2); }
 * const intent = result.intent!;
 */
export function validateIntent(raw: unknown): ValidationResult {
  const parsed = IntentSchema.safeParse(raw);

  if (!parsed.success) {
    const errors: ValidationError[] = parsed.error.errors.map((e) => ({
      path: e.path.length > 0 ? e.path.join('.') : '(root)',
      message: e.message,
    }));
    return { ok: false, errors };
  }

  // Normalize: trim name, normalize action targets (trim each)
  const data = parsed.data;
  const intent: NormalizedIntent = {
    v: 1,
    kind: 'automation',
    name: data.name.trim(),
    ...(data.description !== undefined ? { description: data.description.trim() } : {}),
    actions: data.actions.map((a) => ({
      service: a.service,
      ...(a.targets !== undefined
        ? { targets: a.targets.map((t) => t.trim()).filter((t) => t.length > 0) }
        : {}),
      ...(a.entity_ids !== undefined ? { entity_ids: a.entity_ids } : {}),
      ...(a.data !== undefined ? { data: a.data } : {}),
    })),
    ...(data.triggers !== undefined ? { triggers: data.triggers } : {}),
    ...(data.conditions !== undefined ? { conditions: data.conditions } : {}),
    ...(data.metadata !== undefined ? { metadata: data.metadata } : {}),
  };

  // Post-normalization guard: if targets trimming emptied an array, that's an error
  for (let i = 0; i < intent.actions.length; i++) {
    const a = intent.actions[i];
    if (a.targets !== undefined && a.targets.length === 0) {
      return {
        ok: false,
        errors: [
          {
            path: `actions[${i}].targets`,
            message: 'targets array became empty after trimming whitespace-only strings',
          },
        ],
      };
    }
  }

  return { ok: true, intent };
}
