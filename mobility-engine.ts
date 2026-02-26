import { MobilityRecommendation, Event, Destination, HomeStatus, UserSettings } from '@/shared/types';

interface MobilityFactors {
  weatherScore: number;
  parkingScore: number;
  eventScore: number;
  homeStatusScore: number;
  distanceScore: number;
}

export class MobilityEngine {
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

    // High traffic events increase parking difficulty
    if (nearbyEvents.length > 0) {
      const largeEvents = nearbyEvents.filter(e => e.expected_attendance && e.expected_attendance > 5000);
      if (largeEvents.length > 0) {
        score += 50;
        reasons.push(`${largeEvents.length} large event(s) nearby with >5,000 attendees`);
      }
    }

    // Base parking difficulty
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
    weather: { temp: number; condition: string; rain_probability: number },
    distance: number
  ): MobilityRecommendation {
    const factors: MobilityFactors = {
      weatherScore: 0,
      parkingScore: 0,
      eventScore: 0,
      homeStatusScore: 0,
      distanceScore: 0
    };

    const reasons: string[] = [];

    // Weather evaluation
    const weatherEval = this.evaluateWeather(weather.temp, weather.rain_probability, settings);
    factors.weatherScore = weatherEval.score;
    reasons.push(weatherEval.reason);

    // Parking evaluation
    const parkingEval = this.evaluateParking(destination, nearbyEvents);
    factors.parkingScore = parkingEval.score;
    reasons.push(parkingEval.reason);

    // Home status evaluation
    const homeEval = this.evaluateHomeStatus(homeStatus);
    factors.homeStatusScore = homeEval.score;
    if (homeEval.reason) reasons.push(homeEval.reason);

    // Distance evaluation
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

    // Calculate total score
    const totalScore = 
      factors.weatherScore + 
      factors.parkingScore + 
      factors.eventScore + 
      factors.homeStatusScore + 
      factors.distanceScore;

    // Determine recommendation
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
      }
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
