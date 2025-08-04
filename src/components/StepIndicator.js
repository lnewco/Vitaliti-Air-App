import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const StepIndicator = ({ currentStep, totalSteps, steps }) => {
  const defaultSteps = ['Connect Device', 'Protocol Setup', 'Pre-session Check-in', 'Ready to Begin'];
  const stepLabels = steps || defaultSteps;

  return (
    <View style={styles.container}>
      {/* Progress line background */}
      <View style={styles.progressLineContainer}>
        <View style={styles.progressLineBackground} />
        <View style={[
          styles.progressLineFilled, 
          { width: `${((currentStep - 1) / (totalSteps - 1)) * 100}%` }
        ]} />
      </View>

      {/* Steps */}
      <View style={styles.stepsContainer}>
        {Array.from({ length: totalSteps }, (_, index) => {
          const stepNumber = index + 1;
          const isCompleted = stepNumber < currentStep;
          const isCurrent = stepNumber === currentStep;
          const isUpcoming = stepNumber > currentStep;

          return (
            <View key={stepNumber} style={styles.stepWrapper}>
              {/* Step Circle */}
              <View style={[
                styles.stepCircle,
                isCompleted && styles.stepCompleted,
                isCurrent && styles.stepCurrent,
                isUpcoming && styles.stepUpcoming,
              ]}>
                {isCompleted ? (
                  <Text style={styles.checkmark}>✓</Text>
                ) : (
                  <Text style={[
                    styles.stepNumber,
                    isCurrent && styles.stepNumberCurrent,
                    isUpcoming && styles.stepNumberUpcoming,
                  ]}>
                    {stepNumber}
                  </Text>
                )}
              </View>

              {/* Step Label */}
              <Text style={[
                styles.stepLabel,
                isCurrent && styles.stepLabelCurrent,
                isUpcoming && styles.stepLabelUpcoming,
              ]}>
                {stepLabels[index]}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 60, // Even more padding to fully contain all step label text
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  progressLineContainer: {
    position: 'relative',
    height: 2,
    marginTop: 18, // Center with circles (36px circle height / 2)
    marginHorizontal: 50, // Increased margin to shorten line and center between circles
  },
  progressLineBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#D1D5DB',
  },
  progressLineFilled: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: 2,
    backgroundColor: '#10B981',
  },
  stepsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    position: 'absolute',
    top: 24,
    left: 20,
    right: 20,
  },
  stepWrapper: {
    alignItems: 'center',
    width: 80, // Fixed width for consistent spacing
  },
  stepCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 2,
    backgroundColor: '#FFFFFF',
  },
  stepCompleted: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  stepCurrent: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  stepUpcoming: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D1D5DB',
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  stepNumberCurrent: {
    color: '#FFFFFF',
  },
  stepNumberUpcoming: {
    color: '#9CA3AF',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  stepLabel: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    maxWidth: 76,
    lineHeight: 16,
  },
  stepLabelCurrent: {
    color: '#3B82F6',
    fontWeight: '600',
  },
  stepLabelUpcoming: {
    color: '#9CA3AF',
  },
});

export default StepIndicator; 