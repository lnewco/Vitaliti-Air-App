import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import OnboardingProgressIndicator from '../../components/OnboardingProgressIndicator';

const WelcomeScreen = ({ navigation }) => {
  const handleGetStarted = async () => {
    // Mark onboarding as in progress
    try {
      await AsyncStorage.setItem('onboarding_state', 'in_progress');
      console.log('📝 Onboarding state set to: in_progress');
    } catch (error) {
      console.error('Failed to save onboarding state:', error);
    }
    
    navigation.navigate('BasicInfo');
  };

  return (
    <SafeAreaView style={styles.container}>
      <OnboardingProgressIndicator currentStep={1} totalSteps={5} />
      
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <View style={styles.logoPlaceholder}>
            <Text style={styles.logoText}>Vitaliti Air</Text>
          </View>
        </View>
        
        <View style={styles.textContainer}>
          <Text style={styles.title}>Welcome to Vitaliti Air</Text>
          <Text style={styles.subtitle}>
            Optimize your health with personalized IHHT training. 
            Let's get you set up in just a few simple steps.
          </Text>
        </View>
        
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={styles.getStartedButton}
            onPress={handleGetStarted}
          >
            <Text style={styles.getStartedButtonText}>Get Started</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 320,
  },
  buttonContainer: {
    width: '100%',
    paddingBottom: 20,
  },
  getStartedButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  getStartedButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
});

export default WelcomeScreen; 