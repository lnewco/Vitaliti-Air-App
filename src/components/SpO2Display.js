import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const SpO2Display = ({ data, isConnected }) => {
  const getStatusColor = (spo2) => {
    if (!spo2) return '#9CA3AF';
    if (spo2 >= 95) return '#10B981'; // Green
    if (spo2 >= 90) return '#F59E0B'; // Yellow
    return '#EF4444'; // Red
  };

  const getStatusText = (spo2) => {
    if (!spo2) return 'No Data';
    if (spo2 >= 95) return 'Normal';
    if (spo2 >= 90) return 'Low';
    return 'Critical';
  };

  const getSignalStrengthText = (strength) => {
    if (strength === null || strength === undefined) return 'Unknown';
    if (strength >= 8) return 'Excellent';
    if (strength >= 6) return 'Good';
    if (strength >= 4) return 'Fair';
    if (strength >= 2) return 'Poor';
    return 'Very Poor';
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Blood Oxygen (SpO2)</Text>
        <View style={[styles.connectionIndicator, { 
          backgroundColor: isConnected ? '#10B981' : '#9CA3AF' 
        }]} />
      </View>
      
      <View style={styles.valueContainer}>
        <Text style={[styles.value, { color: getStatusColor(data.spo2) }]}>
          {data.spo2 ? `${data.spo2}%` : '--'}
        </Text>
        <Text style={[styles.status, { color: getStatusColor(data.spo2) }]}>
          {getStatusText(data.spo2)}
        </Text>
      </View>

      {/* BCI Status Information */}
      <View style={styles.statusContainer}>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Finger:</Text>
          <Text style={[styles.statusValue, { 
            color: data.isFingerDetected ? '#10B981' : '#EF4444' 
          }]}>
            {data.isFingerDetected ? 'Detected' : 'Not Detected'}
          </Text>
        </View>
        
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Signal:</Text>
          <Text style={styles.statusValue}>
            {getSignalStrengthText(data.signalStrength)}
          </Text>
        </View>

        {data.isSearchingForPulse && (
          <View style={styles.statusRow}>
            <Text style={[styles.statusValue, { color: '#F59E0B' }]}>
              Searching for pulse...
            </Text>
          </View>
        )}
      </View>
      
      {data.timestamp && (
        <Text style={styles.timestamp}>
          Last updated: {new Date(data.timestamp).toLocaleTimeString()}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    margin: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
  },
  connectionIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  valueContainer: {
    alignItems: 'center',
    marginBottom: 15,
  },
  value: {
    fontSize: 48,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  status: {
    fontSize: 16,
    fontWeight: '500',
  },
  statusContainer: {
    marginBottom: 10,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  statusLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  statusValue: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '600',
  },
  timestamp: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 10,
  },
});

export default SpO2Display; 