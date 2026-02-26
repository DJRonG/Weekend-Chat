import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@libsql/client';

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

// Types
interface Destination {
  id: number;
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
  typical_parking_difficulty?: string;
  has_parking_garage?: boolean;
  parking_cost_estimate?: number;
}

interface Event {
  id: number;
  name: string;
  venue_name?: string;
  latitude?: number;
  longitude?: number;
  start_datetime: string;
  end_datetime?: string;
  expected_attendance?: number;
  is_road_closure?: boolean;
}

interface HomeStatus {
  id: number;
  ev_charge_percentage?: number;
  garden_watered?: boolean;
  last_watered_at?: string;
}

interface UserSettings {
  id: number;
  home_latitude?: number;
  home_longitude?: number;
  max_comfortable_walk_distance: number;
  temperature_drive_threshold_high: number;
  temperature_drive_threshold_low: number;
  rain_drive_threshold: number;
}

interface Weather {
  temp: number;
  condition: string;
  rain_probability: number;
}

// Mobility Engine (inline for Vercel serverless)
class MobilityEngine {
  private calculateDistance(
    lat1?: number,
    lon1?: number,
    lat2?: number,
    lon2?: number
  ): number {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
    
    const R = 3958.8; // Earth radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private evaluateWeather(
    temp: number,
    rainProbability: number,
    settings: UserSettings
  ): { score: number; reason: string } {
    let score = 0;
    const reasons: string[] = [];

    if (temp > settings.temperature_drive_threshold_high) {
      score += 30;
      reasons.push(`Temperature is ${temp}°C (above ${settings.temperature_drive_threshold_high}°C threshold)`);
    } else if (temp < settings.temperature_drive_threshold_low) {
      score += 30;
      reasons.push(`Temperature is ${temp}°C (below ${settings.temperature_drive_threshold_low}°C threshold)`);
    } else {
      reasons.push(`Temperature is comfortable at ${temp}°C`);
    }

    if (rainProbability > settings.rain_drive_threshold) {
      score += 40;
      reasons.push(`${rainProbability}% chance of rain (above ${settings.rain_drive_threshold}% threshold)`);
    }

    return { score, reason: reasons.join('; ') };
  }

  private evaluateParking(
    destination: Destination,
    nearbyEvents: Event[]
  ): { score: number; reason: string } {
    let score = 0;
    const reasons: string[] = [];

    if (nearbyEvents.length > 0) {
      const largeEvents = nearbyEvents.filter(e => e.expected_attendance && e.expected_attendance > 5000);
      if (largeEvents.length > 0) {
        score += 50;
        reasons.push(`${largeEvents.length} large event(s) nearby with >5,000 attendees`);
      }
    }

    switch (destination.typical_parking_difficulty?.toLowerCase()) {
      case 'high':
        score += 30;
        reasons.push('Area typically has high parking difficulty');
        break;
      case 'medium':
        score += 15;
        reasons.push('Area typically has medium parking difficulty');
        break;
      case 'low':
        score -= 10;
        reasons.push('Area typically has low parking difficulty');
        break;
    }

    if (destination.has_parking_garage) {
      score -= 15;
      reasons.push('Parking garage available');
    }

    return { score, reason: reasons.join('; ') };
  }

  private evaluateHomeStatus(
    homeStatus: HomeStatus | null
  ): { score: number; reason: string } {
    let score = 0;
    const reasons: string[] = [];

    if (homeStatus?.ev_charge_percentage !== undefined) {
      if (homeStatus.ev_charge_percentage < 20) {
        score += 40;
        reasons.push(`EV charge low at ${homeStatus.ev_charge_percentage}%`);
      } else {
        reasons.push(`EV charged at ${homeStatus.ev_charge_percentage}%`);
      }
    }

    if (homeStatus && !homeStatus.garden_watered) {
      score += 10;
      reasons.push('Garden needs watering - consider staying local');
    }

    return { score, reason: reasons.join('; ') };
  }

  public generateRecommendation(
    destination: Destination,
    nearbyEvents: Event[],
    homeStatus: HomeStatus | null,
    settings: UserSettings,
    weather: Weather,
    distance: number
  ) {
    const factors = {
      weatherScore: 0,
      parkingScore: 0,
      eventScore: 0,
      homeStatusScore: 0,
      distanceScore: 0
    };

    const reasons: string[] = [];

    const weatherEval = this.evaluateWeather(weather.temp, weather.rain_probability, settings);
    factors.weatherScore = weatherEval.score;
    reasons.push(weatherEval.reason);

    const parkingEval = this.evaluateParking(destination, nearbyEvents);
    factors.parkingScore = parkingEval.score;
    reasons.push(parkingEval.reason);

    const homeEval = this.evaluateHomeStatus(homeStatus);
    factors.homeStatusScore = homeEval.score;
    if (homeEval.reason) reasons.push(homeEval.reason);

    if (distance > 0) {
      if (distance > 5) {
        factors.distanceScore += 40;
        reasons.push(`Destination is ${distance.toFixed(1)} miles away - too far to walk`);
      } else if (distance <= settings.max_comfortable_walk_distance) {
        factors.distanceScore -= 20;
        reasons.push(`Destination is only ${distance.toFixed(1)} miles away - walkable`);
      } else {
        // Mid-range: driveable but not too far - slight preference for driving
        factors.distanceScore += 10;
        reasons.push(`Destination is ${distance.toFixed(1)} miles away`);
      }
    }

    // Road closure evaluation
    const roadClosures = nearbyEvents.filter(e => e.is_road_closure);
    if (roadClosures.length > 0) {
      factors.eventScore += 30;
      reasons.push(`${roadClosures.length} road closure(s) in the area - consider rideshare`);
    } else if (nearbyEvents.length > 0) {
      factors.eventScore += 10;
      reasons.push(`${nearbyEvents.length} event(s) nearby may affect travel`);
    }

    const totalScore = 
      factors.weatherScore + 
      factors.parkingScore + 
      factors.eventScore + 
      factors.homeStatusScore + 
      factors.distanceScore;

    let recommendation: 'Walk' | 'Drive' | 'Rideshare';
    let confidence: number;

    if (totalScore > 60) {
      recommendation = 'Rideshare';
      confidence = Math.min(totalScore / 100, 0.95);
    } else if (totalScore > 30) {
      recommendation = 'Drive';
      confidence = Math.min(totalScore / 80, 0.90);
    } else {
      recommendation = 'Walk';
      confidence = Math.min((100 - totalScore) / 100, 0.95);
    }

    return {
      recommendation,
      confidence_score: confidence,
      reasoning: reasons.join('. '),
      weather: {
        temp: weather.temp,
        condition: weather.condition,
        rain_probability: weather.rain_probability
      },
      parking: {
        difficulty: destination.typical_parking_difficulty || 'Unknown',
        estimated_cost: destination.parking_cost_estimate
      },
      nearby_event: nearbyEvents.length > 0 ? {
        name: nearbyEvents[0].name,
        distance: this.calculateDistance(
          settings.home_latitude,
          settings.home_longitude,
          nearbyEvents[0].latitude,
          nearbyEvents[0].longitude
        )
      } : undefined,
      home_status: {
        garden_watered: homeStatus?.garden_watered || false,
        ev_charge: homeStatus?.ev_charge_percentage
      },
      friday_recap: undefined as string | undefined
    };
  }

  public findNearbyEvents(
    destination: Destination,
    events: Event[],
    radiusMiles: number = 1.5
  ): Event[] {
    if (!destination.latitude || !destination.longitude) return [];

    return events.filter(event => {
      if (!event.latitude || !event.longitude) return false;
      const distance = this.calculateDistance(
        destination.latitude,
        destination.longitude,
        event.latitude,
        event.longitude
      );
      return distance <= radiusMiles;
    });
  }
}

const mobilityEngine = new MobilityEngine();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { destination_id, weather } = req.body;

    if (!destination_id) {
      return res.status(400).json({ error: 'destination_id is required' });
    }

    // Get destination
    const destResult = await db.execute({
      sql: 'SELECT * FROM destinations WHERE id = ?',
      args: [destination_id],
    });
    
    if (destResult.rows.length === 0) {
      return res.status(404).json({ error: 'Destination not found' });
    }
    
    const destination = destResult.rows[0] as unknown as Destination;

    // Get user settings
    let settingsResult = await db.execute(
      'SELECT * FROM user_settings ORDER BY id DESC LIMIT 1'
    );
    
    if (settingsResult.rows.length === 0) {
      // Create default settings
      await db.execute({
        sql: `INSERT INTO user_settings 
              (max_comfortable_walk_distance, temperature_drive_threshold_high, 
               temperature_drive_threshold_low, rain_drive_threshold) 
              VALUES (?, ?, ?, ?)`,
        args: [1.5, 30, 5, 40],
      });
      
      settingsResult = await db.execute(
        'SELECT * FROM user_settings ORDER BY id DESC LIMIT 1'
      );
    }
    
    const settings = settingsResult.rows[0] as unknown as UserSettings;

    // Get current/upcoming events
    const now = new Date().toISOString();
    const eventsResult = await db.execute({
      sql: `SELECT * FROM events 
            WHERE start_datetime >= ? OR end_datetime >= ? 
            ORDER BY start_datetime`,
      args: [now, now],
    });
    
    const events = eventsResult.rows as unknown as Event[];

    // Find nearby events
    const nearbyEvents = mobilityEngine.findNearbyEvents(
      destination,
      events,
      settings.max_comfortable_walk_distance
    );

    // Get home status
    const homeResult = await db.execute(
      'SELECT * FROM home_status ORDER BY id DESC LIMIT 1'
    );
    const homeStatus = (homeResult.rows[0] as unknown as HomeStatus) || null;

    // Calculate distance
    let distance = 0;
    if (
      settings?.home_latitude &&
      settings?.home_longitude &&
      destination.latitude &&
      destination.longitude
    ) {
      const R = 3958.8;
      const dLat = (destination.latitude - settings.home_latitude) * (Math.PI / 180);
      const dLon = (destination.longitude - settings.home_longitude) * (Math.PI / 180);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(settings.home_latitude * (Math.PI / 180)) *
        Math.cos(destination.latitude * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      distance = R * c;
    }

    // Generate recommendation
    const recommendation = mobilityEngine.generateRecommendation(
      destination,
      nearbyEvents,
      homeStatus,
      settings,
      weather || { temp: 20, condition: 'Clear', rain_probability: 0 },
      distance
    );

    // Get recent conversation notes for Friday recap
    const notesResult = await db.execute(
      `SELECT * FROM conversation_notes 
       WHERE date_logged >= date('now', '-7 days') 
       ORDER BY date_logged DESC LIMIT 5`
    );

    if (notesResult.rows.length > 0) {
      const recapParts: string[] = [];
      notesResult.rows.forEach((note: Record<string, unknown>) => {
        if (note.contact_name && note.venue_mentioned) {
          recapParts.push(
            `You mentioned wanting to see ${note.contact_name} - they usually prefer ${note.venue_mentioned}`
          );
        } else if (note.emotional_state) {
          recapParts.push(`Recent mood: ${note.emotional_state} - ${note.note_text}`);
        }
      });
      if (recapParts.length > 0) {
        recommendation.friday_recap = recapParts.join('. ');
      }
    }

    // Store recommendation
    await db.execute({
      sql: `INSERT INTO mobility_recommendations 
            (destination_id, recommendation, confidence_score, reasoning, 
             weather_temp, weather_condition, rain_probability, 
             parking_difficulty, estimated_cost) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        destination_id,
        recommendation.recommendation,
        recommendation.confidence_score,
        recommendation.reasoning,
        recommendation.weather.temp,
        recommendation.weather.condition,
        recommendation.weather.rain_probability,
        recommendation.parking.difficulty,
        recommendation.parking.estimated_cost || null,
      ],
    });

    return res.status(200).json(recommendation);
  } catch (error) {
    console.error('Error generating recommendation:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
