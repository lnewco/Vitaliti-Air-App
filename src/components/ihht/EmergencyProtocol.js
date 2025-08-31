import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { BlurView } from 'expo-blur';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export default function EmergencyProtocol({ visible, onDismiss, reason, metrics }) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
    >
      <BlurView intensity={95} style={styles.container}>
        <View style={styles.content}>
          <View style={styles.warningIcon}>
            <Icon name="alert-octagon" size={60} color="#FF3B30" />
          </View>
          
          <Text style={styles.title}>Session Stopped</Text>
          <Text style={styles.reason}>{reason}</Text>
          
          {metrics && (
            <View style={styles.metricsContainer}>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>SpO2:</Text>
                <Text style={[styles.metricValue, { color: metrics.spo2 < 85 ? '#FF3B30' : '#000' }]}>
                  {metrics.spo2}%
                </Text>
              </View>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Heart Rate:</Text>
                <Text style={styles.metricValue}>{metrics.heartRate} BPM</Text>
              </View>
            </View>
          )}
          
          <View style={styles.instructions}>
            <Text style={styles.instructionTitle}>Please follow these steps:</Text>
            <Text style={styles.instructionText}>1. Remove the mask immediately</Text>
            <Text style={styles.instructionText}>2. Take deep breaths of room air</Text>
            <Text style={styles.instructionText}>3. Remain seated and calm</Text>
            <Text style={styles.instructionText}>4. Monitor your symptoms</Text>
          </View>
          
          <TouchableOpacity style={styles.button} onPress={onDismiss}>
            <Text style={styles.buttonText}>I Understand</Text>
          </TouchableOpacity>
        </View>
      </BlurView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  content: {
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderRadius: 25,
    padding: 30,
    alignItems: 'center',
    width: '90%',
    maxWidth: 400,
  },
  warningIcon: {
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FF3B30',
    marginBottom: 10,
  },
  reason: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  metricsContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 12,
    padding: 15,
    width: '100%',
    marginBottom: 20,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 5,
  },
  metricLabel: {
    fontSize: 14,
    color: '#666',
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  instructions: {
    width: '100%',
    marginBottom: 20,
  },
  instructionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 10,
  },
  instructionText: {
    fontSize: 14,
    color: '#666',
    marginVertical: 3,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});