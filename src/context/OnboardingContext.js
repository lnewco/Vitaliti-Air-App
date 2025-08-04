import React, { createContext, useContext, useState } from 'react';

const OnboardingContext = createContext();

export const useOnboarding = () => {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within OnboardingProvider');
  }
  return context;
};

export const OnboardingProvider = ({ children }) => {
  const [onboardingData, setOnboardingData] = useState({
    // Basic Info
    fullName: '',
    dateOfBirth: null,
    gender: '',
    
    // Consent
    researchConsent: false,
    liabilityWaiver: false,
    
    // Health Screening
    hasHealthConditions: null,
    healthConditionsList: [],
    
    // Phone (will be set during verification)
    phoneNumber: '',
  });

  const updateOnboardingData = (field, value) => {
    setOnboardingData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const updateMultipleFields = (fields) => {
    setOnboardingData(prev => ({
      ...prev,
      ...fields
    }));
  };

  const clearOnboardingData = () => {
    setOnboardingData({
      fullName: '',
      dateOfBirth: null,
      gender: '',
      researchConsent: false,
      liabilityWaiver: false,
      hasHealthConditions: null,
      healthConditionsList: [],
      phoneNumber: '',
    });
  };

  const validateBasicInfo = () => {
    const errors = {};
    
    if (!onboardingData.fullName.trim()) {
      errors.fullName = 'Full name is required';
    } else if (onboardingData.fullName.trim().length < 2) {
      errors.fullName = 'Please enter your full name';
    }
    
    // TEMPORARILY DISABLED - DateTimePicker compatibility issue
    /*
    if (!onboardingData.dateOfBirth) {
      errors.dateOfBirth = 'Date of birth is required';
    } else {
      const today = new Date();
      const birthDate = new Date(onboardingData.dateOfBirth);
      const age = today.getFullYear() - birthDate.getFullYear();
      
      if (age < 18) {
        errors.dateOfBirth = 'You must be at least 18 years old';
      } else if (age > 100) {
        errors.dateOfBirth = 'Please enter a valid date of birth';
      }
    }
    */
    
    if (!onboardingData.gender) {
      errors.gender = 'Please select your gender';
    }
    
    return errors;
  };

  const validateConsent = () => {
    const errors = {};
    
    if (!onboardingData.researchConsent) {
      errors.researchConsent = 'You must consent to participate in research';
    }
    
    if (!onboardingData.liabilityWaiver) {
      errors.liabilityWaiver = 'You must accept the liability waiver';
    }
    
    return errors;
  };

  const validateHealthScreening = () => {
    const errors = {};
    
    if (onboardingData.hasHealthConditions === null) {
      errors.hasHealthConditions = 'Please answer the health screening question';
    }
    
    return errors;
  };

  const isOnboardingComplete = () => {
    const basicInfoErrors = validateBasicInfo();
    const consentErrors = validateConsent();
    const healthErrors = validateHealthScreening();
    
    return Object.keys(basicInfoErrors).length === 0 &&
           Object.keys(consentErrors).length === 0 &&
           Object.keys(healthErrors).length === 0 &&
           onboardingData.phoneNumber.length > 0;
  };

  const value = {
    onboardingData,
    updateOnboardingData,
    updateMultipleFields,
    clearOnboardingData,
    validateBasicInfo,
    validateConsent,
    validateHealthScreening,
    isOnboardingComplete,
  };

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
};

export default OnboardingContext; 