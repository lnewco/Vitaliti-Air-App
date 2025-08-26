import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useAppTheme } from '../theme';
import { colors } from '../design-system';
import LoginScreen from '../auth/screens/LoginScreen';
import PremiumOTPScreen from '../auth/screens/PremiumOTPScreen';

const Stack = createStackNavigator();

const AuthNavigator = () => {
  
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: {
          backgroundColor: colors.background.primary,
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
        name="PremiumOTPScreen" 
        component={PremiumOTPScreen}
        options={{
          title: 'Verify Phone',
        }}
      />
    </Stack.Navigator>
  );
};

export default AuthNavigator; 