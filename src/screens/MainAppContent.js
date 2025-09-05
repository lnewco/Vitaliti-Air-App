import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaView, StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../auth/AuthContext';
import { colors } from '../design-system';
import PremiumDashboard from './PremiumDashboard';
import SessionHistoryScreen from './SessionHistoryScreen';
import SimplifiedSessionSetup from './SimplifiedSessionSetup';
import IHHTSessionSimple from './IHHTSessionSimple';
import PostSessionSurveyScreen from './PostSessionSurveyScreen';
import PremiumProfileScreen from './PremiumProfileScreen';
import IntegrationsScreen from './IntegrationsScreen';
import SettingsScreen from './SettingsScreen';
import SessionRecoveryManager from '../components/SessionRecoveryManager';
import SafeIcon from '../components/base/SafeIcon';
import FloatingTabBar from '../design-system/components/FloatingTabBar';


const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// Tab Navigator for Dashboard and History
function TabNavigator() {
  
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
      }}
      tabBar={props => <FloatingTabBar {...props} />}
    >
      <Tab.Screen 
        name="Dashboard" 
        component={PremiumDashboard}
        options={{
          tabBarLabel: 'Monitor',
          tabBarIcon: ({ color, size }) => (
            <SafeIcon name="chart" size="sm" color={color} />
          ),
          tabBarLabelStyle: {
            fontSize: 14,
            fontWeight: '600',
          },
        }}
      />
      <Tab.Screen 
        name="Profile" 
        component={PremiumProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <SafeIcon name="profile" size="sm" color={color} />
          ),
          tabBarLabelStyle: {
            fontSize: 14,
            fontWeight: '600',
          },
        }}
      />
    </Tab.Navigator>
  );
}

// Stack Navigator Component with navigation handling
const MainStack = ({ onNavigateToSession }) => {
  
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: colors.background.tertiary,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: colors.border.light,
        },
        headerTintColor: colors.text.primary,
        headerTitleStyle: {
          color: colors.text.primary,
          fontSize: 18,
          fontWeight: '600',
        },
        headerBackTitleVisible: false,
        headerBackTitle: 'Back',
      }}
    >
      <Stack.Screen 
        name="MainTabs" 
        component={TabNavigator}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen 
        name="SessionSetup" 
        component={SimplifiedSessionSetup}
        options={{
          presentation: 'card',
          title: 'Training Session Setup',
        }}
      />

      <Stack.Screen 
        name="IHHTSessionSimple" 
        component={IHHTSessionSimple}
        options={{
          presentation: 'card',
          headerShown: false,
        }}
      />
      
      <Stack.Screen 
        name="PostSessionSurvey" 
        component={PostSessionSurveyScreen}
        options={{
          presentation: 'card',
          title: 'Post-Session Survey',
        }}
      />
      
      <Stack.Screen 
        name="Integrations" 
        component={IntegrationsScreen}
        options={{
          presentation: 'card',
          title: 'Integrations',
        }}
      />
      
      <Stack.Screen 
        name="Settings" 
        component={SettingsScreen}
        options={{
          presentation: 'card',
          headerShown: false,
        }}
      />
      
    </Stack.Navigator>
  );
};

// Main App Content with Stack Navigator (authenticated users only)
const MainAppContent = () => {
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      console.log('🔐 Sign out clicked (temporary - not implemented)');
      // await signOut();
    } catch (error) {
      console.error('❌ Sign out error:', error);
    }
  };

  // Create a navigation callback - but let's just remove this and fix the real issue
  const handleNavigateToSession = () => {
    console.log('🔄 MainAppContent - This approach won\'t work');
  };

  return (
    <>
      <MainStack />
      <SessionRecoveryManager onNavigateToSession={handleNavigateToSession} />
    </>
  );
};

export default MainAppContent; 