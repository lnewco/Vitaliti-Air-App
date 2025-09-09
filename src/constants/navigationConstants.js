/**
 * Navigation constants and route names
 */

export const ROUTES = {
  // Auth routes
  AUTH: 'Auth',
  LOGIN: 'Login',
  PREMIUM_OTP: 'PremiumOTP',
  
  // Onboarding routes
  ONBOARDING: 'Onboarding',
  WELCOME: 'Welcome',
  BASIC_INFO: 'BasicInfo',
  PHONE_VERIFICATION: 'PhoneVerification',
  HEALTH_INFO: 'HealthInfo',
  WEARABLES_CONNECTION: 'WearablesConnection',
  BASELINE_SESSION: 'BaselineSession',
  ONBOARDING_COMPLETE: 'OnboardingComplete',
  
  // Main app routes
  MAIN_TABS: 'MainTabs',
  DASHBOARD: 'Dashboard',
  PROFILE: 'Profile',
  SETTINGS: 'Settings',
  INTEGRATIONS: 'Integrations',
  
  // Session routes
  SESSION_SETUP: 'SimplifiedSessionSetup',
  SESSION_ACTIVE: 'IHHTSessionSimple',
  POST_SESSION_SURVEY: 'PostSessionSurvey',
  SESSION_HISTORY: 'SessionHistory',
  
  // Premium routes
  PREMIUM_DASHBOARD: 'PremiumDashboard',
  PREMIUM_PROFILE: 'PremiumProfile',
  
  // Animation preview (dev only)
  ANIMATION_PREVIEW: 'AnimationPreview',
};

export const NAVIGATION_OPTIONS = {
  headerShown: false,
  gestureEnabled: true,
  animationEnabled: true,
};

export const TAB_BAR_OPTIONS = {
  showLabel: true,
  activeTintColor: '#007AFF',
  inactiveTintColor: '#8E8E93',
  style: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 0,
    elevation: 0,
    shadowOpacity: 0,
  },
};