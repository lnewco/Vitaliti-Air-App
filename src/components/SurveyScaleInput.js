import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing } from '../design-system';
import { Body, Caption } from './base/Typography';

const SurveyScaleInput = ({
  label,
  value,
  onValueChange,
  scaleLabels = {},
  isRequired = false,
  disabled = false,
}) => {
  // Design tokens imported from design-system
  const scales = [1, 2, 3, 4, 5];
  
  // Ensure scaleLabels has default values
  const safeScaleLabels = {
    1: 'Low',
    2: 'Slightly Low',
    3: 'Moderate',
    4: 'Slightly High',
    5: 'High',
    ...scaleLabels
  };

  const styles = StyleSheet.create({
    container: {
      marginVertical: spacing.sm,
    },
    label: {
      marginBottom: spacing.sm,
      textAlign: 'center',
      fontWeight: '600',
      fontSize: 14,
    },
    required: {
      color: colors.semantic.error,
    },
    scaleContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: spacing.xs,
      paddingHorizontal: spacing.xs,
    },
    scaleButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: colors.background.primary,
      borderWidth: 2,
      borderColor: colors.border.medium,
      justifyContent: 'center',
      alignItems: 'center',
      elevation: 2,
      shadowColor: colors.text.primary,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 2,
    },
    selectedButton: {
      backgroundColor: colors.brand.accent,
      borderColor: colors.brand.secondary,
    },
    disabledButton: {
      backgroundColor: colors.background.secondary,
      borderColor: colors.border.light,
      opacity: 0.6,
    },
    scaleNumber: {
      fontSize: 16,
      fontWeight: 'bold',
      color: colors.text.secondary,
    },
    selectedNumber: {
      color: '#FFFFFF',
    },
    disabledText: {
      color: colors.text.quaternary,
    },
    labelsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.xs,
      marginBottom: spacing.xs,
    },
    scaleLabel: {
      fontStyle: 'italic',
      fontSize: 11,
    },
    leftLabel: {
      textAlign: 'left',
    },
    rightLabel: {
      textAlign: 'right',
    },
  });

  return (
    <View style={styles.container}>
      <Body style={styles.label}>
        {label}
        {isRequired && <Body color="error"> *</Body>}
      </Body>
      
      <View style={styles.scaleContainer}>
        {scales.map((scale) => (
          <TouchableOpacity
            key={scale}
            style={[
              styles.scaleButton,
              value === scale && styles.selectedButton,
              disabled && styles.disabledButton,
            ]}
            onPress={() => !disabled && onValueChange(scale)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityState={{ selected: value === scale, disabled }}
            accessibilityLabel={`${label}: ${scale} - ${safeScaleLabels[scale]}`}
          >
            <Body style={[
              styles.scaleNumber,
              value === scale && styles.selectedNumber,
              disabled && styles.disabledText,
            ]}>
              {scale}
            </Body>
          </TouchableOpacity>
        ))}
      </View>
      
      <View style={styles.labelsContainer}>
        <Caption color="secondary" style={[styles.scaleLabel, styles.leftLabel]}>
          {safeScaleLabels[1]}
        </Caption>
        <Caption color="secondary" style={[styles.scaleLabel, styles.rightLabel]}>
          {safeScaleLabels[5]}
        </Caption>
      </View>
    </View>
  );
};

export default SurveyScaleInput; 