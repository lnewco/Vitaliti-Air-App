import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SurveyScale } from '../types/surveyTypes';

interface SurveyScaleInputProps {
  label: string;
  value: SurveyScale | null;
  onValueChange: (value: SurveyScale) => void;
  scaleLabels: { [key: number]: string };
  isRequired?: boolean;
  disabled?: boolean;
}

const SurveyScaleInput: React.FC<SurveyScaleInputProps> = ({
  label,
  value,
  onValueChange,
  scaleLabels,
  isRequired = false,
  disabled = false,
}) => {
  const scales: SurveyScale[] = [1, 2, 3, 4, 5];

  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        {label}
        {isRequired && <Text style={styles.required}> *</Text>}
      </Text>
      
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
            accessibilityLabel={`${label}: ${scale} - ${scaleLabels[scale]}`}
          >
            <Text style={[
              styles.scaleNumber,
              value === scale && styles.selectedNumber,
              disabled && styles.disabledText,
            ]}>
              {scale}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      
      <View style={styles.labelsContainer}>
        <Text style={[styles.scaleLabel, styles.leftLabel]}>
          {scaleLabels[1]}
        </Text>
        <Text style={[styles.scaleLabel, styles.rightLabel]}>
          {scaleLabels[5]}
        </Text>
      </View>
      
      {value && (
        <Text style={styles.selectedValue}>
          Selected: {value} - {scaleLabels[value]}
        </Text>
      )}
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
    marginBottom: 12,
    textAlign: 'center',
  },
  required: {
    color: '#e74c3c',
  },
  scaleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 10,
  },
  scaleButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f8f9fa',
    borderWidth: 2,
    borderColor: '#dee2e6',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  selectedButton: {
    backgroundColor: '#007bff',
    borderColor: '#0056b3',
  },
  disabledButton: {
    backgroundColor: '#e9ecef',
    borderColor: '#ced4da',
    opacity: 0.6,
  },
  scaleNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#495057',
  },
  selectedNumber: {
    color: '#ffffff',
  },
  disabledText: {
    color: '#6c757d',
  },
  labelsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  scaleLabel: {
    fontSize: 12,
    color: '#6c757d',
    fontStyle: 'italic',
  },
  leftLabel: {
    textAlign: 'left',
  },
  rightLabel: {
    textAlign: 'right',
  },
  selectedValue: {
    fontSize: 14,
    color: '#007bff',
    textAlign: 'center',
    fontWeight: '500',
    marginTop: 4,
  },
});

export default SurveyScaleInput; 