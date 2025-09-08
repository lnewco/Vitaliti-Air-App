import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  SafeAreaView, 
  ScrollView, 
  ActivityIndicator,
  Alert 
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CommonActions } from '@react-navigation/native';
import OnboardingProgressIndicator from '../../components/OnboardingProgressIndicator';
import { useOnboarding } from '../../context/OnboardingContext';
import { useAuth } from '../../auth/AuthContext';
import { supabase } from '../../config/supabase';

const CompletionScreen = ({ navigation }) => {
  const { onboardingData, clearOnboardingData } = useOnboarding();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Auto-save when component mounts
    console.log('🔄 CompletionScreen mounted, starting auto-save...');
    
    // Use a slight delay to ensure component is fully mounted
    const timer = setTimeout(() => {
      handleSaveAndComplete();
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  const handleSaveAndComplete = async () => {
    
    if (saving) {
      console.log('⚠️ CompletionScreen: Save already in progress, skipping');
      return; // Prevent double-save
    }
    
    console.log('🔄 CompletionScreen: Starting handleSaveAndComplete');
    setSaving(true);
    
    try {
      // Test Supabase connectivity first
      const { data: testData, error: testError } = await supabase
        .from('user_profiles')
        .select('id')
        .limit(1);
      
      if (testError) {
        console.error('❌ Supabase connectivity test failed:', testError);
        throw new Error(`Supabase connection failed: ${testError.message}`);
      }
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      if (!user.id) {
        throw new Error('User ID not available');
      }

      // Check if we have valid onboarding data
      // TEMPORARILY DISABLED dateOfBirth validation
      if (!onboardingData.fullName || !onboardingData.gender) {
        console.error('💾 Missing required onboarding data:', {
          fullName: !!onboardingData.fullName,
          // dateOfBirth: !!onboardingData.dateOfBirth, // TEMPORARILY DISABLED
          gender: !!onboardingData.gender,
          researchConsent: onboardingData.researchConsent,
          liabilityWaiver: onboardingData.liabilityWaiver,
          hasHealthConditions: onboardingData.hasHealthConditions
        });
        throw new Error('Missing required onboarding data');
      }

      // Save user profile data
      const profileData = {
        user_id: user.id,
        full_name: onboardingData.fullName,
        // date_of_birth: null, // NULL allowed - date picker temporarily disabled
        gender: onboardingData.gender,
        onboarding_completed_at: new Date().toISOString(),
      };
      
      // First check if user already has a profile
      const { data: existingProfile, error: checkError } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();
      
      let profileResult;
      if (existingProfile) {
        // Update existing profile
        const { data: updateResult, error: updateError } = await supabase
          .from('user_profiles')
          .update(profileData)
          .eq('user_id', user.id)
          .select();
        
        if (updateError) {
          console.error('❌ Profile update error:', updateError);
          console.error('❌ Profile error details:', JSON.stringify(updateError, null, 2));
          throw new Error(`Failed to update profile data: ${updateError.message}`);
        }
        profileResult = updateResult;
      } else {
        // Insert new profile
        const { data: insertResult, error: insertError } = await supabase
          .from('user_profiles')
          .insert(profileData)
          .select();
        
        if (insertError) {
          console.error('❌ Profile insert error:', insertError);
          console.error('❌ Profile error details:', JSON.stringify(insertError, null, 2));
          throw new Error(`Failed to create profile data: ${insertError.message}`);
        }
        profileResult = insertResult;
      }
      
      console.log('✅ Profile data saved successfully:', profileResult);

      // Save consent data
      const consentData = {
        user_id: user.id,
        research_consent: onboardingData.researchConsent,
        liability_waiver: onboardingData.liabilityWaiver,
        consented_at: new Date().toISOString(),
      };
      
      // Check if user already has consent record
      const { data: existingConsent } = await supabase
        .from('user_consents')
        .select('id')
        .eq('user_id', user.id)
        .single();
      
      let consentResult;
      if (existingConsent) {
        // Update existing consent
        const { data: updateResult, error: updateError } = await supabase
          .from('user_consents')
          .update(consentData)
          .eq('user_id', user.id)
          .select();
        
        if (updateError) {
          console.error('❌ Consent update error:', updateError);
          console.error('❌ Consent error details:', JSON.stringify(updateError, null, 2));
          throw new Error(`Failed to update consent data: ${updateError.message}`);
        }
        consentResult = updateResult;
      } else {
        // Insert new consent
        const { data: insertResult, error: insertError } = await supabase
          .from('user_consents')
          .insert(consentData)
          .select();
        
        if (insertError) {
          console.error('❌ Consent insert error:', insertError);
          console.error('❌ Consent error details:', JSON.stringify(insertError, null, 2));
          throw new Error(`Failed to create consent data: ${insertError.message}`);
        }
        consentResult = insertResult;
      }
      
      console.log('✅ Consent data saved successfully:', consentResult);

      // Save health screening data
      const healthData = {
        user_id: user.id,
        has_conditions: onboardingData.hasHealthConditions,
        conditions_list: onboardingData.healthConditionsList || [],
        screened_at: new Date().toISOString(),
      };
      
      // Check if user already has health record
      const { data: existingHealth } = await supabase
        .from('health_eligibility')
        .select('id')
        .eq('user_id', user.id)
        .single();
      
      let healthResult;
      if (existingHealth) {
        // Update existing health record
        const { data: updateResult, error: updateError } = await supabase
          .from('health_eligibility')
          .update(healthData)
          .eq('user_id', user.id)
          .select();
        
        if (updateError) {
          console.error('❌ Health update error:', updateError);
          console.error('❌ Health error details:', JSON.stringify(updateError, null, 2));
          throw new Error(`Failed to update health screening data: ${updateError.message}`);
        }
        healthResult = updateResult;
      } else {
        // Insert new health record
        const { data: insertResult, error: insertError } = await supabase
          .from('health_eligibility')
          .insert(healthData)
          .select();
        
        if (insertError) {
          console.error('❌ Health insert error:', insertError);
          console.error('❌ Health error details:', JSON.stringify(insertError, null, 2));
          throw new Error(`Failed to create health screening data: ${insertError.message}`);
        }
        healthResult = insertResult;
      }
      
      console.log('✅ Health data saved successfully:', healthResult);

      // Mark onboarding as completed in AsyncStorage (both new and legacy keys for compatibility)
      await AsyncStorage.setItem('onboarding_state', 'completed');
      await AsyncStorage.setItem('hasCompletedOnboarding', 'true'); // Keep for backwards compatibility
      
      console.log('✅ All onboarding data saved successfully!');
      console.log('📝 Onboarding state set to: completed');
      
      // Clear onboarding data from memory
      clearOnboardingData();
      
      // Show success and proceed
      setTimeout(() => {
        setSaving(false);
        // Immediately proceed to main app
        proceedToMainApp();
      }, 1000); // Shorter delay to get to main app faster
      
    } catch (error) {
      console.error('❌ Save onboarding error:', error);
      console.error('❌ Error stack:', error.stack);
      setSaving(false);
      
      Alert.alert(
        'Save Error',
        `There was a problem saving your information: ${error.message}\n\nPlease try again.`,
        [
          { text: 'Retry', onPress: handleSaveAndComplete },
          { text: 'Skip for now', onPress: proceedToMainApp, style: 'cancel' }
        ]
      );
    }
  };

  const proceedToMainApp = () => {
    // Clear onboarding data from memory
    clearOnboardingData();
    
    console.log('✅ Onboarding completed - data saved and flags set');
    console.log('🔄 AppNavigator will handle navigation to Main app');
    
    // Don't navigate manually - let AppNavigator detect the completion
    // The onboarding_state = 'completed' + isAuthenticated = true will trigger
    // the navigation in AppNavigator automatically
    
    // Set a flag to indicate completion is finished
    setTimeout(async () => {
      try {
        await AsyncStorage.setItem('onboarding_completion_finished', 'true');
        console.log('📝 Onboarding completion process finished');
      } catch (error) {
        console.error('Failed to set completion finished flag:', error);
      }
    }, 100);
  };

  return (
    <SafeAreaView style={styles.container}>
      <OnboardingProgressIndicator currentStep={5} totalSteps={5} />
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>
            {saving ? 'Setting Up Your Profile...' : 'Welcome to Vitaliti Air!'}
          </Text>
          <Text style={styles.subtitle}>
            {saving 
              ? 'We\'re saving your information and setting up your personalized experience.'
              : 'Your profile has been set up successfully. Taking you to the app now...'
            }
          </Text>
        </View>
        
        {saving ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text style={styles.loadingText}>Saving your information...</Text>
          </View>
        ) : (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#10B981" />
            <Text style={[styles.loadingText, { color: '#10B981' }]}>
              Transitioning to main app...
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default CompletionScreen; 