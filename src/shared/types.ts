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
  updated_at?: string;
}

export interface UserSettings {
  id: number;
  home_latitude?: number;
  home_longitude?: number;
  max_comfortable_walk_distance: number;
  temperature_drive_threshold_high: number;
  temperature_drive_threshold_low: number;
  rain_drive_threshold: number;
  updated_at?: string;
}

export interface ConversationNote {
  id: number;
  note_text: string;
  category?: string;
  contact_name?: string;
  venue_mentioned?: string;
  emotional_state?: string;
  date_logged: string;
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
  ai_reasoning?: string;
  alternatives?: AlternativeDestination[];
}

export interface AlternativeDestination {
  name: string;
  reason: string;
  confidence: number;
}

export interface Weather {
  temp: number;
  condition: string;
  rain_probability: number;
}

// Analytics types
export interface AnalyticsEvent {
  id?: string;
  event_type: 'recommendation_viewed' | 'destination_clicked' | 'recommendation_accepted' | 'recommendation_rejected' | 'page_view' | 'user_action';
  destination_id?: number;
  destination_name?: string;
  recommendation_type?: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
  session_id: string;
}

export interface TimeRange {
  start: string;
  end: string;
}

export interface Metrics {
  acceptance_rate: number;
  total_recommendations: number;
  accepted: number;
  rejected: number;
  by_type: Record<string, { accepted: number; rejected: number; rate: number }>;
  popular_destinations: Array<{ name: string; visits: number }>;
  peak_hours: Array<{ hour: number; count: number }>;
}

export interface BehaviorAnalysis {
  user_id: string;
  preferred_destination_types: string[];
  typical_session_duration: number;
  acceptance_rate: number;
  most_visited: string[];
}

// Journey types
export interface JourneyDecision {
  id: string;
  type: 'destination_selected' | 'recommendation_viewed' | 'accepted' | 'rejected' | 'alternative_viewed';
  destination_id?: number;
  destination_name?: string;
  recommendation?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

// AI types
export interface RecommendationContext {
  destination: Destination;
  weather: Weather;
  homeStatus: HomeStatus | null;
  userPreferences: {
    max_walk_distance: number;
    temp_threshold_high: number;
    temp_threshold_low: number;
    rain_threshold: number;
  };
  recentDecisions: JourneyDecision[];
  currentTime: string;
  dayOfWeek: string;
}

export interface MobilityData {
  destination: Destination;
  weather: Weather;
  distance: number;
  evCharge?: number;
  nearbyEvents: Event[];
}

export interface Analysis {
  recommendation: string;
  reasoning: string;
  confidence: number;
  factors: string[];
}
