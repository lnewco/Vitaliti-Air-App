import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
} from 'react-native';
import { useAuth } from '../AuthContext';

const OTPScreen = ({ route, navigation }) => {
  const { phoneNumber, displayNumber } = route.params;
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [timer, setTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  
  const inputRefs = useRef([]);
  const verificationInProgress = useRef(false); // Use ref for immediate updates
  const lastVerifiedCode = useRef(null); // Track last verified code to prevent duplicates
  const { verifyOTP, sendOTP } = useAuth();

  // Timer countdown
  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => {
        setTimer(prev => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setCanResend(true);
    }
  }, [timer]);

  const handleOtpChange = (text, index) => {
    // Check if this is a full 6-digit auto-fill on the first input
    if (index === 0 && text.length === 6 && /^\d{6}$/.test(text)) {
      const digits = text.split('');
      setOtp(digits);
      
      // Set each input value via refs
      digits.forEach((digit, idx) => {
        if (inputRefs.current[idx]) {
          inputRefs.current[idx].setNativeProps({ text: digit });
        }
      });
      
      // Auto-verify (prevent duplicate calls using ref for immediate effect)
      if (!verificationInProgress.current && lastVerifiedCode.current !== text) {
        verificationInProgress.current = true;
        setIsVerifying(true);
        setTimeout(() => {
          handleVerifyOTP(text);
        }, 100);
      }
      
      return;
    }
    
    // Only allow numbers
    if (!/^\d*$/.test(text)) return;

    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);

    // Auto-focus next input
    if (text && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-verify when all 6 digits are entered (prevent duplicate calls)
    const fullCode = newOtp.join('');
    if (text && index === 5 && newOtp.every(digit => digit.length === 1) && 
        !verificationInProgress.current && lastVerifiedCode.current !== fullCode) {
      verificationInProgress.current = true;
      setIsVerifying(true);
      handleVerifyOTP(fullCode);
    }
  };

  const handleKeyPress = (e, index) => {
    // Handle backspace
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOTP = async (otpCode = null) => {
    const codeToVerify = otpCode || otp.join('');
    
    // Check using ref for most up-to-date value and prevent duplicate of same code
    if (verificationInProgress.current || lastVerifiedCode.current === codeToVerify) {
      console.log('⚠️ Verification already in progress or code already verified');
      verificationInProgress.current = false; // Reset in case of edge case
      setIsVerifying(false);
      return;
    }
    
    try {
      if (codeToVerify.length !== 6) {
        Alert.alert('Invalid Code', 'Please enter the complete 6-digit verification code.');
        verificationInProgress.current = false;
        setIsVerifying(false);
        return;
      }

      // Mark this code as being verified
      verificationInProgress.current = true;
      lastVerifiedCode.current = codeToVerify;
      setIsLoading(true);
      setIsVerifying(true);

      console.log('🔐 Verifying OTP code:', codeToVerify.substring(0, 2) + '****');

      // Verify OTP
      await verifyOTP(phoneNumber, codeToVerify);
      
      // Success - reset flags after a short delay to allow navigation
      setTimeout(() => {
        setIsLoading(false);
        setIsVerifying(false);
        verificationInProgress.current = false;
      }, 500);

    } catch (error) {
      console.error('❌ OTP verification error:', error.message);
      
      // Clear the last verified code on error so user can retry with same code
      lastVerifiedCode.current = null;
      verificationInProgress.current = false;
      
      // Clear OTP inputs on error
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
      
      Alert.alert(
        'Verification Failed',
        error.message || 'Invalid verification code. Please try again.'
      );
      
      // Reset verification flags on error
      setIsLoading(false);
      setIsVerifying(false);
    }
  };

  const handleResendOTP = async () => {
    try {
      setIsResending(true);
      
      console.log('📱 Resending OTP to:', phoneNumber);

      await sendOTP(phoneNumber);

      // Reset everything including refs
      setTimer(60);
      setCanResend(false);
      setOtp(['', '', '', '', '', '']);
      verificationInProgress.current = false;
      lastVerifiedCode.current = null;
      setIsVerifying(false);
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
      setIsResending(false);
    }
  };

  const handleGoBack = () => {
    navigation.goBack();
  };

  const formatPhoneNumber = (phone) => {
    // Simple formatting for display
    if (phone && phone.length > 6) {
      return phone.replace(/(\+\d{1,3})(\d{3})(\d{3})(\d{4})/, '$1 $2-$3-$4');
    }
    return phone;
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={handleGoBack}
              disabled={isLoading}
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
              <Text style={styles.phoneText}>{formatPhoneNumber(displayNumber || phoneNumber)}</Text>
            </Text>
          </View>

          {/* OTP Input */}
          <View style={styles.otpSection}>
            <Text style={styles.otpLabel}>Verification Code</Text>
            
            <View style={styles.otpContainer}>
              
              {otp.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={el => inputRefs.current[index] = el}
                  style={[
                    styles.otpInput,
                    digit && styles.otpInputFilled,
                    isLoading && styles.otpInputDisabled
                  ]}
                  value={digit}
                  onChangeText={(text) => handleOtpChange(text, index)}
                  onKeyPress={(e) => handleKeyPress(e, index)}
                  keyboardType="number-pad"
                  maxLength={6}
                  textAlign="center"
                  autoFocus={index === 0}
                  editable={!isLoading}
                  selectTextOnFocus
                  textContentType={index === 0 ? "oneTimeCode" : "none"}
                  autoComplete={index === 0 ? "sms-otp" : "off"}
                />
              ))}
            </View>
          </View>

          {/* Verify Button */}
          <TouchableOpacity
            style={[
              styles.verifyButton,
              (otp.some(digit => !digit) || isLoading) && styles.verifyButtonDisabled
            ]}
            onPress={() => handleVerifyOTP()}
            disabled={otp.some(digit => !digit) || isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color="#FFFFFF" size="small" />
                <Text style={styles.verifyButtonText}>Verifying...</Text>
              </View>
            ) : (
              <Text style={styles.verifyButtonText}>Verify Code</Text>
            )}
          </TouchableOpacity>

          {/* Resend Section */}
          <View style={styles.resendSection}>
            <Text style={styles.resendText}>
              Didn't receive the code?
            </Text>
            
            {canResend ? (
              <TouchableOpacity
                onPress={handleResendOTP}
                disabled={isResending}
                style={styles.resendButton}
              >
                {isResending ? (
                  <View style={styles.resendLoadingContainer}>
                    <ActivityIndicator color="#2563EB" size="small" />
                    <Text style={styles.resendButtonText}>Sending...</Text>
                  </View>
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

          {/* Help Text */}
          <View style={styles.helpSection}>
            <Text style={styles.helpText}>
              Make sure to check your messages and enter the 6-digit code exactly as received.
            </Text>
          </View>
        </View>
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
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 40,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 18,
    color: '#374151',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  titleSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  phoneText: {
    fontWeight: '600',
    color: '#2563EB',
  },
  otpSection: {
    marginBottom: 32,
  },
  otpLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 16,
    textAlign: 'center',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
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
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  otpInputDisabled: {
    backgroundColor: '#F9FAFB',
    color: '#9CA3AF',
  },
  verifyButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
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
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resendSection: {
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
    color: '#2563EB',
    fontWeight: '600',
  },
  resendLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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

export default OTPScreen; 