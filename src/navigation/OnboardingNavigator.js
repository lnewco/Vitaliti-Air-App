import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { colors } from '../design-system';

// Import all onboarding screens
import WelcomeScreen from '../screens/onboarding/WelcomeScreen';
import BasicInfoScreen from '../screens/onboarding/BasicInfoScreen';
import ConsentScreen from '../screens/onboarding/ConsentScreen';
import HealthSafetyScreen from '../screens/onboarding/HealthSafetyScreen';
import PhoneVerificationScreen from '../components/PhoneVerificationScreen';
import CompletionScreen from '../screens/onboarding/CompletionScreen';

const Stack = createStackNavigator();

const OnboardingNavigator = () => {
  
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: {
          backgroundColor: colors.background.primary,
        },
        gestureEnabled: false, // Prevent going back during onboarding
        presentation: 'card',
        animationTypeForReplace: 'push',
        cardStyleInterpolator: ({ current, layouts }) => {
          return {
            cardStyle: {
              transform: [
                {
                  translateX: current.progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [layouts.screen.width, 0],
                  }),
                },
              ],
            },
          };
        },
      }}
    >
      <Stack.Screen 
        name="Welcome" 
        component={WelcomeScreen}
        options={{ title: 'Welcome' }}
      />
      <Stack.Screen 
        name="BasicInfo" 
        component={BasicInfoScreen}
        options={{ title: 'Basic Information' }}
      />
      <Stack.Screen 
        name="Consent" 
        component={ConsentScreen}
        options={{ title: 'Consent & Agreements' }}
      />
      <Stack.Screen 
        name="HealthSafety" 
        component={HealthSafetyScreen}
        options={{ title: 'Health & Safety' }}
      />
      <Stack.Screen 
        name="PhoneVerification" 
        component={PhoneVerificationScreen}
        options={{ title: 'Phone Verification' }}
        initialParams={{ isOnboarding: true }}
      />
      <Stack.Screen 
        name="Completion" 
        component={CompletionScreen}
        options={{ title: 'Complete' }}
      />
    </Stack.Navigator>
  );
};

export default OnboardingNavigator; 