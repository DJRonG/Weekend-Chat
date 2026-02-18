
CREATE TABLE destinations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  latitude REAL,
  longitude REAL,
  typical_parking_difficulty TEXT,
  has_parking_garage BOOLEAN DEFAULT 0,
  parking_cost_estimate REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  venue_name TEXT,
  latitude REAL,
  longitude REAL,
  start_datetime DATETIME NOT NULL,
  end_datetime DATETIME,
  expected_attendance INTEGER,
  is_road_closure BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE conversation_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  note_text TEXT NOT NULL,
  category TEXT,
  contact_name TEXT,
  venue_mentioned TEXT,
  emotional_state TEXT,
  date_logged DATE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE home_status (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ev_charge_percentage INTEGER,
  garden_watered BOOLEAN DEFAULT 0,
  last_watered_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE mobility_recommendations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  destination_id INTEGER,
  recommendation TEXT NOT NULL,
  confidence_score REAL,
  reasoning TEXT,
  weather_temp REAL,
  weather_condition TEXT,
  rain_probability REAL,
  nearby_event_id INTEGER,
  parking_difficulty TEXT,
  estimated_cost REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  home_latitude REAL,
  home_longitude REAL,
  max_comfortable_walk_distance REAL DEFAULT 1.5,
  temperature_drive_threshold_high REAL DEFAULT 30,
  temperature_drive_threshold_low REAL DEFAULT 5,
  rain_drive_threshold REAL DEFAULT 40,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_events_datetime ON events(start_datetime);
CREATE INDEX idx_conversation_notes_date ON conversation_notes(date_logged);
