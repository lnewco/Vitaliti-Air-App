import React, { useEffect, useState, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet, AppState } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAuth } from '../auth/AuthContext';
import { OnboardingProvider } from '../context/OnboardingContext';
import { useAppTheme } from '../theme';
import AuthNavigator from './AuthNavigator';
import OnboardingNavigator from './OnboardingNavigator';
import MainAppContent from '../screens/MainAppContent';
import { supabase } from '../config/supabase';

const Stack = createStackNavigator();

const AppNavigator = () => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { colors } = useAppTheme();
  const [onboardingState, setOnboardingState] = useState(null); // 'not_started' | 'in_progress' | 'completed'
  const [isCheckingOnboarding, setIsCheckingOnboarding] = useState(true);
  const navigationRef = useRef();
  const routeNameRef = useRef();
  const hasCheckedOnboardingRef = useRef(false); // Track if we've checked for current auth session

  useEffect(() => {
    checkOnboardingStatus();
  }, []);

  // Check onboarding status when auth state changes to authenticated
  useEffect(() => {
    if (isAuthenticated) {
      console.log('🔄 Auth state changed to authenticated - checking onboarding status');
      
      // Add a small delay to ensure AsyncStorage has been updated by PhoneVerificationScreen
      setTimeout(async () => {
        console.log('🔄 Delayed onboarding status check after auth state change');
        await checkOnboardingStatus();
        
        // Also check if onboarding completion just finished
        await checkForCompletionTransition();
      }, 300); // 300ms delay to ensure AsyncStorage is written
      
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
        console.log('🔄 Skipping navigation - onboarding is in progress');
      }
    }
  }, [isLoading, isCheckingOnboarding, onboardingState]); // No isAuthenticated dependency here

  // Listen for app state changes to re-check onboarding status
  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      if (nextAppState === 'active') {
        console.log('🔄 App became active - re-checking onboarding status');
        
        // Check if there's an active session - if so, skip navigation changes
        try {
          const EnhancedSessionManager = require('../services/EnhancedSessionManager').default;
          const sessionInfo = EnhancedSessionManager.getSessionInfo();
          if (sessionInfo.isActive && !sessionInfo.isPaused) {
            console.log('🔄 Skipping navigation check - active session in progress');
            return;
          }
        } catch (error) {
          console.log('🔄 Could not check session status, proceeding with navigation check');
        }
        
        // Skip navigation if we're already authenticated and in the main app
        if (isAuthenticated && onboardingState === 'completed') {
          console.log('🔄 Already in main app, skipping navigation');
          return;
        }
        
        checkOnboardingStatus();
        
        // Don't check for completion transitions when already in main app
        // This was causing unwanted navigation
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, []);

  // Check if onboarding completion just finished and handle navigation
  const checkForCompletionTransition = async () => {
    try {
      const forceComplete = await AsyncStorage.getItem('onboarding_force_complete');
      const userConfirmed = await AsyncStorage.getItem('onboarding_user_confirmed');
      const onboardingState = await AsyncStorage.getItem('onboarding_state');
      
      if (forceComplete === 'true' && userConfirmed === 'true' && onboardingState === 'completed' && isAuthenticated) {
        console.log('🔄 FORCED onboarding completion detected - navigating to Main app NOW');
        
        // Clear ALL completion flags
        await AsyncStorage.removeItem('onboarding_force_complete');
        await AsyncStorage.removeItem('onboarding_user_confirmed');
        await AsyncStorage.removeItem('onboarding_completion_finished');
        
        // IMMEDIATELY force navigation to Main app using the ROOT navigator
        if (navigationRef.current && navigationRef.current.isReady()) {
          try {
            console.log('🔄 EXECUTING FORCED navigation reset to Main app');
            navigationRef.current.reset({
              index: 0,
              routes: [{ name: 'Main' }],
            });
            console.log('✅ FORCED navigation completed successfully');
          } catch (error) {
            console.error('❌ FORCED navigation reset failed:', error);
          }
        } else {
          console.error('❌ Navigation ref not ready for forced navigation');
        }
      }
    } catch (error) {
      console.error('❌ Error checking completion transition:', error);
    }
  };

  // Removed periodic check - CompletionScreen now handles navigation directly
  // This prevents the loop issue and makes navigation more predictable

  const checkOnboardingStatus = async () => {
    try {
      // Set loading state when checking onboarding status
      setIsCheckingOnboarding(true);
      
      // Force a fresh read of AsyncStorage by clearing any potential cache
      await AsyncStorage.getAllKeys(); // This ensures fresh read
      
      // Check new onboarding_state first, fallback to old hasCompletedOnboarding for backwards compatibility
      const state = await AsyncStorage.getItem('onboarding_state');
      const oldStatus = await AsyncStorage.getItem('hasCompletedOnboarding');
      
      console.log('🔄 AppNavigator: FRESH onboarding state from AsyncStorage:', state || 'not set');
      console.log('🔄 AppNavigator: FRESH legacy onboarding status:', oldStatus || 'not set');
      
      // Determine actual onboarding state
      if (state === 'completed' || oldStatus === 'true') {
        setOnboardingState('completed');
        
        // Optional: Double-check with Supabase only if user is currently authenticated
        // This prevents false negatives for returning users who need to log in first
        if (isAuthenticated && user?.id) {
          console.log('🔄 AppNavigator: Double-checking onboarding completion in Supabase for authenticated user:', user.id);
          
          try {
            const { data: profileData, error: profileError } = await supabase
              .from('user_profiles')
              .select('id, onboarding_completed_at')
              .eq('user_id', user.id)
              .single();
            
            if (profileError || !profileData || !profileData.onboarding_completed_at) {
              console.log('🔄 AppNavigator: Warning: AsyncStorage says complete but no Supabase data found');
              // Don't reset the flag here - let them proceed and fix data on next onboarding if needed
            } else {
              console.log('🔄 AppNavigator: Onboarding completion verified in Supabase:', profileData);
            }
          } catch (supabaseError) {
            console.error('🔄 AppNavigator: Error checking Supabase onboarding status:', supabaseError);
            // Don't reset onboarding status due to network/DB errors
          }
        }
      } else if (state === 'in_progress') {
        setOnboardingState('in_progress');
        console.log('🔄 AppNavigator: Onboarding is in progress, will not reset navigation');
      } else {
        // User hasn't started or completed onboarding
        setOnboardingState('not_started');
      }
      
      // No need to navigate here - CompletionScreen handles navigation directly
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      setOnboardingState('not_started'); // Default to showing onboarding
    } finally {
      setIsCheckingOnboarding(false);
    }
  };

  // Show loading screen while checking authentication or onboarding status
  if (isLoading || isCheckingOnboarding) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors?.surface?.background || '#FFFFFF' }]}>
        <ActivityIndicator size="large" color={colors?.primary?.[500] || '#2563EB'} />
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
      console.log('🔄 Navigation not ready yet');
      // Try again in a moment
      setTimeout(() => navigateBasedOnStatus(), 500);
      return;
    }

    const flow = getInitialFlow();
    console.log('🔄 Navigating to flow:', flow);
    
    try {
      const targetScreen = flow === 'onboarding' ? 'Onboarding' : flow === 'auth' ? 'Auth' : 'Main';
      
      // Get current route
      const currentRoute = navigationRef.current.getCurrentRoute();
      console.log('🔄 Current route:', currentRoute?.name);
      
      // Check if we're already in the target stack
      if (!isInStack(currentRoute?.name, targetScreen)) {
        console.log('🔄 Not in target stack, navigating to:', targetScreen);
        // Use navigate instead of reset to avoid crashes
        navigationRef.current.navigate(targetScreen);
      } else {
        console.log('🔄 Already in target stack, skipping navigation');
      }
    } catch (error) {
      console.error('Navigation failed:', error);
      // Don't crash, just log the error
    }
  };

  // New function to handle navigation based on auth and onboarding state
  const navigateBasedOnAuthAndOnboarding = () => {
    if (!navigationRef.current || !navigationRef.current.isReady()) {
      console.log('🔄 Navigation not ready for auth state change');
      setTimeout(() => navigateBasedOnAuthAndOnboarding(), 100);
      return;
    }

    // If authenticated user, navigate to main only if not already there
    if (isAuthenticated && user) {
      const currentRoute = navigationRef.current.getCurrentRoute();
      console.log('🔄 Current route:', currentRoute?.name);
      
      // Don't navigate if we're in any of these screens (part of Main stack)
      const mainStackScreens = ['Main', 'MainTabs', 'Home', 'Integrations', 'IntegrationsScreen', 'Profile', 'ProfileScreen', 'Sessions', 'Training'];
      if (mainStackScreens.includes(currentRoute?.name)) {
        console.log('🔄 Already in main app (screen: ' + currentRoute?.name + '), skipping navigation');
        return;
      }
      
      // Also check using the existing isInStack function
      if (isInStack(currentRoute?.name, 'Main')) {
        console.log('🔄 Already in main app stack, skipping navigation');
        return;
      }
      
      console.log('🔄 Authenticated user detected - navigating to main app');
      try {
        navigationRef.current.reset({
          index: 0,
          routes: [{ name: 'Main' }],
        });
        console.log('✅ Navigation to main app successful');
        return;
      } catch (error) {
        console.error('Navigation to main failed:', error);
      }
      return;
    }

    // Skip navigation if onboarding is in progress for new users
    if (onboardingState === 'in_progress' && !isAuthenticated) {
      console.log('🔄 Onboarding in progress for new user - skipping navigation reset');
      return;
    }

    const flow = getInitialFlow();
    const targetScreen = flow === 'onboarding' ? 'Onboarding' : flow === 'auth' ? 'Auth' : 'Main';
    const currentRoute = navigationRef.current.getCurrentRoute();
    
    console.log('🔄 Auth state changed - current screen:', currentRoute?.name, ', target stack:', targetScreen);
    
    // Check if we're already in the correct stack
    if (!isInStack(currentRoute?.name, targetScreen)) {
      console.log('🔄 Navigating from', currentRoute?.name, 'to', targetScreen);
      try {
        // Use reset for auth state changes to ensure clean navigation stack
        navigationRef.current.reset({
          index: 0,
          routes: [{ name: targetScreen }],
        });
      } catch (error) {
        console.error('Navigation after auth change failed:', error);
        // Fallback to navigate
        try {
          navigationRef.current.navigate(targetScreen);
        } catch (navError) {
          console.error('Fallback navigation also failed:', navError);
        }
      }
    } else {
      console.log('🔄 Already in correct stack (', targetScreen, '), skipping navigation');
    }
  };

  // Determine which flow to show based on onboarding and auth status
  const getInitialFlow = () => {
    console.log('🔄 AppNavigator: Determining flow...');
    console.log('🔄 isAuthenticated:', isAuthenticated);
    console.log('🔄 onboardingState:', onboardingState);
    
    // Priority 1: If authenticated user exists (returning user who signed in), go to main app
    // This handles the case where a user signs in during onboarding
    if (isAuthenticated && user) {
      console.log('🔄 Flow: main (authenticated user, skipping onboarding)');
      // Clear the in_progress state since they're an existing user
      if (onboardingState === 'in_progress') {
        AsyncStorage.setItem('onboarding_state', 'completed').catch(console.error);
      }
      return 'main';
    }
    
    // Priority 2: If onboarding is in progress (new user), stay in onboarding flow
    if (onboardingState === 'in_progress') {
      console.log('🔄 Flow: onboarding (continuing in-progress onboarding)');
      return 'onboarding';
    }
    
    // Priority 3: If user hasn't completed onboarding, show onboarding flow
    if (onboardingState !== 'completed') {
      console.log('🔄 Flow: onboarding (user needs to complete onboarding)');
      return 'onboarding';
    }
    
    // Priority 4: If onboarding is complete but not authenticated, show auth flow
    if (!isAuthenticated) {
      console.log('🔄 Flow: auth (returning user needs to log in)');
      return 'auth';
    }
    
    // Priority 5: If onboarding complete AND authenticated, show main app
    console.log('🔄 Flow: main (completed user, authenticated)');
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