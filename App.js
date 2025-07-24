import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { LogBox } from 'react-native';
import { BluetoothProvider } from './src/context/BluetoothContext';

// Hide error overlays from app UI but keep console logging for debugging
LogBox.ignoreAllLogs();
import DashboardScreen from './src/screens/DashboardScreen';
import SessionHistoryScreen from './src/screens/SessionHistoryScreen';
import SessionSetupScreen from './src/screens/SessionSetupScreen';
import IHHTTrainingScreen from './src/screens/IHHTTrainingScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// Tab Navigator for Dashboard and History
function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#e0e0e0',
          paddingBottom: 10,
          paddingTop: 5,
        },
        tabBarActiveTintColor: '#2196F3',
        tabBarInactiveTintColor: '#666666',
      }}
    >
      <Tab.Screen 
        name="Dashboard" 
        component={DashboardScreen}
        options={{
          tabBarLabel: '🏠 Home',
          tabBarLabelStyle: {
            fontSize: 14,
            fontWeight: '600',
          },
        }}
      />
      <Tab.Screen 
        name="History" 
        component={SessionHistoryScreen}
        options={{
          tabBarLabel: '📈 History',
          tabBarLabelStyle: {
            fontSize: 14,
            fontWeight: '600',
          },
        }}
      />
    </Tab.Navigator>
  );
}

// Main Stack Navigator
function AppNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="Main" component={TabNavigator} />
      <Stack.Screen 
        name="SessionSetup" 
        component={SessionSetupScreen}
        options={{
          presentation: 'card',
        }}
      />
      <Stack.Screen 
        name="AirSession" 
        component={IHHTTrainingScreen}
        options={{
          presentation: 'card',
        }}
      />
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <BluetoothProvider>
      <NavigationContainer>
        <StatusBar style="auto" />
        <AppNavigator />
      </NavigationContainer>
    </BluetoothProvider>
  );
}
