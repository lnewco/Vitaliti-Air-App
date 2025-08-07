import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, SafeAreaView, TouchableOpacity, ScrollView, Platform } from 'react-native';
import SurveyScaleInput from '../components/SurveyScaleInput';
import StepIndicator from '../components/StepIndicator';
import DatabaseService from '../services/DatabaseService';
import SupabaseService from '../services/SupabaseService';
import { 
  CLARITY_LABELS, 
  ENERGY_LABELS 
} from '../types/surveyTypes';
import { 
  validatePreSessionSurvey, 
  isPreSessionSurveyComplete,
  createDefaultPreSessionSurvey 
} from '../utils/surveyValidation';

const PreSessionSurveyScreen = ({ navigation, route }) => {
  const sessionId = route?.params?.sessionId;
  const protocolConfig = route?.params?.protocolConfig;
  const [surveyData, setSurveyData] = useState(createDefaultPreSessionSurvey());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);

  const handleClarityChange = (value) => {
    setSurveyData(prev => ({ ...prev, clarity: value }));
    setValidationErrors([]); // Clear errors when user makes changes
  };

  const handleEnergyChange = (value) => {
    setSurveyData(prev => ({ ...prev, energy: value }));
    setValidationErrors([]); // Clear errors when user makes changes
  };

  const handleSubmit = async () => {
    // Validate survey data
    const validation = validatePreSessionSurvey(surveyData);
    
    if (!validation.isValid) {
      setValidationErrors(validation.errors);
      return;
    }

    setIsSubmitting(true);
    setValidationErrors([]);

    try {
      console.log('💾 Saving pre-session survey data:', { sessionId, ...surveyData });

      // Initialize database first
      await DatabaseService.init();

      // Save to local database first
      const localResult = await DatabaseService.savePreSessionSurvey(
        sessionId,
        surveyData.clarity,
        surveyData.energy
      );

      if (!localResult.success) {
        throw new Error(localResult.error || 'Failed to save to local database');
      }

      console.log('✅ Pre-session survey saved locally');

      // Complete immediately - don't wait for Supabase sync
      console.log('🎉 Pre-session survey completed successfully');

      // Calculate session details from protocol config
      const totalDuration = protocolConfig ? 
        (protocolConfig.totalCycles * (protocolConfig.hypoxicDuration + protocolConfig.hyperoxicDuration)) : 
        35; // fallback default
      const cycles = protocolConfig?.totalCycles || 5; // fallback default

      // Show confirmation popup and navigate
      Alert.alert(
        '🎯 Starting Your IHHT Session',
        `Great! Your pre-session survey is complete.\n\n• ${cycles} cycles of hypoxic-hyperoxic training\n• Approximately ${totalDuration} minutes duration\n• Real-time safety monitoring\n\nGet comfortable and prepare to begin!`,
        [
          {
            text: 'Start Training',
            onPress: () => {
              console.log('🚀 Starting IHHT session directly after survey completion with sessionId:', sessionId);
              navigation.navigate('AirSession', { 
                sessionId: sessionId,
                protocolConfig: protocolConfig 
              });
            }
          }
        ]
      );

      // Sync to Supabase in background (non-blocking)
      SupabaseService.syncPreSessionSurvey(
        sessionId,
        surveyData.clarity,
        surveyData.energy
      ).then(supabaseResult => {
        if (supabaseResult.queued) {
          console.log('📥 Pre-session survey queued for sync (offline)');
        } else if (!supabaseResult.success) {
          console.warn('⚠️ Failed to sync to Supabase immediately, but saved locally');
        } else {
          console.log('☁️ Pre-session survey synced to Supabase');
        }
      }).catch(error => {
        console.warn('⚠️ Background Supabase sync failed:', error.message);
      });

      // Create Supabase session in background (non-blocking)
      (async () => {
        try {
          console.log('🔄 Creating Supabase session for survey sync in background...');
          
          // Ensure SupabaseService is initialized (fixes deviceId being null)
          await SupabaseService.initialize();
          console.log('🔧 SupabaseService initialized for session creation');
          
          const deviceId = await SupabaseService.getDeviceId();
          console.log('📱 Using device ID for session:', deviceId);
          
          await SupabaseService.createSession({
            id: sessionId,
            startTime: Date.now(),
            deviceId: deviceId,
            sessionType: 'IHHT'
          });
          console.log('✅ Supabase session created in background, survey should sync now');
        } catch (error) {
          console.warn('⚠️ Failed to create Supabase session for survey sync:', error);
          // Continue anyway - survey will remain queued
        }
      })();

    } catch (error) {
      console.error('❌ Error saving pre-session survey:', error);
      Alert.alert(
        'Save Error',
        'Failed to save your survey responses. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    console.log('❌ Pre-session survey cancelled');
    navigation.goBack();
  };

  const canSubmit = isPreSessionSurveyComplete(surveyData) && !isSubmitting;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.innerContainer}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleCancel}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          
          <StepIndicator 
            currentStep={2} 
            totalSteps={3}
            steps={['Connect Device', 'Complete check-in', 'Ready to Begin']}
          />
          
          <View style={styles.headerContent}>
            <Text style={styles.title}>Pre-Session Check-in</Text>
            <Text style={styles.subtitle}>
              Please rate how you're feeling right now. This takes just a moment and helps us understand how IHHT training affects you over time.
            </Text>
            <Text style={styles.requiredNote}>* Required fields</Text>
          </View>
        </View>

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <View style={styles.errorContainer}>
            {validationErrors.map((error, index) => (
              <Text key={index} style={styles.errorText}>
                • {error}
              </Text>
            ))}
          </View>
        )}

        {/* Content */}
        <ScrollView 
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.surveyContent}>
            {/* Mental Clarity Scale */}
            <SurveyScaleInput
              label="Mental Clarity"
              value={surveyData.clarity}
              onValueChange={handleClarityChange}
              scaleLabels={CLARITY_LABELS}
              isRequired={true}
              disabled={isSubmitting}
            />

            {/* Energy Level Scale */}
            <SurveyScaleInput
              label="Energy Level"
              value={surveyData.energy}
              onValueChange={handleEnergyChange}
              scaleLabels={ENERGY_LABELS}
              isRequired={true}
              disabled={isSubmitting}
            />

            {!canSubmit && !isSubmitting && (
              <View style={styles.requirementNote}>
                <Text style={styles.requirementText}>
                  ⚠️ Please complete both ratings to continue
                </Text>
              </View>
            )}

            {isSubmitting && (
              <View style={styles.savingNote}>
                <Text style={styles.savingText}>
                  💾 Saving your responses...
                </Text>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.button, styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit}
          >
            <Text style={[styles.buttonText, styles.submitButtonText, !canSubmit && styles.submitButtonTextDisabled]}>
              {isSubmitting ? 'Saving...' : 'Start Session'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  innerContainer: {
    flex: 1,
  },
  header: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    paddingTop: Platform.OS === 'ios' ? 0 : 20,
    paddingBottom: 20,
    paddingHorizontal: 24,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  backButtonText: {
    fontSize: 16,
    color: '#007bff',
    fontWeight: '500',
  },
  headerContent: {
    marginTop: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#212529',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#6c757d',
    lineHeight: 24,
    marginBottom: 12,
    textAlign: 'center',
  },
  requiredNote: {
    fontSize: 14,
    color: '#dc3545',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  errorContainer: {
    backgroundColor: '#f8d7da',
    borderColor: '#f5c6cb',
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    margin: 16,
  },
  errorText: {
    color: '#721c24',
    fontSize: 14,
    marginBottom: 4,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
  },
  surveyContent: {
    gap: 24,
  },
  requirementNote: {
    backgroundColor: '#fff3cd',
    borderColor: '#ffeaa7',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  requirementText: {
    color: '#856404',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
  savingNote: {
    backgroundColor: '#d1ecf1',
    borderColor: '#bee5eb',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  savingText: {
    color: '#0c5460',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
  footer: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    paddingHorizontal: 24,
    paddingVertical: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  button: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#007bff',
  },
  submitButtonText: {
    color: '#ffffff',
  },
  submitButtonDisabled: {
    backgroundColor: '#6c757d',
  },
  submitButtonTextDisabled: {
    color: '#adb5bd',
  },
});

export default PreSessionSurveyScreen; 