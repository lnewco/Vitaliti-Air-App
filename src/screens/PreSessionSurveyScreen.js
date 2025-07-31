import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import SurveyModal from '../components/SurveyModal';
import SurveyScaleInput from '../components/SurveyScaleInput';
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

const PreSessionSurveyScreen = ({
  visible,
  sessionId,
  onComplete,
  onCancel,
}) => {
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

      // Sync to Supabase
      const supabaseResult = await SupabaseService.syncPreSessionSurvey(
        sessionId,
        surveyData.clarity,
        surveyData.energy
      );

      if (supabaseResult.queued) {
        console.log('📥 Pre-session survey queued for sync (offline)');
      } else if (!supabaseResult.success) {
        console.warn('⚠️ Failed to sync to Supabase immediately, but saved locally');
      } else {
        console.log('☁️ Pre-session survey synced to Supabase');
      }

      // Show success and complete
      console.log('🎉 Pre-session survey completed successfully');
      onComplete();

    } catch (error) {
      console.error('❌ Error saving pre-session survey:', error);
      console.error('❌ Error details:', error.message);
      console.error('❌ Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      Alert.alert(
        'Save Error',
        `Failed to save your survey responses. Please try again.\n\nError: ${error.message}`,
        [{ text: 'OK' }]
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const isComplete = isPreSessionSurveyComplete(surveyData);

  return (
    <SurveyModal
      visible={visible}
      title="Pre-Session Check-in"
      subtitle="Please rate how you're feeling right now. This takes just a moment and helps us understand how IHHT training affects you over time."
      onSubmit={handleSubmit}
      onCancel={onCancel}
      submitButtonText="Start Session"
      cancelButtonText="Cancel"
      submitDisabled={!isComplete || isSubmitting}
      isRequired={true}
      validationErrors={validationErrors}
    >
      <View style={styles.surveyContent}>

        <SurveyScaleInput
          label="Mental Clarity"
          value={surveyData.clarity}
          onValueChange={handleClarityChange}
          scaleLabels={CLARITY_LABELS}
          isRequired={true}
          disabled={isSubmitting}
        />

        <SurveyScaleInput
          label="Energy Level"
          value={surveyData.energy}
          onValueChange={handleEnergyChange}
          scaleLabels={ENERGY_LABELS}
          isRequired={true}
          disabled={isSubmitting}
        />

        {!isComplete && (
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
    </SurveyModal>
  );
};

const styles = StyleSheet.create({
  surveyContent: {
    paddingVertical: 8,
  },
  introText: {
    fontSize: 16,
    color: '#6c757d',
    lineHeight: 24,
    marginBottom: 24,
    textAlign: 'center',
  },
  requirementNote: {
    backgroundColor: '#fff3cd',
    borderColor: '#ffeaa7',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
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
    marginTop: 16,
  },
  savingText: {
    color: '#0c5460',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
});

export default PreSessionSurveyScreen; 