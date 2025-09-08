import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
  FlatList,
  Modal,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useBluetooth } from '../context/BluetoothContext';
import { LinearGradient } from 'expo-linear-gradient';

const { height: screenHeight } = Dimensions.get('window');

const InlineDeviceScanner = ({ isVisible, onClose, onDeviceConnected }) => {
  // Debug logging
  useEffect(() => {
    console.log('🔍 InlineDeviceScanner mounted with isVisible:', isVisible);
    return () => {
      console.log('🔍 InlineDeviceScanner unmounted');
    };
  }, []);
  
  useEffect(() => {
    console.log('🔍 InlineDeviceScanner isVisible changed to:', isVisible);
  }, [isVisible]);
  
  const { 
    startScan, 
    stopScan, 
    connectToDevice,
    discoveredDevices,
    isScanning 
  } = useBluetooth();
  
  const [connecting, setConnecting] = useState(null);
  const slideAnim = useRef(new Animated.Value(screenHeight)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isVisible) {
      // Reset animation values first
      slideAnim.setValue(screenHeight);
      fadeAnim.setValue(0);
      
      // Start scanning when popup opens
      startScan('pulse-ox');
      
      // Animate in with smoother, slower animation
      Animated.sequence([
        // First fade in the backdrop
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        // Then slide up the panel with a nice spring
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 40,  // Lower tension for smoother animation
          friction: 8,   // Slightly lower friction for more bounce
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Animate out
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: screenHeight,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        stopScan();
      });
    }

    return () => {
      stopScan();
    };
  }, [isVisible]);

  const handleConnect = async (device) => {
    setConnecting(device.id);
    try {
      await connectToDevice(device);
      // Always call onDeviceConnected and close after connectToDevice completes
      // The connection status is managed by BluetoothContext
      onDeviceConnected(device);
      
      // Animate out smoothly before closing
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: screenHeight,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        onClose();
      });
    } catch (error) {
      console.error('Connection failed:', error);
      setConnecting(null);
    }
  };

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="none"
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <Animated.View 
          style={[
            styles.backdrop,
            {
              opacity: fadeAnim,
            }
          ]}
        >
          <TouchableOpacity 
            style={StyleSheet.absoluteFillObject} 
            activeOpacity={1} 
            onPress={onClose}
          />
        </Animated.View>
        
        <Animated.View 
          style={[
            styles.popup,
            {
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <LinearGradient
            colors={['#1a1a1a', '#0d0d0d']}
            style={styles.popupGradient}
          >
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Available Devices</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Scanning indicator */}
            {isScanning && (
              <View style={styles.scanningContainer}>
                <ActivityIndicator size="small" color="#007AFF" />
                <Text style={styles.scanningText}>Scanning for devices...</Text>
              </View>
            )}

            {/* Device list */}
            {discoveredDevices.length > 0 ? (
              <FlatList
                data={discoveredDevices}
                keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.deviceItem}
                  onPress={() => handleConnect(item)}
                  disabled={connecting === item.id}
                >
                  <View style={styles.deviceInfo}>
                    <View style={styles.deviceIcon}>
                      <Ionicons name="pulse" size={24} color="#007AFF" />
                    </View>
                    <View style={styles.deviceDetails}>
                      <Text style={styles.deviceName}>{item.name || 'Pulse Oximeter'}</Text>
                      <Text style={styles.deviceSignal}>Signal: {item.rssi || 'N/A'} dBm</Text>
                    </View>
                  </View>
                  
                  {connecting === item.id ? (
                    <ActivityIndicator size="small" color="#007AFF" />
                  ) : (
                    <TouchableOpacity
                      style={styles.connectButton}
                      onPress={() => handleConnect(item)}
                    >
                      <Text style={styles.connectButtonText}>Connect</Text>
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
                )}
                style={styles.deviceList}
                contentContainerStyle={styles.listContent}
              />
            ) : null}
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  popup: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '70%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  popupGradient: {
    flex: 1,
    paddingBottom: 34, // Safe area
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  closeButton: {
    padding: 4,
  },
  scanningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    marginHorizontal: 20,
    marginTop: 10,
    borderRadius: 8,
  },
  scanningText: {
    color: '#007AFF',
    marginLeft: 8,
    fontSize: 14,
  },
  deviceList: {
    flex: 1,
  },
  listContent: {
    padding: 20,
    paddingTop: 10,
  },
  deviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  deviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  deviceIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  deviceDetails: {
    flex: 1,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  deviceSignal: {
    fontSize: 12,
    color: '#888',
  },
  connectButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 16,
  },
  connectButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
    marginTop: 12,
  },
  emptySubtext: {
    color: '#444',
    fontSize: 14,
    marginTop: 4,
  },
});

export default InlineDeviceScanner;