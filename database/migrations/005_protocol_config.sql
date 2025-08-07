-- Migration 005: IHHT Protocol Configuration
-- Adds support for customizable training protocols and FiO2 tracking

-- Add protocol configuration columns to sessions
ALTER TABLE sessions 
  ADD COLUMN IF NOT EXISTS protocol_config JSONB DEFAULT '{
    "totalCycles": 5,
    "hypoxicDuration": 300,
    "hyperoxicDuration": 120
  }'::jsonb,
  ADD COLUMN IF NOT EXISTS default_hypoxia_level INTEGER DEFAULT 5,
  ADD COLUMN IF NOT EXISTS current_cycle INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS completed_cycles INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_planned_cycles INTEGER DEFAULT 5;

-- Add FiO2 tracking to readings
ALTER TABLE readings
  ADD COLUMN IF NOT EXISTS fio2_level INTEGER,
  ADD COLUMN IF NOT EXISTS phase_type TEXT CHECK (phase_type IN ('HYPOXIC', 'HYPEROXIC', 'RECOVERY', 'WARMUP'));

-- Protocol templates table
CREATE TABLE IF NOT EXISTS protocol_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  
  -- Protocol parameters
  total_cycles INTEGER NOT NULL DEFAULT 5,
  hypoxic_duration_seconds INTEGER NOT NULL DEFAULT 300, -- 5 minutes
  hyperoxic_duration_seconds INTEGER NOT NULL DEFAULT 120, -- 2 minutes
  
  -- Intensity settings
  default_hypoxia_level INTEGER DEFAULT 5 CHECK (default_hypoxia_level BETWEEN 0 AND 10),
  progressive_intensity BOOLEAN DEFAULT false,
  intensity_increment DECIMAL(3,1) DEFAULT 0.5,
  
  -- Safety parameters
  min_spo2_threshold INTEGER DEFAULT 80,
  max_heart_rate_threshold INTEGER DEFAULT 180,
  auto_terminate_on_threshold BOOLEAN DEFAULT true,
  
  -- Target audience
  difficulty_level TEXT CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced', 'custom')),
  recommended_for TEXT[],
  contraindications TEXT[],
  
  -- Metadata
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User protocol preferences
CREATE TABLE IF NOT EXISTS user_protocol_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Preferred protocols
  default_protocol_id UUID REFERENCES protocol_templates(id),
  custom_protocols JSONB DEFAULT '[]'::jsonb,
  
  -- Personal limits
  personal_min_spo2 INTEGER DEFAULT 82,
  personal_max_heart_rate INTEGER,
  
  -- Progress tracking
  last_completed_level INTEGER DEFAULT 0,
  total_sessions_completed INTEGER DEFAULT 0,
  total_training_minutes INTEGER DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- One record per user
  UNIQUE(user_id)
);

-- Session protocol history (for progress tracking)
CREATE TABLE IF NOT EXISTS session_protocol_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  protocol_template_id UUID REFERENCES protocol_templates(id),
  
  -- Actual parameters used
  actual_cycles_completed INTEGER,
  actual_hypoxic_duration INTEGER,
  actual_hyperoxic_duration INTEGER,
  actual_hypoxia_level INTEGER,
  
  -- Performance metrics
  avg_spo2_hypoxic REAL,
  avg_spo2_hyperoxic REAL,
  avg_hr_hypoxic REAL,
  avg_hr_hyperoxic REAL,
  min_spo2_reached INTEGER,
  max_hr_reached INTEGER,
  
  -- User feedback
  perceived_difficulty INTEGER CHECK (perceived_difficulty BETWEEN 1 AND 10),
  would_repeat BOOLEAN,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default protocol templates
INSERT INTO protocol_templates (name, description, total_cycles, hypoxic_duration_seconds, hyperoxic_duration_seconds, default_hypoxia_level, difficulty_level, recommended_for)
VALUES 
  ('Beginner', 'Gentle introduction to IHHT', 3, 180, 120, 3, 'beginner', ARRAY['first_time_users', 'elderly', 'recovery']),
  ('Standard', 'Balanced protocol for regular training', 5, 300, 120, 5, 'intermediate', ARRAY['general_fitness', 'endurance', 'wellness']),
  ('Advanced', 'Challenging protocol for experienced users', 7, 420, 180, 7, 'advanced', ARRAY['athletes', 'high_altitude_preparation']),
  ('Recovery', 'Light protocol for active recovery', 3, 240, 180, 2, 'beginner', ARRAY['post_workout', 'recovery_days']),
  ('Performance', 'High-intensity protocol for performance gains', 6, 360, 150, 8, 'advanced', ARRAY['competitive_athletes', 'pre_competition'])
ON CONFLICT DO NOTHING;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_protocol_templates_active ON protocol_templates(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_protocol_templates_difficulty ON protocol_templates(difficulty_level);
CREATE INDEX IF NOT EXISTS idx_user_protocol_preferences_user ON user_protocol_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_session_protocol_history_session ON session_protocol_history(session_id);
CREATE INDEX IF NOT EXISTS idx_session_protocol_history_user ON session_protocol_history(user_id);

-- Enable RLS
ALTER TABLE protocol_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_protocol_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_protocol_history ENABLE ROW LEVEL SECURITY;

-- Temporary policies (will be updated in security migration)
CREATE POLICY IF NOT EXISTS "Temporary allow all on protocol_templates" ON protocol_templates FOR ALL USING (true);
CREATE POLICY IF NOT EXISTS "Temporary allow all on user_protocol_preferences" ON user_protocol_preferences FOR ALL USING (true);
CREATE POLICY IF NOT EXISTS "Temporary allow all on session_protocol_history" ON session_protocol_history FOR ALL USING (true);

-- Update triggers
DROP TRIGGER IF EXISTS update_protocol_templates_updated_at ON protocol_templates;
CREATE TRIGGER update_protocol_templates_updated_at 
    BEFORE UPDATE ON protocol_templates 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_protocol_preferences_updated_at ON user_protocol_preferences;
CREATE TRIGGER update_user_protocol_preferences_updated_at 
    BEFORE UPDATE ON user_protocol_preferences 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();