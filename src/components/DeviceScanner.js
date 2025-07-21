import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { useBluetooth } from '../context/BluetoothContext';

const DeviceScanner = () => {
  const {
    isScanning,
    discoveredDevices,
    startScanning,
    stopScanning,
    connectToDevice,
  } = useBluetooth();

  // Debug: Log discovered devices whenever they change
  React.useEffect(() => {
    console.log('🔍 DeviceScanner: Discovered devices changed:', discoveredDevices.length);
    console.log('📋 DeviceScanner: Full device list:', JSON.stringify(discoveredDevices, null, 2));
    discoveredDevices.forEach((device, index) => {
      console.log(`📱 Device ${index + 1}:`, device.name || device.localName || 'Unknown');
    });
  }, [discoveredDevices]);

  const handleStartScan = async () => {
    try {
      await startScanning();
    } catch (error) {
      Alert.alert('Scan Error', error.message);
    }
  };

  const handleStopScan = async () => {
    try {
      await stopScanning();
    } catch (error) {
      Alert.alert('Stop Scan Error', error.message);
    }
  };

  const handleConnectToDevice = async (device) => {
    try {
      await connectToDevice(device);
      Alert.alert('Success', `Connected to ${device.name || 'device'}`);
    } catch (error) {
      Alert.alert('Connection Error', `Failed to connect: ${error.message}`);
    }
  };

  // Check if device is a BCI device (same logic as in BluetoothService)
  const isBCIDevice = (device) => {
    const name = device.name || '';
    const localName = device.localName || '';
    const deviceText = (name + ' ' + localName).toLowerCase();
    
    // Check for BCI service UUID
    const hasBCIService = device.serviceUUIDs && 
      device.serviceUUIDs.includes('49535343-FE7D-4AE5-8FA9-9FAFD205E455');
    
    const bciKeywords = [
      'berry', 'med', 'bci', 'pulse', 'oximeter', 'spo2'
    ];
    
    const hasKeyword = bciKeywords.some(keyword =>
      deviceText.includes(keyword.toLowerCase())
    );

    return hasBCIService || hasKeyword;
  };

  const renderDevice = ({ item }) => (
    <TouchableOpacity
      style={styles.deviceItem}
      onPress={() => handleConnectToDevice(item)}
    >
      <View style={styles.deviceInfo}>
        <Text style={styles.deviceName}>
          {item.name || item.localName || 'Unknown Device'}
        </Text>
        <Text style={styles.deviceId}>ID: {item.id}</Text>
        {item.rssi && (
          <Text style={styles.deviceRssi}>Signal: {item.rssi} dBm</Text>
        )}
        
        {/* Show if it's a BCI device */}
        {isBCIDevice(item) && (
          <View style={styles.bciIndicator}>
            <Text style={styles.bciTag}>🎯 BCI Protocol Device</Text>
          </View>
        )}

        {/* Show service UUIDs if available */}
        {item.serviceUUIDs && item.serviceUUIDs.length > 0 && (
          <Text style={styles.serviceInfo}>
            Services: {item.serviceUUIDs.length}
          </Text>
        )}
      </View>
      <View style={styles.connectButton}>
        <Text style={styles.connectText}>Connect</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.controls}>
        <Text style={styles.title}>Bluetooth Devices</Text>
        <Text style={styles.subtitle}>
          Looking for BCI Protocol devices (Berry Med pulse oximeters)
        </Text>
        
        {!isScanning ? (
          <TouchableOpacity style={styles.scanButton} onPress={handleStartScan}>
            <Text style={styles.scanButtonText}>Start Scan</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.stopButton} onPress={handleStopScan}>
            <Text style={styles.stopButtonText}>Stop Scan</Text>
          </TouchableOpacity>
        )}
      </View>

      {isScanning && (
        <View style={styles.scanningIndicator}>
          <Text style={styles.scanningText}>🔍 Scanning for devices...</Text>
        </View>
      )}

      {discoveredDevices.length > 0 ? (
        <View style={styles.deviceListContainer}>
          <Text style={styles.deviceListTitle}>
            Found {discoveredDevices.length} device(s):
          </Text>
          <FlatList
            data={discoveredDevices}
            renderItem={renderDevice}
            keyExtractor={(item) => item.id}
            key={discoveredDevices.length} // Force re-render when devices change
            style={styles.deviceList}
            showsVerticalScrollIndicator={false}
            extraData={discoveredDevices} // Ensure FlatList updates when data changes
          />
        </View>
      ) : (
        <View style={styles.noDevicesContainer}>
          <Text style={styles.noDevicesText}>
            {isScanning ? 'Searching for devices...' : 'No devices found'}
          </Text>
          <Text style={styles.debugText}>
            Debug: Found {discoveredDevices.length} devices in state
          </Text>
          {!isScanning && (
            <Text style={styles.noDevicesSubtext}>
              Make sure your pulse oximeter is turned on and in pairing mode
            </Text>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  controls: {
    backgroundColor: 'white',
    padding: 20,
    margin: 10,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 15,
  },
  scanButton: {
    backgroundColor: '#4F46E5',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  scanButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  stopButton: {
    backgroundColor: '#EF4444',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  stopButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  scanningIndicator: {
    backgroundColor: '#FEF3C7',
    margin: 10,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  scanningText: {
    color: '#92400E',
    fontSize: 16,
    fontWeight: '500',
  },
  deviceListContainer: {
    backgroundColor: 'white',
    margin: 10,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  deviceListTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  deviceList: {
    paddingHorizontal: 10,
  },
  deviceItem: {
    backgroundColor: 'white',
    flexDirection: 'row',
    padding: 20,
    marginVertical: 8,
    marginHorizontal: 10,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  deviceId: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  deviceRssi: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 5,
  },
  serviceInfo: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 5,
  },
  bciIndicator: {
    marginTop: 5,
  },
  bciTag: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '600',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  connectButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  connectText: {
    color: 'white',
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
    textAlign: 'center',
    marginBottom: 10,
  },
  noDevicesSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
  },
  debugText: {
    fontSize: 12,
    color: '#4B5563',
    marginTop: 10,
    textAlign: 'center',
  },
});

export default DeviceScanner; 