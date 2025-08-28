-- Enhance existing session_surveys table for AI-powered feedback
ALTER TABLE session_surveys 
ADD COLUMN IF NOT EXISTS stress_pre INTEGER CHECK (stress_pre IS NULL OR (stress_pre >= 1 AND stress_pre <= 5)),
ADD COLUMN IF NOT EXISTS post_symptoms JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS overall_rating INTEGER CHECK (overall_rating IS NULL OR (overall_rating >= 1 AND overall_rating <= 5));

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_session_surveys_overall_rating ON session_surveys(overall_rating);

-- Enhance existing intra_session_responses table
ALTER TABLE intra_session_responses
ADD COLUMN IF NOT EXISTS stress_perception INTEGER CHECK (stress_perception IS NULL OR (stress_perception >= 1 AND stress_perception <= 5)),
ADD COLUMN IF NOT EXISTS sensations JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS spo2_value DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS hr_value INTEGER;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_intra_session_responses_phase ON intra_session_responses(phase_number);
CREATE INDEX IF NOT EXISTS idx_intra_session_responses_timestamp ON intra_session_responses(timestamp);

-- Update RLS policies if needed (they should already exist)
-- Ensure users can only see their own data
ALTER TABLE session_surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE intra_session_responses ENABLE ROW LEVEL SECURITY;

-- Create policies if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'session_surveys' 
    AND policyname = 'Users can view own surveys'
  ) THEN
    CREATE POLICY "Users can view own surveys" ON session_surveys
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'session_surveys' 
    AND policyname = 'Users can insert own surveys'
  ) THEN
    CREATE POLICY "Users can insert own surveys" ON session_surveys
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'session_surveys' 
    AND policyname = 'Users can update own surveys'
  ) THEN
    CREATE POLICY "Users can update own surveys" ON session_surveys
      FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;