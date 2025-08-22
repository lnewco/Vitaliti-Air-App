import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import Constants from 'expo-constants';

// Check if we're in Expo Go (which doesn't support @react-native-community/datetimepicker)
const isExpoGo = Constants.appOwnership === 'expo';

let DateTimePicker = null;
if (!isExpoGo) {
  try {
    DateTimePicker = require('@react-native-community/datetimepicker').default;
  } catch (error) {
    console.log('📱 DateTimePicker not available - using text input fallback');
  }
} else {
  console.log('📱 Expo Go detected - using text input fallback for date picker');
}

const FormDatePicker = ({
  label,
  value,
  onChange,
  error,
  required = false,
  minimumDate,
  maximumDate,
}) => {
  const [showPicker, setShowPicker] = useState(false);

  const handleDateChange = (event, selectedDate) => {
    setShowPicker(false); // Always close picker after selection
    if (selectedDate && event.type === 'set') {
      onChange(selectedDate);
    }
  };

  const formatDate = (date) => {
    if (!date) return '';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        {label}
        {required && <Text style={styles.required}> *</Text>}
      </Text>
      
      <TouchableOpacity
        style={[
          styles.dateButton,
          error && styles.dateButtonError,
        ]}
        onPress={() => setShowPicker(true)}
      >
        <Text style={[
          styles.dateText,
          !value && styles.placeholderText,
        ]}>
          {value ? formatDate(value) : 'Select your date of birth'}
        </Text>
      </TouchableOpacity>
      
      {error && (
        <Text style={styles.errorText}>{error}</Text>
      )}
      
      {showPicker && DateTimePicker && (
        <DateTimePicker
          value={value || new Date()}
          mode="date"
          display="default"
          onChange={handleDateChange}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
        />
      )}
      
      {showPicker && !DateTimePicker && (
        <View style={styles.fallbackPicker}>
          <Text style={styles.fallbackText}>
            Date picker not available in Expo Go. 
            Please enter your birth year manually or use a development build.
          </Text>
          <TouchableOpacity 
            style={styles.fallbackButton}
            onPress={() => setShowPicker(false)}
          >
            <Text style={styles.fallbackButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  required: {
    color: '#EF4444',
  },
  dateButton: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  dateButtonError: {
    borderColor: '#EF4444',
  },
  dateText: {
    fontSize: 16,
    color: '#1F2937',
  },
  placeholderText: {
    color: '#9CA3AF',
  },
  errorText: {
    fontSize: 14,
    color: '#EF4444',
    marginTop: 4,
  },
  fallbackPicker: {
    backgroundColor: '#F3F4F6',
    padding: 16,
    borderRadius: 8,
    marginTop: 8,
  },
  fallbackText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 12,
  },
  fallbackButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignSelf: 'center',
  },
  fallbackButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default FormDatePicker; 