import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * ha-webhook.ts — Outbound HA Webhook Dispatcher
 *
 * Phase 2 of the WHA orchestration pipeline.
 * Receives a trigger event from the orchestrator (or directly from ha-poller)
 * and fires the corresponding Home Assistant webhook automation.
 *
 * POST /api/ha-webhook
 * Body: { "trigger": "ev_charge_low" }   (see TRIGGER_MAP below)
 *
 * Required env vars (set in Vercel):
 *   HA_URL                      - e.g. http://192.168.1.229:8123
 *   HA_TOKEN                    - Long-lived access token
 *   HA_WEBHOOK_EV_ALERT         - Webhook ID for low EV charge automation
 *   HA_WEBHOOK_GARDEN           - Webhook ID for garden water reminder
 *   HA_WEBHOOK_AWAY_MODE        - Webhook ID for away mode on
 *   HA_WEBHOOK_WELCOME_HOME     - Webhook ID for welcome home
 *   HA_WEBHOOK_UMBRELLA         - Webhook ID for umbrella reminder
 *   HA_WEBHOOK_PARKING_WARNING  - Webhook ID for parking warning
 *   HA_WEBHOOK_REST_MODE        - Webhook ID for rest mode lighting
 */

// ── Types ──────────────────────────────────────────────────────────────────

type TriggerKey =
  | 'ev_charge_low'
  | 'garden_needs_water'
  | 'presence_departure'
  | 'presence_arrival'
  | 'high_rain_probability'
  | 'large_nearby_event'
  | 'low_readiness';

interface WebhookRequest {
  trigger: TriggerKey;
  payload?: Record<string, unknown>; // optional context forwarded to HA
}

interface WebhookResult {
  trigger: TriggerKey;
  webhook_id: string;
  ha_status: number;
  dispatched_at: string;
  ok: boolean;
}

// ── Trigger → env var map ──────────────────────────────────────────────────

const TRIGGER_MAP: Record<TriggerKey, string> = {
  ev_charge_low: 'HA_WEBHOOK_EV_ALERT',
  garden_needs_water: 'HA_WEBHOOK_GARDEN',
  presence_departure: 'HA_WEBHOOK_AWAY_MODE',
  presence_arrival: 'HA_WEBHOOK_WELCOME_HOME',
  high_rain_probability: 'HA_WEBHOOK_UMBRELLA',
  large_nearby_event: 'HA_WEBHOOK_PARKING_WARNING',
  low_readiness: 'HA_WEBHOOK_REST_MODE',
};

const DISPATCH_TIMEOUT_MS = 5_000;

// ── Main handler ──────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed — use POST' });
  }

  const body = req.body as Partial<WebhookRequest>;
  const trigger = body?.trigger;

  if (!trigger || !(trigger in TRIGGER_MAP)) {
    return res.status(400).json({
      error: 'Invalid or missing trigger',
      valid_triggers: Object.keys(TRIGGER_MAP),
    });
  }

  const haUrl = process.env.HA_URL;
  const haToken = process.env.HA_TOKEN;
  const envKey = TRIGGER_MAP[trigger];
  const webhookId = process.env[envKey];

  if (!haUrl || !haToken) {
    return res.status(503).json({ error: 'HA_URL or HA_TOKEN not configured' });
  }

  if (!webhookId) {
    return res.status(503).json({
      error: 'Webhook ID not configured for trigger: ' + trigger,
      missing_env: envKey,
      help: 'Add ' + envKey + ' to Vercel environment variables',
    });
  }

  // ── Dispatch to HA ───────────────────────────────────────────────────────
  const dispatchedAt = new Date().toISOString();
  const webhookUrl = haUrl + '/api/webhook/' + webhookId;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DISPATCH_TIMEOUT_MS);

    const haRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + haToken,
      },
      body: JSON.stringify({
        source: 'wha-orchestrator',
        trigger,
        dispatched_at: dispatchedAt,
        ...(body.payload ?? {}),
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const result: WebhookResult = {
      trigger,
      webhook_id: webhookId,
      ha_status: haRes.status,
      dispatched_at: dispatchedAt,
      ok: haRes.ok,
    };

    console.log(
      '[ha-webhook] dispatched ' + trigger + ' -> ' + webhookId + ' status=' + haRes.status
    );

    // HA returns 200 for successful webhook trigger
    return res.status(haRes.ok ? 200 : 502).json(result);
  } catch (err) {
    const msg = (err as Error).message;
    console.error('[ha-webhook] dispatch failed for ' + trigger + ':', msg);
    return res.status(500).json({
      trigger,
      webhook_id: webhookId,
      dispatched_at: dispatchedAt,
      ok: false,
      error: msg,
    });
  }
}
