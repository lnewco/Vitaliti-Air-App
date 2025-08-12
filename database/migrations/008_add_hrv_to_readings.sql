-- Add HRV (Heart Rate Variability) column to readings table
-- This stores the RMSSD value for each reading during the session
ALTER TABLE readings 
  ADD COLUMN IF NOT EXISTS hrv_rmssd REAL;

-- Add index for HRV queries and analysis
CREATE INDEX IF NOT EXISTS idx_readings_hrv ON readings(hrv_rmssd) 
  WHERE hrv_rmssd IS NOT NULL;

-- Add composite index for session HRV analysis
CREATE INDEX IF NOT EXISTS idx_readings_session_hrv ON readings(session_id, timestamp, hrv_rmssd) 
  WHERE hrv_rmssd IS NOT NULL;

-- Documentation:
-- hrv_rmssd: Root Mean Square of Successive Differences (RMSSD) in milliseconds
-- This is the primary time-domain measure of HRV
-- Normal range is typically 20-100ms, higher values indicate better HRV