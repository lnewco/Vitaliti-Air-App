import React, { useState, useRef } from 'react';
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
  StatusBar,
  Dimensions,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
  FadeIn,
  FadeInDown,
} from 'react-native-reanimated';
import { useAuth } from '../AuthContext';
import { colors, typography, spacing } from '../../design-system';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
// const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

const LoginScreen = ({ navigation }) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const buttonScale = useSharedValue(1);
  
  const { sendOTP } = useAuth();

  const handleSendOTP = async () => {
    try {
      console.log('📱 Raw phone number:', phoneNumber);

      if (!phoneNumber || phoneNumber.trim().length === 0) {
        Alert.alert(
          'Invalid Phone Number',
          'Please enter a phone number.',
          [{ text: 'OK', style: 'default' }],
          { userInterfaceStyle: 'dark' }
        );
        return;
      }

      setIsLoading(true);
      
      // Animate button press
      buttonScale.value = withSequence(
        withSpring(0.95, { damping: 15, stiffness: 400 }),
        withSpring(1, { damping: 10, stiffness: 300 })
      );

      // Format the phone number
      let finalPhoneNumber;
      
      if (phoneNumber.startsWith('+')) {
        finalPhoneNumber = phoneNumber;
      } else {
        const digitsOnly = phoneNumber.replace(/\D/g, '');
        
        if (digitsOnly.length < 10) {
          Alert.alert(
            'Invalid Phone Number',
            'Please enter a complete phone number (at least 10 digits).',
            [{ text: 'OK', style: 'default' }],
            { userInterfaceStyle: 'dark' }
          );
          setIsLoading(false);
          return;
        }
        
        if (digitsOnly.length === 10) {
          finalPhoneNumber = `+1${digitsOnly}`;
        } else if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
          finalPhoneNumber = `+${digitsOnly}`;
        } else {
          finalPhoneNumber = `+${digitsOnly}`;
        }
      }
      
      console.log('📱 Final phone number to send:', finalPhoneNumber);

      await sendOTP(finalPhoneNumber);

      navigation.navigate('PremiumOTPScreen', { 
        phoneNumber: finalPhoneNumber,
        displayNumber: finalPhoneNumber
      });

    } catch (error) {
      console.error('❌ Login error:', error.message);
      Alert.alert(
        'Error',
        error.message || 'Failed to send verification code. Please try again.',
        [{ text: 'OK', style: 'default' }],
        { userInterfaceStyle: 'dark' }
      );
    } finally {
      setIsLoading(false);
    }
  };

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background.primary} />
      
      {/* Background gradient overlay */}
      <LinearGradient
        colors={[colors.background.primary, colors.background.secondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      
      {/* Decorative circles like Whoop */}
      <View style={styles.backgroundDecoration}>
        <View style={[styles.circle, styles.circle1]} />
        <View style={[styles.circle, styles.circle2]} />
      </View>
      
      <KeyboardAvoidingView 
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            {/* Logo/Header with animation */}
            <Animated.View 
              entering={FadeInDown.duration(800).springify()}
              style={styles.header}
            >
              <View style={styles.logoContainer}>
                <Image
                  source={require('../../../assets/IMG_4490.png')}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
                <Text style={styles.logoSubtext}>Breathe, Transform.</Text>
              </View>
            </Animated.View>

            {/* Welcome Text with animation */}
            <Animated.View 
              entering={FadeInDown.duration(800).delay(200).springify()}
              style={styles.welcomeSection}
            >
              <Text style={styles.welcomeTitle}>Welcome Back</Text>
              <Text style={styles.welcomeSubtitle}>
                Enter your phone number to access your health data
              </Text>
            </Animated.View>

            {/* Phone Input Section with animation */}
            <Animated.View 
              entering={FadeInDown.duration(800).delay(400).springify()}
              style={styles.formSection}
            >
              <Text style={styles.inputLabel}>PHONE NUMBER</Text>
              
              <View style={[
                styles.phoneInputContainer,
                isFocused && styles.phoneInputContainerFocused
              ]}>
                <TextInput
                  style={styles.phoneInput}
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  placeholder="(555) 123-4567"
                  placeholderTextColor={colors.text.quaternary}
                  keyboardType="phone-pad"
                  textContentType="telephoneNumber"
                  autoComplete="tel"
                  autoCorrect={false}
                  clearButtonMode="while-editing"
                  autoFocus={false}
                  editable={!isLoading}
                  maxLength={15}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                />
              </View>

              {phoneNumber && phoneNumber.replace(/\D/g, '').length < 10 && (
                <Animated.Text 
                  entering={FadeIn.duration(300)}
                  style={styles.errorText}
                >
                  Please enter a valid phone number
                </Animated.Text>
              )}
            </Animated.View>

            {/* Send OTP Button with animation */}
            <Animated.View 
              entering={FadeInDown.duration(800).delay(600).springify()}
              style={buttonAnimatedStyle}
            >
              <TouchableOpacity
                onPress={handleSendOTP}
                disabled={phoneNumber.replace(/\D/g, '').length < 10 || isLoading}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={
                    phoneNumber.replace(/\D/g, '').length < 10 || isLoading
                      ? ['rgba(59, 130, 246, 0.3)', 'rgba(59, 130, 246, 0.3)']
                      : [colors.brand.accent, colors.brand.secondary]
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.sendButton}
                >
                  {isLoading ? (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator color="#FFFFFF" size="small" />
                      <Text style={styles.sendButtonText}>SENDING...</Text>
                    </View>
                  ) : (
                    <Text style={styles.sendButtonText}>SEND VERIFICATION CODE</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>

            {/* Terms and Privacy with animation */}
            <Animated.View 
              entering={FadeInDown.duration(800).delay(800).springify()}
              style={styles.termsSection}
            >
              <Text style={styles.termsText}>
                By continuing, you agree to our{' '}
                <Text style={styles.termsLink}>Terms of Service</Text>
                {' '}and{' '}
                <Text style={styles.termsLink}>Privacy Policy</Text>
              </Text>
            </Animated.View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
  },
  backgroundDecoration: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.05,
  },
  circle: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.brand.primary,
  },
  circle1: {
    width: 300,
    height: 300,
    top: -100,
    right: -100,
  },
  circle2: {
    width: 200,
    height: 200,
    bottom: -50,
    left: -50,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.screenPadding,
    paddingTop: screenHeight * 0.12,
    paddingBottom: spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  logoContainer: {
    alignItems: 'center',
  },
  logoImage: {
    width: 160,
    height: 48,
    marginBottom: spacing.md,
  },
  logoSubtext: {
    ...typography.bodyMedium,
    color: colors.text.secondary,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  welcomeSection: {
    marginBottom: spacing.xxl,
  },
  welcomeTitle: {
    ...typography.h1,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  welcomeSubtitle: {
    ...typography.bodyLarge,
    color: colors.text.secondary,
    lineHeight: 24,
  },
  formSection: {
    marginBottom: spacing.xl,
  },
  inputLabel: {
    ...typography.labelSmall,
    color: colors.text.tertiary,
    marginBottom: spacing.sm,
    letterSpacing: 1,
  },
  phoneInputContainer: {
    marginBottom: spacing.xs,
    borderRadius: spacing.radius.input,
    borderWidth: 1,
    borderColor: colors.border.light,
    backgroundColor: colors.components.input.background,
    overflow: 'hidden',
  },
  phoneInputContainerFocused: {
    borderColor: colors.brand.accent,
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
  },
  phoneInput: {
    height: 56,
    paddingHorizontal: spacing.md,
    ...typography.bodyLarge,
    color: colors.text.primary,
  },
  errorText: {
    ...typography.caption,
    color: colors.semantic.error,
    marginTop: spacing.xxs,
  },
  sendButton: {
    height: 56,
    borderRadius: spacing.radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  sendButtonText: {
    ...typography.buttonLarge,
    color: colors.text.primary,
    letterSpacing: 0.5,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  termsSection: {
    alignItems: 'center',
    paddingTop: spacing.lg,
  },
  termsText: {
    ...typography.bodySmall,
    color: colors.text.tertiary,
    textAlign: 'center',
    lineHeight: 20,
  },
  termsLink: {
    color: colors.brand.accent,
    fontWeight: '500',
  },
});

export default LoginScreen;