import React from 'react';
import { View, StyleSheet, Text, Animated } from 'react-native';
import {
  useAnimatedStyle,
  withSpring,
  AnimatedAPI,
  isExpoGo
} from '../../utils/animationHelpers';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing } from '../../design-system';

const OnboardingProgressIndicator = ({ currentStep = 1, totalSteps = 5 }) => {
  const progress = (currentStep / totalSteps) * 100;

  const animatedStyle = useAnimatedStyle(() => {
    return {
      width: withSpring(`${progress}%`, {
        damping: 15,
        stiffness: 150
      })
    };
  });

  return (
    <View style={styles.container}>
      <Text style={styles.progressText}>
        Step {currentStep} of {totalSteps}
      </Text>
      
      {/* Background track */}
      <View style={styles.track}>
        {/* Progress fill */}
        <AnimatedAPI.View style={[styles.progressContainer, animatedStyle]}>
          <LinearGradient
            colors={[colors.metrics.recovery, colors.metrics.spo2]}
            style={styles.progress}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
        </AnimatedAPI.View>
      </View>

      {/* Step dots */}
      <View style={styles.dotsContainer}>
        {Array.from({ length: totalSteps }, (_, i) => {
          const step = i + 1;
          const isActive = step === currentStep;
          const isCompleted = step < currentStep;
          
          return (
            <View key={step} style={[
              styles.dot,
              isCompleted && styles.dotCompleted,
              isActive && styles.dotActive
            ]} />
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 60,
  },
  progressText: {
    fontSize: 12,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.sm,
    fontWeight: '500',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  track: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  progressContainer: {
    height: '100%',
    position: 'absolute',
    left: 0,
    top: 0,
  },
  progress: {
    flex: 1,
    borderRadius: 2,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  dotCompleted: {
    backgroundColor: colors.metrics.recovery,
  },
  dotActive: {
    backgroundColor: colors.metrics.spo2,
    shadowColor: colors.metrics.spo2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
    elevation: 2,
  },
});

export default OnboardingProgressIndicator; 