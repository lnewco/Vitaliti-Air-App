import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, SafeAreaView, TouchableOpacity, ScrollView } from 'react-native';
import SurveyScaleInput from '../components/SurveyScaleInput';
import SurveyNotesInput from '../components/SurveyNotesInput';
import DatabaseService from '../services/DatabaseService';
import SupabaseService from '../services/SupabaseService';
import { 
  CLARITY_LABELS, 
  ENERGY_LABELS,
  STRESS_LABELS 
} from '../types/surveyTypes';
import { 
  validatePostSessionSurvey, 
  isPostSessionSurveyComplete,
  createDefaultPostSessionSurvey 
} from '../utils/surveyValidation';

const PostSessionSurveyScreen = ({ navigation, route }) => {
  const sessionId = route?.params?.sessionId;
  const [surveyData, setSurveyData] = useState(createDefaultPostSessionSurvey());
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

  const handleStressChange = (value) => {
    setSurveyData(prev => ({ ...prev, stress: value }));
    setValidationErrors([]); // Clear errors when user makes changes
  };

  const handleNotesChange = (value) => {
    setSurveyData(prev => ({ ...prev, notes: value }));
  };

  const handleSubmit = async () => {
    // Validate survey data
    const validation = validatePostSessionSurvey(surveyData);
    
    if (!validation.isValid) {
      setValidationErrors(validation.errors);
      return;
    }

    setIsSubmitting(true);
    setValidationErrors([]);

    try {
      console.log('💾 Saving post-session survey data:', { sessionId, ...surveyData });
      
      // Initialize database if needed
      await DatabaseService.init();
      
      // Save to local database first
      await DatabaseService.savePostSessionSurvey(
        sessionId, 
        surveyData.clarity, 
        surveyData.energy, 
        surveyData.stress, 
        surveyData.notes
      );
      console.log('✅ Post-session survey saved to local database');
      
      // Sync to Supabase (will queue if offline)
      await SupabaseService.syncPostSessionSurvey(
        sessionId, 
        surveyData.clarity, 
        surveyData.energy, 
        surveyData.stress, 
        surveyData.notes
      );
      console.log('✅ Post-session survey queued for Supabase sync');
      
      // Show success and complete
      console.log('🎉 Post-session survey save completed successfully');
      
      // Navigate to History screen and auto-show session results modal
      navigation.navigate('MainTabs', {
        screen: 'History',
        params: {
          showSessionId: sessionId,
          justCompleted: true
        }
      });
      
      // Show a quick success message
      setTimeout(() => {
        Alert.alert(
          '✅ Survey Complete',
          'Thank you for completing your post-session survey!',
          [{ text: 'OK' }]
        );
      }, 500);
      
    } catch (error) {
      console.error('❌ Failed to save post-session survey:', error);
      Alert.alert(
        'Save Error',
        'Failed to save your survey responses. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = isPostSessionSurveyComplete(surveyData) && !isSubmitting;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.keyboardAvoidingView}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Text style={styles.title}>Post-Session Check-in</Text>
            <Text style={styles.subtitle}>
              How are you feeling after your IHHT training? This feedback helps us understand how the training affects you over time.
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

            {/* Physiological Stress Scale */}
            <SurveyScaleInput
              label="Physiological Stress"
              value={surveyData.stress}
              onValueChange={handleStressChange}
              scaleLabels={STRESS_LABELS}
              isRequired={true}
              disabled={isSubmitting}
            />

            {/* Notes Section (Optional) */}
            <SurveyNotesInput
              label="Would you like to add anything else?"
              value={surveyData.notes || ''}
              onValueChange={handleNotesChange}
              placeholder="Add any notes about your session experience (optional)"
              maxLength={500}
              disabled={isSubmitting}
            />
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
              {isSubmitting ? 'Saving...' : 'Complete Session'}
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
    backgroundColor: '#ffffff',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  headerContent: {
    flex: 1,
    paddingRight: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#6c757d',
    lineHeight: 22,
  },
  requiredNote: {
    fontSize: 14,
    color: '#e74c3c',
    marginTop: 8,
    fontStyle: 'italic',
  },
  errorContainer: {
    backgroundColor: '#f8d7da',
    borderColor: '#f5c6cb',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    margin: 20,
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
    padding: 20,
    paddingBottom: 40,
  },
  surveyContent: {
    gap: 24,
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    backgroundColor: '#ffffff',
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 0,
  },
  submitButton: {
    backgroundColor: '#007bff',
  },
  submitButtonDisabled: {
    backgroundColor: '#e9ecef',
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  submitButtonText: {
    color: '#ffffff',
  },
  submitButtonTextDisabled: {
    color: '#6c757d',
  },
});

export default PostSessionSurveyScreen; 