/**
 * MockBLEServiceWrapper - Wraps MockBLEService to match BluetoothService interface
 * This provides all the methods expected by BluetoothContext while using MockBLEService for data
 */

import { mockBLEService } from './MockBLEService';

class MockBLEServiceWrapper {
  constructor() {
    this.mockService = mockBLEService;
    this.deviceFoundCallback = null;
    this.pulseOxDataCallback = null;
    this.connectionChangeCallback = null;
    this.isPulseOxConnected = false;
    this.isAnyDeviceConnected = false;
    this.referenceCount = 0;
    this.dataSubscription = null;
    
    // Auto-connect to mock device on initialization
    setTimeout(() => {
      this.autoConnect();
    }, 1000);
  }
  
  // Reference counting (required by BluetoothContext)
  acquireReference() {
    this.referenceCount++;
    console.log(`📱 MockBLE: Reference acquired (count: ${this.referenceCount})`);
  }
  
  releaseReference() {
    this.referenceCount = Math.max(0, this.referenceCount - 1);
    console.log(`📱 MockBLE: Reference released (count: ${this.referenceCount})`);
  }
  
  // Update current cycle for mock data generation
  setCycle(cycle) {
    if (this.mockService.setCycle) {
      this.mockService.setCycle(cycle);
    }
  }
  
  // Device discovery
  setOnDeviceFound(callback) {
    this.deviceFoundCallback = callback;
  }
  
  // Data callbacks
  setOnPulseOximeterData(callback) {
    // Just store the callback, don't subscribe here
    this.pulseOxDataCallback = callback;
  }
  
  setOnPulseOxDataReceived(callback) {
    console.log('📱 MockBLE: setOnPulseOxDataReceived called');
    this.pulseOxDataCallback = callback;
    
    // Only subscribe once, here
    if (callback && !this.dataSubscription) {
      this.dataSubscription = this.mockService.onData((data) => {
        if (this.isPulseOxConnected && this.pulseOxDataCallback) {
          const pulseData = {
            spo2: data.spo2,
            heartRate: data.heartRate,
            signalStrength: data.signalQuality,
            isFingerDetected: true,
            isSearchingForPulse: false,
            pleth: Math.random() * 100,
            timestamp: data.timestamp
          };
          console.log('📊 MockBLE: Sending pulse ox data:', pulseData);
          this.pulseOxDataCallback(pulseData);
        }
      });
    }
  }
  
  setOnConnectionChange(callback) {
    this.connectionChangeCallback = callback;
  }
  
  // Scanning
  async startScan(deviceType) {
    console.log(`📱 MockBLE: Starting scan for ${deviceType}...`);
    const devices = await this.mockService.searchForDevices();
    
    // Simulate finding devices
    if (this.deviceFoundCallback) {
      devices.forEach(device => {
        this.deviceFoundCallback({
          id: device.id,
          name: device.name,
          rssi: device.rssi,
          isConnectable: true
        });
      });
    }
    
    return true;
  }
  
  async stopScan() {
    console.log('📱 MockBLE: Stopping scan');
    return true;
  }
  
  // Alias for backward compatibility
  async stopScanning() {
    return this.stopScan();
  }
  
  // Connection
  async connectToDevice(device, deviceType) {
    const deviceId = typeof device === 'string' ? device : device.id;
    console.log(`📱 MockBLE: Connecting to ${deviceType} device ${deviceId}...`);
    const connected = await this.mockService.connect();
    
    if (connected) {
      this.isPulseOxConnected = true;
      this.isAnyDeviceConnected = true;
      
      if (this.connectionChangeCallback) {
        this.connectionChangeCallback({
          deviceId,
          connected: true,
          deviceType: 'pulseOximeter'
        });
      }
      
      console.log('✅ MockBLE: Connected to pulse oximeter');
    }
    
    return connected;
  }
  
  async disconnect(deviceType) {
    console.log(`📱 MockBLE: Disconnecting ${deviceType}`);
    this.mockService.disconnect();
    this.isPulseOxConnected = false;
    this.isAnyDeviceConnected = false;
    
    if (this.connectionChangeCallback) {
      this.connectionChangeCallback({
        deviceId: 'mock-pulse-ox',
        connected: false,
        deviceType: 'pulseOximeter'
      });
    }
    
    return true;
  }
  
  // Alias for backward compatibility
  async disconnectDevice(deviceId) {
    return this.disconnect('pulse-ox');
  }
  
  // Auto-connect for easy testing
  async autoConnect() {
    console.log('🚀 MockBLE: Auto-connecting to mock pulse oximeter...');
    
    // Simulate device discovery
    if (this.deviceFoundCallback) {
      console.log('📱 MockBLE: Notifying device found callback');
      this.deviceFoundCallback({
        id: 'mock-pulse-ox',
        name: 'Mock Pulse Oximeter',
        rssi: -45,
        isConnectable: true
      });
    } else {
      console.warn('⚠️ MockBLE: No device found callback registered');
    }
    
    // Auto-connect
    const connected = await this.connectToDevice('mock-pulse-ox', 'pulse-ox');
    console.log(`📱 MockBLE: Auto-connect result: ${connected ? 'SUCCESS' : 'FAILED'}`);
    return connected;
  }
  
  // Utility methods
  destroy() {
    this.mockService.disconnect();
    this.deviceFoundCallback = null;
    this.pulseOxDataCallback = null;
    this.connectionChangeCallback = null;
  }
  
  cleanup() {
    this.destroy();
  }
  
  getConnectedDevices() {
    return this.isPulseOxConnected ? ['mock-pulse-ox'] : [];
  }
  
  async reconnectDevices() {
    if (!this.isPulseOxConnected) {
      return await this.autoConnect();
    }
    return true;
  }
  
  // Phase control for testing
  setPhase(phase) {
    this.mockService.setPhase(phase);
  }
  
  // Session control - important for starting mock data generation
  startSession() {
    console.log('🚀 MockBLEWrapper: Starting session - activating mock data generation');
    if (this.mockService.startSession) {
      this.mockService.startSession();
    }
  }
  
  endSession() {
    console.log('🛑 MockBLEWrapper: Ending session - stopping mock data generation');
    if (this.mockService.endSession) {
      this.mockService.endSession();
    }
  }
}

export default new MockBLEServiceWrapper();