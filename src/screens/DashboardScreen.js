import React, { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  SafeAreaView,
  Alert 
} from 'react-native';
import EnhancedSessionManager from '../services/EnhancedSessionManager';

const DashboardScreen = ({ navigation }) => {
  const [sessionInfo, setSessionInfo] = useState(EnhancedSessionManager.getSessionInfo());

  useEffect(() => {
    const interval = setInterval(() => {
      setSessionInfo(EnhancedSessionManager.getSessionInfo());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const navigateToSessionSetup = () => {
    navigation.navigate('SessionSetup');
  };

  // TEMPORARY: Reset function for testing onboarding
  const resetForOnboardingTest = async () => {
    try {
      // Clear all onboarding-related data
      await AsyncStorage.removeItem('onboarding_state');
      await AsyncStorage.removeItem('hasCompletedOnboarding');
      await AsyncStorage.removeItem('onboarding_completion_finished');
      await AsyncStorage.removeItem('onboarding_force_complete');
      await AsyncStorage.removeItem('onboarding_user_confirmed');
      await AsyncStorage.clear();
      
      console.log('🧹 AsyncStorage fully cleared - restart app to test onboarding');
      console.log('🔄 All onboarding flags removed');
      
      Alert.alert(
        'Reset Complete', 
        'App data cleared. Close the app COMPLETELY (swipe up and swipe away), then reopen to test new user onboarding.',
        [{ text: 'OK', onPress: () => console.log('User should close app now') }]
      );
    } catch (error) {
      console.error('Failed to clear AsyncStorage:', error);
    }
  };





  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Vitaliti Air</Text>
        <Text style={styles.subtitle}>Intermittent Hypoxic-Hyperoxic Training</Text>
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeIcon}>🫁</Text>
          <Text style={styles.welcomeText}>Ready to start your training session?</Text>
          <Text style={styles.welcomeSubtext}>
            Connect your pulse oximeter and begin monitoring your oxygen levels
          </Text>
        </View>

                      <TouchableOpacity 
                style={styles.startButton}
                onPress={navigateToSessionSetup}
              >
                <Text style={styles.startButtonText}>Start Session</Text>
              </TouchableOpacity>
              
              {/* TEMPORARY: Test button for onboarding reset */}
              <TouchableOpacity 
                style={[styles.startButton, { backgroundColor: '#EF4444', marginTop: 20 }]}
                onPress={resetForOnboardingTest}
              >
                <Text style={styles.startButtonText}>🧪 Reset for Onboarding Test</Text>
              </TouchableOpacity>
              


        <View style={styles.infoSection}>
          <Text style={styles.infoText}>
            🔹 Connect your pulse oximeter{'\n'}
            🔹 Follow the guided setup{'\n'}
            🔹 Begin your IHHT training
          </Text>
        </View>


      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  welcomeSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  welcomeIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 12,
  },
  welcomeSubtext: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  startButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 40,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },

  infoSection: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  infoText: {
    fontSize: 16,
    color: '#374151',
    lineHeight: 24,
  },

});

export default DashboardScreen; 