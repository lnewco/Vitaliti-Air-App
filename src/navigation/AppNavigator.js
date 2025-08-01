import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

import { useAuth } from '../auth/AuthContext';
import AuthNavigator from './AuthNavigator';
import OnboardingNavigator from './OnboardingNavigator';
import MainAppContent from '../screens/MainAppContent';

const Stack = createStackNavigator();

const AppNavigator = () => {
  const { isAuthenticated, isLoading, user } = useAuth();
  
  // TODO: In Phase 6, this will check if user has completed onboarding
  const hasCompletedOnboarding = false; // Temporary for Phase 1 testing

  // Show loading screen while checking authentication
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          hasCompletedOnboarding ? (
            // User is authenticated and has completed onboarding - show main app
            <Stack.Screen 
              name="Main" 
              component={MainAppContent}
              options={{ title: 'Vitaliti Air' }}
            />
          ) : (
            // User is authenticated but needs to complete onboarding
            <Stack.Screen 
              name="Onboarding" 
              component={OnboardingNavigator}
              options={{ title: 'Get Started' }}
            />
          )
        ) : (
          // User is not authenticated - show auth screens
          <Stack.Screen 
            name="Auth" 
            component={AuthNavigator}
            options={{ title: 'Sign In' }}
          />
        )}
      </Stack.Navigator>
    </NavigationContainer>
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