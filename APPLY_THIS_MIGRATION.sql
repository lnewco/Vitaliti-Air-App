-- RUN THIS IN SUPABASE SQL EDITOR
-- https://supabase.com/dashboard/project/yhbywcawiothhoqaurgy/sql

-- Add OAuth token storage for Whoop and Oura integrations
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS whoop_access_token TEXT,
ADD COLUMN IF NOT EXISTS whoop_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS whoop_token_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS oura_access_token TEXT,
ADD COLUMN IF NOT EXISTS oura_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS oura_token_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS whoop_connected BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS oura_connected BOOLEAN DEFAULT FALSE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_tokens 
ON user_profiles(user_id) 
WHERE whoop_connected = true OR oura_connected = true;

-- Enable RLS and create policies
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile with tokens" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile tokens" ON user_profiles;

CREATE POLICY "Users can view own profile with tokens" ON user_profiles
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile tokens" ON user_profiles
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

GRANT SELECT, UPDATE ON user_profiles TO authenticated;