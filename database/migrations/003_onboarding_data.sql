-- Migration 003: Onboarding Data
-- Stores user onboarding information and consent records

-- Onboarding data table
CREATE TABLE IF NOT EXISTS onboarding_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Basic Information
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  gender TEXT CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say')),
  
  -- Contact Information
  email TEXT,
  phone_number TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  country TEXT DEFAULT 'USA',
  
  -- Health & Safety Information
  height_cm INTEGER,
  weight_kg INTEGER,
  fitness_level TEXT CHECK (fitness_level IN ('sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extremely_active')),
  medical_conditions TEXT[],
  medications TEXT[],
  allergies TEXT[],
  has_cardiovascular_disease BOOLEAN DEFAULT false,
  has_respiratory_disease BOOLEAN DEFAULT false,
  has_diabetes BOOLEAN DEFAULT false,
  has_other_conditions BOOLEAN DEFAULT false,
  other_conditions_details TEXT,
  
  -- Emergency Contact
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  emergency_contact_relationship TEXT,
  
  -- Training Experience
  has_altitude_training_experience BOOLEAN DEFAULT false,
  altitude_training_details TEXT,
  has_ihht_experience BOOLEAN DEFAULT false,
  ihht_experience_details TEXT,
  training_goals TEXT[],
  
  -- Consent & Legal
  consent_given BOOLEAN DEFAULT false,
  consent_timestamp TIMESTAMPTZ,
  consent_version TEXT DEFAULT '1.0',
  data_sharing_consent BOOLEAN DEFAULT false,
  marketing_consent BOOLEAN DEFAULT false,
  
  -- Completion Status
  onboarding_completed BOOLEAN DEFAULT false,
  onboarding_completed_at TIMESTAMPTZ,
  onboarding_step_completed INTEGER DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one record per user
  UNIQUE(user_id)
);

-- Consent audit log (for compliance)
CREATE TABLE IF NOT EXISTS consent_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL, -- 'terms', 'privacy', 'data_sharing', 'marketing'
  action TEXT NOT NULL, -- 'accepted', 'rejected', 'withdrawn'
  consent_version TEXT NOT NULL,
  ip_address INET,
  user_agent TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_onboarding_user_id ON onboarding_data(user_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_completed ON onboarding_data(onboarding_completed);
CREATE INDEX IF NOT EXISTS idx_consent_audit_user_id ON consent_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_consent_audit_timestamp ON consent_audit_log(timestamp DESC);

-- Enable RLS
ALTER TABLE onboarding_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_audit_log ENABLE ROW LEVEL SECURITY;

-- Temporary policies (will be updated in security migration)
CREATE POLICY IF NOT EXISTS "Temporary allow all on onboarding_data" ON onboarding_data FOR ALL USING (true);
CREATE POLICY IF NOT EXISTS "Temporary allow all on consent_audit_log" ON consent_audit_log FOR ALL USING (true);

-- Update trigger for onboarding_data
DROP TRIGGER IF EXISTS update_onboarding_data_updated_at ON onboarding_data;
CREATE TRIGGER update_onboarding_data_updated_at 
    BEFORE UPDATE ON onboarding_data 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();