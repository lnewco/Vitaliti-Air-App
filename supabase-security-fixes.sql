-- Supabase Security and Performance Fixes
-- This migration addresses all issues found in the Supabase linter

-- =================================
-- 1. FIX CRITICAL SECURITY ISSUES
-- =================================

-- Fix user_profiles RLS issues
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Fix Security Definer Views - recreate without SECURITY DEFINER
DROP VIEW IF EXISTS public.user_session_summary;
DROP VIEW IF EXISTS public.session_fio2_analysis;
DROP VIEW IF EXISTS public.session_summary;
DROP VIEW IF EXISTS public.session_fio2_timeseries;

-- Recreate views without SECURITY DEFINER
CREATE VIEW public.user_session_summary AS
SELECT 
  u.id as user_id,
  u.phone,
  COUNT(s.id) as total_sessions,
  COUNT(CASE WHEN s.status = 'completed' THEN 1 END) as completed_sessions,
  AVG(s.avg_heart_rate) as avg_heart_rate,
  AVG(s.avg_spo2) as avg_spo2,
  MAX(s.created_at) as last_session_date
FROM user_profiles u
LEFT JOIN sessions s ON u.id = s.user_id
GROUP BY u.id, u.phone;

CREATE VIEW public.session_fio2_analysis AS
SELECT 
  s.id as session_id,
  s.user_id,
  s.default_hypoxia_level,
  COUNT(r.id) as total_readings,
  COUNT(CASE WHEN r.phase_type = 'HYPOXIC' THEN 1 END) as hypoxic_readings,
  COUNT(CASE WHEN r.phase_type = 'HYPEROXIC' THEN 1 END) as hyperoxic_readings,
  AVG(r.fio2_level) as avg_fio2_level,
  MIN(r.fio2_level) as min_fio2_level,
  MAX(r.fio2_level) as max_fio2_level
FROM sessions s
LEFT JOIN readings r ON s.id = r.session_id
GROUP BY s.id, s.user_id, s.default_hypoxia_level;

CREATE VIEW public.session_summary AS
SELECT 
  s.id,
  s.user_id,
  s.device_id,
  s.created_at,
  s.start_time,
  s.end_time,
  s.status,
  s.avg_heart_rate,
  s.avg_spo2,
  s.min_heart_rate,
  s.max_heart_rate,
  s.min_spo2,
  s.max_spo2,
  s.total_readings,
  EXTRACT(EPOCH FROM (s.end_time - s.start_time)) / 60.0 as duration_minutes,
  COUNT(r.id) as reading_count,
  COUNT(CASE WHEN r.is_valid THEN 1 END) as valid_reading_count
FROM sessions s
LEFT JOIN readings r ON s.id = r.session_id
GROUP BY s.id, s.user_id, s.device_id, s.created_at, s.start_time, s.end_time, 
         s.status, s.avg_heart_rate, s.avg_spo2, s.min_heart_rate, s.max_heart_rate,
         s.min_spo2, s.max_spo2, s.total_readings;

CREATE VIEW public.session_fio2_timeseries AS
SELECT 
  r.session_id,
  r.timestamp,
  r.fio2_level,
  r.phase_type,
  r.cycle_number,
  r.spo2,
  r.heart_rate,
  LAG(r.fio2_level) OVER (PARTITION BY r.session_id ORDER BY r.timestamp) as prev_fio2_level,
  LEAD(r.fio2_level) OVER (PARTITION BY r.session_id ORDER BY r.timestamp) as next_fio2_level
FROM readings r
WHERE r.fio2_level IS NOT NULL
ORDER BY r.session_id, r.timestamp;

-- Fix function search paths
ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.migrate_anonymous_data_to_user(uuid) SET search_path = public;
ALTER FUNCTION public.get_user_health_stats(uuid) SET search_path = public;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;

-- =================================
-- 2. FIX PERFORMANCE ISSUES
-- =================================

-- Fix RLS performance by optimizing auth function calls
-- Update sessions table policies
DROP POLICY IF EXISTS "Users can view own sessions" ON public.sessions;
DROP POLICY IF EXISTS "Users can insert own sessions" ON public.sessions;
DROP POLICY IF EXISTS "Users can update own sessions" ON public.sessions;
DROP POLICY IF EXISTS "Users can delete own sessions" ON public.sessions;

CREATE POLICY "Users can view own sessions" ON public.sessions
FOR SELECT USING (
  user_id = (SELECT auth.uid()) OR 
  device_id = current_setting('app.device_id', true)
);

CREATE POLICY "Users can insert own sessions" ON public.sessions
FOR INSERT WITH CHECK (
  user_id = (SELECT auth.uid()) OR 
  device_id = current_setting('app.device_id', true)
);

CREATE POLICY "Users can update own sessions" ON public.sessions
FOR UPDATE USING (
  user_id = (SELECT auth.uid()) OR 
  device_id = current_setting('app.device_id', true)
);

CREATE POLICY "Users can delete own sessions" ON public.sessions
FOR DELETE USING (
  user_id = (SELECT auth.uid()) OR 
  device_id = current_setting('app.device_id', true)
);

-- Update readings table policies
DROP POLICY IF EXISTS "Users can view own readings" ON public.readings;
DROP POLICY IF EXISTS "Users can insert own readings" ON public.readings;
DROP POLICY IF EXISTS "Users can update own readings" ON public.readings;
DROP POLICY IF EXISTS "Users can delete own readings" ON public.readings;

CREATE POLICY "Users can view own readings" ON public.readings
FOR SELECT USING (
  session_id IN (
    SELECT id FROM sessions 
    WHERE user_id = (SELECT auth.uid()) OR 
          device_id = current_setting('app.device_id', true)
  )
);

CREATE POLICY "Users can insert own readings" ON public.readings
FOR INSERT WITH CHECK (
  session_id IN (
    SELECT id FROM sessions 
    WHERE user_id = (SELECT auth.uid()) OR 
          device_id = current_setting('app.device_id', true)
  )
);

CREATE POLICY "Users can update own readings" ON public.readings
FOR UPDATE USING (
  session_id IN (
    SELECT id FROM sessions 
    WHERE user_id = (SELECT auth.uid()) OR 
          device_id = current_setting('app.device_id', true)
  )
);

CREATE POLICY "Users can delete own readings" ON public.readings
FOR DELETE USING (
  session_id IN (
    SELECT id FROM sessions 
    WHERE user_id = (SELECT auth.uid()) OR 
          device_id = current_setting('app.device_id', true)
  )
);

-- Remove unused indexes (only if they're truly unused)
-- Note: Be careful with these - only drop if you're sure they're not needed
DROP INDEX IF EXISTS public.idx_sessions_device_id;
DROP INDEX IF EXISTS public.idx_readings_valid;
DROP INDEX IF EXISTS public.idx_user_profiles_phone;
DROP INDEX IF EXISTS public.idx_readings_fio2_level;
DROP INDEX IF EXISTS public.idx_readings_phase_type;

-- Create more efficient indexes
CREATE INDEX IF NOT EXISTS idx_sessions_user_id_status ON public.sessions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_sessions_device_id_status ON public.sessions(device_id, status) WHERE device_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_readings_session_timestamp ON public.readings(session_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_readings_session_valid ON public.readings(session_id) WHERE is_valid = true;

-- =================================
-- 3. GRANT APPROPRIATE PERMISSIONS
-- =================================

-- Grant permissions on views to authenticated users
GRANT SELECT ON public.user_session_summary TO authenticated;
GRANT SELECT ON public.session_fio2_analysis TO authenticated;
GRANT SELECT ON public.session_summary TO authenticated;
GRANT SELECT ON public.session_fio2_timeseries TO authenticated;

-- Grant permissions on views to anonymous users (for device-based access)
GRANT SELECT ON public.session_summary TO anon;
GRANT SELECT ON public.session_fio2_timeseries TO anon;

-- =================================
-- 4. VERIFICATION QUERIES
-- =================================

-- Verify RLS is enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('user_profiles', 'sessions', 'readings');

-- Verify policies exist
SELECT schemaname, tablename, policyname, cmd, roles 
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('user_profiles', 'sessions', 'readings')
ORDER BY tablename, policyname;

-- Check for remaining security definer objects
SELECT n.nspname as schema_name, p.proname as function_name, p.prosecdef
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' AND p.prosecdef = true;

-- List current indexes
SELECT tablename, indexname, indexdef 
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND tablename IN ('sessions', 'readings', 'user_profiles')
ORDER BY tablename, indexname; 