import React from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { colors, spacing } from '../../design-system';
import PremiumButton from '../../design-system/components/PremiumButton';
import OnboardingProgressIndicator from '../navigation/OnboardingProgressIndicator';

const OnboardingContainer = ({
  children,
  currentStep,
  totalSteps,
  onNext,
  onBack,
  nextLabel = 'Continue',
  backLabel = 'Back',
  isNextDisabled = false,
  isNextLoading = false,
  showProgress = true,
  style,
  contentStyle,
}) => {
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background.primary,
    },
    gradient: {
      ...StyleSheet.absoluteFillObject,
    },
    orbContainer: {
      ...StyleSheet.absoluteFillObject,
      overflow: 'hidden',
    },
    orb: {
      position: 'absolute',
      borderRadius: 500,
    },
    orb1: {
      width: 400,
      height: 400,
      top: -200,
      left: -100,
    },
    orb2: {
      width: 350,
      height: 350,
      bottom: -150,
      right: -100,
    },
    safeArea: {
      flex: 1,
    },
    content: {
      flex: 1,
    },
    progressContainer: {
      paddingTop: spacing.md,
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.md,
      backgroundColor: 'transparent',
    },
    childrenContainer: {
      flex: 1,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.lg,
    },
    footer: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.xl,
      paddingTop: spacing.lg,
    },
    footerGlass: {
      padding: spacing.lg,
      borderRadius: 24,
      backgroundColor: 'rgba(26, 29, 35, 0.6)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.08)',
      overflow: 'hidden',
    },
    buttonRow: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    backButton: {
      flex: 1,
    },
    nextButton: {
      flex: 2,
    },
    singleButton: {
      width: '100%',
    },
  });

  return (
    <View style={[styles.container, style]}>
      <StatusBar barStyle="light-content" />
      
      {/* Premium gradient background */}
      <LinearGradient
        colors={['#0C0E12', '#13161B', '#1A1D23']}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Animated orb background effects */}
      <View style={styles.orbContainer}>
        <LinearGradient
          colors={['rgba(59, 130, 246, 0.08)', 'transparent']}
          style={[styles.orb, styles.orb1]}
        />
        <LinearGradient
          colors={['rgba(78, 205, 196, 0.06)', 'transparent']}
          style={[styles.orb, styles.orb2]}
        />
      </View>

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          {showProgress && currentStep && totalSteps && (
            <View style={styles.progressContainer}>
              <OnboardingProgressIndicator 
                currentStep={currentStep} 
                totalSteps={totalSteps} 
              />
            </View>
          )}
          
          <View style={[styles.childrenContainer, contentStyle]}>
            {children}
          </View>

          {(onNext || onBack) && (
            <View style={styles.footer}>
              <BlurView intensity={30} tint="dark" style={styles.footerGlass}>
                <View style={styles.buttonRow}>
                  {onBack && (
                    <PremiumButton
                      title={backLabel}
                      variant="secondary"
                      onPress={onBack}
                      style={styles.backButton}
                    />
                  )}
                  {onNext && (
                    <PremiumButton
                      title={nextLabel}
                      variant="primary"
                      onPress={onNext}
                      disabled={isNextDisabled}
                      loading={isNextLoading}
                      style={onBack ? styles.nextButton : styles.singleButton}
                    />
                  )}
                </View>
              </BlurView>
            </View>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
};

export default OnboardingContainer;