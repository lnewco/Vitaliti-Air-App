import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://yhbywcawiothhoqaurgy.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InloYnl3Y2F3aW90aGhvcWF1cmd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMjA5MTQsImV4cCI6MjA2ODc5NjkxNH0.QbUE7ddPa1KiHRY0_i4LHHu3iKt7Ol_MKdB2WzbhAes';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export default supabase; 