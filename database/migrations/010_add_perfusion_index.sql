-- Migration: Add Perfusion Index (PI) columns to sessions and readings tables
-- Purpose: Track perfusion index data from pulse oximeter for better monitoring

-- Add PI columns to sessions table for aggregate statistics
ALTER TABLE sessions 
ADD COLUMN IF NOT EXISTS avg_perfusion_index REAL,
ADD COLUMN IF NOT EXISTS min_perfusion_index REAL,
ADD COLUMN IF NOT EXISTS max_perfusion_index REAL;

-- Add PI column to readings table for individual measurements
ALTER TABLE readings 
ADD COLUMN IF NOT EXISTS perfusion_index REAL;

-- Add comments to document the columns
COMMENT ON COLUMN sessions.avg_perfusion_index IS 'Average Perfusion Index across all valid readings in the session (0-20% scale)';
COMMENT ON COLUMN sessions.min_perfusion_index IS 'Minimum Perfusion Index recorded during the session';
COMMENT ON COLUMN sessions.max_perfusion_index IS 'Maximum Perfusion Index recorded during the session';
COMMENT ON COLUMN readings.perfusion_index IS 'Perfusion Index value from pulse oximeter (0-20% scale)';

-- Update the insert_readings_with_device_id function to handle perfusion_index
-- This function is used for batch inserting readings with proper device_id
CREATE OR REPLACE FUNCTION insert_readings_with_device_id(
  device_id_value TEXT,
  readings_data JSONB
)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  -- Set the device_id for this transaction
  PERFORM set_config('app.device_id', device_id_value, true);
  
  -- Insert readings with the perfusion_index field
  WITH inserted AS (
    INSERT INTO readings (
      session_id,
      user_id,
      timestamp,
      spo2,
      heart_rate,
      perfusion_index,
      signal_strength,
      is_valid,
      fio2_level,
      phase_type,
      cycle_number,
      hrv_rmssd,
      hrv_type,
      hrv_interval_count,
      hrv_data_quality,
      hrv_confidence,
      created_at
    )
    SELECT 
      (elem->>'session_id')::uuid,
      (elem->>'user_id')::uuid,
      (elem->>'timestamp')::timestamptz,
      (elem->>'spo2')::integer,
      (elem->>'heart_rate')::integer,
      (elem->>'perfusion_index')::real,
      (elem->>'signal_strength')::integer,
      (elem->>'is_valid')::boolean,
      (elem->>'fio2_level')::integer,
      elem->>'phase_type',
      (elem->>'cycle_number')::integer,
      (elem->>'hrv_rmssd')::real,
      elem->>'hrv_type',
      (elem->>'hrv_interval_count')::integer,
      elem->>'hrv_data_quality',
      (elem->>'hrv_confidence')::real,
      (elem->>'created_at')::timestamptz
    FROM jsonb_array_elements(readings_data) AS elem
    RETURNING *
  )
  SELECT jsonb_agg(row_to_json(inserted.*)) INTO result FROM inserted;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION insert_readings_with_device_id(TEXT, JSONB) TO authenticated;