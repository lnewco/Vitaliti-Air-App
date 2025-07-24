import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import { useBluetooth } from '../context/BluetoothContext';
import SpO2Display from '../components/SpO2Display';
import HeartRateDisplay from '../components/HeartRateDisplay';
import DeviceScanner from '../components/DeviceScanner';
import SessionControls from '../components/SessionControls';

const DashboardScreen = ({ navigation }) => {
  const { isConnected, pulseOximeterData, connectedDevice } = useBluetooth();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Vitaliti Air</Text>
          <Text style={styles.subtitle}>Pulse Oximeter Monitor</Text>
        </View>

        {isConnected && connectedDevice && (
          <View style={styles.deviceInfo}>
            <Text style={styles.deviceInfoText}>
              📱 Connected to: {connectedDevice.name || connectedDevice.localName || 'Unknown Device'}
            </Text>
          </View>
        )}

        {/* Show data displays only when connected */}
        {isConnected && (
          <View style={styles.displayContainer}>
            <SpO2Display data={pulseOximeterData} isConnected={isConnected} />
            <HeartRateDisplay data={pulseOximeterData} isConnected={isConnected} />
          </View>
        )}

        {/* Session controls - always visible but disabled when not connected */}
        <SessionControls navigation={navigation} 
          isConnected={isConnected}
          onSessionChanged={(event, data) => {
            console.log('Session event:', event, data);
          }}
        />

        {/* Device scanner takes priority when not connected */}
        <View style={styles.scannerContainer}>
          <DeviceScanner />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 20, // Add bottom padding for scroll
  },
  header: {
    alignItems: 'center',
    paddingVertical: 20,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
  },
  deviceInfo: {
    backgroundColor: '#10B981',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  deviceInfoText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  displayContainer: {
    marginBottom: 20,
  },
  scannerContainer: {
    minHeight: 400, // Ensure minimum height for scanner
  },
});

export default DashboardScreen; 