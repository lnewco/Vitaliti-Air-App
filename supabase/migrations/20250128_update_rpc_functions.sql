-- Create enhanced RPC function for pre-session survey
CREATE OR REPLACE FUNCTION insert_pre_session_survey_with_device_id(
  device_id_value TEXT,
  p_session_id UUID,
  p_user_id UUID,
  p_clarity_pre INTEGER,
  p_energy_pre INTEGER,
  p_stress_pre INTEGER
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  -- Insert or update the pre-session survey with device_id check
  INSERT INTO session_surveys (
    session_id, 
    user_id, 
    clarity_pre, 
    energy_pre, 
    stress_pre,
    created_at, 
    updated_at
  )
  VALUES (
    p_session_id, 
    COALESCE(p_user_id, auth.uid()), 
    p_clarity_pre, 
    p_energy_pre, 
    p_stress_pre,
    NOW(), 
    NOW()
  )
  ON CONFLICT (session_id) DO UPDATE SET
    clarity_pre = EXCLUDED.clarity_pre,
    energy_pre = EXCLUDED.energy_pre,
    stress_pre = EXCLUDED.stress_pre,
    updated_at = NOW()
  WHERE session_surveys.session_id IN (
    SELECT id FROM sessions 
    WHERE device_id = device_id_value
  );
  
  -- Return result
  SELECT json_build_object(
    'success', true,
    'session_id', p_session_id
  ) INTO result;
  
  RETURN result;
END;
$$;

-- Update RPC function for enhanced post-session survey
CREATE OR REPLACE FUNCTION insert_post_session_survey_with_device_id(
  device_id_value TEXT,
  p_session_id UUID,
  p_user_id UUID,
  p_clarity_post INTEGER,
  p_energy_post INTEGER,
  p_stress_post INTEGER,
  p_notes_post TEXT,
  p_post_symptoms JSONB DEFAULT '[]'::jsonb,
  p_overall_rating INTEGER DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  -- Insert or update the post-session survey with enhanced fields
  INSERT INTO session_surveys (
    session_id, 
    user_id, 
    clarity_post, 
    energy_post, 
    stress_post, 
    notes_post, 
    post_symptoms,
    overall_rating,
    created_at, 
    updated_at
  )
  VALUES (
    p_session_id, 
    COALESCE(p_user_id, auth.uid()), 
    p_clarity_post, 
    p_energy_post, 
    p_stress_post, 
    p_notes_post, 
    p_post_symptoms,
    p_overall_rating,
    NOW(), 
    NOW()
  )
  ON CONFLICT (session_id) DO UPDATE SET
    clarity_post = EXCLUDED.clarity_post,
    energy_post = EXCLUDED.energy_post,
    stress_post = EXCLUDED.stress_post,
    notes_post = EXCLUDED.notes_post,
    post_symptoms = EXCLUDED.post_symptoms,
    overall_rating = EXCLUDED.overall_rating,
    updated_at = NOW()
  WHERE session_surveys.session_id IN (
    SELECT id FROM sessions 
    WHERE device_id = device_id_value
  );
  
  -- Return result
  SELECT json_build_object(
    'success', true,
    'session_id', p_session_id
  ) INTO result;
  
  RETURN result;
END;
$$;

-- Update RPC function for enhanced intra-session response
CREATE OR REPLACE FUNCTION insert_intra_session_response_with_device_id(
  device_id_value TEXT,
  p_session_id UUID,
  p_user_id UUID,
  p_phase_number INTEGER,
  p_clarity INTEGER,
  p_energy INTEGER,
  p_stress_perception INTEGER,
  p_timestamp TIMESTAMPTZ,
  p_sensations JSONB DEFAULT '[]'::jsonb,
  p_spo2_value DECIMAL DEFAULT NULL,
  p_hr_value INTEGER DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  -- Insert the enhanced intra-session response
  INSERT INTO intra_session_responses (
    session_id, 
    user_id, 
    phase_number, 
    clarity, 
    energy, 
    stress,
    stress_perception,
    sensations,
    spo2_value,
    hr_value,
    timestamp, 
    created_at
  )
  VALUES (
    p_session_id, 
    COALESCE(p_user_id, auth.uid()), 
    p_phase_number, 
    p_clarity, 
    p_energy, 
    p_stress_perception,  -- Use same value for both stress fields
    p_stress_perception,
    p_sensations,
    p_spo2_value,
    p_hr_value,
    p_timestamp, 
    NOW()
  )
  ON CONFLICT (session_id, phase_number) DO UPDATE SET
    clarity = EXCLUDED.clarity,
    energy = EXCLUDED.energy,
    stress = EXCLUDED.stress,
    stress_perception = EXCLUDED.stress_perception,
    sensations = EXCLUDED.sensations,
    spo2_value = EXCLUDED.spo2_value,
    hr_value = EXCLUDED.hr_value,
    timestamp = EXCLUDED.timestamp;
  
  -- Return result
  SELECT json_build_object(
    'success', true,
    'session_id', p_session_id,
    'phase_number', p_phase_number
  ) INTO result;
  
  RETURN result;
END;
$$;