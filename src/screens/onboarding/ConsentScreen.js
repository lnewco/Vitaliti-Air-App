import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  SafeAreaView, 
  ScrollView, 
  Alert 
} from 'react-native';
import OnboardingProgressIndicator from '../../components/OnboardingProgressIndicator';
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

  return (
    <SafeAreaView style={styles.container}>
      <OnboardingProgressIndicator currentStep={3} totalSteps={5} />
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Consent & Agreements</Text>
          <Text style={styles.subtitle}>
            Please review and accept the following agreements to continue.
          </Text>
        </View>
        
        <View style={styles.consentContainer}>
          {/* Research Consent */}
          <View style={styles.consentItem}>
            <View style={styles.consentHeader}>
              <Text style={styles.consentTitle}>Research Participation</Text>
              <TouchableOpacity 
                style={styles.infoButton}
                onPress={() => showConsentDetails('research')}
              >
                <Text style={styles.infoButtonText}>ℹ</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.consentDescription}>
              I consent to participate in research studies using anonymized data from my IHHT sessions.
            </Text>
            
            <TouchableOpacity
              style={[
                styles.checkboxContainer,
                onboardingData.researchConsent && styles.checkboxSelected,
                errors.researchConsent && styles.checkboxError
              ]}
              onPress={() => updateConsent('researchConsent', !onboardingData.researchConsent)}
            >
              <View style={styles.checkbox}>
                {onboardingData.researchConsent && (
                  <Text style={styles.checkmark}>✓</Text>
                )}
              </View>
              <Text style={styles.checkboxText}>
                I agree to participate in research
              </Text>
            </TouchableOpacity>
            
            {errors.researchConsent && (
              <Text style={styles.errorText}>{errors.researchConsent}</Text>
            )}
          </View>

          {/* Liability Waiver */}
          <View style={styles.consentItem}>
            <View style={styles.consentHeader}>
              <Text style={styles.consentTitle}>Liability Waiver</Text>
              <TouchableOpacity 
                style={styles.infoButton}
                onPress={() => showConsentDetails('liability')}
              >
                <Text style={styles.infoButtonText}>ℹ</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.consentDescription}>
              I acknowledge the risks associated with IHHT training and agree to hold Vitaliti Air harmless.
            </Text>
            
            <TouchableOpacity
              style={[
                styles.checkboxContainer,
                onboardingData.liabilityWaiver && styles.checkboxSelected,
                errors.liabilityWaiver && styles.checkboxError
              ]}
              onPress={() => updateConsent('liabilityWaiver', !onboardingData.liabilityWaiver)}
            >
              <View style={styles.checkbox}>
                {onboardingData.liabilityWaiver && (
                  <Text style={styles.checkmark}>✓</Text>
                )}
              </View>
              <Text style={styles.checkboxText}>
                I accept the liability waiver
              </Text>
            </TouchableOpacity>
            
            {errors.liabilityWaiver && (
              <Text style={styles.errorText}>{errors.liabilityWaiver}</Text>
            )}
          </View>
        </View>
      </ScrollView>
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
          <Text style={styles.nextButtonText}>Next</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  header: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 320,
  },
  consentContainer: {
    marginTop: 20,
    gap: 24,
  },
  consentItem: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  consentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  consentTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  infoButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  consentDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 16,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  checkboxSelected: {
    borderColor: '#3B82F6',
    backgroundColor: '#EFF6FF',
  },
  checkboxError: {
    borderColor: '#EF4444',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkmark: {
    color: '#3B82F6',
    fontSize: 14,
    fontWeight: 'bold',
  },
  checkboxText: {
    fontSize: 16,
    color: '#1F2937',
    flex: 1,
  },
  errorText: {
    fontSize: 14,
    color: '#EF4444',
    marginTop: 8,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  backButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '600',
  },
  nextButton: {
    flex: 1,
    backgroundColor: '#3B82F6',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ConsentScreen; 