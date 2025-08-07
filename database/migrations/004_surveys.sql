-- Migration 004: Pre and Post Session Surveys
-- Stores survey responses for session quality tracking

-- Survey responses table
CREATE TABLE IF NOT EXISTS survey_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  survey_type TEXT NOT NULL CHECK (survey_type IN ('pre_session', 'post_session')),
  
  -- Pre-session survey fields
  current_stress_level INTEGER CHECK (current_stress_level BETWEEN 1 AND 10),
  sleep_quality INTEGER CHECK (sleep_quality BETWEEN 1 AND 10),
  energy_level INTEGER CHECK (energy_level BETWEEN 1 AND 10),
  physical_readiness INTEGER CHECK (physical_readiness BETWEEN 1 AND 10),
  mental_clarity INTEGER CHECK (mental_clarity BETWEEN 1 AND 10),
  hydration_level INTEGER CHECK (hydration_level BETWEEN 1 AND 10),
  last_meal_time TIMESTAMPTZ,
  pre_session_notes TEXT,
  
  -- Post-session survey fields
  session_difficulty INTEGER CHECK (session_difficulty BETWEEN 1 AND 10),
  perceived_benefit INTEGER CHECK (perceived_benefit BETWEEN 1 AND 10),
  comfort_level INTEGER CHECK (comfort_level BETWEEN 1 AND 10),
  breathlessness_level INTEGER CHECK (breathlessness_level BETWEEN 1 AND 10),
  dizziness_level INTEGER CHECK (dizziness_level BETWEEN 1 AND 10),
  overall_experience INTEGER CHECK (overall_experience BETWEEN 1 AND 10),
  would_continue BOOLEAN,
  post_session_notes TEXT,
  
  -- Common fields
  side_effects TEXT[],
  completed BOOLEAN DEFAULT false,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Survey templates (for dynamic survey configuration)
CREATE TABLE IF NOT EXISTS survey_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  survey_type TEXT NOT NULL CHECK (survey_type IN ('pre_session', 'post_session', 'weekly', 'monthly')),
  version TEXT NOT NULL DEFAULT '1.0',
  is_active BOOLEAN DEFAULT true,
  questions JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Survey analytics aggregation view
CREATE OR REPLACE VIEW survey_analytics AS
SELECT 
  user_id,
  survey_type,
  DATE_TRUNC('week', created_at) as week,
  COUNT(*) as response_count,
  
  -- Pre-session averages
  AVG(current_stress_level) as avg_stress,
  AVG(sleep_quality) as avg_sleep_quality,
  AVG(energy_level) as avg_energy,
  AVG(physical_readiness) as avg_readiness,
  
  -- Post-session averages
  AVG(session_difficulty) as avg_difficulty,
  AVG(perceived_benefit) as avg_benefit,
  AVG(overall_experience) as avg_experience,
  
  -- Continuation rate
  COUNT(CASE WHEN would_continue = true THEN 1 END)::FLOAT / 
  NULLIF(COUNT(CASE WHEN would_continue IS NOT NULL THEN 1 END), 0) as continuation_rate
  
FROM survey_responses
WHERE completed = true
GROUP BY user_id, survey_type, week;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_survey_responses_user_id ON survey_responses(user_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_session_id ON survey_responses(session_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_type ON survey_responses(survey_type);
CREATE INDEX IF NOT EXISTS idx_survey_responses_created ON survey_responses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_survey_templates_active ON survey_templates(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_templates ENABLE ROW LEVEL SECURITY;

-- Temporary policies (will be updated in security migration)
CREATE POLICY IF NOT EXISTS "Temporary allow all on survey_responses" ON survey_responses FOR ALL USING (true);
CREATE POLICY IF NOT EXISTS "Temporary allow all on survey_templates" ON survey_templates FOR ALL USING (true);

-- Update triggers
DROP TRIGGER IF EXISTS update_survey_responses_updated_at ON survey_responses;
CREATE TRIGGER update_survey_responses_updated_at 
    BEFORE UPDATE ON survey_responses 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_survey_templates_updated_at ON survey_templates;
CREATE TRIGGER update_survey_templates_updated_at 
    BEFORE UPDATE ON survey_templates 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();