import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import BluetoothService from '../services/BluetoothService';

// Split into two contexts for performance
const BluetoothConnectionContext = createContext();
const BluetoothDataContext = createContext();

export const BluetoothProvider = ({ children }) => {
  // ===== CONNECTION STATE (stable, rarely changes) =====
  const [isScanning, setIsScanning] = useState(false);
  const [scanType, setScanType] = useState('pulse-ox'); // 'pulse-ox' or 'hr-monitor'
  const [isPulseOxConnected, setIsPulseOxConnected] = useState(false);
  const [isHRConnected, setIsHRConnected] = useState(false);
  const [discoveredDevices, setDiscoveredDevices] = useState([]);
  const [connectedPulseOxDevice, setConnectedPulseOxDevice] = useState(null);
  const [connectedHRDevice, setConnectedHRDevice] = useState(null);

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
  
  const heartRateDataRef = useRef({
    heartRate: null,
    sensorContactDetected: false,
    sensorContactSupported: false,
    rrIntervals: [],
    hrv: null, // Legacy field for backward compatibility
    quickHRV: null,
    realHRV: null,
    sessionDuration: null,
    timestamp: null
  });

  // ===== THROTTLED STATE FOR UI UPDATES =====
  const [pulseOximeterData, setPulseOximeterData] = useState(pulseOximeterDataRef.current);
  const [heartRateData, setHeartRateData] = useState(heartRateDataRef.current);
  const [persistentHRV, setPersistentHRV] = useState(null);
  const [lastHRVUpdate, setLastHRVUpdate] = useState(null);

  // Throttling refs
  const lastUIUpdateRef = useRef(0);
  const UPDATE_THROTTLE_MS = 150; // Max 6-7 UI updates per second instead of 20-40

  // Throttled UI update function
  const throttledUIUpdate = useCallback(() => {
    const now = Date.now();
    if (now - lastUIUpdateRef.current >= UPDATE_THROTTLE_MS) {
      lastUIUpdateRef.current = now;
      setPulseOximeterData({...pulseOximeterDataRef.current});
      setHeartRateData({...heartRateDataRef.current});
    }
  }, []);

  useEffect(() => {
    // Set up event handlers for dual device support
    BluetoothService.setOnDeviceFound((device) => {
      console.log('🎯 Context: Device found callback triggered:', device.name || device.localName, 'Type:', device.deviceType);
      setDiscoveredDevices(prev => {
        // Avoid duplicates
        const exists = prev.find(d => d.id === device.id);
        if (!exists) {
          console.log('📱 Context: Adding new device to list:', device.name || device.localName, 'Type:', device.deviceType);
          const newDevices = [...prev, device];
          console.log('📋 Context: Total devices in list:', newDevices.length);
          console.log('📋 Context: All devices:', newDevices.map(d => ({ name: d.name || d.localName, type: d.deviceType })));
          return newDevices;
        } else {
          console.log('📋 Context: Device already in list, skipping:', device.name || device.localName);
          return prev;
        }
      });
    });

    BluetoothService.setOnPulseOxDataReceived((data) => {
      // console.log('Context received pulse ox data:', data); // Disabled: high frequency logging
      pulseOximeterDataRef.current = data;
      throttledUIUpdate(); // Use throttled update instead of immediate setState
    });

    BluetoothService.setOnHRDataReceived((data) => {
      // console.log('Context received HR data:', data); // Disabled: high frequency logging
      
      // Handle dual-timeframe HRV processing
      let processedData = { ...data };
      
      // Apply light smoothing to Quick HRV for stability
      if (data.quickHRV && persistentHRV?.quickHRV) {
        const smoothingFactor = 0.3; // Light smoothing for quick feedback
        processedData.quickHRV = {
          ...data.quickHRV,
          rmssd: Math.round((data.quickHRV.rmssd * smoothingFactor + persistentHRV.quickHRV.rmssd * (1 - smoothingFactor)) * 10) / 10
        };
        console.log(`📊 Quick HRV smoothed: ${persistentHRV.quickHRV.rmssd}ms → ${processedData.quickHRV.rmssd}ms`);
      }
      
      // Real HRV gets minimal smoothing since it's already stable
      if (data.realHRV && persistentHRV?.realHRV) {
        const smoothingFactor = 0.2; // Minimal smoothing for real HRV
        processedData.realHRV = {
          ...data.realHRV,
          rmssd: Math.round((data.realHRV.rmssd * smoothingFactor + persistentHRV.realHRV.rmssd * (1 - smoothingFactor)) * 10) / 10
        };
        console.log(`📊 Real HRV smoothed: ${persistentHRV.realHRV.rmssd}ms → ${processedData.realHRV.rmssd}ms`);
      }
      
      // Update persistent state if we have new HRV data
      if (data.quickHRV || data.realHRV) {
        setPersistentHRV({
          quickHRV: processedData.quickHRV || persistentHRV?.quickHRV,
          realHRV: processedData.realHRV || persistentHRV?.realHRV
        });
        setLastHRVUpdate(Date.now());
      } else {
        // No new HRV calculation, maintain last values for continuity
        if (persistentHRV) {
          const timeSinceLastUpdate = Date.now() - (lastHRVUpdate || 0);
          if (timeSinceLastUpdate < 15000) {
            // Keep existing values if recent
            processedData.quickHRV = persistentHRV.quickHRV;
            processedData.realHRV = persistentHRV.realHRV;
          }
        }
      }
      
      heartRateDataRef.current = processedData;
      throttledUIUpdate(); // Use throttled update instead of immediate setState
    });

    BluetoothService.setOnConnectionStatusChanged((deviceType, connected) => {
      console.log(`${deviceType} connection status changed:`, connected);
      if (deviceType === 'pulse-ox') {
        setIsPulseOxConnected(connected);
        if (!connected) {
          setConnectedPulseOxDevice(null);
        }
      } else if (deviceType === 'hr-monitor') {
        setIsHRConnected(connected);
        if (!connected) {
          setConnectedHRDevice(null);
        }
      }
    });

    return () => {
      BluetoothService.clearHandlers();
    };
  }, [throttledUIUpdate, persistentHRV, lastHRVUpdate]);

  // ===== MEMOIZED CONNECTION FUNCTIONS =====
  const startScanning = useCallback(async (type = 'pulse-ox') => {
    console.log(`🔍 Context: Starting scan for ${type}`);
    setScanType(type);
    setIsScanning(true);
    setDiscoveredDevices([]);
    
    try {
      await BluetoothService.startScanning(type);
    } catch (error) {
      console.error('❌ Context: Scan failed:', error);
      setIsScanning(false);
    }
  }, []);

  const stopScanning = useCallback(async () => {
    console.log('⏹️ Context: Stopping scan');
    setIsScanning(false);
    try {
      await BluetoothService.stopScanning();
    } catch (error) {
      console.error('❌ Context: Stop scan failed:', error);
    }
  }, []);

  const connectToDevice = useCallback(async (device) => {
    const deviceType = device.deviceType || 'pulse-ox';
    console.log(`🔗 Context: Connecting to ${deviceType}:`, device.name || device.localName);
    
    try {
      const success = await BluetoothService.connectToDevice(device, deviceType);
      if (success) {
        if (deviceType === 'pulse-ox') {
          setIsPulseOxConnected(true);
          setConnectedPulseOxDevice(device);
        } else if (deviceType === 'hr-monitor') {
          setIsHRConnected(true);
          setConnectedHRDevice(device);
        }
        console.log(`✅ Context: Connected to ${deviceType}:`, device.name || device.localName);
      }
      return success;
    } catch (error) {
      console.error(`❌ Context: Failed to connect to ${deviceType}:`, error);
      return false;
    }
  }, []);

  const disconnect = useCallback(async (deviceType = 'all') => {
    console.log(`❌ Context: Disconnecting ${deviceType}`);
    
    try {
      await BluetoothService.disconnect(deviceType);
      
      if (deviceType === 'pulse-ox' || deviceType === 'all') {
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
      }
      
      if (deviceType === 'hr-monitor' || deviceType === 'all') {
        setIsHRConnected(false);
        setConnectedHRDevice(null);
        heartRateDataRef.current = {
          heartRate: null,
          sensorContactDetected: false,
          sensorContactSupported: false,
          rrIntervals: [],
          hrv: null,
          quickHRV: null,
          realHRV: null,
          sessionDuration: null,
          timestamp: null
        };
        throttledUIUpdate();
        // Clear persistent HRV state on disconnect
        setPersistentHRV(null);
        setLastHRVUpdate(null);
      }
    } catch (error) {
      console.error(`❌ Context: Disconnect failed for ${deviceType}:`, error);
      
      if (deviceType === 'pulse-ox' || deviceType === 'all') {
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
      }
      
      if (deviceType === 'hr-monitor' || deviceType === 'all') {
        setIsHRConnected(false);
        setConnectedHRDevice(null);
        heartRateDataRef.current = {
          heartRate: null,
          sensorContactDetected: false,
          sensorContactSupported: false,
          rrIntervals: [],
          hrv: null,
          quickHRV: null,
          realHRV: null,
          sessionDuration: null,
          timestamp: null
        };
        throttledUIUpdate();
        // Clear persistent HRV state on disconnect/error
        setPersistentHRV(null);
        setLastHRVUpdate(null);
      }
    }
  }, [throttledUIUpdate]);

  // ===== MEMOIZED CONTEXT VALUES =====
  const connectionValue = useMemo(() => ({
    isScanning,
    scanType,
    isPulseOxConnected,
    isHRConnected,
    isAnyDeviceConnected: isPulseOxConnected || isHRConnected,
    discoveredDevices,
    connectedPulseOxDevice,
    connectedHRDevice,
    startScanning,
    stopScanning,
    connectToDevice,
    disconnect,
    connectionStatus: {
      pulseOx: isPulseOxConnected,
      hrMonitor: isHRConnected,
      any: isPulseOxConnected || isHRConnected
    },
  }), [
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
    disconnect
  ]);

  const dataValue = useMemo(() => ({
    pulseOximeterData,
    heartRateData,
    persistentHRV,
    lastHRVUpdate
  }), [pulseOximeterData, heartRateData, persistentHRV, lastHRVUpdate]);

  return (
    <BluetoothConnectionContext.Provider value={connectionValue}>
      <BluetoothDataContext.Provider value={dataValue}>
        {children}
      </BluetoothDataContext.Provider>
    </BluetoothConnectionContext.Provider>
  );
};

// ===== SEPARATE HOOKS FOR PERFORMANCE =====
export const useBluetoothConnection = () => {
  const context = useContext(BluetoothConnectionContext);
  if (!context) {
    throw new Error('useBluetoothConnection must be used within a BluetoothProvider');
  }
  return context;
};

export const useBluetoothData = () => {
  const context = useContext(BluetoothDataContext);
  if (!context) {
    throw new Error('useBluetoothData must be used within a BluetoothProvider');
  }
  return context;
};

// ===== LEGACY HOOK FOR BACKWARD COMPATIBILITY =====
export const useBluetooth = () => {
  const connectionContext = useContext(BluetoothConnectionContext);
  const dataContext = useContext(BluetoothDataContext);
  
  if (!connectionContext || !dataContext) {
    throw new Error('useBluetooth must be used within a BluetoothProvider');
  }
  
  // Combine both contexts for backward compatibility
  return {
    ...connectionContext,
    ...dataContext
  };
}; 