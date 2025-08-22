import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const SafetyIndicator = ({ spo2, isConnected, isFingerDetected, isMotionDetected, isLowPerfusion }) => {
  const safetyState = determineSafetyState(spo2, isConnected, isFingerDetected);
  const hasWarning = isMotionDetected || isLowPerfusion;
  
  return (
    <View style={[styles.indicator, { backgroundColor: getStateColor(safetyState) }]}>
      <Text style={styles.indicatorText}>
        {getStateIcon(safetyState)} SpO2 Monitoring: {getStateMessage(spo2, safetyState)}
      </Text>
      {safetyState === 'NO_DATA' && (
        <Text style={styles.subText}>Check device connection</Text>
      )}
      {isMotionDetected && (
        <Text style={styles.subText}>Motion detected - Hold still for accurate reading</Text>
      )}
      {isLowPerfusion && (
        <Text style={styles.subText}>Low perfusion - Adjust finger position</Text>
      )}
    </View>
  );
};

function determineSafetyState(spo2, isConnected, isFingerDetected) {
  // No data conditions
  if (!isConnected || !isFingerDetected || spo2 === null) {
    return 'NO_DATA';
  }
  
  // Valid readings
  if (spo2 < 78) return 'CRITICAL';
  if (spo2 < 82) return 'CAUTION';
  return 'NORMAL';
}

function getStateColor(safetyState) {
  switch (safetyState) {
    case 'NORMAL': return '#10B981'; // Green
    case 'CAUTION': return '#F59E0B'; // Orange
    case 'CRITICAL': return '#EF4444'; // Red
    case 'NO_DATA': return '#6B7280'; // Gray
    default: return '#6B7280';
  }
}

function getStateIcon(safetyState) {
  switch (safetyState) {
    case 'NORMAL': return '✅';
    case 'CAUTION': return '⚠️';
    case 'CRITICAL': return '🚨';
    case 'NO_DATA': return '❌';
    default: return '❌';
  }
}

function getStateMessage(spo2, safetyState) {
  switch (safetyState) {
    case 'NORMAL': return `${spo2}% (Normal)`;
    case 'CAUTION': return `${spo2}% (Caution)`;
    case 'CRITICAL': return `${spo2}% (Critical)`;
    case 'NO_DATA': return 'No Data';
    default: return 'No Data';
  }
}

const styles = StyleSheet.create({
  indicator: {
    marginHorizontal: 20,
    marginTop: 10,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  indicatorText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  subText: {
    fontSize: 14,
    color: '#FFFFFF',
    marginTop: 4,
    textAlign: 'center',
  },
});

export default SafetyIndicator; 