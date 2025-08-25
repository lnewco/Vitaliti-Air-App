-- Local SQLite Migration 010: Adaptive Instructions System
-- Adds support for adaptive altitude control and SpO2-based recovery phases
-- for both calibration and training sessions

-- Add adaptive system columns to existing sessions table
ALTER TABLE sessions ADD COLUMN session_subtype TEXT DEFAULT 'calibration' 
  CHECK (session_subtype IN ('calibration', 'training'));
ALTER TABLE sessions ADD COLUMN starting_altitude_level INTEGER DEFAULT 6;
ALTER TABLE sessions ADD COLUMN current_altitude_level INTEGER DEFAULT 6;
ALTER TABLE sessions ADD COLUMN adaptive_system_enabled INTEGER DEFAULT 1; -- SQLite uses INTEGER for BOOLEAN
ALTER TABLE sessions ADD COLUMN total_mask_lifts INTEGER DEFAULT 0;
ALTER TABLE sessions ADD COLUMN total_altitude_adjustments INTEGER DEFAULT 0;

-- Session adaptive events tracking
CREATE TABLE IF NOT EXISTS session_adaptive_events (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))), -- SQLite UUID alternative
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('mask_lift', 'dial_adjustment', 'recovery_complete', 'altitude_phase_complete')),
  event_timestamp INTEGER NOT NULL, -- SQLite uses INTEGER for timestamps
  altitude_phase_number INTEGER,
  recovery_phase_number INTEGER,
  current_altitude_level INTEGER,
  spo2_value INTEGER,
  additional_data TEXT DEFAULT '{}', -- SQLite uses TEXT for JSON
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Phase-level statistics for detailed tracking
CREATE TABLE IF NOT EXISTS session_phase_stats (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  phase_type TEXT NOT NULL CHECK (phase_type IN ('altitude', 'recovery')),
  phase_number INTEGER NOT NULL,
  altitude_level INTEGER NOT NULL,
  start_time INTEGER NOT NULL, -- Unix timestamp
  end_time INTEGER,
  duration_seconds INTEGER,
  
  -- SpO2 statistics for the phase
  min_spo2 INTEGER,
  max_spo2 INTEGER,
  avg_spo2 REAL,
  spo2_readings_count INTEGER DEFAULT 0,
  
  -- Adaptive behavior tracking
  mask_lift_count INTEGER DEFAULT 0,
  target_min_spo2 INTEGER NOT NULL,
  target_max_spo2 INTEGER NOT NULL,
  
  -- Recovery phase specific data
  recovery_trigger TEXT CHECK (recovery_trigger IN ('spo2_stabilized', 'time_limit', 'manual')),
  time_to_95_percent_seconds INTEGER,
  time_above_95_percent_seconds INTEGER,
  
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Altitude level reference table (for UI display)
CREATE TABLE IF NOT EXISTS altitude_levels (
  level INTEGER PRIMARY KEY CHECK (level >= 0 AND level <= 10),
  oxygen_percentage REAL NOT NULL,
  equivalent_altitude_feet INTEGER NOT NULL,
  equivalent_altitude_meters INTEGER NOT NULL,
  display_name TEXT NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Insert altitude level reference data
INSERT OR REPLACE INTO altitude_levels (level, oxygen_percentage, equivalent_altitude_feet, equivalent_altitude_meters, display_name) VALUES
  (0, 18.0, 4000, 1219, '~4,000 ft / 1,219 m'),
  (1, 17.1, 5500, 1676, '~5,500 ft / 1,676 m'),
  (2, 16.2, 7500, 2286, '~7,500 ft / 2,286 m'),
  (3, 15.3, 9500, 2896, '~9,500 ft / 2,896 m'),
  (4, 14.4, 11500, 3505, '~11,500 ft / 3,505 m'),
  (5, 13.5, 13500, 4115, '~13,500 ft / 4,115 m'),
  (6, 12.6, 15500, 4724, '~15,500 ft / 4,724 m'),
  (7, 11.7, 18000, 5486, '~18,000 ft / 5,486 m'),
  (8, 10.8, 20500, 6248, '~20,500 ft / 6,248 m'),
  (9, 9.9, 23000, 7010, '~23,000 ft / 7,010 m'),
  (10, 9.0, 26500, 8077, '~26,500 ft / 8,077 m');

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_session_adaptive_events_session_id ON session_adaptive_events(session_id);
CREATE INDEX IF NOT EXISTS idx_session_adaptive_events_type ON session_adaptive_events(event_type);
CREATE INDEX IF NOT EXISTS idx_session_adaptive_events_timestamp ON session_adaptive_events(event_timestamp);
CREATE INDEX IF NOT EXISTS idx_session_phase_stats_session_id ON session_phase_stats(session_id);
CREATE INDEX IF NOT EXISTS idx_session_phase_stats_phase_type ON session_phase_stats(phase_type);
CREATE INDEX IF NOT EXISTS idx_session_phase_stats_phase_number ON session_phase_stats(phase_number);
CREATE INDEX IF NOT EXISTS idx_sessions_subtype ON sessions(session_subtype);
CREATE INDEX IF NOT EXISTS idx_sessions_adaptive_enabled ON sessions(adaptive_system_enabled);
