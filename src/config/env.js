// Centralized environment configuration
// Hardcoded values for IHHT v2 branch to avoid runtime env issues in EAS builds

const ENV = {
  // Supabase (IHHT v2 branch)
  EXPO_PUBLIC_SUPABASE_URL: 'https://yhbywcawiothhoqaurgy.supabase.co',
  EXPO_PUBLIC_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InloYnl3Y2F3aW90aGhvcWF1cmd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMjA5MTQsImV4cCI6MjA2ODc5NjkxNH0.QbUE7ddPa1KiHRY0_i4LHHu3iKt7Ol_MKdB2WzbhAes',
  
  // Branch
  EXPO_PUBLIC_BRANCH: 'ihht-v2',
  
  // Whoop Integration
  EXPO_PUBLIC_WHOOP_CLIENT_ID: 'ef01edf8-b61c-4cac-99a0-d0825098dace',
  EXPO_PUBLIC_WHOOP_CLIENT_SECRET: '1529284de2cde1574018824932aeec53222eee78487bd3ea63f87ae44d716aeb',
  
  // Oura Integration
  EXPO_PUBLIC_OURA_CLIENT_ID: 'E6B2T5RUOWXZQUBJ',
  EXPO_PUBLIC_OURA_CLIENT_SECRET: 'J2T5CLS4NEFUYPTJEQEMILZD4QT67WKO',
  
  // Analytics
  EXPO_PUBLIC_ANALYTICS_API_URL: 'https://vitaliti-air-analytics.onrender.com',
  
  // App Scheme
  EXPO_PUBLIC_APP_SCHEME: 'vitalitiair',
  EXPO_PUBLIC_REDIRECT_BASE_URL: 'vitalitiair://integrations',
  
  // Debug
  EXPO_PUBLIC_INTEGRATION_DEBUG: 'true'
};

export default ENV;