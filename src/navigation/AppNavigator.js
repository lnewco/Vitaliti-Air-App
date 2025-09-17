/**
 * @fileoverview Main app navigator with auth and onboarding flow
 */

import React, { useEffect, useState, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet, AppState, Linking, Alert } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAuth } from '../auth/AuthContext';
import { OnboardingProvider } from '../context/OnboardingContext';
import { colors } from '../design-system';
import AuthNavigator from './AuthNavigator';
import OnboardingNavigator from './OnboardingNavigator';
import MainAppContent from '../screens/MainAppContent';
import { ROUTES, NAVIGATION_OPTIONS } from '../constants/navigationConstants';
import { getInitialRoute } from '../utils/navigationHelpers';
import { supabase } from '../config/supabase';
import WhoopService from '../services/integrations/WhoopService';
import OuraService from '../services/integrations/OuraService';

const Stack = createStackNavigator();

const AppNavigator = () => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [onboardingState, setOnboardingState] = useState(null); // 'not_started' | 'in_progress' | 'completed'
  const [isCheckingOnboarding, setIsCheckingOnboarding] = useState(true);
  const navigationRef = useRef();
  const routeNameRef = useRef();
  const hasCheckedOnboardingRef = useRef(false); // Track if we've checked for current auth session

  useEffect(() => {
    checkOnboardingStatus();
    // Setup global OAuth deep link handler
    const cleanup = setupOAuthDeepLinkHandler();
    return cleanup;
  }, []);

  // Check onboarding status when auth state changes to authenticated
  useEffect(() => {
    if (isAuthenticated) {
      // Use Promise-based approach instead of fixed delay
      const performAsyncChecks = async () => {
        try {
          // Force AsyncStorage to flush any pending writes
          await AsyncStorage.getAllKeys(); // This forces a sync read

          // Small delay only if absolutely needed (reduced from 300ms to 100ms)
          await new Promise(resolve => setTimeout(resolve, 100));

          // Now perform checks
          await checkOnboardingStatus();
          await checkForCompletionTransition();
        } catch (error) {
          console.error('Error during async checks:', error);
        }
      };

      performAsyncChecks();

    } else {
      // Reset the flag when user logs out
      hasCheckedOnboardingRef.current = false;
    }
  }, [isAuthenticated]); // Only depend on isAuthenticated

  // Separate effect for navigation based on state changes
  useEffect(() => {
    if (!isLoading && !isCheckingOnboarding && onboardingState !== null) {
      // Only navigate if onboarding is not in progress
      if (onboardingState !== 'in_progress') {
        navigateBasedOnAuthAndOnboarding();
      } else {
      }
    }
  }, [isLoading, isCheckingOnboarding, onboardingState, isAuthenticated]); // Added isAuthenticated to trigger on logout

  // Global OAuth deep link handler - always active throughout app lifecycle
  const setupOAuthDeepLinkHandler = () => {
    
    // Handle initial URL if app was opened via deep link
    Linking.getInitialURL().then((url) => {
      if (url && url.includes('code=')) {
        handleOAuthDeepLink(url);
      }
    });
    
    // Handle deep links when app is already open
    const subscription = Linking.addEventListener('url', ({ url }) => {
      if (url && url.includes('code=')) {
        handleOAuthDeepLink(url);
      }
    });
    
    return () => subscription.remove();
  };

  // Handle OAuth callback deep links globally
  const handleOAuthDeepLink = async (url) => {
    
    if (!url || !url.includes('code=')) {
      return;
    }

    try {
      // Parse URL
      let cleanUrl = url;
      if (url.startsWith('exp+')) {
        cleanUrl = url.replace('exp+vitaliti-air-app://', 'https://fake.com/');
      } else if (url.startsWith('vitaliti-air-app://')) {
        cleanUrl = url.replace('vitaliti-air-app://', 'https://fake.com/');
      } else if (url.startsWith('vitalitiair://')) {
        cleanUrl = url.replace('vitalitiair://', 'https://fake.com/');
      }
      
      
      const urlObj = new URL(cleanUrl);
      const code = urlObj.searchParams.get('code');
      const state = urlObj.searchParams.get('state');
      
      // Determine vendor from stored value
      const vendor = await AsyncStorage.getItem('pending_oauth_vendor');
      

      if (!vendor || !code) {
        return;
      }

      // Process OAuth based on vendor
      if (vendor === 'whoop') {
        try {
          const result = await WhoopService.handleCallback(code, state);
          
          if (result.success) {
            Alert.alert(
              'Success',
              `Whoop connected successfully!${result.initialSyncRecords ? ` Synced ${result.initialSyncRecords} records.` : ''}`,
              [{ text: 'OK' }]
            );
          } else {
            Alert.alert('Error', `Failed to connect Whoop: ${result.error || 'Unknown error'}`);
          }
        } catch (error) {
          Alert.alert('Error', `Whoop connection error: ${error.message}`);
        }
      } else if (vendor === 'oura') {
        try {
          const result = await OuraService.handleCallback(code, state);
          
          if (result.success) {
            Alert.alert(
              'Success',
              `Oura connected successfully!${result.initialSyncRecords ? ` Synced ${result.initialSyncRecords} records.` : ''}`,
              [{ text: 'OK' }]
            );
          } else {
            Alert.alert('Error', `Failed to connect Oura: ${result.error || 'Unknown error'}`);
          }
        } catch (error) {
          Alert.alert('Error', `Oura connection error: ${error.message}`);
        }
      }
      
      // Clear the pending vendor
      await AsyncStorage.removeItem('pending_oauth_vendor');
      
    } catch (error) {
      Alert.alert('Connection Error', `Failed to complete authentication: ${error.message}`);
    }
  };

  // Listen for app state changes to re-check onboarding status
  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      if (nextAppState === 'active') {
        
        // Check if there's an active session - if so, skip navigation changes
        try {
          const EnhancedSessionManager = require('../services/EnhancedSessionManager').default;
          const sessionInfo = EnhancedSessionManager.getSessionInfo();
          if (sessionInfo.isActive && !sessionInfo.isPaused) {
            return;
          }
        } catch (error) {
        }
        
        // CRITICAL FIX: Skip ALL navigation checks if we're already authenticated and in the main app
        // This prevents the app from returning to home screen when reopened
        if (isAuthenticated && onboardingState === 'completed') {
          return;
        }
        
        // Only check onboarding status if we're NOT authenticated
        // This handles the case where a new user opens the app for the first time
        if (!isAuthenticated && onboardingState !== 'completed') {
          checkOnboardingStatus();
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [isAuthenticated, onboardingState]);

  // Check if onboarding completion just finished and handle navigation
  const checkForCompletionTransition = async () => {
    try {
      const forceComplete = await AsyncStorage.getItem('onboarding_force_complete');
      const userConfirmed = await AsyncStorage.getItem('onboarding_user_confirmed');
      const onboardingState = await AsyncStorage.getItem('onboarding_state');
      
      if (forceComplete === 'true' && userConfirmed === 'true' && onboardingState === 'completed' && isAuthenticated) {
        
        // Clear ALL completion flags
        await AsyncStorage.removeItem('onboarding_force_complete');
        await AsyncStorage.removeItem('onboarding_user_confirmed');
        await AsyncStorage.removeItem('onboarding_completion_finished');
        
        // IMMEDIATELY force navigation to Main app using the ROOT navigator
        if (navigationRef.current && navigationRef.current.isReady()) {
          try {
            navigationRef.current.reset({
              index: 0,
              routes: [{ name: 'Main' }],
            });
          } catch (error) {
          }
        } else {
        }
      }
    } catch (error) {
    }
  };

  // Removed periodic check - CompletionScreen now handles navigation directly
  // This prevents the loop issue and makes navigation more predictable

  const checkOnboardingStatus = async () => {
    try {
      // Don't re-check if we're already authenticated and have completed onboarding
      // This prevents unnecessary state changes that cause navigation resets
      if (isAuthenticated && onboardingState === 'completed') {
        return;
      }
      
      // Set loading state when checking onboarding status
      setIsCheckingOnboarding(true);
      
      // Force a fresh read of AsyncStorage by clearing any potential cache
      await AsyncStorage.getAllKeys(); // This ensures fresh read
      
      // Check new onboarding_state first, fallback to old hasCompletedOnboarding for backwards compatibility
      const state = await AsyncStorage.getItem('onboarding_state');
      const oldStatus = await AsyncStorage.getItem('hasCompletedOnboarding');
      
      
      // Determine actual onboarding state
      if (state === 'completed' || oldStatus === 'true') {
        setOnboardingState('completed');
        
        // Optional: Double-check with Supabase only if user is currently authenticated
        // This prevents false negatives for returning users who need to log in first
        if (isAuthenticated && user?.id) {
          
          try {
            const { data: profileData, error: profileError } = await supabase
              .from('user_profiles')
              .select('id, onboarding_completed_at')
              .eq('user_id', user.id)
              .single();
            
            if (profileError || !profileData || !profileData.onboarding_completed_at) {
              // Don't reset the flag here - let them proceed and fix data on next onboarding if needed
            } else {
            }
          } catch (supabaseError) {
            // Don't reset onboarding status due to network/DB errors
          }
        }
      } else if (state === 'in_progress') {
        setOnboardingState('in_progress');
      } else {
        // User hasn't started or completed onboarding
        setOnboardingState('not_started');
      }
      
      // No need to navigate here - CompletionScreen handles navigation directly
    } catch (error) {
      setOnboardingState('not_started'); // Default to showing onboarding
    } finally {
      setIsCheckingOnboarding(false);
    }
  };

  // Show loading screen while checking authentication or onboarding status
  if (isLoading || isCheckingOnboarding) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background.primary }]}>
        <ActivityIndicator size="large" color={colors.brand.accent} />
      </View>
    );
  }

  // Helper function to check if current screen belongs to a specific stack
  const isInStack = (currentRouteName, targetStack) => {
    const onboardingScreens = ['Welcome', 'BasicInfo', 'Consent', 'HealthSafety', 'PhoneVerification', 'Completion'];
    const authScreens = ['SignIn', 'SignUp', 'ForgotPassword'];
    
    if (targetStack === 'Onboarding') {
      return currentRouteName === 'Onboarding' || onboardingScreens.includes(currentRouteName);
    } else if (targetStack === 'Auth') {
      return currentRouteName === 'Auth' || authScreens.includes(currentRouteName);
    } else if (targetStack === 'Main') {
      return currentRouteName === 'Main' || (!onboardingScreens.includes(currentRouteName) && !authScreens.includes(currentRouteName));
    }
    return false;
  };

  // Navigate based on current status
  const navigateBasedOnStatus = () => {
    if (!navigationRef.current || !navigationRef.current.isReady()) {
      // Try again in a moment
      setTimeout(() => navigateBasedOnStatus(), 500);
      return;
    }

    const flow = getInitialFlow();
    
    try {
      const targetScreen = flow === 'onboarding' ? 'Onboarding' : flow === 'auth' ? 'Auth' : 'Main';
      
      // Get current route
      const currentRoute = navigationRef.current.getCurrentRoute();
      
      // Check if we're already in the target stack
      if (!isInStack(currentRoute?.name, targetScreen)) {
        // Use navigate instead of reset to avoid crashes
        navigationRef.current.navigate(targetScreen);
      } else {
      }
    } catch (error) {
      // Don't crash, just log the error
    }
  };

  // New function to handle navigation based on auth and onboarding state
  const navigateBasedOnAuthAndOnboarding = () => {
    
    if (!navigationRef.current || !navigationRef.current.isReady()) {
      setTimeout(() => navigateBasedOnAuthAndOnboarding(), 100);
      return;
    }

    // Handle logout case first - if user is NOT authenticated and they're in the main stack
    if (!isAuthenticated && !user) {
      const currentRoute = navigationRef.current.getCurrentRoute();
      
      const mainStackScreens = ['Main', 'MainTabs', 'Home', 'Dashboard', 'Train', 'Data', 'Profile', 'Integrations', 'IntegrationsScreen', 'ProfileScreen', 'Sessions', 'Training', 'History', 'SimplifiedSessionSetup', 'IHHTTraining', 'PostSessionSurvey'];
      
      if (mainStackScreens.includes(currentRoute?.name) || isInStack(currentRoute?.name, 'Main')) {
        try {
          navigationRef.current.reset({
            index: 0,
            routes: [{ name: 'Auth' }],
          });
          return;
        } catch (error) {
        }
      } else {
      }
    }

    // If authenticated user, navigate to main only if not already there
    if (isAuthenticated && user) {
      const currentRoute = navigationRef.current.getCurrentRoute();
      
      // Don't navigate if we're in any of these screens (part of Main stack)
      const mainStackScreens = ['Main', 'MainTabs', 'Home', 'Integrations', 'IntegrationsScreen', 'Profile', 'ProfileScreen', 'Sessions', 'Training'];
      if (mainStackScreens.includes(currentRoute?.name)) {
        return;
      }
      
      // Also check using the existing isInStack function
      if (isInStack(currentRoute?.name, 'Main')) {
        return;
      }
      
      try {
        navigationRef.current.reset({
          index: 0,
          routes: [{ name: 'Main' }],
        });
        return;
      } catch (error) {
      }
      return;
    }

    // Skip navigation if onboarding is in progress for new users
    if (onboardingState === 'in_progress' && !isAuthenticated) {
      return;
    }

    const flow = getInitialFlow();
    const targetScreen = flow === 'onboarding' ? 'Onboarding' : flow === 'auth' ? 'Auth' : 'Main';
    const currentRoute = navigationRef.current.getCurrentRoute();
    
    
    // Check if we're already in the correct stack
    if (!isInStack(currentRoute?.name, targetScreen)) {
      try {
        // Use reset for auth state changes to ensure clean navigation stack
        navigationRef.current.reset({
          index: 0,
          routes: [{ name: targetScreen }],
        });
      } catch (error) {
        // Fallback to navigate
        try {
          navigationRef.current.navigate(targetScreen);
        } catch (navError) {
        }
      }
    } else {
    }
  };

  // Determine which flow to show based on onboarding and auth status
  const getInitialFlow = () => {
    
    // Priority 1: If authenticated user exists (returning user who signed in), go to main app
    // This handles the case where a user signs in during onboarding
    if (isAuthenticated && user) {
      // Clear the in_progress state since they're an existing user
      if (onboardingState === 'in_progress') {
      }
      return 'main';
    }
    
    // Priority 2: If onboarding is in progress (new user), stay in onboarding flow
    if (onboardingState === 'in_progress') {
      return 'onboarding';
    }
    
    // Priority 3: If user hasn't completed onboarding, show onboarding flow
    if (onboardingState !== 'completed') {
      return 'onboarding';
    }
    
    // Priority 4: If onboarding is complete but not authenticated, show auth flow
    if (!isAuthenticated) {
      return 'auth';
    }
    
    // Priority 5: If onboarding complete AND authenticated, show main app
    return 'main';
  };



  // Recalculate flow on every render to respond to state changes
  const currentFlow = getInitialFlow();

  return (
    <OnboardingProvider>
      <NavigationContainer 
        ref={navigationRef}
        onReady={() => {
          routeNameRef.current = navigationRef.current.getCurrentRoute().name;
        }}
        onStateChange={() => {
          const currentRouteName = navigationRef.current.getCurrentRoute().name;
          routeNameRef.current = currentRouteName;
        }}
      >
        <Stack.Navigator 
          screenOptions={{ headerShown: false }}
          initialRouteName={currentFlow === 'onboarding' ? 'Onboarding' : currentFlow === 'auth' ? 'Auth' : 'Main'}
        >
          <Stack.Screen 
            name="Onboarding" 
            component={OnboardingNavigator}
            options={{ title: 'Get Started' }}
          />
          <Stack.Screen 
            name="Auth" 
            component={AuthNavigator}
            options={{ title: 'Sign In' }}
          />
          <Stack.Screen 
            name="Main" 
            component={MainAppContent}
            options={{ title: 'Vitaliti Air' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </OnboardingProvider>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default AppNavigator; 