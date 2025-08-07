-- Phone Authentication Schema for Vitaliti Air App
-- Run this in Supabase SQL Editor after setting up SMS authentication

-- 1. Create user_profiles table to store additional user information
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number TEXT UNIQUE,
  first_name TEXT,
  last_name TEXT,
  date_of_birth DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add user_id columns to existing tables to link data to authenticated users
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE readings ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- 3. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_phone ON user_profiles(phone_number);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_readings_user_id ON readings(user_id);

-- 4. Update RLS policies to ensure users can only access their own data
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow all operations on sessions" ON sessions;
DROP POLICY IF EXISTS "Allow all operations on readings" ON readings;

-- Sessions policies - users can only access their own sessions
CREATE POLICY "Users can view own sessions" ON sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions" ON sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions" ON sessions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions" ON sessions
  FOR DELETE USING (auth.uid() = user_id);

-- Readings policies - users can only access readings from their sessions
CREATE POLICY "Users can view own readings" ON readings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own readings" ON readings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own readings" ON readings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own readings" ON readings
  FOR DELETE USING (auth.uid() = user_id);

-- User profiles policies
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

-- 5. Create function to handle user profile creation on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (id, phone_number)
  VALUES (NEW.id, NEW.phone);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Create trigger to automatically create user profile when user signs up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 7. Create updated view for session summaries with user data
CREATE OR REPLACE VIEW user_session_summary AS
SELECT
  s.*,
  up.phone_number,
  up.first_name,
  up.last_name,
  COUNT(r.id) as reading_count,
  COUNT(CASE WHEN r.is_valid THEN 1 END) as valid_reading_count,
  MIN(r.timestamp) as first_reading,
  MAX(r.timestamp) as last_reading,
  EXTRACT(EPOCH FROM (MAX(r.timestamp) - MIN(r.timestamp)))/60 as duration_minutes
FROM sessions s
LEFT JOIN readings r ON s.id = r.session_id
LEFT JOIN user_profiles up ON s.user_id = up.id
WHERE s.user_id = auth.uid()  -- Only show current user's data
GROUP BY s.id, up.phone_number, up.first_name, up.last_name;

-- 8. Update the updated_at trigger for user_profiles
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 9. Function to migrate anonymous data to authenticated user (optional)
CREATE OR REPLACE FUNCTION migrate_anonymous_data_to_user(user_uuid UUID, device_identifier TEXT)
RETURNS VOID AS $$
BEGIN
  -- Update sessions that match the device identifier
  UPDATE sessions 
  SET user_id = user_uuid 
  WHERE device_id = device_identifier AND user_id IS NULL;
  
  -- Update readings for those sessions
  UPDATE readings 
  SET user_id = user_uuid 
  WHERE session_id IN (
    SELECT id FROM sessions WHERE user_id = user_uuid
  ) AND user_id IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Create function to get user statistics
CREATE OR REPLACE FUNCTION get_user_health_stats(user_uuid UUID DEFAULT auth.uid())
RETURNS TABLE (
  total_sessions INTEGER,
  total_readings INTEGER,
  total_duration_hours NUMERIC,
  avg_spo2 NUMERIC,
  avg_heart_rate NUMERIC,
  last_session_date TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(DISTINCT s.id)::INTEGER as total_sessions,
    COUNT(r.id)::INTEGER as total_readings,
    ROUND(SUM(EXTRACT(EPOCH FROM (s.end_time - s.start_time)))/3600, 2) as total_duration_hours,
    ROUND(AVG(r.spo2), 1) as avg_spo2,
    ROUND(AVG(r.heart_rate), 1) as avg_heart_rate,
    MAX(s.start_time) as last_session_date
  FROM sessions s
  LEFT JOIN readings r ON s.id = r.session_id AND r.is_valid = true
  WHERE s.user_id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 