-- MANUAL RLS FIX FOR READINGS TABLE
-- Run this in your Supabase SQL Editor to fix the RLS policy issues

-- Option 1: Temporarily disable RLS for testing (EASIEST)
-- Warning: This removes all access control - use only for development testing
ALTER TABLE readings DISABLE ROW LEVEL SECURITY;
ALTER TABLE sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE session_surveys DISABLE ROW LEVEL SECURITY;

-- Option 2: Add a more permissive policy (SAFER for production)
-- Uncomment the lines below if you prefer to keep RLS enabled with better policies
/*
CREATE POLICY "Allow all authenticated users" ON readings
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow all authenticated users" ON sessions  
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow all authenticated users" ON session_surveys
FOR ALL
TO authenticated  
USING (true)
WITH CHECK (true);
*/

-- After running this, restart your React Native app to test 