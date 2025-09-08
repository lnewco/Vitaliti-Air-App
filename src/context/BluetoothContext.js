import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Constants from 'expo-constants';
import logger from '../utils/logger';

// Conditionally import BluetoothService with error handling
let BluetoothService = null;

// Check if we're in Expo Go (which doesn't support native Bluetooth)
const isExpoGo = Constants.appOwnership === 'expo';

if (isExpoGo) {
  console.log('📱 Expo Go detected - using MockBLEServiceWrapper for data generation');
  // Use the MockBLEServiceWrapper that provides full interface
  try {
    BluetoothService = require('../services/MockBLEServiceWrapper').default;
    console.log('✅ MockBLEServiceWrapper loaded successfully');
  } catch (error) {
    console.error('❌ Failed to load MockBLEServiceWrapper:', error);
    // Fallback to basic mock if MockBLEServiceWrapper fails
    BluetoothService = {
      acquireReference: () => {},
      releaseReference: () => {},
      setOnDeviceFound: () => {},
      setOnPulseOximeterData: () => {},
      setOnPulseOxDataReceived: () => {},
      setOnConnectionChange: () => {},
      startScanning: () => Promise.resolve(),
      stopScanning: () => Promise.resolve(),
      connectToDevice: () => Promise.resolve(false),
      disconnectDevice: () => Promise.resolve(),
      isPulseOxConnected: false,
      isAnyDeviceConnected: false,
      destroy: () => {},
      cleanup: () => {},
      getConnectedDevices: () => [],
      reconnectDevices: () => Promise.resolve(false),
    };
  }
} else {
  try {
    BluetoothService = require('../services/BluetoothService').default;
    console.log('📱 Using real BluetoothService for EAS build');
  } catch (error) {
    console.log('📱 BluetoothService not available - using MockBLEService');
    try {
      BluetoothService = require('../services/MockBLEService').default;
    } catch (mockError) {
      console.error('❌ Both services failed, using basic mock');
      BluetoothService = {
        acquireReference: () => {},
        releaseReference: () => {},
        setOnDeviceFound: () => {},
        setOnPulseOximeterData: () => {},
        setOnPulseOxDataReceived: () => {},
        setOnConnectionChange: () => {},
        startScanning: () => Promise.resolve(),
        stopScanning: () => Promise.resolve(),
        connectToDevice: () => Promise.resolve(false),
        disconnectDevice: () => Promise.resolve(),
        isPulseOxConnected: false,
        isAnyDeviceConnected: false,
        destroy: () => {},
        cleanup: () => {},
        getConnectedDevices: () => [],
        reconnectDevices: () => Promise.resolve(false),
      };
    }
  }
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
    
    // Make service globally available for EnhancedSessionManager
    global.bluetoothService = BluetoothService;
    
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
      console.log('🔵 BluetoothContext received data:', {
        spo2: data.spo2,
        heartRate: data.heartRate
      });
      pulseOximeterDataRef.current = data;
      throttledUIUpdate(); // Use throttled update instead of immediate setState
    });

    // Set up connection status listener
    BluetoothService.setOnConnectionChange((status) => {
      console.log('🔵 BluetoothContext connection status changed:', status);
      if (status.deviceType === 'pulseOximeter') {
        setIsPulseOxConnected(status.connected);
        if (status.connected) {
          console.log('✅ Pulse oximeter connected in context');
        } else {
          console.log('❌ Pulse oximeter disconnected in context');
        }
      }
    });

    // Check initial connection status for mock device
    if (isExpoGo) {
      // In Expo Go, the mock device auto-connects
      setTimeout(() => {
        console.log('🔵 Setting mock device as connected');
        setIsPulseOxConnected(true);
      }, 2000);
    }

    // Clean up on unmount
    return () => {
      log.info('Context unmounting, releasing BluetoothService reference');
      BluetoothService.releaseReference();
    };
  }, [throttledUIUpdate]);

  // ===== SESSION CONTROL =====
  const startSession = useCallback(() => {
    console.log('🚀 BluetoothContext: Starting session');
    if (BluetoothService.startSession) {
      BluetoothService.startSession();
    }
  }, []);
  
  const endSession = useCallback(() => {
    console.log('🛑 BluetoothContext: Ending session');
    if (BluetoothService.endSession) {
      BluetoothService.endSession();
    }
  }, []);
  
  // ===== SCANNING =====
  const startScan = useCallback(async () => {
    try {
      log.info('📱 Context: Starting scan for pulse oximeter');
      setIsScanning(true);
      setDiscoveredDevices([]); // Clear previous devices
      
      await BluetoothService.startScan('pulse-ox');
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
      await BluetoothService.stopScan();
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
      
      await BluetoothService.connectToDevice(device, 'pulse-ox');
      
      setIsPulseOxConnected(true);
      setConnectedPulseOxDevice(device);
      log.info('✅ Pulse oximeter connected');
      
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
      
      log.info('✅ Pulse oximeter disconnected');
    } catch (error) {
      log.error('❌ Context: Disconnect failed:', error);
      
      // Force cleanup even on error
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
    disconnect,
    
    // Session control
    startSession,
    endSession
  }), [
    isScanning,
    startScan,
    stopScan,
    isPulseOxConnected,
    isAnyDeviceConnected,
    discoveredDevices,
    connectedPulseOxDevice,
    connectToDevice,
    disconnect,
    startSession,
    endSession
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