import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useAppTheme } from '../../theme';
import { Label, Body, Caption } from '../base/Typography';

const FormRadioGroup = ({
  label,
  options,
  value,
  onSelect,
  error,
  required = false,
}) => {
  const { colors, spacing } = useAppTheme();
  
  const styles = StyleSheet.create({
    container: {
      marginBottom: spacing.lg,
    },
    labelContainer: {
      flexDirection: 'row',
      marginBottom: spacing.md,
    },
    optionsContainer: {
      gap: spacing.md,
    },
    optionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm,
    },
    radioButton: {
      marginRight: spacing.md,
    },
    radioCircle: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: colors.border.medium,
      justifyContent: 'center',
      alignItems: 'center',
    },
    radioSelected: {
      borderColor: colors.primary[500],
    },
    radioInner: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.primary[500],
    },
    errorText: {
      marginTop: spacing.xs,
    },
  });
  
  return (
    <View style={styles.container}>
      <View style={styles.labelContainer}>
        <Label>{label}</Label>
        {required && <Label color="error"> *</Label>}
      </View>
      
      <View style={styles.optionsContainer}>
        {options.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={styles.optionRow}
            onPress={() => onSelect(option.value)}
          >
            <View style={styles.radioButton}>
              <View style={[
                styles.radioCircle,
                value === option.value && styles.radioSelected,
              ]}>
                {value === option.value && (
                  <View style={styles.radioInner} />
                )}
              </View>
            </View>
            <Body>{option.label}</Body>
          </TouchableOpacity>
        ))}
      </View>
      
      {error && (
        <Caption color="error" style={styles.errorText}>{error}</Caption>
      )}
    </View>
  );
};

export default FormRadioGroup; 