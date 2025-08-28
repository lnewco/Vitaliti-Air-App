/**
 * BluetoothServiceRefactored - Compatibility wrapper for new modular architecture
 * 
 * This file provides backward compatibility while migrating to the new
 * modular Bluetooth architecture. It wraps the new BluetoothCoordinator
 * to maintain the same API as the original BluetoothService.
 */

let BluetoothCoordinator;
try {
  BluetoothCoordinator = require('./bluetooth/BluetoothCoordinator').default;
  console.log('✅ BluetoothCoordinator loaded successfully');
} catch (error) {
  console.error('❌ Failed to load BluetoothCoordinator:', error);
  // Fallback to original BluetoothService
  BluetoothCoordinator = require('./BluetoothService').default;
  console.log('⚠️ Falling back to original BluetoothService');
}

class BluetoothServiceRefactored {
  constructor() {
    // Map old properties to coordinator
    this.coordinator = BluetoothCoordinator;
    this.initialized = false;
  }

  async ensureInitialized() {
    if (!this.initialized) {
      await this.coordinator.initialize();
      this.initialized = true;
    }
  }

  // Reference counting (compatibility)
  acquireReference() {
    return this.coordinator.acquireReference();
  }
  
  releaseReference() {
    return this.coordinator.releaseReference();
  }

  // Permissions
  async requestPermissions() {
    return this.coordinator.requestPermissions();
  }

  async isBluetoothEnabled() {
    return this.coordinator.isBluetoothEnabled();
  }

  // Scanning
  async startScan(deviceType = 'pulse-ox') {
    try {
      console.log('🔍 StartScan called, ensuring initialized...');
      await this.ensureInitialized();
      console.log('🔍 Initialized, coordinator is:', this.coordinator);
      console.log('🔍 Coordinator.startScan is:', this.coordinator.startScan);
      
      if (!this.coordinator.startScan) {
        console.error('❌ coordinator.startScan is undefined!');
        console.log('🔍 Available methods:', Object.keys(this.coordinator));
      }
      
      return await this.coordinator.startScan(deviceType);
    } catch (error) {
      console.error('StartScan error:', error);
      console.error('Error stack:', error.stack);
      throw error;
    }
  }

  async startScanning(deviceType = 'pulse-ox') {
    return this.startScan(deviceType);
  }

  async stopScan() {
    return this.coordinator.stopScan();
  }

  async stopScanning() {
    return this.stopScan();
  }

  // Connection
  async connectToDevice(device) {
    return this.coordinator.connectToDevice(device);
  }

  async disconnect(deviceType = 'all') {
    return this.coordinator.disconnect(deviceType);
  }

  async restartScanningForMissingDevices() {
    return this.coordinator.restartScanningForMissingDevices();
  }

  // Cleanup
  cleanup() {
    return this.coordinator.cleanup();
  }

  // Callbacks
  setOnDeviceFound(callback) {
    this.coordinator.setOnDeviceFound(callback);
  }

  setOnPulseOxDataReceived(callback) {
    this.coordinator.setOnPulseOxDataReceived(callback);
  }

  setOnConnectionStatusChanged(callback) {
    this.coordinator.setOnConnectionStatusChanged(callback);
  }

  // Properties (getters for compatibility)
  get isAnyDeviceConnected() {
    return this.coordinator.isAnyDeviceConnected;
  }

  get isPulseOxConnected() {
    return this.coordinator.isPulseOxConnected;
  }

  get connectionStatus() {
    return this.coordinator.connectionStatus;
  }

  get isScanning() {
    return this.coordinator.isScanning;
  }

  // Legacy properties that may be referenced
  get pulseOxDevice() {
    const status = this.coordinator.connectionStatus;
    const pulseOx = status.devices.find(d => d.type === 'pulse-ox');
    return pulseOx ? { id: pulseOx.id, name: pulseOx.name } : null;
  }

  get manager() {
    // Return coordinator's manager if needed for legacy code
    return this.coordinator.manager;
  }
}

// Create singleton instance
const bluetoothServiceRefactored = new BluetoothServiceRefactored();

export default bluetoothServiceRefactored;