import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import OnboardingProgressIndicator from '../../components/OnboardingProgressIndicator';
import FormTextInput from '../../components/onboarding/FormTextInput';
import FormDatePicker from '../../components/onboarding/FormDatePicker';
import FormRadioGroup from '../../components/onboarding/FormRadioGroup';
import { useOnboarding } from '../../context/OnboardingContext';

const BasicInfoScreen = ({ navigation }) => {
  const { 
    onboardingData, 
    updateOnboardingData, 
    updateMultipleFields,
    validateBasicInfo 
  } = useOnboarding();
  
  const [errors, setErrors] = useState({});

  const genderOptions = [
    { value: 'male', label: 'Male' },
    { value: 'female', label: 'Female' },
    { value: 'prefer_not_to_say', label: 'Prefer not to say' },
  ];

  const handleNext = () => {
    const validationErrors = validateBasicInfo();
    setErrors(validationErrors);
    
    if (Object.keys(validationErrors).length === 0) {
      console.log('Basic info collected:', {
        fullName: onboardingData.fullName,
        dateOfBirth: onboardingData.dateOfBirth,
        gender: onboardingData.gender
      });
      navigation.navigate('Consent');
    }
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const updateFormData = (field, value) => {
    updateOnboardingData(field, value);
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const minDate = new Date();
  minDate.setFullYear(minDate.getFullYear() - 100); // 100 years ago
  
  const maxDate = new Date();
  maxDate.setFullYear(maxDate.getFullYear() - 18); // 18 years ago

  return (
    <SafeAreaView style={styles.container}>
      <OnboardingProgressIndicator currentStep={2} totalSteps={5} />
      
      <KeyboardAvoidingView 
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Basic Information</Text>
            <Text style={styles.subtitle}>
              Tell us a bit about yourself to personalize your experience.
            </Text>
          </View>
          
          <View style={styles.formContainer}>
            <FormTextInput
              label="Full Name"
              value={onboardingData.fullName}
              onChangeText={(value) => updateFormData('fullName', value)}
              placeholder="Enter your full name"
              error={errors.fullName}
              required
            />
            
            <FormDatePicker
              label="Date of Birth"
              value={onboardingData.dateOfBirth}
              onChange={(date) => updateFormData('dateOfBirth', date)}
              error={errors.dateOfBirth}
              required
              minimumDate={minDate}
              maximumDate={maxDate}
            />
            
            <FormRadioGroup
              label="Gender"
              options={genderOptions}
              value={onboardingData.gender}
              onSelect={(value) => updateFormData('gender', value)}
              error={errors.gender}
              required
            />
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardAvoidingView: {
    flex: 1,
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
  formContainer: {
    marginTop: 20,
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

export default BasicInfoScreen; 