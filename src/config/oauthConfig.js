// OAuth Configuration
// Switch between different redirect approaches based on your needs

export const OAuthConfig = {
  // Option 1: Direct custom scheme (recommended)
  // Works because both Whoop and Oura support custom URL schemes
  DIRECT_SCHEME: {
    redirectUri: 'vitalitiair://oauth-callback',
    notes: 'Register this exact URL in Whoop/Oura dashboards'
  },
  
  // Option 2: Web redirect via Render (fallback)
  // Use if providers reject custom schemes
  WEB_REDIRECT: {
    redirectUri: 'https://vitaliti-oauth.onrender.com/public/oauth-callback-enhanced.html',
    notes: 'Deploy public folder to Render first'
  },
  
  // Option 3: Development/testing with ngrok
  // Temporary HTTPS URL for testing
  NGROK: {
    redirectUri: 'https://your-ngrok-url.ngrok.io/oauth-callback',
    notes: 'Run ngrok locally for testing'
  },
  
  // Current active configuration
  get current() {
    return this.WEB_REDIRECT; // Changed to use web redirect
  }
};