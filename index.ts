import { Hono } from "hono";
import { cors } from "hono/cors";
import { MobilityEngine } from "./mobility-engine";
import type { 
  Destination, 
  Event, 
  HomeStatus, 
  UserSettings, 
  ConversationNote
} from "@/shared/types";

const app = new Hono<{ Bindings: Env }>();

app.use("/*", cors());

const mobilityEngine = new MobilityEngine();

// Get mobility recommendation
app.post("/api/recommendation", async (c) => {
  try {
    const { destination_id, weather } = await c.req.json();

    if (!destination_id) {
      return c.json({ error: "destination_id is required" }, 400);
    }

    const db = c.env.DB;

    // Get destination
    const destination = await db
      .prepare("SELECT * FROM destinations WHERE id = ?")
      .bind(destination_id)
      .first<Destination>();

    if (!destination) {
      return c.json({ error: "Destination not found" }, 404);
    }

    // Get user settings
    let settings = await db
      .prepare("SELECT * FROM user_settings ORDER BY id DESC LIMIT 1")
      .first<UserSettings>();

    if (!settings) {
      // Create default settings
      await db
        .prepare(
          "INSERT INTO user_settings (max_comfortable_walk_distance, temperature_drive_threshold_high, temperature_drive_threshold_low, rain_drive_threshold) VALUES (?, ?, ?, ?)"
        )
        .bind(1.5, 30, 5, 40)
        .run();

      settings = await db
        .prepare("SELECT * FROM user_settings ORDER BY id DESC LIMIT 1")
        .first<UserSettings>();
    }

    // Get current/upcoming events
    const now = new Date().toISOString();
    const events = await db
      .prepare(
        "SELECT * FROM events WHERE start_datetime >= ? OR end_datetime >= ? ORDER BY start_datetime"
      )
      .bind(now, now)
      .all<Event>();

    // Find nearby events
    const nearbyEvents = mobilityEngine.findNearbyEvents(
      destination,
      events.results || [],
      settings!.max_comfortable_walk_distance
    );

    // Get home status
    const homeStatus = await db
      .prepare("SELECT * FROM home_status ORDER BY id DESC LIMIT 1")
      .first<HomeStatus>();

    // Calculate distance
    let distance = 0;
    if (
      settings?.home_latitude &&
      settings?.home_longitude &&
      destination.latitude &&
      destination.longitude
    ) {
      const R = 3958.8;
      const dLat =
        (destination.latitude - settings.home_latitude) * (Math.PI / 180);
      const dLon =
        (destination.longitude - settings.home_longitude) * (Math.PI / 180);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(settings.home_latitude * (Math.PI / 180)) *
          Math.cos(destination.latitude * (Math.PI / 180)) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      distance = R * c;
    }

    // Generate recommendation
    const recommendation = mobilityEngine.generateRecommendation(
      destination,
      nearbyEvents,
      homeStatus,
      settings!,
      weather || { temp: 20, condition: "Clear", rain_probability: 0 },
      distance
    );

    // Get recent conversation notes for Friday recap
    const notes = await db
      .prepare(
        "SELECT * FROM conversation_notes WHERE date_logged >= date('now', '-7 days') ORDER BY date_logged DESC LIMIT 5"
      )
      .all<ConversationNote>();

    if (notes.results && notes.results.length > 0) {
      const recapParts: string[] = [];
      notes.results.forEach((note) => {
        if (note.contact_name && note.venue_mentioned) {
          recapParts.push(
            `You mentioned wanting to see ${note.contact_name} - they usually prefer ${note.venue_mentioned}`
          );
        } else if (note.emotional_state) {
          recapParts.push(
            `Recent mood: ${note.emotional_state} - ${note.note_text}`
          );
        }
      });
      if (recapParts.length > 0) {
        recommendation.friday_recap = recapParts.join(". ");
      }
    }

    // Store recommendation
    await db
      .prepare(
        `INSERT INTO mobility_recommendations 
        (destination_id, recommendation, confidence_score, reasoning, weather_temp, weather_condition, rain_probability, parking_difficulty, estimated_cost) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        destination_id,
        recommendation.recommendation,
        recommendation.confidence_score,
        recommendation.reasoning,
        recommendation.weather.temp,
        recommendation.weather.condition,
        recommendation.weather.rain_probability,
        recommendation.parking.difficulty,
        recommendation.parking.estimated_cost || null
      )
      .run();

    return c.json(recommendation);
  } catch (error) {
    console.error("Error generating recommendation:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Destinations
app.get("/api/destinations", async (c) => {
  const db = c.env.DB;
  const result = await db
    .prepare("SELECT * FROM destinations ORDER BY name")
    .all<Destination>();
  return c.json(result.results || []);
});

app.post("/api/destinations", async (c) => {
  try {
    const data = await c.req.json();
    const db = c.env.DB;

    const result = await db
      .prepare(
        `INSERT INTO destinations 
        (name, address, latitude, longitude, typical_parking_difficulty, has_parking_garage, parking_cost_estimate) 
        VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        data.name,
        data.address,
        data.latitude || null,
        data.longitude || null,
        data.typical_parking_difficulty || null,
        data.has_parking_garage ? 1 : 0,
        data.parking_cost_estimate || null
      )
      .run();

    return c.json({ id: result.meta.last_row_id, ...data });
  } catch (error) {
    console.error("Error creating destination:", error);
    return c.json({ error: "Failed to create destination" }, 500);
  }
});

// Events
app.get("/api/events", async (c) => {
  const db = c.env.DB;
  const result = await db
    .prepare("SELECT * FROM events ORDER BY start_datetime")
    .all<Event>();
  return c.json(result.results || []);
});

app.post("/api/events", async (c) => {
  try {
    const data = await c.req.json();
    const db = c.env.DB;

    const result = await db
      .prepare(
        `INSERT INTO events 
        (name, venue_name, latitude, longitude, start_datetime, end_datetime, expected_attendance, is_road_closure) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        data.name,
        data.venue_name || null,
        data.latitude || null,
        data.longitude || null,
        data.start_datetime,
        data.end_datetime || null,
        data.expected_attendance || null,
        data.is_road_closure ? 1 : 0
      )
      .run();

    return c.json({ id: result.meta.last_row_id, ...data });
  } catch (error) {
    console.error("Error creating event:", error);
    return c.json({ error: "Failed to create event" }, 500);
  }
});

// Conversation Notes
app.get("/api/conversation-notes", async (c) => {
  const db = c.env.DB;
  const result = await db
    .prepare(
      "SELECT * FROM conversation_notes ORDER BY date_logged DESC LIMIT 20"
    )
    .all<ConversationNote>();
  return c.json(result.results || []);
});

app.post("/api/conversation-notes", async (c) => {
  try {
    const data = await c.req.json();
    const db = c.env.DB;

    const result = await db
      .prepare(
        `INSERT INTO conversation_notes 
        (note_text, category, contact_name, venue_mentioned, emotional_state, date_logged) 
        VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(
        data.note_text,
        data.category || null,
        data.contact_name || null,
        data.venue_mentioned || null,
        data.emotional_state || null,
        data.date_logged || new Date().toISOString().split("T")[0]
      )
      .run();

    return c.json({ id: result.meta.last_row_id, ...data });
  } catch (error) {
    console.error("Error creating conversation note:", error);
    return c.json({ error: "Failed to create conversation note" }, 500);
  }
});

// Home Status
app.get("/api/home-status", async (c) => {
  const db = c.env.DB;
  const result = await db
    .prepare("SELECT * FROM home_status ORDER BY id DESC LIMIT 1")
    .first<HomeStatus>();
  return c.json(result || null);
});

app.post("/api/home-status", async (c) => {
  try {
    const data = await c.req.json();
    const db = c.env.DB;

    const result = await db
      .prepare(
        `INSERT INTO home_status 
        (ev_charge_percentage, garden_watered, last_watered_at) 
        VALUES (?, ?, ?)`
      )
      .bind(
        data.ev_charge_percentage || null,
        data.garden_watered ? 1 : 0,
        data.last_watered_at || null
      )
      .run();

    return c.json({ id: result.meta.last_row_id, ...data });
  } catch (error) {
    console.error("Error updating home status:", error);
    return c.json({ error: "Failed to update home status" }, 500);
  }
});

app.put("/api/home-status", async (c) => {
  try {
    const data = await c.req.json();
    const db = c.env.DB;

    await db
      .prepare(
        `UPDATE home_status 
        SET ev_charge_percentage = ?, garden_watered = ?, last_watered_at = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = (SELECT id FROM home_status ORDER BY id DESC LIMIT 1)`
      )
      .bind(
        data.ev_charge_percentage || null,
        data.garden_watered ? 1 : 0,
        data.last_watered_at || null
      )
      .run();

    return c.json({ success: true });
  } catch (error) {
    console.error("Error updating home status:", error);
    return c.json({ error: "Failed to update home status" }, 500);
  }
});

// User Settings
app.get("/api/settings", async (c) => {
  const db = c.env.DB;
  const result = await db
    .prepare("SELECT * FROM user_settings ORDER BY id DESC LIMIT 1")
    .first<UserSettings>();
  return c.json(result || null);
});

app.put("/api/settings", async (c) => {
  try {
    const data = await c.req.json();
    const db = c.env.DB;

    const existing = await db
      .prepare("SELECT id FROM user_settings ORDER BY id DESC LIMIT 1")
      .first();

    if (existing) {
      await db
        .prepare(
          `UPDATE user_settings 
          SET home_latitude = ?, home_longitude = ?, max_comfortable_walk_distance = ?, 
              temperature_drive_threshold_high = ?, temperature_drive_threshold_low = ?, 
              rain_drive_threshold = ?, updated_at = CURRENT_TIMESTAMP 
          WHERE id = ?`
        )
        .bind(
          data.home_latitude || null,
          data.home_longitude || null,
          data.max_comfortable_walk_distance || 1.5,
          data.temperature_drive_threshold_high || 30,
          data.temperature_drive_threshold_low || 5,
          data.rain_drive_threshold || 40,
          existing.id
        )
        .run();
    } else {
      await db
        .prepare(
          `INSERT INTO user_settings 
          (home_latitude, home_longitude, max_comfortable_walk_distance, temperature_drive_threshold_high, temperature_drive_threshold_low, rain_drive_threshold) 
          VALUES (?, ?, ?, ?, ?, ?)`
        )
        .bind(
          data.home_latitude || null,
          data.home_longitude || null,
          data.max_comfortable_walk_distance || 1.5,
          data.temperature_drive_threshold_high || 30,
          data.temperature_drive_threshold_low || 5,
          data.rain_drive_threshold || 40
        )
        .run();
    }

    return c.json({ success: true });
  } catch (error) {
    console.error("Error updating settings:", error);
    return c.json({ error: "Failed to update settings" }, 500);
  }
});

export default app;
