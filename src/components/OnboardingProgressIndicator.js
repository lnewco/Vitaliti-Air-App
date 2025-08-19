import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useAppTheme } from '../theme';
import { Caption } from './base/Typography';

const OnboardingProgressIndicator = ({ currentStep, totalSteps }) => {
  const { colors, spacing } = useAppTheme();
  
  const styles = StyleSheet.create({
    container: {
      paddingVertical: spacing.md,
    },
    progressText: {
      textAlign: 'center',
      marginBottom: spacing.sm,
    },
    progressBar: {
      height: 4,
      backgroundColor: colors.border.light,
      borderRadius: 2,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: colors.primary[500],
      borderRadius: 2,
    },
  });
  
  return (
    <View style={styles.container}>
      <Caption color="secondary" style={styles.progressText}>
        Step {currentStep} of {totalSteps}
      </Caption>
      <View style={styles.progressBar}>
        <View 
          style={[
            styles.progressFill, 
            { width: `${(currentStep / totalSteps) * 100}%` }
          ]} 
        />
      </View>
    </View>
  );
};

export default OnboardingProgressIndicator; 