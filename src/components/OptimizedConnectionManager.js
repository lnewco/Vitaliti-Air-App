import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, FlatList, Alert } from 'react-native';
import { useBluetoothConnection, useBluetoothData } from '../context/BluetoothContext';

// ===== MEMOIZED DATA DISPLAY COMPONENT =====
const BluetoothDataDisplay = React.memo(() => {
  const { pulseOximeterData, heartRateData, persistentHRV } = useBluetoothData();
  const { isPulseOxConnected, isHRConnected } = useBluetoothConnection();

  const DualHRVDisplay = ({ heartRateData }) => {
    if (!heartRateData) return null;
    
    // Use persistentHRV for more stable values, fallback to heartRateData
    const quickHRV = persistentHRV?.quickHRV || heartRateData?.quickHRV;
    const realHRV = persistentHRV?.realHRV || heartRateData?.realHRV;
    
    if (!quickHRV && !realHRV) return null;
    
    return (
      <View style={styles.hrvDisplayContainer}>
        {quickHRV && (
          <View style={styles.hrvItem}>
            <Text style={styles.hrvLabel}>Quick HRV ({quickHRV.windowSize}s)</Text>
            <Text style={styles.hrvValue}>{quickHRV.rmssd}ms</Text>
            <Text style={styles.hrvQuality}>{quickHRV.dataQuality} quality</Text>
          </View>
        )}
        {realHRV && (
          <View style={styles.hrvItem}>
            <Text style={styles.hrvLabel}>Real HRV ({realHRV.windowSize}s)</Text>
            <Text style={styles.hrvValue}>{realHRV.rmssd}ms</Text>
            <Text style={styles.hrvQuality}>{realHRV.dataQuality} quality</Text>
          </View>
        )}
      </View>
    );
  };

  if (!isPulseOxConnected && !isHRConnected) {
    return null;
  }

  return (
    <View style={styles.dataDisplaySection}>
      <View style={styles.deviceDataContainer}>
        {heartRateData && (
          <View style={[styles.dataCard, styles.hrCard]}>
            <Text style={styles.dataLabel}>Heart Rate Monitor</Text>
            <View style={styles.dataRow}>
              <Text style={[styles.dataValue, styles.primaryDataValue]}>{heartRateData.heartRate || '--'} bpm</Text>
            </View>
            <View style={styles.dataRow}>
              <Text style={styles.dataSubLabel}>Sensor Contact:</Text>
              <Text style={[styles.dataSubValue, heartRateData.sensorContactDetected ? styles.goodStatus : styles.warningStatus]}>
                {heartRateData.sensorContactDetected ? '✅ Good' : '⚠️ Check placement'}
              </Text>
            </View>
            {!heartRateData.sensorContactDetected && (
              <Text style={styles.sensorWarning}>
                Ensure the heart rate monitor is properly positioned and has good skin contact
              </Text>
            )}
            
            <DualHRVDisplay heartRateData={heartRateData} />
          </View>
        )}
        
        {pulseOximeterData && (
          <View style={[styles.dataCard, styles.pulseOxCard]}>
            <Text style={styles.dataLabel}>Pulse Oximeter</Text>
            <View style={styles.dataRow}>
              <Text style={[styles.dataValue, !isHRConnected && styles.primaryDataValue]}>{pulseOximeterData.spo2 || '--'}%</Text>
              <Text style={styles.dataUnit}>SpO₂</Text>
            </View>
            <View style={styles.dataRow}>
              <Text style={styles.dataValue}>{pulseOximeterData.heartRate || '--'} bpm</Text>
            </View>
            <View style={styles.dataRow}>
              <Text style={styles.dataSubLabel}>Signal:</Text>
              <Text style={styles.dataSubValue}>
                {pulseOximeterData.signalStrength ? `${pulseOximeterData.signalStrength}/15` : '--'}
              </Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
});

// ===== MAIN OPTIMIZED CONNECTION MANAGER =====
const OptimizedConnectionManager = () => {
  // ===== STABLE CONNECTION STATE (no re-renders from data) =====
  const {
    isScanning,
    scanType,
    isPulseOxConnected,
    isHRConnected,
    discoveredDevices,
    connectedPulseOxDevice,
    connectedHRDevice,
    startScanning,
    stopScanning,
    connectToDevice,
    disconnect,
  } = useBluetoothConnection();

  // ===== LOCAL UI STATE =====
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [modalScanType, setModalScanType] = useState(null);

  // ===== MEMOIZED HANDLERS =====
  const handleFindDevice = useCallback(async (deviceType) => {
    try {
      console.log(`🔍 Starting ${deviceType} scan...`);
      setModalScanType(deviceType);
      setShowDeviceModal(true);
      await startScanning(deviceType);
    } catch (error) {
      console.error(`❌ Failed to start ${deviceType} scan:`, error);
      Alert.alert('Scan Error', `Failed to start scanning for ${deviceType}: ${error.message}`);
      setShowDeviceModal(false);
      setModalScanType(null);
    }
  }, [startScanning]);

  const handleDisconnect = useCallback(async (deviceType) => {
    try {
      console.log(`🔌 Disconnecting ${deviceType}...`);
      await disconnect(deviceType);
    } catch (error) {
      console.error(`❌ Failed to disconnect ${deviceType}:`, error);
      Alert.alert('Disconnect Error', `Failed to disconnect ${deviceType}: ${error.message}`);
    }
  }, [disconnect]);

  const handleConnectToDevice = useCallback(async (device) => {
    try {
      console.log('🔗 Connecting to device:', device.name || device.localName);
      const success = await connectToDevice(device);
      if (success) {
        console.log('✅ Connection successful');
        setShowDeviceModal(false);
        setModalScanType(null);
        await stopScanning();
      } else {
        Alert.alert('Connection Error', 'Failed to connect to device. Please try again.');
      }
    } catch (error) {
      console.error('❌ Connection failed:', error);
      Alert.alert('Connection Error', `Failed to connect: ${error.message}`);
    }
  }, [connectToDevice, stopScanning]);

  const handleCloseModal = useCallback(async () => {
    try {
      await stopScanning();
    } catch (error) {
      console.error('❌ Error stopping scan:', error);
    }
    setShowDeviceModal(false);
    setModalScanType(null);
  }, [stopScanning]);

  // ===== AUTO-CLOSE MODAL ON CONNECTION =====
  useEffect(() => {
    if (showDeviceModal && modalScanType) {
      const currentScanConnected = (modalScanType === 'pulse-ox' && isPulseOxConnected) || 
                                   (modalScanType === 'hr-monitor' && isHRConnected);
      
      if (currentScanConnected) {
        console.log(`🎯 ${modalScanType} connected - closing modal`);
        setShowDeviceModal(false);
        setModalScanType(null);
        stopScanning().catch(console.error);
      }
    }
  }, [isPulseOxConnected, isHRConnected, showDeviceModal, modalScanType, stopScanning]);

  // ===== MEMOIZED DEVICE RENDERER =====
  const renderDevice = useCallback(({ item }) => (
    <TouchableOpacity
      style={styles.deviceItem}
      onPress={() => handleConnectToDevice(item)}
    >
      <View style={styles.deviceInfo}>
        <Text style={styles.deviceName}>
          {item.deviceType === 'pulse-ox' ? '📱' : '❤️'} {item.name || item.localName || (item.deviceType === 'pulse-ox' ? 'Pulse Oximeter' : 'Heart Rate Monitor')}
        </Text>
        <Text style={styles.deviceType}>
          {item.deviceType === 'pulse-ox' ? 'Pulse Oximeter' : 'Heart Rate Monitor'}
        </Text>
        {item.rssi && (
          <Text style={styles.deviceRssi}>Signal: {item.rssi} dBm</Text>
        )}
      </View>
      <TouchableOpacity 
        style={styles.connectButton}
        onPress={() => handleConnectToDevice(item)}
      >
        <Text style={styles.connectButtonText}>Connect</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  ), [handleConnectToDevice]);

  return (
    <View style={styles.container}>
      {/* Pulse Oximeter Section */}
      <View style={styles.deviceSection}>
        <Text style={styles.sectionTitle}>1. Pulse Oximeter (Required)</Text>
        <View style={styles.statusCard}>
          {isPulseOxConnected ? (
            <>
              <Text style={styles.statusIcon}>✅</Text>
              <Text style={styles.statusTitle}>Connected</Text>
              <Text style={styles.deviceNameConnected}>
                {connectedPulseOxDevice?.name || connectedPulseOxDevice?.localName || 'Pulse Oximeter'}
              </Text>
              <TouchableOpacity 
                style={styles.disconnectButton} 
                onPress={() => handleDisconnect('pulse-ox')}
              >
                <Text style={styles.disconnectButtonText}>Disconnect</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.statusIcon}>📱</Text>
              <Text style={styles.statusTitle}>Not Connected</Text>
              <TouchableOpacity 
                style={styles.findButton} 
                onPress={() => handleFindDevice('pulse-ox')}
              >
                <Text style={styles.findButtonText}>Find Pulse Oximeter</Text>
              </TouchableOpacity>
              <Text style={styles.instructions}>
                Required for SpO2 and basic heart rate monitoring
              </Text>
            </>
          )}
        </View>
      </View>

      {/* Heart Rate Monitor Section */}
      <View style={styles.deviceSection}>
        <Text style={styles.sectionTitle}>2. Heart Rate Monitor (Optional)</Text>
        <Text style={styles.sectionSubtitle}>
          For enhanced heart rate accuracy and HRV analysis
        </Text>
        <View style={styles.statusCard}>
          {isHRConnected ? (
            <>
              <Text style={styles.statusIcon}>❤️</Text>
              <Text style={styles.statusTitle}>Connected</Text>
              <Text style={styles.deviceNameConnected}>
                {connectedHRDevice?.name || connectedHRDevice?.localName || 'Heart Rate Monitor'}
              </Text>
              <TouchableOpacity 
                style={styles.disconnectButton} 
                onPress={() => handleDisconnect('hr-monitor')}
              >
                <Text style={styles.disconnectButtonText}>Disconnect</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.statusIcon}>❤️</Text>
              <Text style={styles.statusTitle}>Not Connected</Text>
              <TouchableOpacity 
                style={styles.findButton} 
                onPress={() => handleFindDevice('hr-monitor')}
              >
                <Text style={styles.findButtonText}>Find Heart Rate Monitor</Text>
              </TouchableOpacity>
              <Text style={styles.instructions}>
                Optional for enhanced accuracy and HRV analysis
              </Text>
            </>
          )}
        </View>
      </View>

      {/* Optimized Data Display - Only shows when devices are connected */}
      <BluetoothDataDisplay />

      {/* Device Discovery Modal */}
      <Modal
        visible={showDeviceModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCloseModal}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {modalScanType === 'pulse-ox' ? 'Find Pulse Oximeter' : 'Find Heart Rate Monitor'}
            </Text>
            <TouchableOpacity style={styles.closeButton} onPress={handleCloseModal}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.modalInstructions}>
            {isScanning 
              ? `Scanning for ${modalScanType === 'pulse-ox' ? 'pulse oximeters' : 'heart rate monitors'}...`
              : 'Make sure your device is powered on and in pairing mode'
            }
          </Text>

          {discoveredDevices.length > 0 ? (
            <FlatList
              data={discoveredDevices.filter(device => device.deviceType === modalScanType)}
              renderItem={renderDevice}
              keyExtractor={(item) => item.id}
              style={styles.deviceList}
              showsVerticalScrollIndicator={true}
            />
          ) : isScanning ? (
            <View style={styles.scanningContainer}>
              <Text style={styles.scanningText}>🔍 Scanning...</Text>
              <Text style={styles.scanningSubtext}>
                Make sure your {modalScanType === 'pulse-ox' ? 'pulse oximeter' : 'heart rate monitor'} is nearby and discoverable
              </Text>
            </View>
          ) : (
            <View style={styles.noDevicesContainer}>
              <Text style={styles.noDevicesText}>No devices found</Text>
              <TouchableOpacity 
                style={styles.retryButton} 
                onPress={() => startScanning(modalScanType)}
              >
                <Text style={styles.retryButtonText}>Retry Scan</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  deviceSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
    lineHeight: 20,
  },
  statusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  statusIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  deviceNameConnected: {
    fontSize: 16,
    color: '#059669',
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  instructions: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 20,
    maxWidth: 280,
  },
  findButton: {
    backgroundColor: '#4ECDC4',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  findButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  disconnectButton: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  disconnectButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  
  // ===== DATA DISPLAY STYLES =====
  dataDisplaySection: {
    marginTop: 16,
  },
  deviceDataContainer: {
    flexDirection: 'column',
    gap: 16,
  },
  dataCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#4ECDC4',
  },
  hrCard: {
    borderLeftColor: '#FF6B6B',
  },
  pulseOxCard: {
    borderLeftColor: '#FFE66D',
  },
  dataLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 8,
  },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  dataValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginRight: 8,
  },
  primaryDataValue: {
    color: '#059669',
  },
  dataUnit: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 4,
  },
  dataSubLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginRight: 8,
  },
  dataSubValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  goodStatus: {
    color: '#10B981',
  },
  warningStatus: {
    color: '#F59E0B',
  },
  sensorWarning: {
    fontSize: 12,
    color: '#F59E0B',
    marginTop: 8,
    textAlign: 'center',
  },
  hrvDisplayContainer: {
    flexDirection: 'column',
    gap: 8,
    marginTop: 16,
  },
  hrvItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#4ECDC4',
  },
  hrvLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 4,
  },
  hrvValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#059669',
    marginBottom: 4,
  },
  hrvQuality: {
    fontSize: 12,
    color: '#6B7280',
  },

  // ===== MODAL STYLES =====
  modalContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    paddingTop: 60,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: '#374151',
    fontWeight: 'bold',
  },
  modalInstructions: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    margin: 20,
    lineHeight: 24,
  },
  deviceList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  deviceItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  deviceInfo: {
    flex: 1,
    marginRight: 12,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  deviceType: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 2,
  },
  deviceRssi: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  connectButton: {
    backgroundColor: '#4ECDC4',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  connectButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  scanningContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  scanningText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 12,
  },
  scanningSubtext: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  noDevicesContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  noDevicesText: {
    fontSize: 18,
    color: '#6B7280',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#4ECDC4',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default OptimizedConnectionManager; 