import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@libsql/client';

/**
 * ha-poller.ts — Home Assistant REST API Poller
 * Phase 1 of the WHA orchestration pipeline.
 * Polls HA entity states and writes snapshot to Turso home_status table.
 *
 * GET /api/ha-poller  (protected by x-poller-secret header)
 * Env vars required: HA_URL, HA_TOKEN, HA_POLLER_SECRET
 */

interface HAStateResponse {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_changed: string;
  last_updated: string;
}

interface PollerResult {
  polled_at: string;
  ev_charge_pct: number | null;
  garden_watered: boolean;
  last_watered_at: string | null;
  presence_home: boolean;
  presence_room: string | null;
  ha_entities_found: string[];
  ha_entities_missing: string[];
  warnings: string[];
}

const ENTITIES_TO_POLL = [
  'sensor.ev_battery_level',
  'binary_sensor.garden_valve',
  'person.ron',
  'person.djrong',
  'weather.home',
] as const;

const POLL_TIMEOUT_MS = 8_000;
const MAX_RETRIES = 2;

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

async function fetchEntity(
  entityId: string,
  haUrl: string,
  haToken: string,
  attempt = 0
): Promise<HAStateResponse | null> {
  const url = haUrl + '/api/states/' + entityId;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), POLL_TIMEOUT_MS);
    const res = await fetch(url, {
      headers: {
        Authorization: 'Bearer ' + haToken,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error('HA returned ' + res.status + ' for ' + entityId);
    return (await res.json()) as HAStateResponse;
  } catch (err) {
    if (attempt < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      return fetchEntity(entityId, haUrl, haToken, attempt + 1);
    }
    console.error('[ha-poller] failed to fetch ' + entityId + ':', err);
    return null;
  }
}

function resolvePresence(states: Partial<Record<string, HAStateResponse>>): {
  home: boolean;
  room: string | null;
} {
  const person = states['person.ron'] ?? states['person.djrong'];
  if (!person) return { home: false, room: null };
  const home = person.state === 'home';
  const room = (person.attributes?.room_name as string) ?? null;
  return { home, room };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const secret = process.env.HA_POLLER_SECRET;
  if (secret && req.headers['x-poller-secret'] !== secret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const haUrl = process.env.HA_URL;
  const haToken = process.env.HA_TOKEN;

  if (!haUrl || !haToken) {
    const msg = 'HA_URL or HA_TOKEN not set';
    console.warn('[ha-poller]', msg);
    return res.status(503).json({ error: msg });
  }

  const polledAt = new Date().toISOString();
  const warnings: string[] = [];
  const found: string[] = [];
  const missing: string[] = [];

  const stateEntries = await Promise.all(
    ENTITIES_TO_POLL.map(async (id) => {
      const state = await fetchEntity(id, haUrl, haToken);
      if (state) { found.push(id); } else { missing.push(id); warnings.push("Entity '" + id + "' not found in HA"); }
      return [id, state] as const;
    })
  );
  const states = Object.fromEntries(stateEntries) as Partial<Record<string, HAStateResponse>>;

  let evChargePct: number | null = null;
  const evState = states['sensor.ev_battery_level'];
  if (evState) {
    const parsed = parseInt(evState.state, 10);
    evChargePct = isNaN(parsed) ? null : parsed;
  }

  const valveState = states['binary_sensor.garden_valve'];
  const gardenWatered = valveState ? valveState.state === 'on' : false;
  const lastWateredAt = valveState?.last_changed ?? null;

  const { home: presenceHome, room: presenceRoom } = resolvePresence(states);

  const result: PollerResult = {
    polled_at: polledAt,
    ev_charge_pct: evChargePct,
    garden_watered: gardenWatered,
    last_watered_at: lastWateredAt,
    presence_home: presenceHome,
    presence_room: presenceRoom,
    ha_entities_found: found,
    ha_entities_missing: missing,
    warnings,
  };

  try {
    await db.execute({
      sql: 'INSERT INTO home_status (ev_charge_percentage, garden_watered, last_watered_at, created_at, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
      args: [evChargePct, gardenWatered ? 1 : 0, lastWateredAt],
    });
    console.log('[ha-poller] snapshot written at ' + polledAt);
  } catch (dbErr) {
    const msg = 'Turso write failed: ' + (dbErr as Error).message;
    console.error('[ha-poller]', msg);
    warnings.push(msg);
    return res.status(207).json({ ...result, db_error: msg });
  }

  return res.status(200).json(result);
}
