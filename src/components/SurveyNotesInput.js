import React from 'react';
import { View, TextInput, StyleSheet, Platform } from 'react-native';
import { useAppTheme } from '../theme';
import { Body, Caption } from './base/Typography';

const SurveyNotesInput = ({
  label,
  value,
  onValueChange,
  placeholder = 'Add any notes about your session...',
  maxLength = 500,
  isRequired = false,
  disabled = false,
}) => {
  const theme = useAppTheme();
  const { colors, spacing, typography } = theme || {};
  const characterCount = value.length;
  const isAtLimit = characterCount >= maxLength;
  
  // Fallback if theme is not ready
  if (!colors || !spacing || !typography) {
    return null;
  }

  const styles = StyleSheet.create({
    container: {
      marginVertical: spacing.sm,
    },
    label: {
      marginBottom: spacing.xs,
      fontWeight: '600',
      fontSize: 14,
    },
    required: {
      color: colors.error[500],
    },
    textInput: {
      borderWidth: 1,
      borderColor: colors.border.medium,
      borderRadius: spacing.borderRadius.md,
      padding: spacing.sm,
      fontSize: 14,
      color: colors.text.primary,
      backgroundColor: colors.surface.card,
      minHeight: 60,
      maxHeight: 100,
      textAlignVertical: 'top',
    },
    disabledInput: {
      backgroundColor: colors.surface.background,
      color: colors.text.disabled,
    },
    limitReached: {
      borderColor: colors.warning[500],
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginTop: spacing.xs,
    },
    characterCount: {
      fontWeight: isAtLimit ? '600' : '400',
    },
  });

  return (
    <View style={styles.container}>
      <Body style={styles.label}>
        {label}
        {isRequired && <Body color="error"> *</Body>}
      </Body>
      
      <TextInput
        style={[
          styles.textInput,
          disabled && styles.disabledInput,
          isAtLimit && styles.limitReached,
        ]}
        value={value}
        onChangeText={onValueChange}
        placeholder={placeholder}
        placeholderTextColor={colors.text.secondary}
        multiline
        numberOfLines={2}
        maxLength={maxLength}
        editable={!disabled}
        textAlignVertical="top"
        accessibilityLabel={label}
        accessibilityHint={`${characterCount} of ${maxLength} characters used`}
        returnKeyType={Platform.OS === 'ios' ? 'done' : 'default'}
        blurOnSubmit={true}
        enablesReturnKeyAutomatically={true}
      />
      
      <View style={styles.footer}>
        <Caption 
          color={isAtLimit ? "warning" : "secondary"}
          style={styles.characterCount}
        >
          {characterCount}/{maxLength} characters
        </Caption>
      </View>
    </View>
  );
};

export default SurveyNotesInput; 