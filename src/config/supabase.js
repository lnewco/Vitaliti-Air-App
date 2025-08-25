import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Get environment variables with robust fallbacks for local development
const SUPABASE_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_URL || 
                     process.env.EXPO_PUBLIC_SUPABASE_URL || 
                     'https://yhbywcawiothhoqaurgy.supabase.co';

const SUPABASE_ANON_KEY = Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_ANON_KEY || 
                          process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 
                          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InloYnl3Y2F3aW90aGhvcWF1cmd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMjA5MTQsImV4cCI6MjA2ODc5NjkxNH0.QbUE7ddPa1KiHRY0_i4LHHu3iKt7Ol_MKdB2WzbhAes';

// Validate environment variables - but don't throw in local dev if we have fallbacks
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // Don't throw error - let it use the fallback values
  // Using hardcoded fallbacks for local development
}

const supabaseUrl = SUPABASE_URL;
const supabaseAnonKey = SUPABASE_ANON_KEY;

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