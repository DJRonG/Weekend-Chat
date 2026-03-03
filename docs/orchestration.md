# Weekend Agent — Orchestration Layer

This document describes how the Weekend Agent orchestrates data from Home Assistant and other sources to produce context-aware mobility recommendations and weekend agendas.

---

## 1. Overview

The orchestration layer sits between raw sensor/API inputs and the dashboard/notification outputs. It is responsible for:

1. **Polling** data sources on a schedule (HA REST API, calendar, weather)
2. **Building a world-state snapshot** — a single JSON object representing "now"
3. **Running engines** (Mobility, Agenda, Emotion) against that snapshot
4. **Writing results** back to the Supabase / Turso state store
5. **Triggering HA automations** via webhook or MQTT when thresholds are crossed

---

## 2. Data Sources & Poll Intervals

| Source | Protocol | Poll interval | HA entity examples |
|--------|----------|---------------|--------------------|
| Home Assistant REST API | HTTP GET | 60 s | `sensor.ev_battery_level`, `binary_sensor.garden_valve`, `person.ron` |
| BLE / Motion presence | MQTT (HA bridge) | real-time | `binary_sensor.presence_living_room` |
| OpenWeatherMap | HTTP GET | 15 min | injected as `weather.home` in HA |
| Google Calendar | OAuth2 / REST | 5 min | parsed locally, stored in `events` table |
| Conversation Notes | Manual / webhook | on-demand | stored in `conversation_notes` table |

---

## 3. World-State Snapshot Schema

```json
{
  "timestamp": "2026-02-18T17:00:00Z",
  "presence": {
    "home": true,
    "room": "office",
    "last_seen": "2026-02-18T16:58:00Z"
  },
  "biometric": {
    "readiness_score": 78,
    "hrv": 45,
    "sleep_score": 85
  },
  "home": {
    "ev_charge_pct": 62,
    "garden_watered": false,
    "last_watered_at": "2026-02-17T08:00:00Z"
  },
  "weather": {
    "temp_c": 18,
    "condition": "Clear",
    "rain_probability": 10
  },
  "calendar": {
    "next_event": "Dinner @ Nobu",
    "next_event_start": "2026-02-18T19:30:00Z",
    "free_until": "2026-02-18T19:00:00Z"
  },
  "conversation_context": {
    "emotional_state": "positive",
    "recent_venues": ["Nobu", "Griffith Park"],
    "planned_contacts": ["Alex"]
  }
}
```

---

## 4. Engine Pipeline

```
World-State Snapshot
        │
        ├──► Context Engine          builds snapshot, validates fields
        │         │
        │         ├──► Mobility Engine     scores walk/drive/rideshare
        │         │         └── writes → home_status.mobility_recommendation
        │         │
        │         ├──► Agenda Engine       ranks tasks for the day
        │         │         └── writes → home_status.agenda_json
        │         │
        │         └──► Emotion Engine      parses mood from conv notes
        │                   └── feeds back into Agenda Engine weighting
        │
        └──► HA Webhook Dispatcher   fires HA automations on threshold events
```

---

## 5. HA Automation Trigger Points

These are the conditions under which the orchestrator fires a webhook back into Home Assistant:

| Trigger | Condition | HA Automation called |
|---------|-----------|----------------------|
| Low EV charge | `ev_charge_pct < 20` | `automation.ev_charge_alert` |
| Garden needs water | `garden_watered == false && hour >= 7` | `automation.garden_water_reminder` |
| Presence departure | `presence.home` changes false | `automation.away_mode_on` |
| Presence arrival | `presence.home` changes true | `automation.welcome_home` |
| High rain probability | `rain_probability > 40 && next_event_within_2h` | `automation.umbrella_reminder` |
| Large event nearby | `nearby_event.attendance > 5000` | `automation.parking_warning_notify` |
| Low readiness | `readiness_score < 50` | `automation.light_schedule_rest_mode` |

---

## 6. HA Workflow Automations — Build Checklist

### Phase 1 — HA Sensor Integration (CURRENT PRIORITY)
- [ ] **HA REST API poller** — Node.js script or HA `rest_command` that calls `/api/states` every 60 s and writes to Turso `home_status` table
- [ ] **MQTT bridge** — configure HA Mosquitto add-on and map BLE/motion sensors to MQTT topics consumed by WHA
- [ ] **`sensor.ev_battery_level` entity** — verify entity exists in HA; add `template sensor` if sourced from Zappi/Ohme charger integration
- [ ] **`binary_sensor.garden_valve` entity** — verify RainBird / generic valve entity is exposed via HA REST

### Phase 2 — Webhook Dispatcher
- [ ] **Outbound webhook handler** in `/api/ha-webhook.ts` — accepts POST from orchestrator, calls HA `/api/webhook/<id>`
- [ ] **HA webhook automations** — create automations in HA triggered by `webhook_id` for each row in the trigger table above
- [ ] **Secret / token management** — store `HA_WEBHOOK_TOKEN` and `HA_URL` in Vercel env vars

### Phase 3 — MQTT Presence Pipeline
- [ ] **Mosquitto add-on** installed and running in HA
- [ ] **BLE scanner** (ESPresense or room-assistant) publishing to `wha/sensors/rssi`
- [ ] **RTLS engine** in WHA core consuming RSSI topics → room-level `presence.room` state

### Phase 4 — Notification Outputs
- [ ] **HA mobile push** — use HA Companion App `notify.mobile_app_*` service in automations
- [ ] **Dashboard update** — POST updated `home_status` to Vercel API after each orchestrator run
- [ ] **Friday recap card** — Vercel API endpoint `/api/weekly-recap` that aggregates `conversation_notes` for the past 7 days

### Phase 5 — Calendar & Biometric Feeds
- [ ] **Google Calendar OAuth2** — service account or OAuth token stored in Vercel env; synced to `events` table every 5 min
- [ ] **Biometric MQTT publisher** — Whoop/Oura/Apple Health → MQTT bridge publishing to `wha/biometrics`
- [ ] **Readiness score entity** in HA — `sensor.biometric_readiness` created via MQTT autodiscovery

---

## 7. Environment Variables Required

```bash
# Home Assistant
HA_URL=http://192.168.1.229:8123
HA_TOKEN=<long_lived_access_token>
HA_WEBHOOK_EV_ALERT=<webhook_id>
HA_WEBHOOK_GARDEN=<webhook_id>
HA_WEBHOOK_AWAY_MODE=<webhook_id>
HA_WEBHOOK_WELCOME_HOME=<webhook_id>
HA_WEBHOOK_UMBRELLA=<webhook_id>
HA_WEBHOOK_PARKING_WARNING=<webhook_id>
HA_WEBHOOK_REST_MODE=<webhook_id>

# Database
TURSO_DATABASE_URL=<url>
TURSO_AUTH_TOKEN=<token>

# External APIs
OPENWEATHER_API_KEY=<key>
GOOGLE_CALENDAR_CLIENT_ID=<id>
GOOGLE_CALENDAR_CLIENT_SECRET=<secret>
GOOGLE_CALENDAR_REFRESH_TOKEN=<token>

# MQTT
MQTT_BROKER_URL=mqtt://192.168.1.229:1883
MQTT_USER=wha
MQTT_PASSWORD=<password>
```

---

## 8. References

- [wha_readme.md](../wha_readme.md) — Full WHA v2.0 system documentation
- [docs/diagrams/home-model.mmd](diagrams/home-model.mmd) — Architecture diagram
- [home-status.ts](../home-status.ts) — Current HA state API endpoint
- [HA REST API docs](https://developers.home-assistant.io/docs/api/rest/)
- [HA Automation Blueprints](https://www.home-assistant.io/docs/automation/)
