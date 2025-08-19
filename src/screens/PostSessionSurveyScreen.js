import React, { useState } from 'react';
import { View, StyleSheet, Alert, ScrollView, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard, SafeAreaView, Text, TouchableOpacity } from 'react-native';
import { useAppTheme } from '../theme';
import Container from '../components/base/Container';
import { H1, Body, BodySmall, Caption } from '../components/base/Typography';
import Button from '../components/base/Button';
import Card from '../components/base/Card';
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
  const { colors, spacing } = useAppTheme();
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

  const styles = StyleSheet.create({
    container: {
      flex: 1,
    },
    keyboardAvoidingView: {
      flex: 1,
    },
    innerContainer: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
      backgroundColor: colors.surface.card,
    },
    headerContent: {
      flex: 1,
    },
    title: {
      marginBottom: 4,
    },
    subtitle: {
      lineHeight: 18,
      marginBottom: 4,
    },
    requiredNote: {
      marginTop: 2,
      fontStyle: 'italic',
    },
    errorContainer: {
      backgroundColor: colors.error[50],
      borderColor: colors.error[200],
      borderWidth: 1,
      borderRadius: spacing.borderRadius.md,
      padding: spacing.sm,
      marginHorizontal: spacing.md,
      marginVertical: spacing.sm,
    },
    errorText: {
      marginBottom: 2,
    },
    content: {
      flex: 1,
    },
    scrollContent: {
      padding: spacing.md,
      paddingBottom: 20,
    },
    surveyContent: {
      gap: spacing.md,
    },
    footer: {
      flexDirection: 'row',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.border.light,
      backgroundColor: colors.surface.card,
    },
  });

  return (
    <Container safe>
      <KeyboardAvoidingView 
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.innerContainer}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerContent}>
                <H1 style={styles.title}>Post-Session Survey</H1>
                <Body color="secondary" style={styles.subtitle}>
                  How are you feeling after training?
                </Body>
                <Caption color="error" style={styles.requiredNote}>* Required</Caption>
              </View>
            </View>

            {/* Validation Errors */}
            {validationErrors.length > 0 && (
              <View style={styles.errorContainer}>
                {validationErrors.map((error, index) => (
                  <Caption key={index} color="error" style={styles.errorText}>
                    • {error}
                  </Caption>
                ))}
              </View>
            )}

            {/* Content */}
            <ScrollView 
              style={styles.content}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
              indicatorStyle="black"
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
                  label="Notes (optional)"
                  value={surveyData.notes || ''}
                  onValueChange={handleNotesChange}
                  placeholder="Any additional comments"
                  maxLength={500}
                  disabled={isSubmitting}
                />
              </View>
            </ScrollView>

            {/* Footer */}
            <View style={styles.footer}>
              <Button
                title={isSubmitting ? 'Saving...' : 'Complete Session'}
                variant="primary"
                onPress={handleSubmit}
                disabled={!canSubmit}
                loading={isSubmitting}
                fullWidth
              />
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Container>
  );
};

export default PostSessionSurveyScreen; 