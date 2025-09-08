import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  Alert,
  ActivityIndicator,
  StatusBar
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useBluetoothConnection } from '../context/BluetoothContext';
import SafeIcon from './base/SafeIcon';
import logger from '../utils/logger';
import { colors, spacing } from '../design-system';

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
      backgroundColor: colors.background.primary,
    },
    modalContent: {
      flex: 1,
      paddingTop: 60,
    },
    gradient: {
      ...StyleSheet.absoluteFillObject,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.lg,
      backgroundColor: 'transparent',
    },
    modalTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text.primary,
    },
    closeButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    modalInstructions: {
      fontSize: 16,
      color: colors.text.secondary,
      textAlign: 'center',
      marginHorizontal: spacing.xl,
      marginBottom: spacing.lg,
      lineHeight: 24,
    },
    sectionTitle: {
      fontSize: 14,
      color: colors.text.tertiary,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginHorizontal: spacing.xl,
      marginBottom: spacing.md,
      fontWeight: '600',
    },
    deviceList: {
      flex: 1,
      paddingHorizontal: spacing.xl,
    },
    deviceItem: {
      backgroundColor: 'rgba(26, 29, 35, 0.8)',
      borderRadius: 16,
      padding: spacing.lg,
      marginBottom: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    connectedItem: {
      backgroundColor: 'rgba(74, 222, 128, 0.1)',
      borderColor: colors.metrics.breath,
    },
    deviceInfo: {
      flex: 1,
      marginRight: spacing.md,
    },
    deviceName: {
      fontSize: 16,
      fontWeight: '600',
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
      backgroundColor: colors.brand.accent,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: 12,
    },
    disconnectButton: {
      backgroundColor: colors.semantic.error,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: 12,
    },
    connectButtonText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '600',
    },
    scanningContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: spacing.xxl,
    },
    spinner: {
      marginBottom: spacing.lg,
    },
    scanningText: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text.primary,
      marginBottom: spacing.sm,
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
      paddingHorizontal: spacing.xxl,
    },
    noDevicesText: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text.primary,
      marginBottom: spacing.sm,
    },
    noDevicesSubtext: {
      fontSize: 14,
      color: colors.text.secondary,
      textAlign: 'center',
      marginBottom: spacing.lg,
      lineHeight: 20,
    },
    retryButton: {
      backgroundColor: colors.brand.accent,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      borderRadius: 12,
    },
    retryButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
    connectedContainer: {
      backgroundColor: 'rgba(26, 29, 35, 0.9)',
      borderRadius: 20,
      padding: spacing.xl,
      marginHorizontal: spacing.xl,
      marginTop: spacing.xxl,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    connectedIcon: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.metrics.breath,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: spacing.lg,
    },
    connectedTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text.primary,
      marginBottom: spacing.sm,
    },
    connectedDevice: {
      fontSize: 18,
      color: colors.metrics.breath,
      fontWeight: '600',
      marginBottom: spacing.lg,
    },
    liveDataContainer: {
      flexDirection: 'row',
      marginTop: spacing.lg,
      gap: spacing.xl,
    },
    liveDataItem: {
      alignItems: 'center',
    },
    liveDataLabel: {
      fontSize: 12,
      color: colors.text.tertiary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: spacing.xs,
    },
    liveDataValue: {
      fontSize: 32,
      fontWeight: '700',
      color: colors.text.primary,
    },
    liveDataUnit: {
      fontSize: 14,
      color: colors.text.secondary,
      marginTop: spacing.xs,
    },
  });

  const renderDevice = useCallback(({ item }) => {
    const isConnected = (deviceType === 'pulse-ox' && isPulseOxConnected) || 
                       (deviceType === 'hr-monitor' && isHRConnected);
    
    return (
      <TouchableOpacity
        style={[styles.deviceItem, isConnected && styles.connectedItem]}
        onPress={() => !isConnected && handleConnectToDevice(item)}
      >
        <View style={styles.deviceInfo}>
          <Text style={styles.deviceName}>
            {item.name || item.localName || (deviceType === 'pulse-ox' ? 'Pulse Oximeter' : 'Heart Rate Monitor')}
          </Text>
          {item.id && (
            <Text style={styles.deviceType}>
              ID: {item.id.substring(0, 17)}...
            </Text>
          )}
          {item.rssi && (
            <Text style={styles.deviceRssi}>
              Signal: {item.rssi} dBm
            </Text>
          )}
        </View>
        <TouchableOpacity
          style={isConnected ? styles.disconnectButton : styles.connectButton}
          onPress={() => !isConnected && handleConnectToDevice(item)}
        >
          <Text style={styles.connectButtonText}>
            {isConnected ? 'Connected' : 'Connect'}
          </Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  }, [deviceType, isPulseOxConnected, isHRConnected, handleConnectToDevice, styles]);

  const getConnectedDevice = () => {
    if (deviceType === 'pulse-ox' && isPulseOxConnected) {
      return discoveredDevices.find(d => d.name?.includes('O2Ring') || d.localName?.includes('O2Ring'));
    }
    return null;
  };

  const connectedDevice = getConnectedDevice();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
    >
      <View style={styles.modalContainer}>
        <StatusBar barStyle="light-content" />
        
        {/* Premium gradient background */}
        <LinearGradient
          colors={['#0C0E12', '#13161B', '#1A1D23']}
          style={styles.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />

        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {title || 'Connect Device'}
            </Text>
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={handleClose}
            >
              <SafeIcon name="close" size={20} color={colors.text.primary} />
            </TouchableOpacity>
          </View>

          {/* Instructions */}
          {instructions && (
            <Text style={styles.modalInstructions}>
              {instructions}
            </Text>
          )}

          {/* Connected Device Display */}
          {connectedDevice && (
            <>
              <Text style={styles.sectionTitle}>Pulse Oximeter (Required)</Text>
              <View style={styles.connectedContainer}>
                <View style={styles.connectedIcon}>
                  <SafeIcon name="checkmark" size={40} color="#FFFFFF" />
                </View>
                <Text style={styles.connectedTitle}>Connected</Text>
                <Text style={styles.connectedDevice}>
                  {connectedDevice.name || 'O2Ring 0029'}
                </Text>
                <TouchableOpacity
                  style={styles.disconnectButton}
                  onPress={() => {/* Add disconnect logic */}}
                >
                  <Text style={styles.connectButtonText}>Disconnect</Text>
                </TouchableOpacity>
              </View>

              {/* Live Data Display */}
              <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>Pulse Oximeter</Text>
              <View style={[styles.connectedContainer, { marginTop: spacing.md }]}>
                <View style={styles.liveDataContainer}>
                  <View style={styles.liveDataItem}>
                    <Text style={styles.liveDataValue}>90</Text>
                    <Text style={styles.liveDataUnit}>% SpO₂</Text>
                  </View>
                  <View style={styles.liveDataItem}>
                    <Text style={styles.liveDataValue}>75</Text>
                    <Text style={styles.liveDataUnit}>bpm</Text>
                  </View>
                </View>
                <Text style={[styles.deviceRssi, { marginTop: spacing.md }]}>
                  Signal: ████████░░
                </Text>
              </View>
            </>
          )}

          {/* Device List */}
          {!connectedDevice && (
            <>
              {isScanning ? (
                <View style={styles.scanningContainer}>
                  <ActivityIndicator size="large" color={colors.brand.accent} style={styles.spinner} />
                  <Text style={styles.scanningText}>Scanning for Devices...</Text>
                  <Text style={styles.scanningSubtext}>
                    Make sure your {deviceType === 'pulse-ox' ? 'pulse oximeter' : 'heart rate monitor'} is turned on and nearby
                  </Text>
                </View>
              ) : discoveredDevices.length > 0 ? (
                <>
                  <Text style={styles.sectionTitle}>Available Devices</Text>
                  <FlatList
                    style={styles.deviceList}
                    data={discoveredDevices}
                    keyExtractor={(item) => item.id || Math.random().toString()}
                    renderItem={renderDevice}
                  />
                </>
              ) : (
                <View style={styles.noDevicesContainer}>
                  <Text style={styles.noDevicesText}>No Devices Found</Text>
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
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

export default DeviceSelectionModal;