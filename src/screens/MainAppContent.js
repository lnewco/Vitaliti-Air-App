import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaView, StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import DashboardScreen from './DashboardScreen';
import SessionHistoryScreen from './SessionHistoryScreen';
import SessionSetupScreen from './SessionSetupScreen';
import IHHTTrainingScreen from './IHHTTrainingScreen';
import PostSessionSurveyScreen from './PostSessionSurveyScreen';
import PreSessionSurveyScreen from './PreSessionSurveyScreen';

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
          tabBarLabel: 'Monitor',
          tabBarIcon: ({ color, size }) => (
            <Text style={{ fontSize: 20 }}>📊</Text>
          ),
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
          tabBarLabel: 'History',
          tabBarIcon: ({ color, size }) => (
            <Text style={{ fontSize: 20 }}>📈</Text>
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

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="MainTabs" component={TabNavigator} />
      <Stack.Screen 
        name="SessionSetup" 
        component={SessionSetupScreen}
        options={{
          presentation: 'card',
        }}
      />
      <Stack.Screen 
        name="PreSessionSurvey" 
        component={PreSessionSurveyScreen}
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
      <Stack.Screen 
        name="PostSessionSurvey" 
        component={PostSessionSurveyScreen}
        options={{
          presentation: 'card',
        }}
      />
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2563EB',
  },
  signOutButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
  },
  signOutText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingBottom: 10,
    paddingTop: 5,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 5,
  },
  activeTab: {
    backgroundColor: '#f0f8ff',
    borderRadius: 8,
    marginHorizontal: 10,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
  },
  activeTabText: {
    color: '#2196F3',
  },
});

export default MainAppContent; 