import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, FlatList, Alert } from 'react-native';
import { useBluetooth } from '../context/BluetoothContext';

const DualDeviceConnectionManager = () => {
  // DEBUG: Verify this component is actually loading
  console.log('🚨 DEBUG: DualDeviceConnectionManager component is LOADING!');
  
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
  } = useBluetooth();

  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [currentStep, setCurrentStep] = useState('pulse-ox'); // 'pulse-ox' or 'hr-monitor'

  // DEBUG: Log when component renders
  useEffect(() => {
    console.log('🚨 DEBUG: DualDeviceConnectionManager useEffect - Component has rendered!');
  }, []);

  // Auto-advance to HR monitor step once pulse ox is connected
  useEffect(() => {
    if (isPulseOxConnected && currentStep === 'pulse-ox') {
      console.log('✅ Pulse oximeter connected - ready for HR monitor step');
    }
  }, [isPulseOxConnected, currentStep]);

  // Close modal and stop scanning when device connects
  useEffect(() => {
    if (showDeviceModal) {
      const isConnecting = (scanType === 'pulse-ox' && isPulseOxConnected) || 
                          (scanType === 'hr-monitor' && isHRConnected);
      
      if (isConnecting) {
        console.log(`🎯 ${scanType} connected - closing modal`);
        setShowDeviceModal(false);
        stopScanning().catch(console.error);
      }
    }
  }, [isPulseOxConnected, isHRConnected, showDeviceModal, scanType]);

  // Cleanup: Stop scanning if component unmounts while scanning
  useEffect(() => {
    return () => {
      if (isScanning) {
        console.log('🧹 DualDeviceConnectionManager: Cleanup - stopping scan');
        stopScanning().catch(console.error);
      }
    };
  }, [isScanning]);

  const handleFindDevice = async (deviceType) => {
    try {
      setShowDeviceModal(true);
      await startScanning(deviceType);
    } catch (error) {
      setShowDeviceModal(false);
      Alert.alert('Error', 'Failed to scan for devices. Please check Bluetooth permissions.');
    }
  };

  const handleConnectToDevice = async (device) => {
    try {
      await connectToDevice(device);
      setShowDeviceModal(false);
      await stopScanning();
    } catch (error) {
      Alert.alert('Connection Failed', `Could not connect to ${device.name || 'device'}. Please try again.`);
    }
  };

  const handleDisconnect = async (deviceType) => {
    try {
      console.log(`🔌 Disconnecting ${deviceType}...`);
      await disconnect(deviceType);
      console.log(`✅ ${deviceType} disconnected`);
    } catch (error) {
      console.error(`❌ Disconnect failed for ${deviceType}:`, error);
      Alert.alert('Error', 'Failed to disconnect device.');
    }
  };

  const handleCloseModal = async () => {
    await stopScanning();
    setShowDeviceModal(false);
  };

  // Filter devices by type
  const filteredDevices = discoveredDevices.filter(device => {
    if (scanType === 'pulse-ox') {
      return device.deviceType === 'pulse-ox';
    } else if (scanType === 'hr-monitor') {
      return device.deviceType === 'hr-monitor';
    }
    return false;
  });

  const renderDevice = ({ item }) => (
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
      </View>
      <TouchableOpacity 
        style={styles.connectButton}
        onPress={() => handleConnectToDevice(item)}
      >
        <Text style={styles.connectButtonText}>Connect</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, styles.debugContainer]}>
      {/* DEBUG: Visual indicator this component is rendering */}
      <View style={styles.debugBanner}>
        <Text style={styles.debugText}>🚨 DEBUG: DualDeviceConnectionManager is ACTIVE! 🚨</Text>
      </View>
      
      {/* Pulse Oximeter Section */}
      <View style={styles.deviceSection}>
        <Text style={styles.sectionTitle}>1. Pulse Oximeter (Required)</Text>
        <View style={styles.statusCard}>
          {isPulseOxConnected ? (
            <>
              <Text style={styles.statusIcon}>✅</Text>
              <Text style={styles.statusTitle}>Connected</Text>
              <Text style={styles.deviceName}>
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
        <View style={[styles.statusCard, !isPulseOxConnected && styles.disabledCard]}>
          {isHRConnected ? (
            <>
              <Text style={styles.statusIcon}>❤️</Text>
              <Text style={styles.statusTitle}>Connected</Text>
              <Text style={styles.deviceName}>
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
                style={[styles.findButton, styles.secondaryButton]} 
                onPress={() => handleFindDevice('hr-monitor')}
                disabled={!isPulseOxConnected}
              >
                <Text style={[styles.findButtonText, styles.secondaryButtonText]}>
                  Find Heart Rate Monitor
                </Text>
              </TouchableOpacity>
              <Text style={styles.instructions}>
                {!isPulseOxConnected 
                  ? 'Connect pulse oximeter first' 
                  : 'Supports WHOOP, Polar, Garmin, and other BLE monitors'
                }
              </Text>
            </>
          )}
        </View>
      </View>

      {/* Device Selection Modal */}
      <Modal
        visible={showDeviceModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCloseModal}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              Choose Your {scanType === 'pulse-ox' ? 'Pulse Oximeter' : 'Heart Rate Monitor'}
            </Text>
            <TouchableOpacity style={styles.closeButton} onPress={handleCloseModal}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {isScanning && (
            <View style={styles.scanningIndicator}>
              <Text style={styles.scanningText}>
                🔍 Scanning for {scanType === 'pulse-ox' ? 'pulse oximeters' : 'heart rate monitors'}...
              </Text>
            </View>
          )}

          {filteredDevices.length > 0 ? (
            <FlatList
              data={filteredDevices}
              renderItem={renderDevice}
              keyExtractor={(item) => item.id}
              style={styles.deviceList}
              contentContainerStyle={styles.deviceListContent}
            />
          ) : (
            <View style={styles.noDevicesContainer}>
              <Text style={styles.noDevicesText}>
                {isScanning 
                  ? `Looking for ${scanType === 'pulse-ox' ? 'pulse oximeters' : 'heart rate monitors'}...` 
                  : 'No devices found'
                }
              </Text>
              {!isScanning && (
                <Text style={styles.noDevicesSubtext}>
                  {scanType === 'pulse-ox' 
                    ? 'Make sure your pulse oximeter is turned on and in pairing mode'
                    : 'Enable HR broadcast in your WHOOP app (Device Settings) or turn on your heart rate monitor'
                  }
                </Text>
              )}
            </View>
          )}

          <View style={styles.modalActions}>
            <TouchableOpacity 
              style={styles.scanAgainButton} 
              onPress={() => handleFindDevice(scanType)}
              disabled={isScanning}
            >
              <Text style={styles.scanAgainButtonText}>
                {isScanning ? 'Scanning...' : 'Scan Again'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={handleCloseModal}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
  },
  // DEBUG: Make it visually obvious when this component loads
  debugContainer: {
    backgroundColor: '#FFE5E5', // Light red background
    borderWidth: 3,
    borderColor: '#FF0000',
  },
  debugBanner: {
    backgroundColor: '#FF0000',
    padding: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  debugText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  deviceSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
  },
  statusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  disabledCard: {
    opacity: 0.6,
  },
  statusIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 6,
    textAlign: 'center',
  },
  deviceName: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
    textAlign: 'center',
  },
  findButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 12,
    minWidth: 180,
  },
  secondaryButton: {
    backgroundColor: '#F3F4F6',
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  findButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  secondaryButtonText: {
    color: '#3B82F6',
  },
  disconnectButton: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
  },
  disconnectButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  instructions: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 16,
  },
  
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    flex: 1,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: '#6B7280',
  },
  scanningIndicator: {
    backgroundColor: '#FEF3C7',
    margin: 20,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  scanningText: {
    color: '#92400E',
    fontSize: 14,
    fontWeight: '500',
  },
  deviceList: {
    flex: 1,
  },
  deviceListContent: {
    padding: 20,
  },
  deviceItem: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 8,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceType: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  connectButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  connectButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  noDevicesContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  noDevicesText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 8,
  },
  noDevicesSubtext: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 18,
  },
  modalActions: {
    flexDirection: 'row',
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 12,
  },
  scanAgainButton: {
    flex: 1,
    backgroundColor: '#6B7280',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  scanAgainButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default DualDeviceConnectionManager;
