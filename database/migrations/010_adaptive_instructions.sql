-- Migration 010: Adaptive Instructions System
-- Adds support for adaptive altitude control and SpO2-based recovery phases
-- for both calibration and training sessions

-- Add adaptive system columns to existing sessions table
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS session_subtype TEXT DEFAULT 'calibration' 
  CHECK (session_subtype IN ('calibration', 'training'));
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS starting_altitude_level INTEGER DEFAULT 6;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS current_altitude_level INTEGER DEFAULT 6 
  CHECK (current_altitude_level >= 0 AND current_altitude_level <= 10);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS adaptive_system_enabled BOOLEAN DEFAULT true;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS total_mask_lifts INTEGER DEFAULT 0;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS total_altitude_adjustments INTEGER DEFAULT 0;

-- Session adaptive events tracking
CREATE TABLE IF NOT EXISTS session_adaptive_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('mask_lift', 'dial_adjustment', 'recovery_complete', 'altitude_phase_complete')),
  event_timestamp TIMESTAMPTZ NOT NULL,
  altitude_phase_number INTEGER,
  recovery_phase_number INTEGER,
  current_altitude_level INTEGER,
  spo2_value INTEGER,
  additional_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_phase_number CHECK (
    (altitude_phase_number IS NOT NULL AND recovery_phase_number IS NULL) OR
    (altitude_phase_number IS NULL AND recovery_phase_number IS NOT NULL) OR
    (altitude_phase_number IS NULL AND recovery_phase_number IS NULL)
  )
);

-- Phase-level statistics for detailed tracking
CREATE TABLE IF NOT EXISTS session_phase_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  phase_type TEXT NOT NULL CHECK (phase_type IN ('altitude', 'recovery')),
  phase_number INTEGER NOT NULL,
  altitude_level INTEGER NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  duration_seconds INTEGER,
  
  -- SpO2 statistics for the phase
  min_spo2 INTEGER,
  max_spo2 INTEGER,
  avg_spo2 REAL,
  spo2_readings_count INTEGER DEFAULT 0,
  
  -- Adaptive behavior tracking
  mask_lift_count INTEGER DEFAULT 0,
  target_min_spo2 INTEGER NOT NULL, -- Target range minimum for this session type
  target_max_spo2 INTEGER NOT NULL, -- Target range maximum for this session type
  
  -- Recovery phase specific data
  recovery_trigger TEXT CHECK (recovery_trigger IN ('spo2_stabilized', 'time_limit', 'manual')), -- How recovery phase ended
  time_to_95_percent_seconds INTEGER, -- How long it took to reach 95% SpO2
  time_above_95_percent_seconds INTEGER, -- How long SpO2 stayed above 95%
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure end_time is after start_time
  CONSTRAINT valid_phase_duration CHECK (end_time IS NULL OR end_time >= start_time)
);

-- Altitude level reference table (for UI display)
CREATE TABLE IF NOT EXISTS altitude_levels (
  level INTEGER PRIMARY KEY CHECK (level >= 0 AND level <= 10),
  oxygen_percentage DECIMAL(3,1) NOT NULL,
  equivalent_altitude_feet INTEGER NOT NULL,
  equivalent_altitude_meters INTEGER NOT NULL,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert altitude level reference data
INSERT INTO altitude_levels (level, oxygen_percentage, equivalent_altitude_feet, equivalent_altitude_meters, display_name) VALUES
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
  (10, 9.0, 26500, 8077, '~26,500 ft / 8,077 m')
ON CONFLICT (level) DO UPDATE SET
  oxygen_percentage = EXCLUDED.oxygen_percentage,
  equivalent_altitude_feet = EXCLUDED.equivalent_altitude_feet,
  equivalent_altitude_meters = EXCLUDED.equivalent_altitude_meters,
  display_name = EXCLUDED.display_name;

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_session_adaptive_events_session_id ON session_adaptive_events(session_id);
CREATE INDEX IF NOT EXISTS idx_session_adaptive_events_type ON session_adaptive_events(event_type);
CREATE INDEX IF NOT EXISTS idx_session_adaptive_events_timestamp ON session_adaptive_events(event_timestamp);
CREATE INDEX IF NOT EXISTS idx_session_phase_stats_session_id ON session_phase_stats(session_id);
CREATE INDEX IF NOT EXISTS idx_session_phase_stats_phase_type ON session_phase_stats(phase_type);
CREATE INDEX IF NOT EXISTS idx_session_phase_stats_phase_number ON session_phase_stats(phase_number);
CREATE INDEX IF NOT EXISTS idx_sessions_subtype ON sessions(session_subtype);
CREATE INDEX IF NOT EXISTS idx_sessions_adaptive_enabled ON sessions(adaptive_system_enabled);

-- Add RLS policies for new tables
ALTER TABLE session_adaptive_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_phase_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE altitude_levels ENABLE ROW LEVEL SECURITY;

-- RLS Policies (matching existing sessions table pattern)
-- Note: These will need to be adjusted based on your existing RLS setup
CREATE POLICY "Users can view their own session events" ON session_adaptive_events
  FOR SELECT USING (
    session_id IN (
      SELECT id FROM sessions WHERE device_id = current_setting('app.device_id', true)
    )
  );

CREATE POLICY "Users can insert their own session events" ON session_adaptive_events
  FOR INSERT WITH CHECK (
    session_id IN (
      SELECT id FROM sessions WHERE device_id = current_setting('app.device_id', true)
    )
  );

CREATE POLICY "Users can view their own phase stats" ON session_phase_stats
  FOR SELECT USING (
    session_id IN (
      SELECT id FROM sessions WHERE device_id = current_setting('app.device_id', true)
    )
  );

CREATE POLICY "Users can insert their own phase stats" ON session_phase_stats
  FOR INSERT WITH CHECK (
    session_id IN (
      SELECT id FROM sessions WHERE device_id = current_setting('app.device_id', true)
    )
  );

-- Altitude levels are read-only for all users
CREATE POLICY "All users can view altitude levels" ON altitude_levels
  FOR SELECT USING (true);

-- Comments for documentation
COMMENT ON TABLE session_adaptive_events IS 'Tracks all adaptive instruction events during IHHT sessions';
COMMENT ON TABLE session_phase_stats IS 'Detailed statistics for each altitude and recovery phase';
COMMENT ON TABLE altitude_levels IS 'Reference table for altitude level display information';
COMMENT ON COLUMN sessions.session_subtype IS 'Calibration (first session) or training session type';
COMMENT ON COLUMN sessions.starting_altitude_level IS 'Altitude level user started the session with';
COMMENT ON COLUMN sessions.current_altitude_level IS 'Current altitude level (may change during session)';
COMMENT ON COLUMN sessions.adaptive_system_enabled IS 'Whether adaptive instructions are enabled for this session';
