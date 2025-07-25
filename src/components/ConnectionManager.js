import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, FlatList, Alert } from 'react-native';
import { useBluetooth } from '../context/BluetoothContext';

const ConnectionManager = () => {
  const {
    isScanning,
    isConnected,
    discoveredDevices,
    connectedDevice,
    startScanning,
    stopScanning,
    connectToDevice,
    disconnect,
  } = useBluetooth();

  const [showDeviceModal, setShowDeviceModal] = useState(false);

  // Debug: Log connection state changes
  useEffect(() => {
    console.log('🔗 ConnectionManager: Connection state changed:', { 
      isConnected, 
      connectedDevice: connectedDevice?.name || connectedDevice?.localName || 'None'
    });
  }, [isConnected, connectedDevice]);

  // Close modal and stop scanning when connected
  useEffect(() => {
    if (isConnected && showDeviceModal) {
      console.log('🎯 ConnectionManager: Connected - closing modal');
      setShowDeviceModal(false);
      stopScanning().catch(console.error);
    }
  }, [isConnected, showDeviceModal]);

  // Cleanup: Stop scanning if component unmounts while scanning
  useEffect(() => {
    return () => {
      if (isScanning) {
        console.log('🧹 ConnectionManager: Cleanup - stopping scan');
        stopScanning().catch(console.error);
      }
    };
  }, [isScanning]);

  // Check if device is a pulse oximeter (same logic as BCI device detection)
  const isPulseOximeter = (device) => {
    const name = device.name || '';
    const localName = device.localName || '';
    const deviceText = (name + ' ' + localName).toLowerCase();
    
    // Check for BCI service UUID
    const hasBCIService = device.serviceUUIDs && 
      device.serviceUUIDs.includes('49535343-FE7D-4AE5-8FA9-9FAFD205E455');
    
    const pulseOxKeywords = [
      'berry', 'med', 'bci', 'pulse', 'oximeter', 'spo2'
    ];
    
    const hasKeyword = pulseOxKeywords.some(keyword =>
      deviceText.includes(keyword.toLowerCase())
    );

    return hasBCIService || hasKeyword;
  };

  const handleFindDevice = async () => {
    try {
      setShowDeviceModal(true);
      await startScanning();
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

  const handleDisconnect = async () => {
    try {
      console.log('🔌 ConnectionManager: Initiating disconnect...');
      await disconnect();
      console.log('✅ ConnectionManager: Disconnect completed');
    } catch (error) {
      console.error('❌ ConnectionManager: Disconnect failed:', error);
      Alert.alert('Error', 'Failed to disconnect device.');
    }
  };

  const handleCloseModal = async () => {
    await stopScanning();
    setShowDeviceModal(false);
  };

  const pulseOxDevices = discoveredDevices.filter(device => isPulseOximeter(device));

  const renderDevice = ({ item }) => (
    <TouchableOpacity
      style={styles.deviceItem}
      onPress={() => handleConnectToDevice(item)}
    >
      <View style={styles.deviceInfo}>
        <Text style={styles.deviceName}>
          📱 {item.name || item.localName || 'Pulse Oximeter'}
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

  // Connected State
  if (isConnected) {
    return (
      <View style={styles.container}>
        <View style={styles.statusCard}>
          <Text style={styles.statusIcon}>✅</Text>
          <Text style={styles.statusTitle}>Connected to PulseOx</Text>
          <Text style={styles.deviceName}>
            {connectedDevice?.name || connectedDevice?.localName || 'Pulse Oximeter'}
          </Text>
          <TouchableOpacity style={styles.disconnectButton} onPress={handleDisconnect}>
            <Text style={styles.disconnectButtonText}>Disconnect</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Disconnected State
  return (
    <View style={styles.container}>
      <View style={styles.statusCard}>
        <Text style={styles.statusIcon}>📱</Text>
        <Text style={styles.statusTitle}>Not Connected</Text>
        <TouchableOpacity style={styles.findButton} onPress={handleFindDevice}>
          <Text style={styles.findButtonText}>Find Pulse Oximeter</Text>
        </TouchableOpacity>
        <Text style={styles.instructions}>
          Make sure your device is on and ready to connect
        </Text>
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
            <Text style={styles.modalTitle}>Choose Your Device</Text>
            <TouchableOpacity style={styles.closeButton} onPress={handleCloseModal}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {isScanning && (
            <View style={styles.scanningIndicator}>
              <Text style={styles.scanningText}>🔍 Scanning for devices...</Text>
            </View>
          )}

          {pulseOxDevices.length > 0 ? (
            <FlatList
              data={pulseOxDevices}
              renderItem={renderDevice}
              keyExtractor={(item) => item.id}
              style={styles.deviceList}
              contentContainerStyle={styles.deviceListContent}
            />
          ) : (
            <View style={styles.noDevicesContainer}>
              <Text style={styles.noDevicesText}>
                {isScanning ? 'Looking for pulse oximeters...' : 'No devices found'}
              </Text>
              {!isScanning && (
                <Text style={styles.noDevicesSubtext}>
                  Make sure your pulse oximeter is turned on and in pairing mode
                </Text>
              )}
            </View>
          )}

          <View style={styles.modalActions}>
            <TouchableOpacity 
              style={styles.scanAgainButton} 
              onPress={handleFindDevice}
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
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  statusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  statusIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  statusTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  deviceName: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 24,
    textAlign: 'center',
  },
  findButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 16,
    minWidth: 200,
  },
  findButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
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
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
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
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
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
    fontSize: 16,
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
    padding: 20,
    marginBottom: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  deviceInfo: {
    flex: 1,
  },
  connectButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  connectButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
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
    textAlign: 'center',
    marginBottom: 8,
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
    fontSize: 16,
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
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ConnectionManager; 