/**
 * BluetoothCoordinator - Main orchestrator for Bluetooth operations
 * Coordinates scanner, permissions, and connection manager
 */

import { BleManager } from 'react-native-ble-plx';
import BluetoothScanner from './BluetoothScanner';
import BluetoothPermissions from './BluetoothPermissions';
import BluetoothConnectionManager from './BluetoothConnectionManager';
import EnhancedSessionManager from '../EnhancedSessionManager';
import logger from '../../utils/logger';

const log = logger.createModuleLogger('BluetoothCoordinator');

class BluetoothCoordinator {
  constructor() {
    // Initialize BLE manager
    this.manager = null;
    this.isDestroyed = false;
    this.referenceCount = 0;
    
    // Sub-services
    this.scanner = null;
    this.permissions = null;
    this.connectionManager = null;
    
    // Callbacks
    this.onDeviceFound = null;
    this.onPulseOxDataReceived = null;
    this.onConnectionStatusChanged = null;
    
    // Initialize on first use
    this.initPromise = null;
  }

  /**
   * Initialize coordinator and sub-services
   */
  async initialize() {
    if (this.initPromise) {
      return this.initPromise;
    }
    
    this.initPromise = this._doInitialize();
    return this.initPromise;
  }

  async _doInitialize() {
    try {
      log.info('🔄 Initializing Bluetooth Coordinator');
      
      // Create BLE manager
      this.manager = new BleManager();
      this.isDestroyed = false;
      
      // Create sub-services
      this.scanner = new BluetoothScanner(this.manager);
      this.permissions = new BluetoothPermissions(this.manager);
      this.connectionManager = new BluetoothConnectionManager(this.manager);
      
      // Setup connection callbacks
      this.connectionManager.setCallbacks(
        this.handleDataReceived.bind(this),
        this.handleConnectionStatusChange.bind(this)
      );
      
      log.info('✅ Bluetooth Coordinator initialized');
      
    } catch (error) {
      log.error('Failed to initialize Bluetooth Coordinator:', error);
      throw error;
    }
  }

  /**
   * Reference counting for lifecycle management
   */
  acquireReference() {
    this.referenceCount++;
    log.info(`📱 Reference acquired (count: ${this.referenceCount})`);
    
    // Recreate manager if destroyed
    if ((!this.manager || this.isDestroyed) && this.referenceCount > 0) {
      this._doInitialize();
    }
    
    return this.referenceCount;
  }

  releaseReference() {
    if (this.referenceCount > 0) {
      this.referenceCount--;
      log.info(`📱 Reference released (count: ${this.referenceCount})`);
      
      if (this.referenceCount === 0) {
        setTimeout(() => {
          if (this.referenceCount === 0) {
            this.cleanup();
          }
        }, 500);
      }
    }
  }

  /**
   * Request permissions
   */
  async requestPermissions() {
    await this.initialize();
    return this.permissions.requestPermissions();
  }

  /**
   * Check if Bluetooth is enabled
   */
  async isBluetoothEnabled() {
    await this.initialize();
    return this.permissions.isBluetoothEnabled();
  }

  /**
   * Start scanning for devices
   */
  async startScan(deviceType = 'pulse-ox') {
    await this.initialize();
    
    // Check permissions first
    const hasPermissions = await this.requestPermissions();
    if (!hasPermissions) {
      log.error('Cannot scan without permissions');
      return false;
    }
    
    // Check if Bluetooth is enabled
    const isEnabled = await this.isBluetoothEnabled();
    if (!isEnabled) {
      log.error('Cannot scan - Bluetooth is disabled');
      return false;
    }
    
    // Start scanning
    await this.scanner.startScanning(
      deviceType,
      this.handleDeviceFound.bind(this)
    );
    
    return true;
  }

  /**
   * Stop scanning
   */
  async stopScan() {
    if (this.scanner) {
      await this.scanner.stopScanning();
    }
  }

  /**
   * Connect to device
   */
  async connectToDevice(device) {
    await this.initialize();
    
    const success = await this.connectionManager.connect(device);
    
    if (success) {
      // Notify Enhanced Session Manager
      if (EnhancedSessionManager && EnhancedSessionManager.setConnectedDevice) {
        EnhancedSessionManager.setConnectedDevice(device.id);
      }
    }
    
    return success;
  }

  /**
   * Disconnect device(s)
   */
  async disconnect(deviceType = 'all') {
    if (!this.connectionManager) {
      return;
    }
    
    if (deviceType === 'all') {
      await this.connectionManager.disconnect();
      
      // Clear from Enhanced Session Manager
      if (EnhancedSessionManager && EnhancedSessionManager.clearConnectedDevice) {
        EnhancedSessionManager.clearConnectedDevice();
      }
    } else {
      // Find and disconnect specific device type
      const status = this.connectionManager.connectionStatus;
      for (const device of status.devices) {
        if (device.type === deviceType) {
          await this.connectionManager.disconnect(device.id);
        }
      }
    }
  }

  /**
   * Handle device discovery
   */
  handleDeviceFound(device, deviceType) {
    log.info(`📱 Device found: ${device.name} (type: ${deviceType})`);
    
    if (this.onDeviceFound) {
      this.onDeviceFound(device);
    }
  }

  /**
   * Handle data received from device
   */
  handleDataReceived(data) {
    // Forward to callback
    if (this.onPulseOxDataReceived && data) {
      // Extract key fields for compatibility
      const compatData = {
        spo2: data.spo2,
        heartRate: data.heartRate,
        perfusionIndex: data.perfusionIndex,
        signalStrength: data.signalStrength,
        isFingerDetected: data.isFingerDetected,
        deviceId: data.deviceId,
        timestamp: data.timestamp
      };
      
      this.onPulseOxDataReceived(compatData);
      
      // Also send to Enhanced Session Manager
      if (EnhancedSessionManager && EnhancedSessionManager.isActive) {
        EnhancedSessionManager.addReading(compatData);
      }
    }
  }

  /**
   * Handle connection status changes
   */
  handleConnectionStatusChange(status) {
    log.info(`📱 Connection status changed:`, status);
    
    if (this.onConnectionStatusChanged) {
      this.onConnectionStatusChanged(status);
    }
    
    // Update Enhanced Session Manager
    if (!status.isConnected && EnhancedSessionManager) {
      if (EnhancedSessionManager.isActive) {
        log.warn('⚠️ Device disconnected during active session');
      }
      EnhancedSessionManager.clearConnectedDevice();
    }
  }

  /**
   * Restart scanning for missing devices
   */
  async restartScanningForMissingDevices() {
    const status = this.connectionStatus;
    
    if (!status.isAnyConnected) {
      log.info('🔄 No devices connected, restarting scan...');
      await this.startScan('pulse-ox');
      
      // Auto-stop after 10 seconds
      setTimeout(() => {
        this.stopScan();
      }, 10000);
    }
  }

  /**
   * Set callback functions
   */
  setOnDeviceFound(callback) {
    this.onDeviceFound = callback;
  }

  setOnPulseOxDataReceived(callback) {
    this.onPulseOxDataReceived = callback;
  }

  setOnConnectionStatusChanged(callback) {
    this.onConnectionStatusChanged = callback;
  }

  /**
   * Get connection status
   */
  get connectionStatus() {
    if (!this.connectionManager) {
      return {
        isAnyConnected: false,
        connectedCount: 0,
        devices: []
      };
    }
    
    return this.connectionManager.connectionStatus;
  }

  /**
   * Check if any device is connected
   */
  get isAnyDeviceConnected() {
    return this.connectionStatus.isAnyConnected;
  }

  /**
   * Check if pulse oximeter is connected
   */
  get isPulseOxConnected() {
    return this.connectionManager?.isDeviceTypeConnected('pulse-ox') || false;
  }

  /**
   * Check if currently scanning
   */
  get isScanning() {
    return this.scanner?.scanning || false;
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    log.info('🧹 Cleaning up Bluetooth Coordinator...');
    
    // Stop scanning
    if (this.scanner) {
      await this.scanner.stopScanning();
    }
    
    // Disconnect all devices
    if (this.connectionManager) {
      await this.connectionManager.cleanup();
    }
    
    // Destroy BLE manager
    if (this.manager && !this.isDestroyed) {
      try {
        this.manager.destroy();
        this.isDestroyed = true;
      } catch (error) {
        log.error('Error destroying BLE manager:', error);
      }
    }
    
    // Clear references
    this.scanner = null;
    this.permissions = null;
    this.connectionManager = null;
    this.manager = null;
    
    log.info('✅ Bluetooth Coordinator cleaned up');
  }
}

// Create singleton instance
const bluetoothCoordinator = new BluetoothCoordinator();

export default bluetoothCoordinator;