-- Add OAuth token storage for Whoop and Oura integrations
-- This enables persistent API connections that survive app restarts

-- Add OAuth token columns to user_profiles
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS whoop_access_token TEXT,
ADD COLUMN IF NOT EXISTS whoop_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS whoop_token_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS oura_access_token TEXT,
ADD COLUMN IF NOT EXISTS oura_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS oura_token_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS whoop_connected BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS oura_connected BOOLEAN DEFAULT FALSE;

-- Create index for faster lookups of connected users
CREATE INDEX IF NOT EXISTS idx_user_profiles_tokens 
ON user_profiles(user_id) 
WHERE whoop_connected = true OR oura_connected = true;

-- Add RLS policies for token columns (users can only see/update their own)
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Users can view own profile with tokens" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile tokens" ON user_profiles;

-- Create new policies
CREATE POLICY "Users can view own profile with tokens" ON user_profiles
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile tokens" ON user_profiles
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Grant necessary permissions
GRANT SELECT, UPDATE ON user_profiles TO authenticated;

-- Add comment for documentation
COMMENT ON COLUMN user_profiles.whoop_access_token IS 'Encrypted Whoop API access token';
COMMENT ON COLUMN user_profiles.whoop_refresh_token IS 'Encrypted Whoop API refresh token';
COMMENT ON COLUMN user_profiles.whoop_token_expires_at IS 'Whoop token expiration timestamp';
COMMENT ON COLUMN user_profiles.oura_access_token IS 'Encrypted Oura API access token';
COMMENT ON COLUMN user_profiles.oura_refresh_token IS 'Encrypted Oura API refresh token';  
COMMENT ON COLUMN user_profiles.oura_token_expires_at IS 'Oura token expiration timestamp';
COMMENT ON COLUMN user_profiles.whoop_connected IS 'Whether Whoop is currently connected';
COMMENT ON COLUMN user_profiles.oura_connected IS 'Whether Oura is currently connected';