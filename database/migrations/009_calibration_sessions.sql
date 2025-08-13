-- Migration 009: Calibration Sessions
-- Adds support for calibration sessions to determine optimal training intensity
-- Calibration finds the intensity level where SpO2 drops to 85% or reaches max level 10

-- Calibration sessions table: Stores calibration session data
CREATE TABLE IF NOT EXISTS calibration_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  local_session_id TEXT, -- For mapping local SQLite sessions
  
  -- Session timing
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  
  -- Session results
  calibration_value INTEGER, -- Final calibration intensity (2-10)
  final_spo2 INTEGER, -- SpO2 value when calibration ended
  final_heart_rate INTEGER, -- Heart rate when calibration ended
  
  -- Session status and termination
  status TEXT NOT NULL DEFAULT 'active', -- active, completed, incomplete
  terminated_reason TEXT, -- spo2_threshold, max_intensity, user_ended, device_disconnected
  total_duration_seconds INTEGER,
  levels_completed INTEGER DEFAULT 0,
  
  -- Statistics
  avg_spo2 REAL,
  min_spo2 INTEGER,
  max_spo2 INTEGER,
  avg_heart_rate REAL,
  min_heart_rate INTEGER,
  max_heart_rate INTEGER,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  synced_at TIMESTAMPTZ -- When synced to Supabase
);

-- Calibration readings table: Stores minute-by-minute calibration data
CREATE TABLE IF NOT EXISTS calibration_readings (
  id BIGSERIAL PRIMARY KEY,
  calibration_session_id UUID NOT NULL REFERENCES calibration_sessions(id) ON DELETE CASCADE,
  
  -- Level data
  intensity_level INTEGER NOT NULL CHECK (intensity_level >= 2 AND intensity_level <= 10),
  minute_number INTEGER NOT NULL, -- Sequential minute counter
  
  -- Timing
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  confirmation_time TIMESTAMPTZ, -- When user confirmed the intensity change
  duration_seconds INTEGER,
  
  -- Sensor data at end of minute
  final_spo2 INTEGER,
  final_heart_rate INTEGER,
  avg_spo2 REAL,
  min_spo2 INTEGER,
  avg_heart_rate REAL,
  
  -- Status
  completed BOOLEAN DEFAULT FALSE,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Update user_profiles table to store calibration value
ALTER TABLE user_profiles 
  ADD COLUMN IF NOT EXISTS current_calibration_value INTEGER CHECK (current_calibration_value >= 2 AND current_calibration_value <= 10),
  ADD COLUMN IF NOT EXISTS last_calibration_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS total_calibrations INTEGER DEFAULT 0;

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_calibration_sessions_user_id ON calibration_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_calibration_sessions_device_id ON calibration_sessions(device_id);
CREATE INDEX IF NOT EXISTS idx_calibration_sessions_local_id ON calibration_sessions(local_session_id);
CREATE INDEX IF NOT EXISTS idx_calibration_sessions_start_time ON calibration_sessions(start_time DESC);
CREATE INDEX IF NOT EXISTS idx_calibration_sessions_status ON calibration_sessions(status);
CREATE INDEX IF NOT EXISTS idx_calibration_readings_session ON calibration_readings(calibration_session_id);
CREATE INDEX IF NOT EXISTS idx_calibration_readings_minute ON calibration_readings(calibration_session_id, minute_number);

-- Enable Row Level Security
ALTER TABLE calibration_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE calibration_readings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for calibration_sessions
CREATE POLICY "Users can view own calibration sessions" ON calibration_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own calibration sessions" ON calibration_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own calibration sessions" ON calibration_sessions
  FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for calibration_readings
CREATE POLICY "Users can view own calibration readings" ON calibration_readings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM calibration_sessions 
      WHERE calibration_sessions.id = calibration_readings.calibration_session_id 
      AND calibration_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own calibration readings" ON calibration_readings
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM calibration_sessions 
      WHERE calibration_sessions.id = calibration_readings.calibration_session_id 
      AND calibration_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own calibration readings" ON calibration_readings
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM calibration_sessions 
      WHERE calibration_sessions.id = calibration_readings.calibration_session_id 
      AND calibration_sessions.user_id = auth.uid()
    )
  );

-- Trigger for auto-updating updated_at on calibration_sessions
DROP TRIGGER IF EXISTS update_calibration_sessions_updated_at ON calibration_sessions;
CREATE TRIGGER update_calibration_sessions_updated_at 
    BEFORE UPDATE ON calibration_sessions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Function to update user profile with latest calibration value
CREATE OR REPLACE FUNCTION update_user_calibration_value()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if calibration was completed successfully with a value
  IF NEW.status = 'completed' AND NEW.calibration_value IS NOT NULL THEN
    UPDATE user_profiles
    SET 
      current_calibration_value = NEW.calibration_value,
      last_calibration_date = NEW.end_time,
      total_calibrations = COALESCE(total_calibrations, 0) + 1
    WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update user profile when calibration completes
DROP TRIGGER IF EXISTS update_user_calibration_on_complete ON calibration_sessions;
CREATE TRIGGER update_user_calibration_on_complete
    AFTER UPDATE ON calibration_sessions
    FOR EACH ROW
    WHEN (OLD.status != 'completed' AND NEW.status = 'completed')
    EXECUTE FUNCTION update_user_calibration_value();

-- View for calibration session summaries
CREATE OR REPLACE VIEW calibration_summary AS
SELECT 
  cs.*,
  up.first_name,
  up.last_name,
  COUNT(cr.id) as total_readings,
  MAX(cr.intensity_level) as max_intensity_reached
FROM calibration_sessions cs
LEFT JOIN user_profiles up ON cs.user_id = up.user_id
LEFT JOIN calibration_readings cr ON cs.id = cr.calibration_session_id
GROUP BY cs.id, up.first_name, up.last_name;

-- Documentation:
-- calibration_value: The intensity level (2-10) where SpO2 reached 85% or max level completed
-- terminated_reason values:
--   'spo2_threshold': SpO2 dropped to 85% or below
--   'max_intensity': Reached level 10 and completed 1 minute
--   'user_ended': User manually ended the session
--   'device_disconnected': Pulse oximeter disconnected
-- intensity_level: Simulated altitude level (2 = lowest, 10 = highest)