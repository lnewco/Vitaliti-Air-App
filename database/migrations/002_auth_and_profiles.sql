-- Migration 002: Authentication and User Profiles
-- Adds user authentication support and profile management
-- Requires Supabase Auth to be configured with phone authentication

-- User profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number TEXT UNIQUE,
  first_name TEXT,
  last_name TEXT,
  date_of_birth DATE,
  
  -- Medical/training info
  training_experience TEXT, -- beginner, intermediate, advanced
  medical_conditions TEXT[],
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  
  -- Preferences
  preferred_hypoxia_level INTEGER DEFAULT 5,
  notification_preferences JSONB DEFAULT '{"session_reminders": true, "progress_updates": true}'::jsonb,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add user_id columns to link data to authenticated users
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE readings ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Indexes for user lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_phone ON user_profiles(phone_number);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_readings_user_id ON readings(user_id);

-- Enable RLS on user_profiles
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Temporary policy for user_profiles (will be updated in security migration)
CREATE POLICY IF NOT EXISTS "Temporary allow all on user_profiles" ON user_profiles FOR ALL USING (true);

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (id, phone_number, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.phone,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Update trigger for user_profiles
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at 
    BEFORE UPDATE ON user_profiles 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();