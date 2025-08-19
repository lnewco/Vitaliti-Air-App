import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useAppTheme } from '../theme';
import LoginScreen from '../auth/screens/LoginScreen';
import PhoneVerificationScreen from '../components/PhoneVerificationScreen';

const Stack = createStackNavigator();

const AuthNavigator = () => {
  const { colors } = useAppTheme();
  
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: {
          backgroundColor: colors.surface.background,
        },
        gestureEnabled: true,
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
        name="LoginScreen" 
        component={LoginScreen}
        options={{
          title: 'Sign In',
        }}
      />
      <Stack.Screen 
        name="OTPScreen" 
        component={PhoneVerificationScreen}
        options={{
          title: 'Verify Phone',
        }}
        initialParams={{ isOnboarding: false }}
      />
    </Stack.Navigator>
  );
};

export default AuthNavigator; 