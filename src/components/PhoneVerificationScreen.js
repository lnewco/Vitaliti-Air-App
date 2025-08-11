import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import OnboardingProgressIndicator from './OnboardingProgressIndicator';
import { useOnboarding } from '../context/OnboardingContext';
import { useAuth } from '../auth/AuthContext';

const PhoneVerificationScreen = ({ route, navigation }) => {
  // Determine if we're in onboarding flow or login flow
  const isOnboarding = route?.params?.isOnboarding || false;
  const phoneFromLogin = route?.params?.phoneNumber;
  const displayFromLogin = route?.params?.displayNumber;
  
  const { onboardingData, updateOnboardingData } = useOnboarding();
  const { sendOTP: authSendOTP, verifyOTP: authVerifyOTP } = useAuth();
  
  const [phoneNumber, setPhoneNumber] = useState(phoneFromLogin || '');
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const [step, setStep] = useState(phoneFromLogin ? 'otp' : 'phone'); // Skip phone entry if coming from login
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [timer, setTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  
  const inputRefs = useRef([]);
  const verificationInProgress = useRef(false);
  const lastVerifiedCode = useRef(null);

  // Timer countdown for resend
  useEffect(() => {
    if (step === 'otp' && timer > 0) {
      const interval = setInterval(() => {
        setTimer(prev => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    } else if (timer === 0) {
      setCanResend(true);
    }
  }, [timer, step]);

  const formatPhoneDisplay = (phone) => {
    if (phone.length >= 6) {
      return phone.replace(/(\d{3})(\d{3})(\d{0,4})/, '($1) $2-$3').trim();
    } else if (phone.length >= 3) {
      return phone.replace(/(\d{3})(\d{0,3})/, '($1) $2').trim();
    }
    return phone;
  };

  const formatPhoneForDisplay = (phone) => {
    if (phone && phone.length > 6) {
      return phone.replace(/(\+\d{1,3})(\d{3})(\d{3})(\d{4})/, '$1 $2-$3-$4');
    }
    return phone;
  };

  const validatePhoneNumber = (phone) => {
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      return 'Please enter a valid 10-digit phone number';
    }
    return null;
  };

  const handlePhoneNumberChange = (text) => {
    const cleanPhone = text.replace(/\D/g, '');
    
    // Handle 11-digit numbers (like from autofill: 18055700864)
    let phoneToUse = cleanPhone;
    if (cleanPhone.length === 11 && cleanPhone.startsWith('1')) {
      phoneToUse = cleanPhone.slice(1);
    }

    if (phoneToUse.length <= 10) {
      const formattedNumber = formatPhoneDisplay(phoneToUse);
      setPhoneNumber(formattedNumber);
      
      // Clear validation error if phone number is being corrected
      if (phoneToUse.length === 10) {
        setErrors(prev => ({ ...prev, phoneNumber: '' }));
        console.log('📱 Auto-sending OTP for number:', formattedNumber);
        // Pass the formatted number directly to avoid state timing issues
        setTimeout(() => {
          handleSendOTP(formattedNumber);
        }, 500);
      } else if (errors.phoneNumber) {
        setErrors(prev => ({ ...prev, phoneNumber: '' }));
      }
    }
  };

  const handleSendOTP = async (phoneNumberOverride = null) => {
    const phoneToUse = phoneNumberOverride || phoneNumber;
    const cleanPhone = phoneToUse.replace(/\D/g, '');
    
    const phoneError = validatePhoneNumber(phoneToUse);
    
    if (phoneError) {
      setErrors({ phoneNumber: phoneError });
      return;
    }

    setLoading(true);
    try {
      if (!authSendOTP) {
        throw new Error('Authentication service not available');
      }
      
      const formattedPhone = `+1${cleanPhone}`;
      
      await authSendOTP(formattedPhone);
      
      // Only update onboarding data if in onboarding flow
      if (isOnboarding) {
        updateOnboardingData('phoneNumber', formattedPhone);
      }
      
      setStep('otp');
      setErrors({});
      setTimer(60);
      setCanResend(false);
      
    } catch (error) {
      console.error('📱 Send OTP error details:', error);
      
      let userFriendlyMessage = 'Failed to send verification code. Please try again.';
      
      if (error.message.includes('Invalid phone number')) {
        userFriendlyMessage = 'Please enter a valid phone number.';
      } else if (error.message.includes('rate limit')) {
        userFriendlyMessage = 'Too many attempts. Please wait a few minutes and try again.';
      }
      
      Alert.alert('Error Sending Code', userFriendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (text, index) => {
    // Check if this is a full 6-digit auto-fill on the first input
    if (index === 0 && text.length === 6 && /^\d{6}$/.test(text)) {
      const digits = text.split('');
      setOtpCode(digits);
      
      // Set each input value via refs
      digits.forEach((digit, idx) => {
        if (inputRefs.current[idx]) {
          inputRefs.current[idx].setNativeProps({ text: digit });
        }
      });
      
      // Auto-verify (prevent duplicate calls)
      if (!verificationInProgress.current && lastVerifiedCode.current !== text) {
        verificationInProgress.current = true;
        setTimeout(() => {
          handleVerifyOTP(text);
        }, 100);
      }
      
      return;
    }
    
    // Only allow numbers
    if (!/^\d*$/.test(text)) return;

    const newOtp = [...otpCode];
    newOtp[index] = text;
    setOtpCode(newOtp);

    // Auto-focus next input
    if (text && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-verify when all 6 digits are entered
    const fullCode = newOtp.join('');
    if (text && index === 5 && newOtp.every(digit => digit.length === 1) && 
        !verificationInProgress.current && lastVerifiedCode.current !== fullCode) {
      verificationInProgress.current = true;
      handleVerifyOTP(fullCode);
    }
  };

  const handleKeyPress = (e, index) => {
    // Handle backspace
    if (e.nativeEvent.key === 'Backspace' && !otpCode[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOTP = async (otpCodeOverride = null) => {
    const otpToUse = otpCodeOverride || otpCode.join('');
    
    // Prevent duplicate verification of same code
    if (verificationInProgress.current || lastVerifiedCode.current === otpToUse) {
      console.log('⚠️ Verification already in progress or code already verified');
      verificationInProgress.current = false;
      return;
    }
    
    if (otpToUse.length !== 6) {
      setErrors({ otpCode: 'Please enter the 6-digit verification code' });
      return;
    }

    setLoading(true);
    verificationInProgress.current = true;
    lastVerifiedCode.current = otpToUse;
    
    try {
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      const formattedPhone = phoneFromLogin || `+1${cleanPhone}`;
      
      await authVerifyOTP(formattedPhone, otpToUse);
      
      setErrors({});
      
      if (isOnboarding) {
        console.log('📱 OTP verification successful in onboarding, navigating to CompletionScreen');
        
        // Navigate to completion screen in onboarding flow
        navigation.navigate('Completion');
        
        // Show success message for onboarding
        setTimeout(() => {
          Alert.alert(
            'Account Created Successfully!',
            'Welcome to Vitaliti Air! Your account has been created and verified.',
            [{ text: 'Continue', style: 'default' }]
          );
        }, 100);
      } else {
        console.log('📱 OTP verification successful in login flow, auth context will handle navigation');
        // For login flow, the auth context will handle navigation to Main app
        // No need to navigate manually
      }
      
      // Reset flags after a short delay
      setTimeout(() => {
        setLoading(false);
        verificationInProgress.current = false;
      }, 500);
      
    } catch (error) {
      console.error('❌ OTP verification error:', error.message);
      
      // Clear the last verified code on error so user can retry
      lastVerifiedCode.current = null;
      verificationInProgress.current = false;
      
      // Clear OTP inputs on error
      setOtpCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
      
      let userFriendlyMessage = 'Invalid verification code. Please check and try again.';
      
      if (error.message.includes('expired')) {
        userFriendlyMessage = 'This code has expired. Please request a new one.';
      } else if (error.message.includes('Too many')) {
        userFriendlyMessage = 'Too many failed attempts. Please wait and try again.';
      }
      
      Alert.alert('Verification Failed', userFriendlyMessage);
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    try {
      setLoading(true);
      
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      const formattedPhone = phoneFromLogin || `+1${cleanPhone}`;
      
      console.log('📱 Resending OTP to:', formattedPhone);

      await authSendOTP(formattedPhone);

      // Reset everything
      setTimer(60);
      setCanResend(false);
      setOtpCode(['', '', '', '', '', '']);
      verificationInProgress.current = false;
      lastVerifiedCode.current = null;
      inputRefs.current[0]?.focus();

      Alert.alert(
        'Code Sent',
        'A new verification code has been sent to your phone.'
      );

    } catch (error) {
      console.error('❌ Resend OTP error:', error.message);
      Alert.alert(
        'Error',
        error.message || 'Failed to resend verification code. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (step === 'otp' && !phoneFromLogin) {
      // Go back to phone entry if we started from phone entry
      setStep('phone');
      setOtpCode(['', '', '', '', '', '']);
      verificationInProgress.current = false;
      lastVerifiedCode.current = null;
    } else {
      // Go back to previous screen
      navigation.goBack();
    }
  };

  const renderPhoneStep = () => {
    return (
      <>
        <View style={styles.header}>
          <Text style={styles.title}>Enter Your Phone Number</Text>
          <Text style={styles.subtitle}>
            We'll send you a verification code to confirm your phone number.
          </Text>
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Phone Number</Text>
          <View style={styles.phoneInputWrapper}>
            <Text style={styles.countryCode}>+1</Text>
            <TextInput
              style={styles.phoneInput}
              value={phoneNumber}
              onChangeText={handlePhoneNumberChange}
              placeholder="(555) 123-4567"
              placeholderTextColor="#9CA3AF"
              keyboardType="phone-pad"
              autoFocus
              editable={!loading}
              textContentType="telephoneNumber"
              autoComplete="tel"
            />
          </View>
          {errors.phoneNumber && (
            <Text style={styles.errorText}>{errors.phoneNumber}</Text>
          )}
        </View>

        <TouchableOpacity
          style={[styles.continueButton, loading && styles.buttonDisabled]}
          onPress={() => handleSendOTP()}
          disabled={loading || phoneNumber.replace(/\D/g, '').length !== 10}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.continueButtonText}>Send Verification Code</Text>
          )}
        </TouchableOpacity>
      </>
    );
  };

  const renderOTPStep = () => {
    const displayPhone = displayFromLogin || phoneNumber;
    
    return (
      <>
        <View style={styles.header}>
          <Text style={styles.title}>Enter Verification Code</Text>
          <Text style={styles.subtitle}>
            We sent a 6-digit code to{'\n'}
            <Text style={styles.phoneHighlight}>{formatPhoneForDisplay(displayPhone)}</Text>
          </Text>
        </View>

        <View style={styles.otpSection}>
          <Text style={styles.inputLabel}>Verification Code</Text>
          
          <View style={styles.otpContainer}>
            {otpCode.map((digit, index) => (
              <TextInput
                key={index}
                ref={el => inputRefs.current[index] = el}
                style={[
                  styles.otpInput,
                  digit && styles.otpInputFilled,
                  loading && styles.otpInputDisabled
                ]}
                value={digit}
                onChangeText={(text) => handleOtpChange(text, index)}
                onKeyPress={(e) => handleKeyPress(e, index)}
                keyboardType="number-pad"
                maxLength={6}
                textAlign="center"
                autoFocus={index === 0}
                editable={!loading}
                selectTextOnFocus
                textContentType={index === 0 ? "oneTimeCode" : "none"}
                autoComplete={index === 0 ? "sms-otp" : "off"}
              />
            ))}
          </View>
          
          {errors.otpCode && (
            <Text style={styles.errorText}>{errors.otpCode}</Text>
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.continueButton,
            (otpCode.some(digit => !digit) || loading) && styles.buttonDisabled
          ]}
          onPress={() => handleVerifyOTP()}
          disabled={otpCode.some(digit => !digit) || loading}
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color="#FFFFFF" size="small" />
              <Text style={styles.continueButtonText}>Verifying...</Text>
            </View>
          ) : (
            <Text style={styles.continueButtonText}>Verify Code</Text>
          )}
        </TouchableOpacity>

        {/* Resend Section */}
        <View style={styles.resendContainer}>
          <Text style={styles.resendText}>
            Didn't receive the code?
          </Text>
          
          {canResend ? (
            <TouchableOpacity
              onPress={handleResendOTP}
              disabled={loading}
              style={styles.resendButton}
            >
              {loading ? (
                <ActivityIndicator color="#3B82F6" size="small" />
              ) : (
                <Text style={styles.resendButtonText}>Resend Code</Text>
              )}
            </TouchableOpacity>
          ) : (
            <Text style={styles.timerText}>
              Resend in {Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, '0')}
            </Text>
          )}
        </View>
      </>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Show progress indicator only in onboarding flow */}
      {isOnboarding && (
        <OnboardingProgressIndicator currentStep={4} totalSteps={5} />
      )}
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Back button */}
          <TouchableOpacity 
            style={styles.backButton}
            onPress={handleBack}
            disabled={loading}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>

          {step === 'phone' ? renderPhoneStep() : renderOTPStep()}

          {/* Help text at bottom */}
          <View style={styles.helpSection}>
            <Text style={styles.helpText}>
              {step === 'phone' 
                ? 'Standard messaging rates may apply'
                : 'Make sure to check your messages and enter the code exactly as received'
              }
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  backButton: {
    paddingVertical: 12,
    marginBottom: 20,
  },
  backButtonText: {
    fontSize: 16,
    color: '#3B82F6',
    fontWeight: '500',
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    lineHeight: 24,
  },
  phoneHighlight: {
    fontWeight: '600',
    color: '#3B82F6',
  },
  inputContainer: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  phoneInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
  },
  countryCode: {
    fontSize: 16,
    color: '#6B7280',
    marginRight: 8,
    fontWeight: '500',
  },
  phoneInput: {
    flex: 1,
    height: 56,
    fontSize: 16,
    color: '#1F2937',
  },
  otpSection: {
    marginBottom: 32,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  otpInput: {
    flex: 1,
    height: 56,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    fontSize: 24,
    fontWeight: '600',
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  otpInputFilled: {
    borderColor: '#3B82F6',
    backgroundColor: '#EFF6FF',
  },
  otpInputDisabled: {
    backgroundColor: '#F9FAFB',
    color: '#9CA3AF',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    marginTop: 8,
  },
  continueButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  buttonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resendContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  resendText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  resendButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  resendButtonText: {
    fontSize: 16,
    color: '#3B82F6',
    fontWeight: '600',
  },
  timerText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  helpSection: {
    alignItems: 'center',
    paddingTop: 16,
  },
  helpText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default PhoneVerificationScreen;