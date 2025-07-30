import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, FlatList, Alert } from 'react-native';
import { useBluetooth } from '../context/BluetoothContext';

const DualDeviceConnectionManager = () => {
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
  const [modalScanType, setModalScanType] = useState(null); // Track which scan opened the modal

  // Debug logging
  useEffect(() => {
    console.log('🔍 DualDeviceConnectionManager state:', {
      isPulseOxConnected,
      isHRConnected,
      connectedPulseOxDevice: connectedPulseOxDevice?.name,
      connectedHRDevice: connectedHRDevice?.name
    });
  }, [isPulseOxConnected, isHRConnected, connectedPulseOxDevice, connectedHRDevice]);

  // Close modal and stop scanning when device connects
  useEffect(() => {
    if (showDeviceModal && modalScanType) {
      // ✅ FIX: Use modalScanType (local) instead of scanType (global) to prevent race condition
      const currentScanConnected = (modalScanType === 'pulse-ox' && isPulseOxConnected) || 
                                   (modalScanType === 'hr-monitor' && isHRConnected);
      
      if (currentScanConnected) {
        console.log(`🎯 ${modalScanType} connected - closing modal`);
        setShowDeviceModal(false);
        setModalScanType(null);
        stopScanning().catch(console.error);
      }
    }
  }, [isPulseOxConnected, isHRConnected, showDeviceModal, modalScanType]);

  // Cleanup: Stop scanning if component unmounts while scanning
  useEffect(() => {
    return () => {
      if (isScanning) {
        console.log('🧹 DualDeviceConnectionManager: Cleanup - stopping scan');
        stopScanning().catch(console.error);
      }
    };
  }, [isScanning, stopScanning]);

  const handleFindDevice = async (deviceType) => {
    try {
      console.log(`🔍 Finding ${deviceType} devices...`);
      
      setModalScanType(deviceType); // ✅ Track which scan type opened this modal
      setShowDeviceModal(true);
      
      await startScanning(deviceType);
      console.log(`✅ Started scanning for ${deviceType} devices`);
    } catch (error) {
      console.error(`Error finding ${deviceType} devices:`, error);
      Alert.alert('Error', `Failed to start scanning for ${deviceType}: ${error.message}`);
      setShowDeviceModal(false);
      setModalScanType(null);
    }
  };

  const handleConnectToDevice = async (device) => {
    try {
      console.log(`🔗 Connecting to ${device.deviceType} device:`, device.name);
      await connectToDevice(device);
      // Modal will close automatically via useEffect when connection succeeds
    } catch (error) {
      console.error('Connection error:', error);
      Alert.alert('Connection Failed', `Failed to connect to ${device.name}: ${error.message}`);
    }
  };

  const handleDisconnect = async (deviceType) => {
    try {
      console.log(`🔌 Disconnecting ${deviceType}...`);
      await disconnect(deviceType);
    } catch (error) {
      console.error('Disconnect error:', error);
      Alert.alert('Disconnect Failed', `Failed to disconnect ${deviceType}: ${error.message}`);
    }
  };

  const handleCloseModal = () => {
    if (isScanning) {
      stopScanning().catch(console.error);
    }
    setShowDeviceModal(false);
    setModalScanType(null); // ✅ Clear the modal scan type
  };

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
  );

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
        <View style={styles.statusCard}>
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
              
              {/* Always show the button as enabled - remove pulse ox dependency */}
              <TouchableOpacity 
                style={styles.findButton} 
                onPress={() => handleFindDevice('hr-monitor')}
              >
                <Text style={styles.findButtonText}>
                  Find Heart Rate Monitor
                </Text>
              </TouchableOpacity>
              
              <Text style={styles.instructions}>
                Supports WHOOP, Polar, Garmin, and other BLE monitors
              </Text>
            </>
          )}
        </View>
      </View>

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

          {isScanning && (
            <View style={styles.scanningIndicator}>
              <Text style={styles.scanningText}>
                📡 Scanning for {modalScanType === 'pulse-ox' ? 'pulse oximeters' : 'heart rate monitors'}...
              </Text>
            </View>
          )}

          {discoveredDevices.length > 0 ? (
            <FlatList
              data={discoveredDevices}
              renderItem={renderDevice}
              keyExtractor={(item) => item.id}
              style={styles.deviceList}
              contentContainerStyle={styles.deviceListContent}
            />
          ) : (
            <View style={styles.noDevicesContainer}>
              <Text style={styles.noDevicesText}>
                {isScanning ? 'Searching for devices...' : 'No devices found'}
              </Text>
              <Text style={styles.noDevicesSubtext}>
                {modalScanType === 'pulse-ox' 
                  ? 'Make sure your pulse oximeter is turned on and in pairing mode.'
                  : 'Make sure your heart rate monitor is on and in pairing mode. For WHOOP: Enable HR broadcast in your WHOOP app (Device Settings → Live Data).'
                }
              </Text>
            </View>
          )}

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => {
                console.log('🔄 User requested scan refresh');
                stopScanning().then(() => {
                  setTimeout(() => {
                    startScanning(modalScanType);
                  }, 500);
                });
              }}
            >
              <Text style={styles.secondaryButtonText}>Refresh Scan</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCloseModal}
            >
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
    padding: 20,
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
  },
  statusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statusIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
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
  },
  findButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#6B7280',
  },
  secondaryButtonText: {
    color: '#FFFFFF',
  },
  disconnectButton: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  disconnectButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  instructions: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 18,
    color: '#6B7280',
  },
  scanningIndicator: {
    padding: 20,
    alignItems: 'center',
  },
  scanningText: {
    fontSize: 16,
    color: '#6B7280',
  },
  deviceList: {
    flex: 1,
  },
  deviceListContent: {
    padding: 20,
  },
  deviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  deviceType: {
    fontSize: 14,
    color: '#6B7280',
  },
  deviceRssi: {
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
    fontSize: 18,
    color: '#6B7280',
    marginBottom: 12,
    textAlign: 'center',
  },
  noDevicesSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  scanAgainButton: {
    flex: 1,
    backgroundColor: '#3B82F6',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  scanAgainButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default DualDeviceConnectionManager;
