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
import LegalDocumentModal from '../../components/legal/LegalDocumentModal';
import { TERMS_OF_USE } from '../../legal/TermsOfUse';
import { RESEARCH_CONSENT } from '../../legal/ResearchConsent';

const ConsentScreen = ({ navigation }) => {
  const { 
    onboardingData, 
    updateOnboardingData, 
    validateConsent 
  } = useOnboarding();
  
  const [errors, setErrors] = useState({});
  const [modalVisible, setModalVisible] = useState(false);
  const [currentDocument, setCurrentDocument] = useState(null);

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
    const document = type === 'research' ? RESEARCH_CONSENT : TERMS_OF_USE;
    setCurrentDocument(document);
    setModalVisible(true);
  };

  const handleAgreeFromModal = () => {
    setModalVisible(false);
    // Auto-check the corresponding checkbox when user agrees from modal
    if (currentDocument === RESEARCH_CONSENT) {
      updateConsent('researchConsent', true);
    } else if (currentDocument === TERMS_OF_USE) {
      updateConsent('liabilityWaiver', true);
    }
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
                I consent to participate in research using anonymized data from my IHHT sessions.
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
                <H3>Terms of Use & Liability Waiver</H3>
                <TouchableOpacity 
                  style={styles.infoButton}
                  onPress={() => showConsentDetails('liability')}
                >
                  <Body style={styles.infoButtonText}>i</Body>
                </TouchableOpacity>
              </View>
              <BodySmall color="secondary" style={styles.consentDescription}>
                I acknowledge the risks of IHHT training and agree to the Terms of Use.
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
      
      {/* Legal Document Modal */}
      <LegalDocumentModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        document={currentDocument}
        onAgree={handleAgreeFromModal}
      />
    </OnboardingContainer>
  );
};

export default ConsentScreen; 