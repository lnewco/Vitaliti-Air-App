import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = 'https://yhbywcawiothhoqaurgy.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InloYnl3Y2F3aW90aGhvcWF1cmd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMjA5MTQsImV4cCI6MjA2ODc5NjkxNH0.QbUE7ddPa1KiHRY0_i4LHHu3iKt7Ol_MKdB2WzbhAes';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,  // Enable auto refresh
    persistSession: true,     // Enable session persistence
    detectSessionInUrl: false,
    storageKey: 'vitaliti-auth-session',
    storage: AsyncStorage,    // Use AsyncStorage for React Native
  },
  db: {
    schema: 'public',
  },
  global: {
    headers: {
      'apikey': supabaseAnonKey,
    },
  },
});

// React Native doesn't have localStorage - using AsyncStorage instead

export default supabase; 