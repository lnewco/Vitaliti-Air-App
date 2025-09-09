/**
 * Navigation helper utilities
 */

import { ROUTES } from '../constants/navigationConstants';

/**
 * Determine initial route based on auth and onboarding status
 * @param {boolean} isAuthenticated - User authentication status
 * @param {boolean} hasCompletedOnboarding - Onboarding completion status
 * @returns {string} Initial route name
 */
export const getInitialRoute = (isAuthenticated, hasCompletedOnboarding) => {
  if (!isAuthenticated) {
    return ROUTES.AUTH;
  }
  
  if (!hasCompletedOnboarding) {
    return ROUTES.ONBOARDING;
  }
  
  return ROUTES.MAIN_TABS;
};

/**
 * Check if route requires authentication
 * @param {string} routeName - Route name to check
 * @returns {boolean} Whether route requires auth
 */
export const requiresAuth = (routeName) => {
  const publicRoutes = [
    ROUTES.AUTH,
    ROUTES.LOGIN,
    ROUTES.WELCOME,
  ];
  
  return !publicRoutes.includes(routeName);
};

/**
 * Get screen options based on route
 * @param {string} routeName - Route name
 * @returns {Object} Screen options
 */
export const getScreenOptions = (routeName) => {
  const options = {
    headerShown: false,
    gestureEnabled: true,
  };
  
  // Disable gestures for certain screens
  const noGestureScreens = [
    ROUTES.SESSION_ACTIVE,
    ROUTES.POST_SESSION_SURVEY,
  ];
  
  if (noGestureScreens.includes(routeName)) {
    options.gestureEnabled = false;
  }
  
  return options;
};