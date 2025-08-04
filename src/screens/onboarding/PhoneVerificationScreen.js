import React, { useState, useRef } from 'react';
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
import OnboardingProgressIndicator from '../../components/OnboardingProgressIndicator';
import { useOnboarding } from '../../context/OnboardingContext';
import { useAuth } from '../../auth/AuthContext';

const PhoneVerificationScreen = ({ navigation }) => {
  const { onboardingData, updateOnboardingData } = useOnboarding();
  const { sendOTP: authSendOTP, verifyOTP: authVerifyOTP } = useAuth();
  
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const [step, setStep] = useState('phone'); // 'phone' or 'otp'
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  
  const inputRefs = useRef([]);

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
      
      updateOnboardingData('phoneNumber', formattedPhone);
      
      setStep('otp');
      setErrors({});
      
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
      
      // Auto-verify
      setTimeout(() => {
        handleVerifyOTP(text);
      }, 100);
      
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
    if (text && index === 5 && newOtp.every(digit => digit.length === 1)) {
      handleVerifyOTP(newOtp.join(''));
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
    
    if (otpToUse.length !== 6) {
      setErrors({ otpCode: 'Please enter the 6-digit verification code' });
      return;
    }

    setLoading(true);
    try {
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      const formattedPhone = `+1${cleanPhone}`;
      
      await authVerifyOTP(formattedPhone, otpToUse);
      
      setErrors({});
      
      console.log('📱 OTP verification successful, navigating to CompletionScreen');
      
      // Navigate immediately to CompletionScreen
      navigation.navigate('Completion');
      
      // Show success popup AFTER navigation starts
      setTimeout(() => {
        Alert.alert(
          'Account Created Successfully!',
          'Welcome to Vitaliti Air! Your account has been created and verified.',
          [{ text: 'Continue', style: 'default' }]
        );
      }, 100);
      
    } catch (error) {
      console.error('📱 Verify OTP error:', error);
      
      // Clear OTP inputs on error
      setOtpCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
      
      let userFriendlyMessage = 'Verification failed. Please try again.';
      
      if (error.message.includes('Invalid token')) {
        userFriendlyMessage = 'Invalid verification code. Please check the code and try again.';
      } else if (error.message.includes('expired')) {
        userFriendlyMessage = 'Verification code has expired. Please request a new code.';
      }
      
      Alert.alert('Verification Failed', userFriendlyMessage);
      setErrors({ otpCode: userFriendlyMessage });
    } finally {
      setLoading(false);
    }
  };

  const handleGoBack = () => {
    if (step === 'otp') {
      setStep('phone');
      setOtpCode(['', '', '', '', '', '']);
      setErrors({});
    } else {
      navigation.goBack();
    }
  };

  if (step === 'phone') {
    return (
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
        >
          <SafeAreaView style={styles.content}>
            <OnboardingProgressIndicator currentStep={5} totalSteps={5} />
            
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity 
                style={styles.backButton}
                onPress={handleGoBack}
                disabled={loading}
              >
                <Text style={styles.backButtonText}>←</Text>
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Phone Verification</Text>
              <View style={styles.backButton} />
            </View>

            {/* Title and Description */}
            <View style={styles.titleSection}>
              <Text style={styles.title}>Phone Verification</Text>
              <Text style={styles.subtitle}>
                We'll send you a verification code to confirm your phone number.
              </Text>
            </View>

            {/* Phone Input Section */}
            <View style={styles.formSection}>
              <Text style={styles.inputLabel}>Phone Number *</Text>
              
              <View style={styles.phoneInputContainer}>
                <TextInput
                  style={[styles.phoneInput, errors.phoneNumber && styles.inputError]}
                  value={phoneNumber}
                  onChangeText={handlePhoneNumberChange}
                  placeholder="Enter phone number"
                  keyboardType="phone-pad"
                  textContentType="telephoneNumber"
                  autoComplete="tel"
                  autoCorrect={false}
                  clearButtonMode="while-editing"
                  autoFocus={true}
                  editable={!loading}
                  maxLength={14}
                />
              </View>

              {errors.phoneNumber && (
                <Text style={styles.errorText}>{errors.phoneNumber}</Text>
              )}

              <Text style={styles.autoSendText}>
                Verification code will be sent automatically when you finish entering your number
              </Text>
            </View>

            {/* Manual Send Button (fallback) */}
            <TouchableOpacity
              style={[
                styles.sendButton,
                (phoneNumber.replace(/\D/g, '').length < 10 || loading) && styles.sendButtonDisabled
              ]}
              onPress={() => handleSendOTP()}
              disabled={phoneNumber.replace(/\D/g, '').length < 10 || loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator color="#FFFFFF" size="small" />
                  <Text style={styles.sendButtonText}>Sending...</Text>
                </View>
              ) : (
                <Text style={styles.sendButtonText}>Send Verification Code</Text>
              )}
            </TouchableOpacity>
          </SafeAreaView>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // OTP Step
  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        <SafeAreaView style={styles.content}>
          <OnboardingProgressIndicator currentStep={5} totalSteps={5} />
          
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={handleGoBack}
              disabled={loading}
            >
              <Text style={styles.backButtonText}>←</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Verify Phone</Text>
            <View style={styles.backButton} />
          </View>

          {/* Title and Description */}
          <View style={styles.titleSection}>
            <Text style={styles.title}>Enter Verification Code</Text>
            <Text style={styles.subtitle}>
              We sent a 6-digit code to{'\n'}
              <Text style={styles.phoneText}>{formatPhoneForDisplay(onboardingData.phoneNumber)}</Text>
            </Text>
          </View>

          {/* OTP Input */}
          <View style={styles.otpSection}>
            <Text style={styles.otpLabel}>Verification Code</Text>
            
            <View style={styles.otpContainer}>
              {otpCode.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={el => inputRefs.current[index] = el}
                  style={[
                    styles.otpInput,
                    digit && styles.otpInputFilled,
                    loading && styles.otpInputDisabled,
                    errors.otpCode && styles.inputError
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

            <Text style={styles.autoVerifyText}>
              Code will be verified automatically when you finish entering
            </Text>
          </View>

          {/* Verify Button */}
          <TouchableOpacity
            style={[
              styles.verifyButton,
              (otpCode.some(digit => !digit) || loading) && styles.verifyButtonDisabled
            ]}
            onPress={() => handleVerifyOTP()}
            disabled={otpCode.some(digit => !digit) || loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color="#FFFFFF" size="small" />
                <Text style={styles.verifyButtonText}>Verifying...</Text>
              </View>
            ) : (
              <Text style={styles.verifyButtonText}>Verify Code</Text>
            )}
          </TouchableOpacity>

          {/* Help Text */}
          <View style={styles.helpSection}>
            <Text style={styles.helpText}>
              Make sure to check your messages and enter the 6-digit code exactly as received.
            </Text>
          </View>
        </SafeAreaView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContainer: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 32, // Increased from 16 to 32 for much more padding
    paddingTop: 40, // Reduced from 50
    paddingBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24, // Reduced from 30
    paddingHorizontal: 4, // Add extra padding to header
  },
  backButton: {
    width: 32, // Reduced from 36
    height: 32, // Reduced from 36
    borderRadius: 16, // Adjusted for new size
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 14, // Reduced from 16
    color: '#374151',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 14, // Reduced from 16
    fontWeight: '600',
    color: '#111827',
  },
  titleSection: {
    alignItems: 'center',
    marginBottom: 24, // Reduced from 30
    paddingHorizontal: 16, // Add extra padding to title section
  },
  title: {
    fontSize: 20, // Reduced from 24
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 6, // Reduced from 8
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14, // Reduced from 15
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20, // Reduced from 22
    paddingHorizontal: 12, // Increased padding for better text wrap
  },
  phoneText: {
    fontWeight: '600',
    color: '#2563EB',
  },
  formSection: {
    marginBottom: 20, // Reduced from 24
    paddingHorizontal: 8, // Add padding to form section
  },
  inputLabel: {
    fontSize: 14, // Reduced from 15
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6, // Reduced from 8
  },
  phoneInputContainer: {
    marginBottom: 6,
    paddingHorizontal: 4, // Add padding to input container
  },
  phoneInput: {
    width: '100%',
    height: 48, // Reduced from 52
    borderRadius: 8, // Reduced from 10
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12, // Reduced from 14
    fontSize: 15, // Reduced from 16
    color: '#111827',
  },
  inputError: {
    borderColor: '#EF4444',
    borderWidth: 2,
  },
  errorText: {
    fontSize: 12, // Reduced from 13
    color: '#EF4444',
    marginTop: 4,
    paddingHorizontal: 4,
  },
  autoSendText: {
    fontSize: 12, // Reduced from 13
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 6, // Reduced from 8
    fontStyle: 'italic',
    paddingHorizontal: 16, // Increased padding for better text wrap
  },
  autoVerifyText: {
    fontSize: 12, // Reduced from 13
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 4, // Reduced from 6
    fontStyle: 'italic',
    paddingHorizontal: 16, // Increased padding for better text wrap
  },
  sendButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 12, // Reduced from 14
    borderRadius: 8, // Reduced from 10
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16, // Reduced from 20
    marginHorizontal: 12, // Increased from 4 to add more side margin
    shadowColor: '#2563EB',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  sendButtonDisabled: {
    backgroundColor: '#9CA3AF',
    shadowOpacity: 0,
    elevation: 0,
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 14, // Reduced from 15
    fontWeight: '600',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4, // Reduced from 6
  },
  otpSection: {
    marginBottom: 20, // Reduced from 24
    paddingHorizontal: 8, // Add padding to OTP section
  },
  otpLabel: {
    fontSize: 14, // Reduced from 15
    fontWeight: '600',
    color: '#374151',
    marginBottom: 10, // Reduced from 12
    textAlign: 'center',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6, // Reduced from 8
    paddingHorizontal: 16, // Increased from 4 to add much more padding to prevent edge touching
  },
  otpInput: {
    flex: 1,
    height: 44, // Reduced from 50
    borderWidth: 2,
    borderColor: '#D1D5DB',
    borderRadius: 8, // Reduced from 10
    fontSize: 18, // Reduced from 20
    fontWeight: '600',
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  otpInputFilled: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  otpInputDisabled: {
    backgroundColor: '#F9FAFB',
    color: '#9CA3AF',
  },
  verifyButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 12, // Reduced from 14
    borderRadius: 8, // Reduced from 10
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16, // Reduced from 20
    marginHorizontal: 12, // Increased from 4 to add more side margin
    shadowColor: '#2563EB',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  verifyButtonDisabled: {
    backgroundColor: '#9CA3AF',
    shadowOpacity: 0,
    elevation: 0,
  },
  verifyButtonText: {
    color: '#FFFFFF',
    fontSize: 14, // Reduced from 15
    fontWeight: '600',
  },
  helpSection: {
    alignItems: 'center',
    paddingTop: 8, // Reduced from 12
    paddingHorizontal: 16, // Increased padding for better text wrap
  },
  helpText: {
    fontSize: 12, // Reduced from 13
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 16, // Reduced from 18
  },
});

export default PhoneVerificationScreen;