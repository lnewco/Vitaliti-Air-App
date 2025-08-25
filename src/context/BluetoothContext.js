import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Constants from 'expo-constants';
import logger from '../utils/logger';

// Conditionally import BluetoothService with error handling
let BluetoothService = null;

// Check if we're in Expo Go (which doesn't support native Bluetooth)
const isExpoGo = Constants.appOwnership === 'expo';

// Create comprehensive mock service for Expo Go and fallbacks with Berry Med simulation
const createMockBluetoothService = () => {
  let onDeviceFoundCallback = null;
  let onDataReceivedCallback = null;
  let isConnected = false;
  let dataInterval = null;
  
  const mockBerryMedDevice = {
    id: 'mock-berry-med-12345',
    name: 'Berry Med BM1000C',
    localName: 'BM1000C',
    serviceUUIDs: ['49535343-FE7D-4AE5-8FA9-9FAFD205E455'], // BCI service UUID
    deviceType: 'pulse-ox', // Required for device filtering
  };
  
  const generateMockSpO2Data = () => {
    // Generate wide SpO2 range for testing all adaptive instructions
    const baseSpO2 = 80 + Math.random() * 18; // 80-98 range (wider for testing)
    const heartRate = 60 + Math.random() * 40; // 60-100 range
    
    return {
      spo2: Math.round(baseSpO2),
      heartRate: Math.round(heartRate),
      signalStrength: Math.round(Math.random() * 15),
      isFingerDetected: true,
      isSearchingForPulse: false,
      isLowPerfusion: false,
      isMotionDetected: false,
      pleth: Math.round(Math.random() * 127),
      perfusionIndex: null,
      bargraph: null,
      timestamp: Date.now(),
      protocol: 'bci'
    };
  };
  
  return {
    acquireReference: () => {},
    releaseReference: () => {},
    setOnDeviceFound: (callback) => { onDeviceFoundCallback = callback; },
    setOnPulseOximeterData: (callback) => { onDataReceivedCallback = callback; },
    setOnPulseOxDataReceived: (callback) => { onDataReceivedCallback = callback; },
    setOnConnectionChange: () => {},
    startScanning: () => {
      console.log('📱 Mock: Starting scan for Berry Med device...');
      // Simulate device discovery after 2 seconds
      setTimeout(() => {
        if (onDeviceFoundCallback) {
          console.log('📱 Mock: Found Berry Med device');
          onDeviceFoundCallback(mockBerryMedDevice);
        }
      }, 2000);
      return Promise.resolve();
    },
    stopScanning: () => {
      console.log('📱 Mock: Stopping scan');
      return Promise.resolve();
    },
    connectToDevice: (device) => {
      console.log('📱 Mock: Connecting to Berry Med device');
      isConnected = true;
      
      // Start generating mock data every 1 second
      dataInterval = setInterval(async () => {
        if (onDataReceivedCallback && isConnected) {
          const mockData = generateMockSpO2Data();
          console.log('📱 Mock: Generated SpO2 data:', mockData.spo2, 'HR:', mockData.heartRate);
          
          // Send to callback (for UI updates)
          onDataReceivedCallback(mockData);
          
          // Send to session manager if active (for adaptive processing)
          try {
            const { default: EnhancedSessionManager } = await import('../services/EnhancedSessionManager');
            if (EnhancedSessionManager.isActive) {
              EnhancedSessionManager.addReading(mockData);
            }
          } catch (error) {
            // Session manager might not be available, that's okay
          }
        }
      }, 1000);
      
      return Promise.resolve(true);
    },
    disconnectDevice: () => {
      console.log('📱 Mock: Disconnecting device');
      isConnected = false;
      if (dataInterval) {
        clearInterval(dataInterval);
        dataInterval = null;
      }
      return Promise.resolve();
    },
    isPulseOxConnected: isConnected,
    isAnyDeviceConnected: isConnected,
    destroy: () => {
      if (dataInterval) {
        clearInterval(dataInterval);
        dataInterval = null;
      }
    },
    cleanup: () => {
      if (dataInterval) {
        clearInterval(dataInterval);
        dataInterval = null;
      }
    },
    getConnectedDevices: () => isConnected ? [mockBerryMedDevice] : [],
    reconnectDevices: () => Promise.resolve(false),
  };
};

// Check if BLE is available before trying to use real BluetoothService
const isBLEAvailable = () => {
  try {
    // Check if the native BLE module is available
    const { BleManager } = require('react-native-ble-plx');
    return !!BleManager;
  } catch (error) {
    return false;
  }
};

if (isBLEAvailable() && !isExpoGo) {
  try {
    BluetoothService = require('../services/BluetoothService').default;
    console.log('📱 Using real BluetoothService');
  } catch (error) {
    console.log('📱 BluetoothService failed to load - using mock service');
    console.log('Error:', error.message);
    BluetoothService = createMockBluetoothService();
  }
} else {
  console.log('📱 BLE not available or Expo Go detected - using mock service');
  BluetoothService = createMockBluetoothService();
}

const log = logger.createModuleLogger('BluetoothContext');

// Split into two contexts for performance
const BluetoothConnectionContext = createContext();
const BluetoothDataContext = createContext();

export const BluetoothProvider = ({ children }) => {
  // ===== CONNECTION STATE (stable, rarely changes) =====
  const [isScanning, setIsScanning] = useState(false);
  const [isPulseOxConnected, setIsPulseOxConnected] = useState(false);
  const [discoveredDevices, setDiscoveredDevices] = useState([]);
  const [connectedPulseOxDevice, setConnectedPulseOxDevice] = useState(null);
  
  // Import EnhancedSessionManager for BLE device tracking
  const sessionManagerRef = useRef(null);
  useEffect(() => {
    import('../services/EnhancedSessionManager').then(module => {
      sessionManagerRef.current = module.default;
    });
  }, []);

  // ===== DATA STREAMS (high frequency, use refs to avoid re-renders) =====
  const pulseOximeterDataRef = useRef({
    spo2: null,
    heartRate: null,
    signalStrength: null,
    isFingerDetected: false,
    isSearchingForPulse: false,
    pleth: null,
    timestamp: null
  });

  // ===== THROTTLED STATE FOR UI UPDATES =====
  const [pulseOximeterData, setPulseOximeterData] = useState(pulseOximeterDataRef.current);

  // Throttling refs
  const lastUIUpdateRef = useRef(0);
  const UPDATE_THROTTLE_MS = 150; // Max 6-7 UI updates per second

  // Throttled UI update function
  const throttledUIUpdate = useCallback(() => {
    const now = Date.now();
    if (now - lastUIUpdateRef.current >= UPDATE_THROTTLE_MS) {
      lastUIUpdateRef.current = now;
      setPulseOximeterData({...pulseOximeterDataRef.current});
    }
  }, []);

  useEffect(() => {
    // Acquire reference to BluetoothService
    BluetoothService.acquireReference();
    
    // Set up event handler for pulse oximeter
    BluetoothService.setOnDeviceFound((device) => {
      log.info('Context: Device found callback triggered:', device.name || device.localName);
      setDiscoveredDevices(prev => {
        // Avoid duplicates
        const exists = prev.find(d => d.id === device.id);
        if (!exists) {
          log.info('Context: Adding new device to list:', device.name || device.localName);
          const newDevices = [...prev, device];
          log.info('📱 Context: Total devices in list:', newDevices.length);
          return newDevices;
        } else {
          log.info('📱 Context: Device already in list, skipping:', device.name || device.localName);
          return prev;
        }
      });
    });

    BluetoothService.setOnPulseOxDataReceived((data) => {
      // log.info('Context received pulse ox data:', data); // Disabled: high frequency logging
      pulseOximeterDataRef.current = data;
      throttledUIUpdate(); // Use throttled update instead of immediate setState
    });

    // Clean up on unmount
    return () => {
      log.info('Context unmounting, releasing BluetoothService reference');
      BluetoothService.releaseReference();
    };
  }, [throttledUIUpdate]);

  // ===== SCANNING =====
  const startScan = useCallback(async () => {
    try {
      log.info('📱 Context: Starting scan for pulse oximeter');
      setIsScanning(true);
      setDiscoveredDevices([]); // Clear previous devices
      
      await BluetoothService.startScanning('pulse-ox');
      log.info('✅ Context: Scan started successfully');
    } catch (error) {
      log.error('❌ Context: Failed to start scan:', error);
      setIsScanning(false);
      throw error;
    }
  }, []);

  const stopScan = useCallback(async () => {
    try {
      log.info('🛑 Context: Stopping scan');
      await BluetoothService.stopScanning();
      setIsScanning(false);
      log.info('✅ Context: Scan stopped');
    } catch (error) {
      log.error('❌ Context: Failed to stop scan:', error);
      setIsScanning(false);
      throw error;
    }
  }, []);

  // ===== CONNECTION =====
  const connectToDevice = useCallback(async (device) => {
    try {
      log.info(`📱 Context: Connecting to pulse oximeter: ${device.name || device.localName}`);
      console.log('📱 Context: Calling BluetoothService.connectToDevice');
      
      await BluetoothService.connectToDevice(device, 'pulse-ox');
      
      setIsPulseOxConnected(true);
      setConnectedPulseOxDevice(device);
      log.info('✅ Pulse oximeter connected');
      
      // Notify EnhancedSessionManager of connected device for background execution
      if (sessionManagerRef.current) {
        sessionManagerRef.current.setConnectedDevice(device.id);
        log.info('📱 Notified SessionManager of BLE device:', device.id);
      }
      
      // Stop scanning after successful connection
      if (isScanning) {
        await stopScan();
      }
    } catch (error) {
      log.error(`❌ Context: Failed to connect to pulse oximeter:`, error);
      setIsPulseOxConnected(false);
      setConnectedPulseOxDevice(null);
      throw error;
    }
  }, [isScanning, stopScan]);

  const disconnect = useCallback(async () => {
    try {
      log.info('📱 Context: Disconnecting pulse oximeter');
      
      await BluetoothService.disconnect('pulse-ox');
      
      setIsPulseOxConnected(false);
      setConnectedPulseOxDevice(null);
      pulseOximeterDataRef.current = {
        spo2: null,
        heartRate: null,
        signalStrength: null,
        isFingerDetected: false,
        isSearchingForPulse: false,
        pleth: null,
        timestamp: null
      };
      throttledUIUpdate();
      
      // Notify EnhancedSessionManager of disconnection
      if (sessionManagerRef.current) {
        sessionManagerRef.current.clearConnectedDevice();
        log.info('📱 Notified SessionManager of BLE disconnection');
      }
      
      log.info('✅ Pulse oximeter disconnected');
    } catch (error) {
      log.error('❌ Context: Disconnect failed:', error);
      
      // Force cleanup even on error
      setIsPulseOxConnected(false);
      setConnectedPulseOxDevice(null);
      
      // Still notify SessionManager even on error
      if (sessionManagerRef.current) {
        sessionManagerRef.current.clearConnectedDevice();
      }
      
      pulseOximeterDataRef.current = {
        spo2: null,
        heartRate: null,
        signalStrength: null,
        isFingerDetected: false,
        isSearchingForPulse: false,
        pleth: null,
        timestamp: null
      };
      throttledUIUpdate();
      
      throw error;
    }
  }, [throttledUIUpdate]);

  // ===== COMPUTED VALUES =====
  const isAnyDeviceConnected = useMemo(() => isPulseOxConnected, [isPulseOxConnected]);

  // ===== MEMOIZED VALUES =====
  const connectionValue = useMemo(() => ({
    // Scanning
    isScanning,
    startScan,
    stopScan,
    
    // Connection status
    isPulseOxConnected,
    isAnyDeviceConnected,
    
    // Devices
    discoveredDevices,
    connectedPulseOxDevice,
    
    // Actions
    connectToDevice,
    disconnect
  }), [
    isScanning,
    startScan,
    stopScan,
    isPulseOxConnected,
    isAnyDeviceConnected,
    discoveredDevices,
    connectedPulseOxDevice,
    connectToDevice,
    disconnect
  ]);

  const dataValue = useMemo(() => ({
    pulseOximeterData
  }), [pulseOximeterData]);

  return (
    <BluetoothConnectionContext.Provider value={connectionValue}>
      <BluetoothDataContext.Provider value={dataValue}>
        {children}
      </BluetoothDataContext.Provider>
    </BluetoothConnectionContext.Provider>
  );
};

// Custom hooks for accessing Bluetooth functionality
export const useBluetoothConnection = () => {
  const context = useContext(BluetoothConnectionContext);
  if (!context) {
    throw new Error('useBluetoothConnection must be used within BluetoothProvider');
  }
  return context;
};

export const useBluetoothData = () => {
  const context = useContext(BluetoothDataContext);
  if (!context) {
    throw new Error('useBluetoothData must be used within BluetoothProvider');
  }
  return context;
};

// Combined hook for backward compatibility
export const useBluetooth = () => {
  const connection = useBluetoothConnection();
  const data = useBluetoothData();
  return { ...connection, ...data };
};