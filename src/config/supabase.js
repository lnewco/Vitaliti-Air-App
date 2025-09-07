import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ENV from './env';

// Use centralized environment config to avoid runtime issues in EAS builds
const supabaseUrl = ENV.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = ENV.EXPO_PUBLIC_SUPABASE_ANON_KEY;

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

