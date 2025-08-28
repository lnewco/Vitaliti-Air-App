import React from 'react';
import { View, TextInput, StyleSheet, Platform } from 'react-native';
import { colors, spacing, typography } from '../design-system';
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
  // Design tokens imported from design-system
  const characterCount = value.length;
  const isAtLimit = characterCount >= maxLength;

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
      color: colors.semantic.error,
    },
    textInput: {
      borderWidth: 1,
      borderColor: colors.border.medium,
      borderRadius: spacing.borderRadius.md,
      padding: spacing.sm,
      fontSize: 14,
      color: colors.text.primary,
      backgroundColor: colors.background.tertiary,
      minHeight: 60,
      maxHeight: 100,
      textAlignVertical: 'top',
    },
    disabledInput: {
      backgroundColor: colors.background.primary,
      color: colors.text.disabled,
    },
    limitReached: {
      borderColor: colors.semantic.warning,
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