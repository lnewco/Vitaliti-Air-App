-- Onboarding Database Schema
-- This schema supports the new user onboarding flow

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables if they exist (clean slate)
DROP TABLE IF EXISTS health_eligibility CASCADE;
DROP TABLE IF EXISTS user_consents CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;

-- User profiles table to store basic information
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  full_name TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('male', 'female', 'prefer_not_to_say')),
  onboarding_completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one profile per user
  UNIQUE(user_id)
);

-- Legal consent tracking table
CREATE TABLE user_consents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  research_consent BOOLEAN NOT NULL DEFAULT FALSE,
  liability_waiver BOOLEAN NOT NULL DEFAULT FALSE,
  consented_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one consent record per user
  UNIQUE(user_id)
);

-- Health eligibility screening table
CREATE TABLE health_eligibility (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  has_conditions BOOLEAN NOT NULL,
  conditions_list TEXT[], -- Array to store specific conditions if needed
  screened_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one screening per user
  UNIQUE(user_id)
);

-- Create indexes for better performance
CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX idx_user_consents_user_id ON user_consents(user_id);
CREATE INDEX idx_health_eligibility_user_id ON health_eligibility(user_id);
CREATE INDEX idx_user_profiles_onboarding_completed ON user_profiles(onboarding_completed_at);

-- Row Level Security (RLS) Policies
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_eligibility ENABLE ROW LEVEL SECURITY;

-- User profiles policies
CREATE POLICY "Users can view their own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- User consents policies  
CREATE POLICY "Users can view their own consents" ON user_consents
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own consents" ON user_consents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own consents" ON user_consents
  FOR UPDATE USING (auth.uid() = user_id);

-- Health eligibility policies
CREATE POLICY "Users can view their own health eligibility" ON health_eligibility
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own health eligibility" ON health_eligibility
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own health eligibility" ON health_eligibility
  FOR UPDATE USING (auth.uid() = user_id);

-- Function to check if user has completed onboarding
CREATE OR REPLACE FUNCTION user_has_completed_onboarding(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM user_profiles 
    WHERE user_id = user_uuid 
    AND onboarding_completed_at IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark onboarding as complete
CREATE OR REPLACE FUNCTION complete_user_onboarding(user_uuid UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE user_profiles 
  SET onboarding_completed_at = NOW(),
      updated_at = NOW()
  WHERE user_id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_profiles_updated_at 
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Sample data validation constraints
ALTER TABLE user_profiles 
ADD CONSTRAINT valid_full_name 
CHECK (length(trim(full_name)) >= 2);

ALTER TABLE user_profiles 
ADD CONSTRAINT valid_date_of_birth 
CHECK (date_of_birth <= CURRENT_DATE AND date_of_birth >= '1900-01-01');

-- Comments for documentation
COMMENT ON TABLE user_profiles IS 'Stores user basic information collected during onboarding';
COMMENT ON TABLE user_consents IS 'Tracks legal consent agreements for research and liability';
COMMENT ON TABLE health_eligibility IS 'Records health screening results for IHHT safety';
COMMENT ON FUNCTION user_has_completed_onboarding IS 'Check if user has completed the onboarding process';
COMMENT ON FUNCTION complete_user_onboarding IS 'Mark user onboarding as complete with timestamp'; 