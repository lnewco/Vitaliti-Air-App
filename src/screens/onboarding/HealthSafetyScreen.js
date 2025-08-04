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

  return (
    <SafeAreaView style={styles.container}>
      <OnboardingProgressIndicator currentStep={4} totalSteps={5} />
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Health & Safety</Text>
          <Text style={styles.subtitle}>
            Help us ensure IHHT training is safe for you.
          </Text>
          <TouchableOpacity 
            style={styles.infoButton}
            onPress={showHealthInfo}
          >
            <Text style={styles.infoButtonText}>ℹ About IHHT Safety</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.questionContainer}>
          <Text style={styles.questionTitle}>
            Do you currently have any of the following health conditions?
          </Text>
          
          <View style={styles.conditionsContainer}>
            {healthConditions.map((condition, index) => (
              <View key={index} style={styles.conditionItem}>
                <Text style={styles.conditionText}>• {condition}</Text>
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
              <Text style={styles.answerText}>
                Yes, I have one or more of these conditions
              </Text>
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
              <Text style={styles.answerText}>
                No, I do not have any of these conditions
              </Text>
            </TouchableOpacity>
          </View>
          
          {errors.hasHealthConditions && (
            <Text style={styles.errorText}>{errors.hasHealthConditions}</Text>
          )}
        </View>
      </ScrollView>
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.nextButton} 
          onPress={handleNext}
        >
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
    marginBottom: 16,
  },
  infoButton: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  infoButtonText: {
    color: '#3B82F6',
    fontSize: 14,
    fontWeight: '600',
  },
  questionContainer: {
    marginTop: 20,
  },
  questionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 20,
    lineHeight: 24,
  },
  conditionsContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  conditionItem: {
    marginBottom: 8,
  },
  conditionText: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
  },
  answerContainer: {
    gap: 12,
  },
  answerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  answerSelected: {
    borderColor: '#3B82F6',
    backgroundColor: '#EFF6FF',
  },
  answerError: {
    borderColor: '#EF4444',
  },
  radioButton: {
    marginRight: 12,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioSelected: {
    borderColor: '#3B82F6',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3B82F6',
  },
  answerText: {
    fontSize: 16,
    color: '#1F2937',
    flex: 1,
    lineHeight: 22,
  },
  errorText: {
    fontSize: 14,
    color: '#EF4444',
    marginTop: 12,
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

export default HealthSafetyScreen; 