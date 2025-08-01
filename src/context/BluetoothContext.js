import React, { createContext, useContext, useState, useEffect } from 'react';
import BluetoothService from '../services/BluetoothService';

const BluetoothContext = createContext();

export const BluetoothProvider = ({ children }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [scanType, setScanType] = useState('pulse-ox'); // 'pulse-ox' or 'hr-monitor'
  const [isPulseOxConnected, setIsPulseOxConnected] = useState(false);
  const [isHRConnected, setIsHRConnected] = useState(false);
  const [discoveredDevices, setDiscoveredDevices] = useState([]);
  const [connectedPulseOxDevice, setConnectedPulseOxDevice] = useState(null);
  const [connectedHRDevice, setConnectedHRDevice] = useState(null);
  const [pulseOximeterData, setPulseOximeterData] = useState({
    spo2: null,
    heartRate: null,
    signalStrength: null,
    isFingerDetected: false,
    isSearchingForPulse: false,
    pleth: null,
    timestamp: null
  });
  const [heartRateData, setHeartRateData] = useState({
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
  const [persistentHRV, setPersistentHRV] = useState(null);
  const [lastHRVUpdate, setLastHRVUpdate] = useState(null);

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
          console.log('⚠️ Context: Device already exists in list:', device.name || device.localName);
        }
        return prev;
      });
    });

    BluetoothService.setOnPulseOxDataReceived((data) => {
              // console.log('Context received pulse ox data:', data);
      setPulseOximeterData(data);
    });

    BluetoothService.setOnHRDataReceived((data) => {
      console.log('Context received HR data:', data);
      
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
            processedData.quickHRV = processedData.quickHRV || persistentHRV.quickHRV;
            processedData.realHRV = processedData.realHRV || persistentHRV.realHRV;
          } else {
            // Clear old data
            setPersistentHRV(null);
            setLastHRVUpdate(null);
            console.log(`📊 HRV data expired after ${Math.round(timeSinceLastUpdate/1000)}s`);
          }
        }
      }
      
      setHeartRateData(processedData);
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
      BluetoothService.cleanup();
    };
  }, []);

  const startScanning = async (targetScanType = 'pulse-ox') => {
    try {
      console.log(`🔍 Starting real Bluetooth scan for ${targetScanType}`);
      
      // Check permissions and Bluetooth state first
      const hasPermission = await BluetoothService.requestPermissions();
      if (!hasPermission) {
        throw new Error('Bluetooth permissions not granted');
      }

      const isEnabled = await BluetoothService.isBluetoothEnabled();
      if (!isEnabled) {
        throw new Error('Bluetooth is not enabled');
      }

      setDiscoveredDevices([]); // Clear previous results
      setIsScanning(true);
      setScanType(targetScanType);
      await BluetoothService.startScanning(targetScanType);
    } catch (error) {
      console.error('Error starting scan:', error);
      setIsScanning(false);
      throw error;
    }
  };

  const stopScanning = async () => {
    try {
      await BluetoothService.stopScanning();
      setIsScanning(false);
    } catch (error) {
      console.error('Error stopping scan:', error);
    }
  };

  const connectToDevice = async (device) => {
    try {
      const deviceType = device.deviceType || 'pulse-ox';
      console.log(`Connecting to ${deviceType} device:`, device.name || device.id);
      
      const connectedDevice = await BluetoothService.connectToDevice(device);
      
      if (deviceType === 'pulse-ox') {
        setConnectedPulseOxDevice(device);
        setIsPulseOxConnected(true);
      } else if (deviceType === 'hr-monitor') {
        setConnectedHRDevice(device);
        setIsHRConnected(true);
      }
      
      return connectedDevice;
    } catch (error) {
      console.error('Error connecting to device:', error);
      const deviceType = device.deviceType || 'pulse-ox';
      
      if (deviceType === 'pulse-ox') {
        setIsPulseOxConnected(false);
        setConnectedPulseOxDevice(null);
      } else if (deviceType === 'hr-monitor') {
        setIsHRConnected(false);
        setConnectedHRDevice(null);
      }
      
      throw error;
    }
  };

  const disconnect = async (deviceType = 'all') => {
    try {
      console.log(`🔌 BluetoothContext: Initiating real disconnect for ${deviceType}...`);
      await BluetoothService.disconnect(deviceType);
      
      // Reset connection state based on device type
      if (deviceType === 'pulse-ox' || deviceType === 'all') {
        setIsPulseOxConnected(false);
        setConnectedPulseOxDevice(null);
        setPulseOximeterData({
          spo2: null,
          heartRate: null,
          signalStrength: null,
          isFingerDetected: false,
          isSearchingForPulse: false,
          pleth: null,
          timestamp: null
        });
      }
      
      if (deviceType === 'hr-monitor' || deviceType === 'all') {
        setIsHRConnected(false);
        setConnectedHRDevice(null);
        setHeartRateData({
          heartRate: null,
          sensorContactDetected: false,
          sensorContactSupported: false,
          rrIntervals: [],
          hrv: null,
          timestamp: null
        });
        // Clear persistent HRV state on disconnect/error
        setPersistentHRV(null);
        setLastHRVUpdate(null);
      }
      
      console.log(`✅ BluetoothContext: Disconnect completed for ${deviceType}, state reset`);
    } catch (error) {
      console.error(`❌ BluetoothContext: Error disconnecting ${deviceType}:`, error);
      
      // Still reset state even if disconnect failed
      if (deviceType === 'pulse-ox' || deviceType === 'all') {
        setIsPulseOxConnected(false);
        setConnectedPulseOxDevice(null);
        setPulseOximeterData({
          spo2: null,
          heartRate: null,
          signalStrength: null,
          isFingerDetected: false,
          isSearchingForPulse: false,
          pleth: null,
          timestamp: null
        });
      }
      
      if (deviceType === 'hr-monitor' || deviceType === 'all') {
        setIsHRConnected(false);
        setConnectedHRDevice(null);
        setHeartRateData({
          heartRate: null,
          sensorContactDetected: false,
          sensorContactSupported: false,
          rrIntervals: [],
          hrv: null,
          timestamp: null
        });
        // Clear persistent HRV state on disconnect/error
        setPersistentHRV(null);
        setLastHRVUpdate(null);
      }
    }
  };

  const value = {
    isScanning,
    scanType,
    isPulseOxConnected,
    isHRConnected,
    isAnyDeviceConnected: isPulseOxConnected || isHRConnected,
    discoveredDevices,
    connectedPulseOxDevice,
    connectedHRDevice,
    pulseOximeterData,
    heartRateData,
    startScanning,
    stopScanning,
    connectToDevice,
    disconnect,
    connectionStatus: {
      pulseOx: isPulseOxConnected,
      hrMonitor: isHRConnected,
      any: isPulseOxConnected || isHRConnected
    },
  };

  return (
    <BluetoothContext.Provider value={value}>
      {children}
    </BluetoothContext.Provider>
  );
};

export const useBluetooth = () => {
  const context = useContext(BluetoothContext);
  if (!context) {
    throw new Error('useBluetooth must be used within a BluetoothProvider');
  }
  return context;
}; 