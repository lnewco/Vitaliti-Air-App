import React, { createContext, useContext, useState, useEffect } from 'react';
import BluetoothService from '../services/BluetoothService';

const BluetoothContext = createContext();

export const BluetoothProvider = ({ children }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [discoveredDevices, setDiscoveredDevices] = useState([]);
  const [connectedDevice, setConnectedDevice] = useState(null);
  const [pulseOximeterData, setPulseOximeterData] = useState({
    spo2: null,
    heartRate: null,
    signalStrength: null,
    isFingerDetected: false,
    isSearchingForPulse: false,
    pleth: null,
    timestamp: null
  });

  useEffect(() => {
    // Set up event handlers
    BluetoothService.setOnDeviceFound((device) => {
      console.log('🎯 Context: Device found callback triggered:', device.name || device.localName);
      setDiscoveredDevices(prev => {
        // Avoid duplicates
        const exists = prev.find(d => d.id === device.id);
        if (!exists) {
          console.log('📱 Context: Adding new device to list:', device.name || device.localName);
          const newDevices = [...prev, device];
          console.log('📋 Context: Total devices in list:', newDevices.length);
          return newDevices;
        } else {
          console.log('⚠️ Context: Device already exists in list:', device.name || device.localName);
        }
        return prev;
      });
    });

    BluetoothService.setOnDataReceived((data) => {
      console.log('Context received BCI data:', data);
      setPulseOximeterData(data);
    });

    BluetoothService.setOnConnectionStatusChanged((connected) => {
      console.log('Connection status changed:', connected);
      setIsConnected(connected);
      if (!connected) {
        setConnectedDevice(null);
      }
    });

    return () => {
      BluetoothService.cleanup();
    };
  }, []);

  const startScanning = async () => {
    try {
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
      await BluetoothService.startScanning();
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
      console.log('Connecting to device:', device.name || device.id);
      const connectedDevice = await BluetoothService.connectToDevice(device);
      setConnectedDevice(device);
      setIsConnected(true);
      return connectedDevice;
    } catch (error) {
      console.error('Error connecting to device:', error);
      setIsConnected(false);
      setConnectedDevice(null);
      throw error;
    }
  };

  const disconnect = async () => {
    try {
      console.log('🔌 BluetoothContext: Initiating disconnect...');
      await BluetoothService.disconnect();
      
      // Reset all connection state
      setIsConnected(false);
      setConnectedDevice(null);
      setPulseOximeterData({
        spo2: null,
        heartRate: null,
        signalStrength: null,
        isFingerDetected: false,
        isSearchingForPulse: false,
        pleth: null,
        timestamp: null
      });
      
      console.log('✅ BluetoothContext: Disconnect completed, state reset');
    } catch (error) {
      console.error('❌ BluetoothContext: Error disconnecting:', error);
      
      // Still reset state even if disconnect failed
      setIsConnected(false);
      setConnectedDevice(null);
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
  };

  const value = {
    isScanning,
    isConnected,
    discoveredDevices,
    connectedDevice,
    pulseOximeterData,
    startScanning,
    stopScanning,
    connectToDevice,
    disconnect,
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