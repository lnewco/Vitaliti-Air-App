import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  Alert,
  ActivityIndicator
} from 'react-native';
import { useBluetoothConnection } from '../context/BluetoothContext';
import { useAppTheme } from '../theme';
import logger from '../utils/logger';

const log = logger.createModuleLogger('DeviceSelectionModal');

const DeviceSelectionModal = ({ 
  visible, 
  deviceType = 'pulse-ox', 
  onDeviceSelected, 
  onClose,
  title,
  instructions 
}) => {
  const {
    isScanning,
    discoveredDevices,
    isPulseOxConnected,
    isHRConnected,
    startScanning,
    stopScanning,
    connectToDevice,
  } = useBluetoothConnection();
  const { colors, spacing } = useAppTheme();

  // Start scanning when modal opens
  useEffect(() => {
    if (visible && deviceType) {
      log.info(`Starting ${deviceType} scan`);
      startScanning(deviceType).catch(error => {
        log.error(`Failed to start ${deviceType} scan:`, error);
        Alert.alert('Scan Error', `Failed to start scanning: ${error.message}`);
      });
    }
    
    // Cleanup: stop scanning when modal closes
    return () => {
      if (visible) {
        stopScanning().catch(error => {
          log.error('Failed to stop scanning:', error);
        });
      }
    };
  }, [visible, deviceType]);

  // Auto-close modal when device connects
  useEffect(() => {
    if (visible) {
      const isConnected = (deviceType === 'pulse-ox' && isPulseOxConnected) || 
                         (deviceType === 'hr-monitor' && isHRConnected);
      
      if (isConnected) {
        log.info(`${deviceType} connected - closing modal`);
        stopScanning().catch(console.error);
        if (onDeviceSelected) {
          onDeviceSelected();
        }
      }
    }
  }, [isPulseOxConnected, isHRConnected, visible, deviceType, onDeviceSelected]);

  const handleConnectToDevice = useCallback(async (device) => {
    try {
      log.info('Connecting to device:', device.name || device.localName);
      await connectToDevice(device);
      log.info('Connection successful');
      // Modal will auto-close via the effect above
    } catch (error) {
      log.error('Connection failed:', error);
      Alert.alert('Connection Error', `Failed to connect: ${error.message}`);
    }
  }, [connectToDevice]);

  const handleClose = useCallback(async () => {
    try {
      await stopScanning();
    } catch (error) {
      log.error('Error stopping scan:', error);
    }
    if (onClose) {
      onClose();
    }
  }, [stopScanning, onClose]);

  const styles = StyleSheet.create({
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
      backgroundColor: colors.surface.card,
      justifyContent: 'center',
      alignItems: 'center',
    },
    closeButtonText: {
      fontSize: 18,
      color: colors.text.secondary,
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
      paddingHorizontal: 20,
      paddingVertical: 10,
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
    spinner: {
      marginBottom: 20,
    },
    scanningText: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text.primary,
      marginBottom: 10,
    },
    scanningSubtext: {
      fontSize: 14,
      color: colors.text.secondary,
      textAlign: 'center',
      lineHeight: 20,
    },
    noDevicesContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 40,
    },
    noDevicesText: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text.primary,
      marginBottom: 10,
    },
    noDevicesSubtext: {
      fontSize: 14,
      color: colors.text.secondary,
      textAlign: 'center',
      marginBottom: 20,
      lineHeight: 20,
    },
    retryButton: {
      backgroundColor: colors.primary[500],
      paddingHorizontal: 30,
      paddingVertical: 12,
      borderRadius: 8,
    },
    retryButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: 'bold',
    },
  });

  const renderDevice = useCallback(({ item }) => (
    <TouchableOpacity
      style={styles.deviceItem}
      onPress={() => handleConnectToDevice(item)}
    >
      <View style={styles.deviceInfo}>
        <Text style={styles.deviceName}>
          {deviceType === 'pulse-ox' ? '📱' : '❤️'} {item.name || item.localName || (deviceType === 'pulse-ox' ? 'Pulse Oximeter' : 'Heart Rate Monitor')}
        </Text>
        <Text style={styles.deviceType}>
          {deviceType === 'pulse-ox' ? 'Pulse Oximeter' : 'Heart Rate Monitor'}
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
  ), [handleConnectToDevice, deviceType, styles]);

  // Filter devices by type
  const filteredDevices = discoveredDevices.filter(device => device.deviceType === deviceType);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>
            {title || (deviceType === 'pulse-ox' ? 'Find Pulse Oximeter' : 'Find Heart Rate Monitor')}
          </Text>
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.modalInstructions}>
          {instructions || (isScanning 
            ? `Scanning for ${deviceType === 'pulse-ox' ? 'pulse oximeters' : 'heart rate monitors'}...`
            : 'Make sure your device is powered on and in pairing mode'
          )}
        </Text>

        {filteredDevices.length > 0 ? (
          <FlatList
            data={filteredDevices}
            renderItem={renderDevice}
            keyExtractor={(item) => item.id}
            style={styles.deviceList}
            showsVerticalScrollIndicator={true}
          />
        ) : isScanning ? (
          <View style={styles.scanningContainer}>
            <ActivityIndicator size="large" color={colors.primary[500]} style={styles.spinner} />
            <Text style={styles.scanningText}>🔍 Scanning...</Text>
            <Text style={styles.scanningSubtext}>
              Make sure your {deviceType === 'pulse-ox' ? 'pulse oximeter' : 'heart rate monitor'} is nearby and turned on
            </Text>
          </View>
        ) : (
          <View style={styles.noDevicesContainer}>
            <Text style={styles.noDevicesText}>No devices found</Text>
            <Text style={styles.noDevicesSubtext}>
              Make sure your device is powered on and in pairing mode
            </Text>
            <TouchableOpacity 
              style={styles.retryButton} 
              onPress={() => startScanning(deviceType)}
            >
              <Text style={styles.retryButtonText}>Retry Scan</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
};

export default DeviceSelectionModal;