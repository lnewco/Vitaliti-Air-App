import React, { useState, useEffect } from 'react';
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
import ProfileScreen from './ProfileScreen';
import SessionRecoveryModal from '../components/SessionRecoveryModal';
import EnhancedSessionManager from '../services/EnhancedSessionManager';


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
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Text style={{ fontSize: 20 }}>👤</Text>
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
  const [recoveryData, setRecoveryData] = useState(null);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);

  // Check for recoverable session on mount
  useEffect(() => {
    checkForRecoverableSession();
  }, []);

  const checkForRecoverableSession = async () => {
    try {
      const recovery = await EnhancedSessionManager.getRecoverableSession();
      if (recovery) {
        console.log('🔄 Found recoverable session:', recovery);
        setRecoveryData(recovery);
        setShowRecoveryModal(true);
      }
    } catch (error) {
      console.error('❌ Error checking for recoverable session:', error);
    }
  };

  const handleResumeSession = async () => {
    if (!recoveryData) return;

    try {
      setIsRecovering(true);
      console.log('🔄 User chose to resume session');
      
      await EnhancedSessionManager.resumeSession(recoveryData);
      
      setShowRecoveryModal(false);
      setRecoveryData(null);
      
      // Note: The user will need to navigate to the session screen manually
      // or we could add automatic navigation here
      console.log('✅ Session resumed successfully');
      
    } catch (error) {
      console.error('❌ Failed to resume session:', error);
      setShowRecoveryModal(false);
      setRecoveryData(null);
    } finally {
      setIsRecovering(false);
    }
  };

  const handleDeclineRecovery = async () => {
    try {
      console.log('🗑️ User declined session recovery');
      
      await EnhancedSessionManager.declineSessionRecovery();
      
      setShowRecoveryModal(false);
      setRecoveryData(null);
      
    } catch (error) {
      console.error('❌ Error declining session recovery:', error);
    }
  };

  const handleSignOut = async () => {
    try {
      console.log('🔐 Sign out clicked (temporary - not implemented)');
      // await signOut();
    } catch (error) {
      console.error('❌ Sign out error:', error);
    }
  };

  return (
    <>
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

      <SessionRecoveryModal
        visible={showRecoveryModal}
        recoveryData={recoveryData}
        onResume={handleResumeSession}
        onDecline={handleDeclineRecovery}
        isLoading={isRecovering}
      />
    </>
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