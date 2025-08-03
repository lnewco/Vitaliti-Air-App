import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
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

  useEffect(() => {
    checkOnboardingStatus();
  }, []);

  // Re-check onboarding status when authentication state changes
  useEffect(() => {
    if (isAuthenticated) {
      checkOnboardingStatus();
    }
  }, [isAuthenticated]);

  const checkOnboardingStatus = async () => {
    try {
      const onboardingStatus = await AsyncStorage.getItem('hasCompletedOnboarding');
      console.log('🔄 AppNavigator: Raw onboarding status from AsyncStorage:', onboardingStatus);
      
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

  const initialFlow = getInitialFlow();

  return (
    <OnboardingProvider>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {initialFlow === 'onboarding' && (
            <Stack.Screen 
              name="Onboarding" 
              component={OnboardingNavigator}
              options={{ title: 'Get Started' }}
            />
          )}
          {initialFlow === 'auth' && (
            <Stack.Screen 
              name="Auth" 
              component={AuthNavigator}
              options={{ title: 'Sign In' }}
            />
          )}
          {initialFlow === 'main' && (
            <Stack.Screen 
              name="Main" 
              component={MainAppContent}
              options={{ title: 'Vitaliti Air' }}
            />
          )}
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