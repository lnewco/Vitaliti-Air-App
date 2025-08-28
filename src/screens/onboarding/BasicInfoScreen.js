import React, { useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { colors, spacing } from '../../design-system';
import OnboardingContainer from '../../components/onboarding/OnboardingContainer';
import { H1, Body } from '../../components/base/Typography';
import FormTextInput from '../../components/onboarding/FormTextInput';
// import FormDatePicker from '../../components/onboarding/FormDatePicker'; // TEMPORARILY DISABLED
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
        // dateOfBirth: onboardingData.dateOfBirth, // TEMPORARILY DISABLED
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
    },
    formContainer: {
      marginTop: spacing.lg,
    },
  });

  return (
    <OnboardingContainer
      currentStep={2}
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
          <H1 style={styles.title}>Basic Information</H1>
          <Body color="secondary" style={styles.subtitle}>
            Tell us a bit about yourself to personalize your experience.
          </Body>
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
          
          {/* TEMPORARILY DISABLED - DateTimePicker compatibility issue
          <FormDatePicker
            label="Date of Birth"
            value={onboardingData.dateOfBirth}
            onChange={(date) => updateFormData('dateOfBirth', date)}
            error={errors.dateOfBirth}
            required
            minimumDate={minDate}
            maximumDate={maxDate}
          />
          */}
          
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
    </OnboardingContainer>
  );
};

export default BasicInfoScreen; 