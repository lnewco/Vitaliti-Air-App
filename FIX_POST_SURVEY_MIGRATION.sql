-- Update the RPC function to include post_symptoms and overall_rating parameters
CREATE OR REPLACE FUNCTION public.insert_post_session_survey_with_device_id(
  device_id_value text,
  p_session_id uuid,
  p_user_id uuid,
  p_clarity_post integer,
  p_energy_post integer,
  p_stress_post integer,
  p_notes_post text,
  p_post_symptoms text[],
  p_overall_rating integer
)
RETURNS TABLE(
  survey_id bigint,
  survey_session_id uuid,
  survey_user_id uuid,
  survey_clarity_post integer,
  survey_energy_post integer,
  survey_stress_post integer,
  survey_notes_post text,
  survey_post_symptoms text[],
  survey_overall_rating integer,
  survey_updated_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Set the device_id session variable for RLS
  PERFORM set_config('app.device_id', device_id_value, true);
  
  -- Insert or update survey data with new fields
  RETURN QUERY
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
    p_user_id,
    p_clarity_post,
    p_energy_post,
    p_stress_post,
    p_notes_post,
    p_post_symptoms,
    p_overall_rating,
    NOW(),
    NOW()
  )
  ON CONFLICT (session_id) 
  DO UPDATE SET
    clarity_post = EXCLUDED.clarity_post,
    energy_post = EXCLUDED.energy_post,
    stress_post = EXCLUDED.stress_post,
    notes_post = EXCLUDED.notes_post,
    post_symptoms = EXCLUDED.post_symptoms,
    overall_rating = EXCLUDED.overall_rating,
    updated_at = NOW()
  RETURNING 
    session_surveys.id,
    session_surveys.session_id,
    session_surveys.user_id,
    session_surveys.clarity_post,
    session_surveys.energy_post,
    session_surveys.stress_post,
    session_surveys.notes_post,
    session_surveys.post_symptoms,
    session_surveys.overall_rating,
    session_surveys.updated_at;
END;
$function$;