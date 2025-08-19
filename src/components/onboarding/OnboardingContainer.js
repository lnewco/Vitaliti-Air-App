import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useAppTheme } from '../../theme';
import Container from '../base/Container';
import Button from '../base/Button';
import OnboardingProgressIndicator from '../OnboardingProgressIndicator';

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
  const { colors, spacing } = useAppTheme();

  const styles = StyleSheet.create({
    container: {
      flex: 1,
    },
    content: {
      flex: 1,
      paddingHorizontal: spacing.lg,
    },
    progressContainer: {
      paddingTop: spacing.md,
      paddingHorizontal: spacing.lg,
    },
    childrenContainer: {
      flex: 1,
      paddingTop: spacing.xl,
    },
    footer: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xl,
      paddingTop: spacing.lg,
      backgroundColor: colors.surface.background,
      borderTopWidth: 1,
      borderTopColor: colors.border.light,
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
    <Container safe style={[styles.container, style]}>
      {showProgress && currentStep && totalSteps && (
        <View style={styles.progressContainer}>
          <OnboardingProgressIndicator 
            currentStep={currentStep} 
            totalSteps={totalSteps} 
          />
        </View>
      )}
      
      <View style={[styles.content, contentStyle]}>
        <View style={styles.childrenContainer}>
          {children}
        </View>
      </View>

      <View style={styles.footer}>
        <View style={styles.buttonRow}>
          {onBack && (
            <Button
              title={backLabel}
              variant="ghost"
              onPress={onBack}
              style={styles.backButton}
            />
          )}
          {onNext && (
            <Button
              title={nextLabel}
              variant="primary"
              onPress={onNext}
              disabled={isNextDisabled}
              loading={isNextLoading}
              style={onBack ? styles.nextButton : styles.singleButton}
            />
          )}
        </View>
      </View>
    </Container>
  );
};

export default OnboardingContainer;