-- Migration 001: Initial Schema
-- Creates base tables for sessions and readings
-- Safe to run multiple times (idempotent)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Sessions table: Stores IHHT training sessions
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id TEXT NOT NULL,
  local_session_id TEXT, -- For mapping local SQLite sessions
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active', -- active, completed, terminated
  
  -- Session statistics
  total_readings INTEGER DEFAULT 0,
  avg_spo2 REAL,
  min_spo2 INTEGER,
  max_spo2 INTEGER,
  avg_heart_rate REAL,
  min_heart_rate INTEGER,
  max_heart_rate INTEGER,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Readings table: Stores individual sensor readings
CREATE TABLE IF NOT EXISTS readings (
  id BIGSERIAL PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ NOT NULL,
  
  -- Sensor data
  spo2 INTEGER,
  heart_rate INTEGER,
  signal_strength INTEGER,
  is_valid BOOLEAN DEFAULT TRUE,
  
  -- Phase tracking (for IHHT protocol)
  phase TEXT, -- HYPOXIC, HYPEROXIC
  cycle_number INTEGER,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_sessions_device_id ON sessions(device_id);
CREATE INDEX IF NOT EXISTS idx_sessions_local_id ON sessions(local_session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_start_time ON sessions(start_time DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_readings_session_id ON readings(session_id);
CREATE INDEX IF NOT EXISTS idx_readings_timestamp ON readings(timestamp);
CREATE INDEX IF NOT EXISTS idx_readings_valid ON readings(is_valid) WHERE is_valid = TRUE;

-- Enable Row Level Security
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE readings ENABLE ROW LEVEL SECURITY;

-- Temporary policies (will be updated in security migration)
CREATE POLICY IF NOT EXISTS "Temporary allow all on sessions" ON sessions FOR ALL USING (true);
CREATE POLICY IF NOT EXISTS "Temporary allow all on readings" ON readings FOR ALL USING (true);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for auto-updating updated_at
DROP TRIGGER IF EXISTS update_sessions_updated_at ON sessions;
CREATE TRIGGER update_sessions_updated_at 
    BEFORE UPDATE ON sessions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- View for session summaries with statistics
CREATE OR REPLACE VIEW session_summary AS
SELECT 
  s.*,
  COUNT(r.id) as reading_count,
  COUNT(CASE WHEN r.is_valid THEN 1 END) as valid_reading_count,
  MIN(r.timestamp) as first_reading,
  MAX(r.timestamp) as last_reading,
  EXTRACT(EPOCH FROM (s.end_time - s.start_time))/60 as duration_minutes
FROM sessions s
LEFT JOIN readings r ON s.id = r.session_id
GROUP BY s.id;