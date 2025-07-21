import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const HeartRateDisplay = ({ data, isConnected }) => {
  const getStatusColor = (heartRate) => {
    if (!heartRate) return '#9CA3AF';
    if (heartRate >= 60 && heartRate <= 100) return '#10B981'; // Green - Normal
    if (heartRate >= 50 && heartRate <= 120) return '#F59E0B'; // Yellow - Borderline
    return '#EF4444'; // Red - Abnormal
  };

  const getStatusText = (heartRate) => {
    if (!heartRate) return 'No Data';
    if (heartRate < 60) return 'Low (Bradycardia)';
    if (heartRate > 100) return 'High (Tachycardia)';
    return 'Normal';
  };

  const getPlethText = (pleth) => {
    if (pleth === null || pleth === undefined) return 'No Signal';
    if (pleth >= 80) return 'Strong';
    if (pleth >= 50) return 'Good';
    if (pleth >= 20) return 'Weak';
    return 'Very Weak';
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Heart Rate (BPM)</Text>
        <View style={[styles.connectionIndicator, { 
          backgroundColor: isConnected ? '#10B981' : '#9CA3AF' 
        }]} />
      </View>
      
      <View style={styles.valueContainer}>
        <Text style={[styles.value, { color: getStatusColor(data.heartRate) }]}>
          {data.heartRate ? `${data.heartRate}` : '--'}
        </Text>
        <Text style={[styles.status, { color: getStatusColor(data.heartRate) }]}>
          {getStatusText(data.heartRate)}
        </Text>
      </View>

      {/* BCI Status Information */}
      <View style={styles.statusContainer}>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Pulse Wave:</Text>
          <Text style={styles.statusValue}>
            {getPlethText(data.pleth)}
          </Text>
        </View>
        
        {data.pleth !== null && data.pleth !== undefined && (
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Waveform:</Text>
            <Text style={styles.statusValue}>
              {data.pleth}/127
            </Text>
          </View>
        )}

        {data.isSearchingForPulse && (
          <View style={styles.statusRow}>
            <Text style={[styles.statusValue, { color: '#F59E0B' }]}>
              🔍 Searching for pulse...
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

export default HeartRateDisplay; 