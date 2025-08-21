import React, { useState } from 'react';
import { 
  View, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  Alert 
} from 'react-native';
import { useAppTheme } from '../../theme';
import OnboardingContainer from '../../components/onboarding/OnboardingContainer';
import { H1, H3, Body, BodySmall, Caption } from '../../components/base/Typography';
import Card from '../../components/base/Card';
import { useOnboarding } from '../../context/OnboardingContext';

const ConsentScreen = ({ navigation }) => {
  const { 
    onboardingData, 
    updateOnboardingData, 
    validateConsent 
  } = useOnboarding();
  
  const [errors, setErrors] = useState({});

  const handleNext = () => {
    const validationErrors = validateConsent();
    setErrors(validationErrors);
    
    if (Object.keys(validationErrors).length === 0) {
      console.log('Consent collected:', {
        researchConsent: onboardingData.researchConsent,
        liabilityWaiver: onboardingData.liabilityWaiver
      });
      navigation.navigate('HealthSafety');
    }
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const updateConsent = (field, value) => {
    updateOnboardingData(field, value);
    // Clear error when user makes selection
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const showConsentDetails = (type) => {
    const title = type === 'research' ? 'Research Participation' : 'Liability Waiver';
    const message = type === 'research' 
      ? 'By consenting, you agree to participate in research studies using anonymized data from your IHHT sessions. This helps us improve the technology and understand its benefits.\n\nYour personal information will never be shared, and you can withdraw consent at any time.'
      : 'By accepting this waiver, you acknowledge that IHHT training carries inherent risks and that you participate at your own risk. You agree to hold Vitaliti Air harmless from any injuries or adverse effects.\n\nAlways consult your physician before starting any new health regimen.';
    
    Alert.alert(title, message, [{ text: 'OK', style: 'default' }]);
  };

  const { colors, spacing } = useAppTheme();
  
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
    },
    consentContainer: {
      gap: spacing.lg,
    },
    consentItem: {
      marginBottom: spacing.lg,
    },
    consentHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    infoButton: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.primary[100],
      justifyContent: 'center',
      alignItems: 'center',
    },
    infoButtonText: {
      color: colors.primary[600],
      fontSize: 14,
      fontWeight: 'bold',
    },
    consentDescription: {
      marginBottom: spacing.md,
    },
    checkboxContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border.light,
      borderRadius: spacing.borderRadius.md,
      backgroundColor: colors.surface.card,
    },
    checkboxSelected: {
      borderColor: colors.primary[500],
      backgroundColor: colors.primary[50],
    },
    checkboxError: {
      borderColor: colors.error[500],
    },
    checkbox: {
      width: 24,
      height: 24,
      borderWidth: 2,
      borderColor: colors.border.light,
      borderRadius: spacing.borderRadius.sm,
      marginRight: spacing.md,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.surface.card,
    },
    checkmark: {
      color: colors.primary[500],
      fontSize: 16,
      fontWeight: 'bold',
    },
    errorText: {
      marginTop: spacing.xs,
    },
  });

  return (
    <OnboardingContainer
      currentStep={3}
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
          <H1 style={styles.title}>Consent & Agreements</H1>
          <Body color="secondary" style={styles.subtitle}>
            Please review and accept the following agreements to continue.
          </Body>
        </View>
        
        <View style={styles.consentContainer}>
          {/* Research Consent */}
          <Card>
            <Card.Body>
              <View style={styles.consentHeader}>
                <H3>Research Participation</H3>
                <TouchableOpacity 
                  style={styles.infoButton}
                  onPress={() => showConsentDetails('research')}
                >
                  <Body style={styles.infoButtonText}>i</Body>
                </TouchableOpacity>
              </View>
              <BodySmall color="secondary" style={styles.consentDescription}>
                I consent to participate in research studies using anonymized data from my IHHT sessions.
              </BodySmall>
              
              <TouchableOpacity
                style={[
                  styles.checkboxContainer,
                  onboardingData.researchConsent && styles.checkboxSelected,
                  errors.researchConsent && styles.checkboxError
                ]}
                onPress={() => updateConsent('researchConsent', !onboardingData.researchConsent)}
              >
                <View style={[
                  styles.checkbox,
                  onboardingData.researchConsent && { borderColor: colors.primary[500] }
                ]}>
                  {onboardingData.researchConsent && (
                    <Body style={styles.checkmark}>✓</Body>
                  )}
                </View>
                <Body>I agree to participate in research</Body>
              </TouchableOpacity>
              
              {errors.researchConsent && (
                <Caption color="error" style={styles.errorText}>{errors.researchConsent}</Caption>
              )}
            </Card.Body>
          </Card>

          {/* Liability Waiver */}
          <Card>
            <Card.Body>
              <View style={styles.consentHeader}>
                <H3>Liability Waiver</H3>
                <TouchableOpacity 
                  style={styles.infoButton}
                  onPress={() => showConsentDetails('liability')}
                >
                  <Body style={styles.infoButtonText}>i</Body>
                </TouchableOpacity>
              </View>
              <BodySmall color="secondary" style={styles.consentDescription}>
                I acknowledge the risks associated with IHHT training and agree to hold Vitaliti Air harmless.
              </BodySmall>
              
              <TouchableOpacity
                style={[
                  styles.checkboxContainer,
                  onboardingData.liabilityWaiver && styles.checkboxSelected,
                  errors.liabilityWaiver && styles.checkboxError
                ]}
                onPress={() => updateConsent('liabilityWaiver', !onboardingData.liabilityWaiver)}
              >
                <View style={[
                  styles.checkbox,
                  onboardingData.liabilityWaiver && { borderColor: colors.primary[500] }
                ]}>
                  {onboardingData.liabilityWaiver && (
                    <Body style={styles.checkmark}>✓</Body>
                  )}
                </View>
                <Body>I accept the liability waiver</Body>
              </TouchableOpacity>
              
              {errors.liabilityWaiver && (
                <Caption color="error" style={styles.errorText}>{errors.liabilityWaiver}</Caption>
              )}
            </Card.Body>
          </Card>
        </View>
      </ScrollView>
    </OnboardingContainer>
  );
};

export default ConsentScreen; 