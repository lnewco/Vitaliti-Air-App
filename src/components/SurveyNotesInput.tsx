import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';

interface SurveyNotesInputProps {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  isRequired?: boolean;
  disabled?: boolean;
}

const SurveyNotesInput: React.FC<SurveyNotesInputProps> = ({
  label,
  value,
  onValueChange,
  placeholder = 'Add any notes about your session...',
  maxLength = 500,
  isRequired = false,
  disabled = false,
}) => {
  const characterCount = value.length;
  const isAtLimit = characterCount >= maxLength;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        {label}
        {isRequired && <Text style={styles.required}> *</Text>}
      </Text>
      
      <TextInput
        style={[
          styles.textInput,
          disabled && styles.disabledInput,
          isAtLimit && styles.limitReached,
        ]}
        value={value}
        onChangeText={onValueChange}
        placeholder={placeholder}
        placeholderTextColor="#6c757d"
        multiline
        numberOfLines={4}
        maxLength={maxLength}
        editable={!disabled}
        textAlignVertical="top"
        accessibilityLabel={label}
        accessibilityHint={`${characterCount} of ${maxLength} characters used`}
      />
      
      <View style={styles.footer}>
        <Text style={[
          styles.characterCount,
          isAtLimit && styles.limitReachedText,
        ]}>
          {characterCount}/{maxLength} characters
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  required: {
    color: '#e74c3c',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#ffffff',
    minHeight: 100,
    maxHeight: 150,
    textAlignVertical: 'top',
  },
  disabledInput: {
    backgroundColor: '#f8f9fa',
    color: '#6c757d',
  },
  limitReached: {
    borderColor: '#ffc107',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  characterCount: {
    fontSize: 12,
    color: '#6c757d',
  },
  limitReachedText: {
    color: '#ffc107',
    fontWeight: '600',
  },
});

export default SurveyNotesInput; 