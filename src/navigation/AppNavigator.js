import React, { useEffect, useState, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet, AppState } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAuth } from '../auth/AuthContext';
import { OnboardingProvider } from '../context/OnboardingContext';
import AuthNavigator from './AuthNavigator';
import OnboardingNavigator from './OnboardingNavigator';
import MainAppContent from '../screens/MainAppContent';
import { supabase } from '../config/supabase';

const Stack = createStackNavigator();

const AppNavigator = () => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(null);
  const [isCheckingOnboarding, setIsCheckingOnboarding] = useState(true);
  const navigationRef = useRef();
  const routeNameRef = useRef();

  useEffect(() => {
    checkOnboardingStatus();
  }, []);

  // Re-check onboarding status and navigate when authentication state changes
  useEffect(() => {
    if (isAuthenticated) {
      checkOnboardingStatus();
    }
    // Navigate when auth state changes and we're ready
    if (!isLoading && !isCheckingOnboarding && hasSeenOnboarding !== null) {
      navigateBasedOnAuthAndOnboarding();
    }
  }, [isAuthenticated, isLoading, isCheckingOnboarding, hasSeenOnboarding]);

  // Listen for app state changes to re-check onboarding status
  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      if (nextAppState === 'active') {
        console.log('🔄 App became active - re-checking onboarding status');
        checkOnboardingStatus();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, []);

  // Periodic check for onboarding completion (useful when onboarding completes)
  useEffect(() => {
    const interval = setInterval(() => {
      // Check if we're in onboarding mode (regardless of auth status)
      if (!hasSeenOnboarding) {
        console.log('🔄 Periodic check - looking for onboarding completion');
        checkOnboardingStatus();
      }
    }, 2000); // Check every 2 seconds when in onboarding mode

    return () => clearInterval(interval);
  }, [hasSeenOnboarding]);

  const checkOnboardingStatus = async () => {
    try {
      // Don't set isCheckingOnboarding if we're doing periodic checks
      if (hasSeenOnboarding === null) {
        setIsCheckingOnboarding(true);
      }
      const onboardingStatus = await AsyncStorage.getItem('hasCompletedOnboarding');
      console.log('🔄 AppNavigator: Raw onboarding status from AsyncStorage:', onboardingStatus);
      
      const previousStatus = hasSeenOnboarding;
      
      // For returning users, trust AsyncStorage primarily
      // Only verify with Supabase if user is currently authenticated AND we have concerns about data integrity
      if (onboardingStatus === 'true') {
        // User has completed onboarding according to AsyncStorage
        setHasSeenOnboarding(true);
        
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
      } else {
        // User hasn't completed onboarding
        setHasSeenOnboarding(false);
      }
      
      // If onboarding status changed and navigation is ready, navigate accordingly
      if (previousStatus !== null && previousStatus !== (onboardingStatus === 'true')) {
        console.log('🔄 Onboarding status changed from', previousStatus, 'to', onboardingStatus === 'true');
        // Delay navigation slightly to ensure navigation is ready
        setTimeout(() => {
          navigateBasedOnStatus();
        }, 100);
      }
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      setHasSeenOnboarding(false); // Default to showing onboarding
    } finally {
      setIsCheckingOnboarding(false);
    }
  };

  // Show loading screen while checking authentication or onboarding status
  if (isLoading || isCheckingOnboarding) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

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
      
      // Only navigate if we're not already on the target screen
      if (currentRoute?.name !== targetScreen) {
        // Use navigate instead of reset to avoid crashes
        navigationRef.current.navigate(targetScreen);
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

    const flow = getInitialFlow();
    const targetScreen = flow === 'onboarding' ? 'Onboarding' : flow === 'auth' ? 'Auth' : 'Main';
    const currentRoute = navigationRef.current.getCurrentRoute();
    
    console.log('🔄 Auth state changed - navigating from', currentRoute?.name, 'to', targetScreen);
    
    if (currentRoute?.name !== targetScreen) {
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
    }
  };

  // Determine which flow to show based on onboarding and auth status
  const getInitialFlow = () => {
    console.log('🔄 AppNavigator: Determining flow...');
    console.log('🔄 isAuthenticated:', isAuthenticated);
    console.log('🔄 hasSeenOnboarding:', hasSeenOnboarding);
    
    // Priority 1: If user hasn't completed onboarding, always show onboarding flow
    // (even if they're authenticated - they might be mid-onboarding)
    if (!hasSeenOnboarding) {
      console.log('🔄 Flow: onboarding (user needs to complete onboarding)');
      return 'onboarding';
    }
    
    // Priority 2: If onboarding is complete but not authenticated, show auth flow
    if (!isAuthenticated) {
      console.log('🔄 Flow: auth (returning user needs to log in)');
      return 'auth';
    }
    
    // Priority 3: If onboarding complete AND authenticated, show main app
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
    backgroundColor: '#FFFFFF',
  },
});

export default AppNavigator; 