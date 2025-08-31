import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Use IHHT v2 branch for testing
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://pkabhnqarbmzfkcvnbud.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBrYWJobnFhcmJtemZrY3ZuYnVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0NzU4MTEsImV4cCI6MjA3MjA1MTgxMX0.M_vRURfdNUJFYSxt_CjMRTDoTz3kTsV0ujgNYehNjbY';

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

