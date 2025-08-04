-- Add total session duration column for easier querying
ALTER TABLE sessions 
ADD COLUMN total_duration_seconds INTEGER;

-- Add index for performance
CREATE INDEX idx_sessions_duration ON sessions(total_duration_seconds) WHERE total_duration_seconds IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN sessions.total_duration_seconds IS 'Total session duration in seconds (calculated from end_time - start_time)';

-- Update existing completed sessions with calculated duration
UPDATE sessions 
SET total_duration_seconds = EXTRACT(EPOCH FROM (end_time - start_time))::INTEGER
WHERE end_time IS NOT NULL AND total_duration_seconds IS NULL; 