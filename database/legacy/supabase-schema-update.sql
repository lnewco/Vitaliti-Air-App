-- Update to add local_session_id field
-- Run this in Supabase SQL Editor

-- Add local_session_id column to sessions table
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS local_session_id TEXT;

-- Create index for local_session_id lookups
CREATE INDEX IF NOT EXISTS idx_sessions_local_id ON sessions(local_session_id);

-- Update the readings table to use local_session_id for lookups
-- We'll handle this in the app code by mapping local to Supabase UUIDs 