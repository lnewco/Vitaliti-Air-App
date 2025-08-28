-- RPC Functions for AI-Powered Subjective Feedback Engine
-- These functions handle atomic operations for survey data with proper device_id context

-- Function to upsert session survey data
CREATE OR REPLACE FUNCTION upsert_session_survey(
  p_session_id UUID,
  p_energy_pre INTEGER DEFAULT NULL,
  p_clarity_pre INTEGER DEFAULT NULL,
  p_stress_pre INTEGER DEFAULT NULL,
  p_energy_post INTEGER DEFAULT NULL,
  p_clarity_post INTEGER DEFAULT NULL,
  p_breathing_comfort INTEGER DEFAULT NULL,
  p_session_satisfaction INTEGER DEFAULT NULL,
  p_post_symptoms TEXT[] DEFAULT NULL,
  p_overall_rating INTEGER DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN
  INSERT INTO session_surveys (
    session_id,
    energy_pre,
    clarity_pre,
    stress_pre,
    energy_post,
    clarity_post,
    breathing_comfort,
    session_satisfaction,
    post_symptoms,
    overall_rating,
    created_at,
    updated_at
  ) VALUES (
    p_session_id,
    p_energy_pre,
    p_clarity_pre,
    p_stress_pre,
    p_energy_post,
    p_clarity_post,
    p_breathing_comfort,
    p_session_satisfaction,
    p_post_symptoms,
    p_overall_rating,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  )
  ON CONFLICT (session_id) DO UPDATE SET
    energy_pre = COALESCE(EXCLUDED.energy_pre, session_surveys.energy_pre),
    clarity_pre = COALESCE(EXCLUDED.clarity_pre, session_surveys.clarity_pre),
    stress_pre = COALESCE(EXCLUDED.stress_pre, session_surveys.stress_pre),
    energy_post = COALESCE(EXCLUDED.energy_post, session_surveys.energy_post),
    clarity_post = COALESCE(EXCLUDED.clarity_post, session_surveys.clarity_post),
    breathing_comfort = COALESCE(EXCLUDED.breathing_comfort, session_surveys.breathing_comfort),
    session_satisfaction = COALESCE(EXCLUDED.session_satisfaction, session_surveys.session_satisfaction),
    post_symptoms = COALESCE(EXCLUDED.post_symptoms, session_surveys.post_symptoms),
    overall_rating = COALESCE(EXCLUDED.overall_rating, session_surveys.overall_rating),
    updated_at = CURRENT_TIMESTAMP
  RETURNING row_to_json(session_surveys.*) INTO v_result;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to insert pre-session survey with device_id context
CREATE OR REPLACE FUNCTION insert_pre_session_survey_with_device_id(
  device_id_value TEXT,
  p_session_id UUID,
  p_user_id UUID,
  p_clarity_pre INTEGER,
  p_energy_pre INTEGER,
  p_stress_pre INTEGER
)
RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN
  -- Set the device_id for RLS context
  PERFORM set_config('request.jwt.claim.device_id', device_id_value, true);
  
  -- Insert or update the survey data
  INSERT INTO session_surveys (
    session_id,
    user_id,
    energy_pre,
    clarity_pre,
    stress_pre,
    created_at,
    updated_at
  ) VALUES (
    p_session_id,
    p_user_id,
    p_energy_pre,
    p_clarity_pre,
    p_stress_pre,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  )
  ON CONFLICT (session_id) DO UPDATE SET
    energy_pre = EXCLUDED.energy_pre,
    clarity_pre = EXCLUDED.clarity_pre,
    stress_pre = EXCLUDED.stress_pre,
    updated_at = CURRENT_TIMESTAMP
  RETURNING row_to_json(session_surveys.*) INTO v_result;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to insert post-session survey with device_id context
CREATE OR REPLACE FUNCTION insert_post_session_survey_with_device_id(
  device_id_value TEXT,
  p_session_id UUID,
  p_user_id UUID,
  p_clarity_post INTEGER,
  p_energy_post INTEGER,
  p_stress_post INTEGER,
  p_notes_post TEXT DEFAULT NULL,
  p_symptoms TEXT[] DEFAULT NULL,
  p_overall_rating INTEGER DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN
  -- Set the device_id for RLS context
  PERFORM set_config('request.jwt.claim.device_id', device_id_value, true);
  
  -- Update the survey data (assumes pre-session already created the row)
  UPDATE session_surveys SET
    energy_post = p_energy_post,
    clarity_post = p_clarity_post,
    stress_post = p_stress_post,
    notes_post = p_notes_post,
    post_symptoms = p_symptoms,
    overall_rating = p_overall_rating,
    updated_at = CURRENT_TIMESTAMP
  WHERE session_id = p_session_id
  RETURNING row_to_json(session_surveys.*) INTO v_result;
  
  -- If no row was updated, insert a new one
  IF v_result IS NULL THEN
    INSERT INTO session_surveys (
      session_id,
      user_id,
      energy_post,
      clarity_post,
      stress_post,
      notes_post,
      post_symptoms,
      overall_rating,
      created_at,
      updated_at
    ) VALUES (
      p_session_id,
      p_user_id,
      p_energy_post,
      p_clarity_post,
      p_stress_post,
      p_notes_post,
      p_symptoms,
      p_overall_rating,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    RETURNING row_to_json(session_surveys.*) INTO v_result;
  END IF;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to insert intra-session response with device_id context
CREATE OR REPLACE FUNCTION insert_intra_session_response_with_device_id(
  device_id_value TEXT,
  p_session_id UUID,
  p_user_id UUID,
  p_cycle_number INTEGER,
  p_clarity INTEGER,
  p_energy INTEGER,
  p_stress_perception INTEGER,
  p_sensations TEXT[] DEFAULT NULL,
  p_spo2_value INTEGER DEFAULT NULL,
  p_hr_value INTEGER DEFAULT NULL,
  p_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN
  -- Set the device_id for RLS context
  PERFORM set_config('request.jwt.claim.device_id', device_id_value, true);
  
  -- Insert the intra-session response
  INSERT INTO intra_session_responses (
    session_id,
    user_id,
    cycle_number,
    clarity,
    energy,
    stress_perception,
    sensations,
    spo2_value,
    hr_value,
    timestamp,
    created_at
  ) VALUES (
    p_session_id,
    p_user_id,
    p_cycle_number,
    p_clarity,
    p_energy,
    p_stress_perception,
    p_sensations,
    p_spo2_value,
    p_hr_value,
    p_timestamp,
    CURRENT_TIMESTAMP
  )
  ON CONFLICT (session_id, cycle_number) DO UPDATE SET
    clarity = EXCLUDED.clarity,
    energy = EXCLUDED.energy,
    stress_perception = EXCLUDED.stress_perception,
    sensations = EXCLUDED.sensations,
    spo2_value = EXCLUDED.spo2_value,
    hr_value = EXCLUDED.hr_value,
    timestamp = EXCLUDED.timestamp
  RETURNING row_to_json(intra_session_responses.*) INTO v_result;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION upsert_session_survey TO authenticated, anon;
GRANT EXECUTE ON FUNCTION insert_pre_session_survey_with_device_id TO authenticated, anon;
GRANT EXECUTE ON FUNCTION insert_post_session_survey_with_device_id TO authenticated, anon;
GRANT EXECUTE ON FUNCTION insert_intra_session_response_with_device_id TO authenticated, anon;