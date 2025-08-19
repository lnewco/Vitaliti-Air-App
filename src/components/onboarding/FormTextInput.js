import React from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import { useAppTheme } from '../../theme';
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
  const { colors, spacing, typography } = useAppTheme();
  
  const styles = StyleSheet.create({
    container: {
      marginBottom: spacing.lg,
    },
    labelContainer: {
      flexDirection: 'row',
      marginBottom: spacing.sm,
    },
    required: {
      color: colors.error[500],
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border.light,
      borderRadius: spacing.borderRadius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 4,
      fontSize: typography.fontSize.base,
      color: colors.text.primary,
      backgroundColor: colors.surface.card,
    },
    inputError: {
      borderColor: colors.error[500],
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