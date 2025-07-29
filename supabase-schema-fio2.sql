-- Vitaliti Air App - FiO2 Tracking Schema Update
-- Add FiO2 level tracking and IHHT phase information

-- Add IHHT training fields to sessions table
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS session_type TEXT DEFAULT 'IHHT';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS current_phase TEXT; -- 'HYPOXIC' or 'HYPEROXIC'
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS current_cycle INTEGER DEFAULT 1;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS total_cycles INTEGER DEFAULT 5;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS hypoxic_duration INTEGER DEFAULT 300; -- 5 minutes in seconds
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS hyperoxic_duration INTEGER DEFAULT 120; -- 2 minutes in seconds
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS default_hypoxia_level INTEGER; -- User's chosen hypoxia level for the session

-- Add FiO2 level tracking to readings table
ALTER TABLE readings ADD COLUMN IF NOT EXISTS fio2_level INTEGER; -- 0-10 hypoxia level
ALTER TABLE readings ADD COLUMN IF NOT EXISTS phase_type TEXT; -- 'HYPOXIC' or 'HYPEROXIC'
ALTER TABLE readings ADD COLUMN IF NOT EXISTS cycle_number INTEGER; -- Which cycle this reading belongs to

-- Add indexes for new fields
CREATE INDEX IF NOT EXISTS idx_sessions_session_type ON sessions(session_type);
CREATE INDEX IF NOT EXISTS idx_sessions_current_phase ON sessions(current_phase);
CREATE INDEX IF NOT EXISTS idx_readings_fio2_level ON readings(fio2_level);
CREATE INDEX IF NOT EXISTS idx_readings_phase_type ON readings(phase_type);
CREATE INDEX IF NOT EXISTS idx_readings_cycle_number ON readings(cycle_number);

-- Create a view for FiO2 analysis
CREATE OR REPLACE VIEW session_fio2_analysis AS
SELECT 
  s.id as session_id,
  s.start_time,
  s.end_time,
  s.status,
  s.total_cycles,
  COUNT(r.id) as total_readings,
  COUNT(CASE WHEN r.phase_type = 'HYPOXIC' THEN 1 END) as hypoxic_readings,
  COUNT(CASE WHEN r.phase_type = 'HYPEROXIC' THEN 1 END) as hyperoxic_readings,
  AVG(CASE WHEN r.phase_type = 'HYPOXIC' THEN r.fio2_level END) as avg_hypoxic_fio2,
  MIN(CASE WHEN r.phase_type = 'HYPOXIC' THEN r.fio2_level END) as min_hypoxic_fio2,
  MAX(CASE WHEN r.phase_type = 'HYPOXIC' THEN r.fio2_level END) as max_hypoxic_fio2,
  ARRAY_AGG(DISTINCT r.cycle_number ORDER BY r.cycle_number) as cycles_completed
FROM sessions s
LEFT JOIN readings r ON s.id = r.session_id
WHERE s.session_type = 'IHHT'
GROUP BY s.id, s.start_time, s.end_time, s.status, s.total_cycles;

-- Create a view for FiO2 time series data (for graphing)
CREATE OR REPLACE VIEW session_fio2_timeseries AS
SELECT 
  r.session_id,
  r.timestamp,
  r.fio2_level,
  r.phase_type,
  r.cycle_number,
  r.spo2,
  r.heart_rate,
  r.is_valid,
  EXTRACT(EPOCH FROM (r.timestamp - s.start_time)) as seconds_from_start
FROM readings r
JOIN sessions s ON r.session_id = s.id
WHERE r.fio2_level IS NOT NULL
ORDER BY r.session_id, r.timestamp;

-- Add comment to document the FiO2 level scale
COMMENT ON COLUMN readings.fio2_level IS 'Hypoxia level from 0-10 where 0 = high oxygen (hyperoxic), 10 = low oxygen (most hypoxic)';
COMMENT ON COLUMN readings.phase_type IS 'IHHT phase type: HYPOXIC (breathing low oxygen) or HYPEROXIC (breathing high oxygen)'; 