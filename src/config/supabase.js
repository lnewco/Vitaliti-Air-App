import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://yhbywcawiothhoqaurgy.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InloYnl3Y2F3aW90aGhvcWF1cmd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMjA5MTQsImV4cCI6MjA2ODc5NjkxNH0.QbUE7ddPa1KiHRY0_i4LHHu3iKt7Ol_MKdB2WzbhAes';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
    storageKey: 'sb-anonymous-session', // Use a different storage key to avoid conflicts
    storage: {
      // Provide a mock storage that does nothing to prevent any session persistence
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    },
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

// React Native doesn't have localStorage - storage cleanup is handled in SupabaseService.initialize()

// Force sign out on initialization to clear any cached sessions
supabase.auth.signOut({ scope: 'local' }).catch(() => {
  // Ignore errors - this is just cleanup
});

export default supabase; 