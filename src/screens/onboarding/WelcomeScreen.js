import React from 'react';
import { View, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppTheme } from '../../theme';
import OnboardingContainer from '../../components/onboarding/OnboardingContainer';
import { H1, Body } from '../../components/base/Typography';
import Button from '../../components/base/Button';

const WelcomeScreen = ({ navigation }) => {
  const { colors, spacing } = useAppTheme();
  
  const handleGetStarted = async () => {
    // Mark onboarding as in progress
    try {
      await AsyncStorage.setItem('onboarding_state', 'in_progress');
      console.log('📝 Onboarding state set to: in_progress');
    } catch (error) {
      console.error('Failed to save onboarding state:', error);
    }
    
    navigation.navigate('BasicInfo');
  };

  const handleSignIn = async () => {
    // Reset onboarding state for existing users
    try {
      await AsyncStorage.setItem('onboarding_state', 'completed');
      await AsyncStorage.setItem('hasCompletedOnboarding', 'true');
      console.log('🔑 Reset onboarding state for existing user');
    } catch (error) {
      console.error('Failed to reset onboarding state:', error);
    }
    
    // Navigate to Auth stack for existing users
    console.log('🔑 Navigating to sign in for existing user');
    navigation.navigate('Auth', { screen: 'LoginScreen' });
  };

  const styles = StyleSheet.create({
    content: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    logoContainer: {
      marginBottom: spacing.xl,
      alignItems: 'center',
    },
    logoPlaceholder: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: colors.primary[500],
      justifyContent: 'center',
      alignItems: 'center',
    },
    logoText: {
      color: colors.text.inverse,
      fontSize: 18,
      fontWeight: 'bold',
      textAlign: 'center',
    },
    textContainer: {
      alignItems: 'center',
      marginBottom: spacing.xl,
      paddingHorizontal: spacing.lg,
    },
    title: {
      marginBottom: spacing.md,
    },
    subtitle: {
      textAlign: 'center',
      maxWidth: 320,
    },
    buttonContainer: {
      width: '100%',
      paddingHorizontal: spacing.lg,
    },
    signInButton: {
      marginTop: spacing.md,
    },
  });

  return (
    <OnboardingContainer
      currentStep={1}
      totalSteps={5}
      onNext={null}
      showProgress={true}
    >
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <View style={styles.logoPlaceholder}>
            <Body color="inverse" weight="bold" style={styles.logoText}>
              Vitaliti Air
            </Body>
          </View>
        </View>
        
        <View style={styles.textContainer}>
          <H1 style={styles.title}>Welcome to Vitaliti Air</H1>
          <Body color="secondary" style={styles.subtitle}>
            Optimize your health with personalized IHHT training. 
            Let's get you set up in just a few simple steps.
          </Body>
        </View>
        
        <View style={styles.buttonContainer}>
          <Button
            title="Get Started"
            variant="primary"
            onPress={handleGetStarted}
            fullWidth
          />
          
          <Button
            title="Already have an account? Sign In"
            variant="secondary"
            onPress={handleSignIn}
            fullWidth
            style={styles.signInButton}
          />
        </View>
      </View>
    </OnboardingContainer>
  );
};

export default WelcomeScreen; 