import React, { useState } from 'react';
import { 
  View, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  Alert 
} from 'react-native';
import { colors, spacing } from '../../design-system';
import OnboardingContainer from '../../components/onboarding/OnboardingContainer';
import { H1, H3, Body, BodySmall, Caption } from '../../components/base/Typography';
import Card from '../../components/base/Card';
import Button from '../../components/base/Button';
import { useOnboarding } from '../../context/OnboardingContext';

const HealthSafetyScreen = ({ navigation }) => {
  const { 
    onboardingData, 
    updateOnboardingData, 
    validateHealthScreening 
  } = useOnboarding();
  
  const [errors, setErrors] = useState({});

  const handleNext = () => {
    const validationErrors = validateHealthScreening();
    setErrors(validationErrors);
    
    if (Object.keys(validationErrors).length === 0) {
      // Check if user has health conditions - they cannot proceed if they do
      if (onboardingData.hasHealthConditions === true) {
        Alert.alert(
          'IHHT Training Not Recommended',
          'Unfortunately, IHHT (Intermittent Hypoxic-Hyperoxic Training) is not recommended for individuals with the health conditions listed above.\n\nFor your safety, we cannot proceed with account creation at this time. We strongly encourage you to consult with your physician about alternative wellness approaches.\n\nThank you for your understanding.',
          [
            {
              text: 'I Understand',
              onPress: () => {
                // Navigate back to welcome screen
                navigation.navigate('Welcome');
              },
              style: 'default'
            }
          ],
          { cancelable: false }
        );
        return;
      }
      
      // User has no health conditions - proceed normally
      console.log('Health screening collected:', {
        hasHealthConditions: onboardingData.hasHealthConditions,
        healthConditionsList: onboardingData.healthConditionsList
      });
      navigation.navigate('PhoneVerification');
    }
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const updateHealthData = (field, value) => {
    updateOnboardingData(field, value);
    // Clear error when user makes selection
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const showHealthInfo = () => {
    Alert.alert(
      'Health Eligibility Information',
      'IHHT (Intermittent Hypoxic-Hyperoxic Training) involves breathing reduced oxygen levels alternated with normal or enriched oxygen. This training should not be used by individuals with certain health conditions.\n\nIf you have any of the listed conditions, please consult your physician before using this technology.',
      [{ text: 'OK', style: 'default' }]
    );
  };

  const healthConditions = [
    'Heart disease or cardiovascular conditions',
    'Respiratory disorders (asthma, COPD, etc.)',
    'Pregnancy',
    'Severe anemia',
    'Active malignancy/cancer treatment',
    'Severe neurological conditions',
    'Recent surgery (within 4 weeks)',
    'Uncontrolled hypertension',
  ];

  // Colors and spacing imported from design-system
  
  const styles = StyleSheet.create({
    scrollContent: {
      flexGrow: 1,
    },
    header: {
      alignItems: 'center',
      marginBottom: spacing.xl,
    },
    title: {
      marginBottom: spacing.md,
    },
    subtitle: {
      textAlign: 'center',
      maxWidth: 320,
      marginBottom: spacing.md,
    },
    infoButton: {
      marginTop: spacing.sm,
    },
    questionContainer: {
      marginBottom: spacing.lg,
    },
    questionTitle: {
      marginBottom: spacing.lg,
    },
    conditionsContainer: {
      padding: spacing.md,
      backgroundColor: colors.background.primary,
      borderRadius: spacing.borderRadius.lg,
      marginBottom: spacing.lg,
    },
    conditionItem: {
      marginBottom: spacing.sm,
    },
    answerContainer: {
      gap: spacing.md,
    },
    answerOption: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border.light,
      borderRadius: spacing.borderRadius.md,
      backgroundColor: colors.background.tertiary,
    },
    answerSelected: {
      borderColor: colors.brand.accent,
      backgroundColor: colors.background.elevated,
    },
    answerError: {
      borderColor: colors.semantic.error,
    },
    radioButton: {
      marginRight: spacing.md,
    },
    radioCircle: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: colors.border.light,
      justifyContent: 'center',
      alignItems: 'center',
    },
    radioSelected: {
      borderColor: colors.brand.accent,
    },
    radioInner: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.brand.accent,
    },
    warningContainer: {
      padding: spacing.md,
      backgroundColor: colors.background.elevated,
      borderRadius: spacing.borderRadius.md,
      borderWidth: 1,
      borderColor: colors.border.medium,
      marginTop: spacing.lg,
    },
    errorText: {
      marginTop: spacing.xs,
    },
  });

  return (
    <OnboardingContainer
      currentStep={4}
      totalSteps={5}
      onNext={handleNext}
      onBack={handleBack}
      showProgress={true}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <H1 style={styles.title}>Health & Safety</H1>
          <Body color="secondary" style={styles.subtitle}>
            Help us ensure IHHT training is safe for you.
          </Body>
          <Button
            title="About IHHT Safety"
            variant="ghost"
            size="small"
            onPress={showHealthInfo}
            style={styles.infoButton}
          />
        </View>
        
        <Card>
          <Card.Body>
            <H3 style={styles.questionTitle}>
              Do you currently have any of the following health conditions?
            </H3>
            
            <View style={styles.conditionsContainer}>
              {healthConditions.map((condition, index) => (
                <View key={index} style={styles.conditionItem}>
                  <BodySmall>• {condition}</BodySmall>
                </View>
              ))}
            </View>
            
            <View style={styles.answerContainer}>
              <TouchableOpacity
                style={[
                  styles.answerOption,
                  onboardingData.hasHealthConditions === true && styles.answerSelected,
                  errors.hasHealthConditions && styles.answerError
                ]}
                onPress={() => updateHealthData('hasHealthConditions', true)}
              >
                <View style={styles.radioButton}>
                  <View style={[
                    styles.radioCircle,
                    onboardingData.hasHealthConditions === true && styles.radioSelected,
                  ]}>
                    {onboardingData.hasHealthConditions === true && (
                      <View style={styles.radioInner} />
                    )}
                  </View>
                </View>
                <Body>Yes, I have one or more of these conditions</Body>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.answerOption,
                  onboardingData.hasHealthConditions === false && styles.answerSelected,
                  errors.hasHealthConditions && styles.answerError
                ]}
                onPress={() => updateHealthData('hasHealthConditions', false)}
              >
                <View style={styles.radioButton}>
                  <View style={[
                    styles.radioCircle,
                    onboardingData.hasHealthConditions === false && styles.radioSelected,
                  ]}>
                    {onboardingData.hasHealthConditions === false && (
                      <View style={styles.radioInner} />
                    )}
                  </View>
                </View>
                <Body>No, I do not have any of these conditions</Body>
              </TouchableOpacity>
            </View>
            
            {errors.hasHealthConditions && (
              <Caption color="error" style={styles.errorText}>{errors.hasHealthConditions}</Caption>
            )}
            
            {onboardingData.hasHealthConditions === true && (
              <View style={styles.warningContainer}>
                <Caption color="warning">
                  IHHT training is not recommended for individuals with these conditions. 
                  Please consult your physician before proceeding.
                </Caption>
              </View>
            )}
          </Card.Body>
        </Card>
      </ScrollView>
    </OnboardingContainer>
  );
};

export default HealthSafetyScreen; 