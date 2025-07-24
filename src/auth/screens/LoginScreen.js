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
  Image,
  TextInput,
} from 'react-native';
// Removed PhoneInput due to React version conflicts
import { useAuth } from '../AuthContext';

const LoginScreen = ({ navigation }) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { sendOTP } = useAuth();

  const handleSendOTP = async () => {
    try {
      console.log('📱 Raw phone number:', phoneNumber);

      // Check if we have a phone number
      if (!phoneNumber || phoneNumber.trim().length === 0) {
        Alert.alert(
          'Invalid Phone Number',
          'Please enter a phone number.'
        );
        return;
      }

      setIsLoading(true);

      // Format the phone number
      let finalPhoneNumber;
      
      if (phoneNumber.startsWith('+')) {
        // Already has country code
        finalPhoneNumber = phoneNumber;
      } else {
        // Remove any non-digits
        const digitsOnly = phoneNumber.replace(/\D/g, '');
        
        // Validate length
        if (digitsOnly.length < 10) {
          Alert.alert(
            'Invalid Phone Number',
            'Please enter a complete phone number (at least 10 digits).'
          );
          setIsLoading(false);
          return;
        }
        
        // Add +1 if it's a 10-digit US number
        if (digitsOnly.length === 10) {
          finalPhoneNumber = `+1${digitsOnly}`;
        } else if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
          finalPhoneNumber = `+${digitsOnly}`;
        } else {
          finalPhoneNumber = `+${digitsOnly}`;
        }
      }
      
      console.log('📱 Final phone number to send:', finalPhoneNumber);

      // Send OTP
      await sendOTP(finalPhoneNumber);

      // Navigate to OTP verification screen
      navigation.navigate('OTPScreen', { 
        phoneNumber: finalPhoneNumber,
        displayNumber: finalPhoneNumber
      });

    } catch (error) {
      console.error('❌ Login error:', error.message);
      Alert.alert(
        'Error',
        error.message || 'Failed to send verification code. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
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
          {/* Logo/Header */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Text style={styles.logoText}>Vitaliti Air</Text>
              <Text style={styles.logoSubtext}>Your Health, Connected</Text>
            </View>
          </View>

          {/* Welcome Text */}
          <View style={styles.welcomeSection}>
            <Text style={styles.welcomeTitle}>Welcome Back</Text>
            <Text style={styles.welcomeSubtitle}>
              Enter your phone number to sign in to your account
            </Text>
          </View>

          {/* Phone Input Section */}
          <View style={styles.formSection}>
            <Text style={styles.inputLabel}>Phone Number</Text>
            
            <View style={styles.phoneInputContainer}>
              <TextInput
                style={styles.phoneInput}
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                placeholder="Enter phone number (e.g., 8055700864)"
                keyboardType="phone-pad"
                autoFocus={false}
                editable={!isLoading}
                maxLength={15}
              />
            </View>

            {phoneNumber && phoneNumber.replace(/\D/g, '').length < 10 && (
              <Text style={styles.errorText}>
                Please enter a valid phone number
              </Text>
            )}
          </View>

          {/* Send OTP Button */}
          <TouchableOpacity
            style={[
              styles.sendButton,
              (phoneNumber.replace(/\D/g, '').length < 10 || isLoading) && styles.sendButtonDisabled
            ]}
            onPress={handleSendOTP}
            disabled={phoneNumber.replace(/\D/g, '').length < 10 || isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color="#FFFFFF" size="small" />
                <Text style={styles.sendButtonText}>Sending...</Text>
              </View>
            ) : (
              <Text style={styles.sendButtonText}>Send Verification Code</Text>
            )}
          </TouchableOpacity>

          {/* Terms and Privacy */}
          <View style={styles.termsSection}>
            <Text style={styles.termsText}>
              By continuing, you agree to our{' '}
              <Text style={styles.termsLink}>Terms of Service</Text>
              {' '}and{' '}
              <Text style={styles.termsLink}>Privacy Policy</Text>
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
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    alignItems: 'center',
  },
  logoText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2563EB',
    marginBottom: 4,
  },
  logoSubtext: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
  welcomeSection: {
    marginBottom: 40,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    lineHeight: 24,
  },
  formSection: {
    marginBottom: 32,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  phoneInputContainer: {
    marginBottom: 8,
  },
  phoneInput: {
    width: '100%',
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#111827',
  },
  phoneContainer: {
    width: '100%',
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
  },
  phoneTextContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 0,
  },
  phoneTextInput: {
    fontSize: 16,
    color: '#111827',
    height: 54,
  },
  phoneCodeText: {
    fontSize: 16,
    color: '#111827',
    height: 54,
  },
  phoneFlagButton: {
    borderRadius: 12,
  },
  phoneCountryPicker: {
    borderRadius: 12,
  },
  errorText: {
    fontSize: 14,
    color: '#EF4444',
    marginTop: 4,
  },
  sendButton: {
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
  sendButtonDisabled: {
    backgroundColor: '#9CA3AF',
    shadowOpacity: 0,
    elevation: 0,
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  termsSection: {
    alignItems: 'center',
    paddingTop: 16,
  },
  termsText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  termsLink: {
    color: '#2563EB',
    fontWeight: '500',
  },
});

export default LoginScreen; 