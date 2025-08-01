import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const StepIndicator = ({ currentStep, totalSteps, steps }) => {
  const defaultSteps = ['Connect Device', 'Ready to Begin'];
  const stepLabels = steps || defaultSteps;

  return (
    <View style={styles.container}>
      <View style={styles.progressBar}>
        {Array.from({ length: totalSteps }, (_, index) => {
          const stepNumber = index + 1;
          const isCompleted = stepNumber < currentStep;
          const isCurrent = stepNumber === currentStep;
          const isUpcoming = stepNumber > currentStep;

          return (
            <View key={stepNumber} style={styles.stepContainer}>
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

              {/* Connector Line */}
              {index < totalSteps - 1 && (
                <View style={[
                  styles.connector,
                  isCompleted && styles.connectorCompleted,
                ]} />
              )}
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
    paddingVertical: 24,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  progressBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepContainer: {
    alignItems: 'center',
    flex: 1,
    position: 'relative',
  },
  stepCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 2,
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
    fontSize: 16,
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
    fontSize: 18,
    fontWeight: 'bold',
  },
  stepLabel: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    maxWidth: 100,
  },
  stepLabelCurrent: {
    color: '#3B82F6',
    fontWeight: '600',
  },
  stepLabelUpcoming: {
    color: '#9CA3AF',
  },
  connector: {
    position: 'absolute',
    top: 19, // Center of circle (40px height / 2 - 1px for line)
    left: '50%',
    width: '100%',
    height: 2,
    backgroundColor: '#D1D5DB',
    zIndex: -1,
  },
  connectorCompleted: {
    backgroundColor: '#10B981',
  },
});

export default StepIndicator; 