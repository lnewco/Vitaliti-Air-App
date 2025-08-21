import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, FlatList, Alert } from 'react-native';
import { useBluetoothConnection, useBluetoothData } from '../context/BluetoothContext';
import { useAppTheme } from '../theme';

// ===== MEMOIZED DATA DISPLAY COMPONENT =====
const BluetoothDataDisplay = React.memo(() => {
  const { pulseOximeterData } = useBluetoothData();
  const { isPulseOxConnected } = useBluetoothConnection();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);


  if (!isPulseOxConnected) {
    return null;
  }

  return (
    <View style={styles.dataDisplaySection}>
      <View style={styles.deviceDataContainer}>
        {pulseOximeterData && (
          <View style={[styles.dataCard, styles.pulseOxCard]}>
            <Text style={styles.dataLabel}>Pulse Oximeter</Text>
            <View style={styles.dataRow}>
              <Text style={[styles.dataValue, styles.primaryDataValue]}>{pulseOximeterData.spo2 || '--'}%</Text>
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
const OptimizedConnectionManager = ({ hideDataDisplay = false }) => {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  
  // ===== STABLE CONNECTION STATE (no re-renders from data) =====
  const {
    isScanning,
    scanType,
    isPulseOxConnected,
    discoveredDevices,
    connectedPulseOxDevice,
    startScan,
    stopScan,
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
      await startScan(deviceType);
    } catch (error) {
      console.error(`❌ Failed to start ${deviceType} scan:`, error);
      Alert.alert('Scan Error', `Failed to start scanning for ${deviceType}: ${error.message}`);
      setShowDeviceModal(false);
      setModalScanType(null);
    }
  }, [startScan]);

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
      await connectToDevice(device);
      console.log('✅ Connection successful');
      setShowDeviceModal(false);
      setModalScanType(null);
      await stopScan();
    } catch (error) {
      console.error('❌ Connection failed:', error);
      Alert.alert('Connection Error', `Failed to connect: ${error.message}`);
    }
  }, [connectToDevice, stopScan]);

  const handleCloseModal = useCallback(async () => {
    try {
      await stopScan();
    } catch (error) {
      console.error('❌ Error stopping scan:', error);
    }
    setShowDeviceModal(false);
    setModalScanType(null);
  }, [stopScan]);

  // ===== AUTO-CLOSE MODAL ON CONNECTION =====
  useEffect(() => {
    if (showDeviceModal && modalScanType) {
      const currentScanConnected = modalScanType === 'pulse-ox' && isPulseOxConnected;
      
      if (currentScanConnected) {
        console.log(`🎯 ${modalScanType} connected - closing modal`);
        setShowDeviceModal(false);
        setModalScanType(null);
        stopScan().catch(console.error);
      }
    }
  }, [isPulseOxConnected, showDeviceModal, modalScanType, stopScan]);

  // ===== MEMOIZED DEVICE RENDERER =====
  const renderDevice = useCallback(({ item }) => (
    <TouchableOpacity
      style={styles.deviceItem}
      onPress={() => handleConnectToDevice(item)}
    >
      <View style={styles.deviceInfo}>
        <Text style={styles.deviceName}>
          📱 {item.name || item.localName || 'Pulse Oximeter'}
        </Text>
        <Text style={styles.deviceType}>
          Pulse Oximeter
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
        <Text style={styles.sectionTitle}>Pulse Oximeter (Required)</Text>
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

      {/* Optimized Data Display - Only shows when devices are connected */}
      {!hideDataDisplay && <BluetoothDataDisplay />}

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
              Find Pulse Oximeter
            </Text>
            <TouchableOpacity style={styles.closeButton} onPress={handleCloseModal}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.modalInstructions}>
            {isScanning 
              ? 'Scanning for pulse oximeters...'
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
                Make sure your pulse oximeter is nearby and discoverable
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

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
  },
  deviceSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 16,
    lineHeight: 20,
  },
  statusCard: {
    backgroundColor: colors.surface.card,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: colors.isDark ? '#000' : '#000',
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
    color: colors.text.primary,
    marginBottom: 8,
  },
  deviceNameConnected: {
    fontSize: 16,
    color: colors.success[600],
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  instructions: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 20,
    maxWidth: 280,
  },
  findButton: {
    backgroundColor: colors.primary[500],
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  findButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  disconnectButton: {
    backgroundColor: colors.error[500],
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  disconnectButtonText: {
    color: colors.white,
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
    backgroundColor: colors.surface.elevated,
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary[500],
  },
  hrCard: {
    borderLeftColor: colors.error[400],
  },
  pulseOxCard: {
    borderLeftColor: colors.warning[400],
  },
  dataLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text.primary,
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
    color: colors.text.primary,
    marginRight: 8,
  },
  primaryDataValue: {
    color: colors.success[600],
  },
  dataUnit: {
    fontSize: 14,
    color: colors.text.secondary,
    marginLeft: 4,
  },
  dataSubLabel: {
    fontSize: 14,
    color: colors.text.secondary,
    marginRight: 8,
  },
  dataSubValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  goodStatus: {
    color: colors.success[500],
  },
  warningStatus: {
    color: colors.warning[500],
  },
  sensorWarning: {
    fontSize: 12,
    color: colors.warning[500],
    marginTop: 8,
    textAlign: 'center',
  },
  hrvDisplayContainer: {
    flexDirection: 'column',
    gap: 8,
    marginTop: 16,
  },
  hrvItem: {
    backgroundColor: colors.surface.card,
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary[500],
  },
  hrvLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: 4,
  },
  hrvValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.success[600],
    marginBottom: 4,
  },
  hrvQuality: {
    fontSize: 12,
    color: colors.text.secondary,
  },

  // ===== MODAL STYLES =====
  modalContainer: {
    flex: 1,
    backgroundColor: colors.surface.background,
    paddingTop: 60,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text.primary,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface.elevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: colors.text.primary,
    fontWeight: 'bold',
  },
  modalInstructions: {
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: 'center',
    margin: 20,
    lineHeight: 24,
  },
  deviceList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  deviceItem: {
    backgroundColor: colors.surface.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: colors.isDark ? '#000' : '#000',
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
    color: colors.text.primary,
    marginBottom: 4,
  },
  deviceType: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 2,
  },
  deviceRssi: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  connectButton: {
    backgroundColor: colors.primary[500],
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  connectButtonText: {
    color: colors.white,
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
    color: colors.text.primary,
    marginBottom: 12,
  },
  scanningSubtext: {
    fontSize: 16,
    color: colors.text.secondary,
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
    color: colors.text.secondary,
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: colors.primary[500],
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default OptimizedConnectionManager; 