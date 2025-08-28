import React from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../../design-system';
import { Label, Caption } from '../base/Typography';

const FormTextInput = ({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  required = false,
  autoCapitalize = 'words',
  keyboardType = 'default',
  ...props
}) => {
  // Design tokens imported from design-system
  
  const styles = StyleSheet.create({
    container: {
      marginBottom: spacing.lg,
    },
    labelContainer: {
      flexDirection: 'row',
      marginBottom: spacing.sm,
    },
    required: {
      color: colors.semantic.error,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border.light,
      borderRadius: spacing.borderRadius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 4,
      fontSize: typography.fontSize.base,
      color: colors.text.primary,
      backgroundColor: colors.background.tertiary,
    },
    inputError: {
      borderColor: colors.semantic.error,
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
      
      <TextInput
        style={[
          styles.input,
          error && styles.inputError,
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.text.tertiary}
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        {...props}
      />
      
      {error && (
        <Caption color="error" style={styles.errorText}>{error}</Caption>
      )}
    </View>
  );
};

export default FormTextInput; 