export interface Destination {
  id: number;
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
  typical_parking_difficulty?: string;
  has_parking_garage?: boolean;
  parking_cost_estimate?: number;
}

export interface Event {
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

export interface HomeStatus {
  id: number;
  ev_charge_percentage?: number;
  garden_watered?: boolean;
  last_watered_at?: string;
}

export interface UserSettings {
  id: number;
  home_latitude?: number;
  home_longitude?: number;
  max_comfortable_walk_distance: number;
  temperature_drive_threshold_high: number;
  temperature_drive_threshold_low: number;
  rain_drive_threshold: number;
}

export interface ConversationNote {
  id: number;
  note_text: string;
  category?: string;
  contact_name?: string;
  venue_mentioned?: string;
  emotional_state?: string;
  date_logged?: string;
}

export interface MobilityRecommendation {
  recommendation: 'Walk' | 'Drive' | 'Rideshare';
  confidence_score: number;
  reasoning: string;
  weather: {
    temp: number;
    condition: string;
    rain_probability: number;
  };
  parking: {
    difficulty: string;
    estimated_cost?: number;
  };
  nearby_event?: {
    name: string;
    distance: number;
  };
  home_status: {
    garden_watered: boolean;
    ev_charge?: number;
  };
  friday_recap?: string;
}
