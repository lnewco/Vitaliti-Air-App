-- Migration 006: Security Policies (RLS)
-- Implements proper Row Level Security for all tables
-- IMPORTANT: Run this after authentication is configured

-- First, drop all temporary policies
DROP POLICY IF EXISTS "Temporary allow all on sessions" ON sessions;
DROP POLICY IF EXISTS "Temporary allow all on readings" ON readings;
DROP POLICY IF EXISTS "Temporary allow all on user_profiles" ON user_profiles;
DROP POLICY IF EXISTS "Temporary allow all on onboarding_data" ON onboarding_data;
DROP POLICY IF EXISTS "Temporary allow all on consent_audit_log" ON consent_audit_log;
DROP POLICY IF EXISTS "Temporary allow all on survey_responses" ON survey_responses;
DROP POLICY IF EXISTS "Temporary allow all on survey_templates" ON survey_templates;
DROP POLICY IF EXISTS "Temporary allow all on protocol_templates" ON protocol_templates;
DROP POLICY IF EXISTS "Temporary allow all on user_protocol_preferences" ON user_protocol_preferences;
DROP POLICY IF EXISTS "Temporary allow all on session_protocol_history" ON session_protocol_history;

-- Also drop old "Allow all" policies if they exist
DROP POLICY IF EXISTS "Allow all operations on sessions" ON sessions;
DROP POLICY IF EXISTS "Allow all operations on readings" ON readings;

-- ========================================
-- SESSIONS TABLE POLICIES
-- ========================================
CREATE POLICY "Users can view own sessions" ON sessions
  FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can insert own sessions" ON sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can update own sessions" ON sessions
  FOR UPDATE USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can delete own sessions" ON sessions
  FOR DELETE USING (auth.uid() = user_id OR user_id IS NULL);

-- ========================================
-- READINGS TABLE POLICIES
-- ========================================
CREATE POLICY "Users can view own readings" ON readings
  FOR SELECT USING (
    auth.uid() = user_id OR 
    user_id IS NULL OR
    EXISTS (
      SELECT 1 FROM sessions 
      WHERE sessions.id = readings.session_id 
      AND sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own readings" ON readings
  FOR INSERT WITH CHECK (
    auth.uid() = user_id OR 
    user_id IS NULL OR
    EXISTS (
      SELECT 1 FROM sessions 
      WHERE sessions.id = readings.session_id 
      AND sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own readings" ON readings
  FOR UPDATE USING (
    auth.uid() = user_id OR 
    user_id IS NULL OR
    EXISTS (
      SELECT 1 FROM sessions 
      WHERE sessions.id = readings.session_id 
      AND sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own readings" ON readings
  FOR DELETE USING (
    auth.uid() = user_id OR 
    user_id IS NULL OR
    EXISTS (
      SELECT 1 FROM sessions 
      WHERE sessions.id = readings.session_id 
      AND sessions.user_id = auth.uid()
    )
  );

-- ========================================
-- USER_PROFILES TABLE POLICIES
-- ========================================
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

-- Insert handled by trigger, no direct insert policy needed

-- ========================================
-- ONBOARDING_DATA TABLE POLICIES
-- ========================================
CREATE POLICY "Users can view own onboarding data" ON onboarding_data
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own onboarding data" ON onboarding_data
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own onboarding data" ON onboarding_data
  FOR UPDATE USING (auth.uid() = user_id);

-- ========================================
-- CONSENT_AUDIT_LOG TABLE POLICIES
-- ========================================
CREATE POLICY "Users can view own consent history" ON consent_audit_log
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own consent records" ON consent_audit_log
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- No update or delete - audit logs are immutable

-- ========================================
-- SURVEY_RESPONSES TABLE POLICIES
-- ========================================
CREATE POLICY "Users can view own survey responses" ON survey_responses
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own survey responses" ON survey_responses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own survey responses" ON survey_responses
  FOR UPDATE USING (auth.uid() = user_id);

-- ========================================
-- SURVEY_TEMPLATES TABLE POLICIES
-- ========================================
CREATE POLICY "Everyone can view active templates" ON survey_templates
  FOR SELECT USING (is_active = true);

-- Admin-only for insert/update/delete (implement admin check as needed)

-- ========================================
-- PROTOCOL_TEMPLATES TABLE POLICIES
-- ========================================
CREATE POLICY "Everyone can view active protocol templates" ON protocol_templates
  FOR SELECT USING (is_active = true);

-- Admin-only for insert/update/delete (implement admin check as needed)

-- ========================================
-- USER_PROTOCOL_PREFERENCES TABLE POLICIES
-- ========================================
CREATE POLICY "Users can view own protocol preferences" ON user_protocol_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own protocol preferences" ON user_protocol_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own protocol preferences" ON user_protocol_preferences
  FOR UPDATE USING (auth.uid() = user_id);

-- ========================================
-- SESSION_PROTOCOL_HISTORY TABLE POLICIES
-- ========================================
CREATE POLICY "Users can view own protocol history" ON session_protocol_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own protocol history" ON session_protocol_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- No update or delete - history records are immutable

-- ========================================
-- FUNCTIONS FOR ADVANCED SECURITY
-- ========================================

-- Function to check if user is admin (customize as needed)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- Implement your admin check logic here
  -- For now, return false for all users
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to safely get current user ID (handles anonymous access)
CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS UUID AS $$
BEGIN
  RETURN auth.uid();
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;