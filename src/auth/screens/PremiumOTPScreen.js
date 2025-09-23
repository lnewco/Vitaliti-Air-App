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
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Animated } from 'react-native';
import {
  FadeInDown,
  FadeIn,
  AnimatedAPI,
  isExpoGo
} from '../../utils/animationHelpers';
import { useAuth } from '../AuthContext';
import { colors, typography, spacing } from '../../design-system';
import VitalitiLogo from '../../components/common/VitalitiLogo';

const PremiumOTPScreen = ({ route, navigation }) => {
  const { phoneNumber, displayNumber } = route.params;
  const { verifyOTP } = useAuth();
  
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  
  const inputRefs = useRef([]);
  const hiddenInputRef = useRef(null);
  const verificationInProgress = useRef(false);
  const lastVerifiedCode = useRef(null);

  // Timer countdown for resend
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

  // Auto-focus hidden input for SMS autofill
  useEffect(() => {
    setTimeout(() => {
      hiddenInputRef.current?.focus();
    }, 300);
  }, []);

  // Handle SMS autofill from hidden input
  const handleHiddenInputChange = (value) => {
    const cleanedValue = value.replace(/[^0-9]/g, '').slice(0, 6);
    if (cleanedValue.length > 0) {
      const newOTP = cleanedValue.split('').concat(Array(6).fill('')).slice(0, 6);
      setOtpCode(newOTP);
      
      if (cleanedValue.length === 6) {
        // Hide keyboard and verify
        hiddenInputRef.current?.blur();
        verifyOTPCode(cleanedValue);
      }
    }
  };

  const handleOTPChange = (value, index) => {
    const cleanedValue = value.replace(/[^0-9]/g, '');
    
    if (cleanedValue.length > 1) {
      const digits = cleanedValue.split('').slice(0, 6);
      const newOTP = [...otpCode];
      digits.forEach((digit, i) => {
        if (index + i < 6) {
          newOTP[index + i] = digit;
        }
      });
      setOtpCode(newOTP);
      
      const lastFilledIndex = Math.min(index + digits.length - 1, 5);
      if (lastFilledIndex < 5) {
        inputRefs.current[lastFilledIndex + 1]?.focus();
      } else {
        inputRefs.current[5]?.blur();
        const fullCode = newOTP.join('');
        if (fullCode.length === 6) {
          verifyOTPCode(fullCode);
        }
      }
      return;
    }
    
    const newOTP = [...otpCode];
    newOTP[index] = cleanedValue;
    setOtpCode(newOTP);
    
    if (cleanedValue && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
    
    const fullCode = newOTP.join('');
    if (fullCode.length === 6 && fullCode !== lastVerifiedCode.current && !verificationInProgress.current) {
      verifyOTPCode(fullCode);
    }
  };

  const verifyOTPCode = async (code) => {
    if (verificationInProgress.current || code === lastVerifiedCode.current) {
      return;
    }
    
    verificationInProgress.current = true;
    lastVerifiedCode.current = code;
    setLoading(true);
    
    try {
      await verifyOTP(phoneNumber, code);
      // Navigation handled by auth context
    } catch (error) {
      console.error('Verification error:', error);
      
      let userMessage = 'Verification failed. Please check the code and try again.';
      if (error.message.includes('expired')) {
        userMessage = 'The verification code has expired. Please request a new one.';
      } else if (error.message.includes('Invalid')) {
        userMessage = 'Invalid verification code. Please try again.';
      }
      
      Alert.alert(
        'Verification Failed',
        userMessage,
        [{ text: 'OK', style: 'default' }],
        { userInterfaceStyle: 'dark' }
      );
      
      // Clear the code on error
      setOtpCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
      lastVerifiedCode.current = null;
    } finally {
      setLoading(false);
      verificationInProgress.current = false;
    }
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !otpCode[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleResend = () => {
    if (canResend) {
      setTimer(60);
      setCanResend(false);
      // You can add resend OTP logic here
      Alert.alert(
        'Code Resent',
        'A new verification code has been sent to your phone.',
        [{ text: 'OK', style: 'default' }],
        { userInterfaceStyle: 'dark' }
      );
    }
  };

  const formatPhoneForDisplay = () => {
    if (!displayNumber) return phoneNumber;
    // Format as +1 (XXX) XXX-XXXX
    const cleaned = displayNumber.replace(/\D/g, '');
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    return displayNumber;
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background.primary} />
      
      {/* Background gradient */}
      <LinearGradient
        colors={[colors.background.primary, colors.background.secondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Logo */}
            <AnimatedAPI.View
              style={[styles.logoContainer, isExpoGo ? {} : { opacity: 1 }]}
            >
              <VitalitiLogo size="large" />
            </AnimatedAPI.View>

            {/* Header */}
            <AnimatedAPI.View
              style={[styles.header, isExpoGo ? {} : { opacity: 1 }]}
            >
              <Text style={styles.title}>Enter Verification Code</Text>
              <Text style={styles.subtitle}>
                We sent a 6-digit code to{'\n'}
                <Text style={styles.phoneNumber}>{formatPhoneForDisplay()}</Text>
              </Text>
            </AnimatedAPI.View>

            {/* OTP Input */}
            <AnimatedAPI.View
              style={[styles.otpContainer, isExpoGo ? {} : { opacity: 1 }]}
            >
              <Text style={styles.inputLabel}>Verification Code</Text>
              <View style={styles.otpInputsContainer}>
                {/* Hidden input for iOS SMS autofill */}
                <TextInput
                  ref={hiddenInputRef}
                  style={styles.hiddenInput}
                  value={otpCode.join('')}
                  onChangeText={handleHiddenInputChange}
                  keyboardType="number-pad"
                  autoComplete="one-time-code"
                  textContentType="oneTimeCode"
                  maxLength={6}
                  editable={!loading}
                />
                
                {otpCode.map((digit, index) => (
                  <TouchableOpacity
                    key={index}
                    onPress={() => hiddenInputRef.current?.focus()}
                    activeOpacity={1}
                  >
                    <View style={[
                      styles.otpInput,
                      digit && styles.otpInputFilled,
                      loading && styles.otpInputDisabled
                    ]}>
                      <Text style={styles.otpDigit}>{digit}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </AnimatedAPI.View>

            {/* Verify Button */}
            <AnimatedAPI.View
              style={isExpoGo ? {} : { opacity: 1 }}
            >
              <TouchableOpacity
                onPress={() => {
                  const code = otpCode.join('');
                  if (code.length === 6) {
                    verifyOTPCode(code);
                  }
                }}
                disabled={otpCode.join('').length !== 6 || loading}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={
                    otpCode.join('').length !== 6 || loading
                      ? ['rgba(59, 130, 246, 0.3)', 'rgba(59, 130, 246, 0.3)']
                      : [colors.brand.accent, colors.brand.secondary]
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.verifyButton}
                >
                  {loading ? (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator color="#FFFFFF" size="small" />
                      <Text style={styles.verifyButtonText}>VERIFYING...</Text>
                    </View>
                  ) : (
                    <Text style={styles.verifyButtonText}>VERIFY CODE</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </AnimatedAPI.View>

            {/* Resend Section */}
            <AnimatedAPI.View
              style={[styles.resendSection, isExpoGo ? {} : { opacity: 1 }]}
            >
              <Text style={styles.resendText}>Didn't receive the code?</Text>
              {canResend ? (
                <TouchableOpacity onPress={handleResend}>
                  <Text style={styles.resendLink}>Resend Code</Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.resendTimer}>
                  Resend in {timer}s
                </Text>
              )}
            </AnimatedAPI.View>

            {/* Info Text */}
            <AnimatedAPI.View
              style={[styles.infoSection, isExpoGo ? {} : { opacity: 1 }]}
            >
              <Text style={styles.infoText}>
                Make sure to check your messages and enter the 6-digit code
              </Text>
            </AnimatedAPI.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  header: {
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.h1,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.bodyLarge,
    color: colors.text.secondary,
    lineHeight: 26,
  },
  phoneNumber: {
    ...typography.bodyLarge,
    color: colors.brand.accent,
    fontWeight: '600',
  },
  otpContainer: {
    marginBottom: spacing.xl,
  },
  inputLabel: {
    ...typography.labelSmall,
    color: colors.text.tertiary,
    marginBottom: spacing.md,
    letterSpacing: 1,
  },
  otpInputsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  hiddenInput: {
    position: 'absolute',
    width: 0,
    height: 0,
    opacity: 0,
  },
  otpInput: {
    width: 52,
    height: 60,
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: spacing.radius.input,
    backgroundColor: colors.components.input.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpDigit: {
    ...typography.displaySmall,
    color: colors.text.primary,
    textAlign: 'center',
  },
  otpInputFilled: {
    borderColor: colors.brand.accent,
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
  },
  otpInputDisabled: {
    opacity: 0.5,
  },
  verifyButton: {
    height: 56,
    borderRadius: spacing.radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  verifyButtonText: {
    ...typography.buttonLarge,
    color: colors.text.primary,
    letterSpacing: 0.5,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  resendSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  resendText: {
    ...typography.bodyMedium,
    color: colors.text.tertiary,
    marginBottom: spacing.xs,
  },
  resendLink: {
    ...typography.bodyMedium,
    color: colors.brand.accent,
    fontWeight: '600',
  },
  resendTimer: {
    ...typography.bodyMedium,
    color: colors.text.quaternary,
  },
  infoSection: {
    alignItems: 'center',
  },
  infoText: {
    ...typography.bodySmall,
    color: colors.text.quaternary,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default PremiumOTPScreen;