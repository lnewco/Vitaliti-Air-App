/**
 * BluetoothConnectionManager - Manages BLE connections and data subscriptions
 */

import { Buffer } from 'buffer';
import ProtocolFactory from './protocols/ProtocolFactory';
import { WELLUE_UUIDS } from './protocols/wellue/WellueConstants';
import { BCI_UUIDS } from './protocols/bci/BCIConstants';
import logger from '../../utils/logger';

const log = logger.createModuleLogger('BluetoothConnection');

class BluetoothConnectionManager {
  constructor(bleManager) {
    this.manager = bleManager;
    this.connectedDevices = new Map();
    this.subscriptions = new Map();
    this.dataIntervals = new Map();
    
    // Callbacks
    this.onDataReceived = null;
    this.onConnectionStatusChanged = null;
    
    // Recovery settings
    this.connectionRecoveryTimer = null;
    this.lastDisconnectTime = null;
    this.RECOVERY_DELAY = 2000;
    this.MAX_RECOVERY_ATTEMPTS = 3;
  }

  /**
   * Connect to a BLE device
   */
  async connect(device) {
    try {
      log.info(`📱 Connecting to ${device.name} (${device.id})...`);
      
      // Check if already connected
      if (this.connectedDevices.has(device.id)) {
        log.warn('Device already connected');
        return true;
      }
      
      // Connect to device
      await device.connect();
      log.info(`✅ Connected to ${device.name}`);
      
      // Discover services and characteristics
      await device.discoverAllServicesAndCharacteristics();
      log.info('🔍 Services discovered');
      
      // Get protocol handler
      const protocolHandler = ProtocolFactory.getProtocolHandler(device);
      if (!protocolHandler) {
        throw new Error('No protocol handler found for device');
      }
      
      // Store connection info
      this.connectedDevices.set(device.id, {
        device,
        protocolHandler,
        type: this.getDeviceType(device),
        connectedAt: Date.now(),
        recoveryAttempts: 0
      });
      
      // Setup notifications based on device type
      const success = await this.setupNotifications(device, protocolHandler);
      
      if (success) {
        // Notify connection status
        this.notifyConnectionStatus(device.id, true);
        
        // Setup disconnection handler
        device.onDisconnected((error) => {
          this.handleDisconnection(device.id, error);
        });
        
        return true;
      }
      
      throw new Error('Failed to setup notifications');
      
    } catch (error) {
      log.error(`❌ Connection failed: ${error.message}`);
      
      // Clean up on failure
      try {
        await device.cancelConnection();
      } catch (e) {
        // Ignore cleanup errors
      }
      
      this.connectedDevices.delete(device.id);
      ProtocolFactory.clearProtocol(device.id);
      
      return false;
    }
  }

  /**
   * Setup characteristic notifications
   */
  async setupNotifications(device, protocolHandler) {
    const deviceType = this.getDeviceType(device);
    
    if (deviceType === 'wellue') {
      return this.setupWellueNotifications(device, protocolHandler);
    } else if (deviceType === 'bci') {
      return this.setupBCINotifications(device, protocolHandler);
    }
    
    log.warn('Unknown device type for notifications');
    return false;
  }

  /**
   * Setup Wellue device notifications
   */
  async setupWellueNotifications(device, protocolHandler) {
    try {
      // Monitor TX characteristic for data
      const subscription = device.monitorCharacteristicForService(
        WELLUE_UUIDS.SERVICE,
        WELLUE_UUIDS.TX_CHARACTERISTIC,
        (error, characteristic) => {
          if (error) {
            log.error('Wellue notification error:', error);
            return;
          }
          
          if (characteristic?.value) {
            this.handleDataReceived(device.id, characteristic.value, protocolHandler);
          }
        }
      );
      
      this.subscriptions.set(device.id, subscription);
      
      // Send initial commands
      await this.sendWellueCommand(device, protocolHandler.getPingCommand());
      
      // Start real-time data polling
      const interval = setInterval(async () => {
        if (this.connectedDevices.has(device.id)) {
          await this.sendWellueCommand(device, protocolHandler.getRealTimeDataCommand());
        }
      }, 1000);
      
      this.dataIntervals.set(device.id, interval);
      
      log.info('✅ Wellue notifications setup complete');
      return true;
      
    } catch (error) {
      log.error('Failed to setup Wellue notifications:', error);
      return false;
    }
  }

  /**
   * Setup BCI device notifications
   */
  async setupBCINotifications(device, protocolHandler) {
    try {
      // Monitor data characteristic
      const subscription = device.monitorCharacteristicForService(
        BCI_UUIDS.SERVICE,
        BCI_UUIDS.DATA_CHARACTERISTIC,
        (error, characteristic) => {
          if (error) {
            log.error('BCI notification error:', error);
            return;
          }
          
          if (characteristic?.value) {
            this.handleDataReceived(device.id, characteristic.value, protocolHandler);
          }
        }
      );
      
      this.subscriptions.set(device.id, subscription);
      
      log.info('✅ BCI notifications setup complete');
      return true;
      
    } catch (error) {
      log.error('Failed to setup BCI notifications:', error);
      return false;
    }
  }

  /**
   * Send command to Wellue device
   */
  async sendWellueCommand(device, commandBuffer) {
    try {
      const base64Command = commandBuffer.toString('base64');
      
      await device.writeCharacteristicWithResponseForService(
        WELLUE_UUIDS.SERVICE,
        WELLUE_UUIDS.RX_CHARACTERISTIC,
        base64Command
      );
      
      return true;
    } catch (error) {
      log.error('Failed to send Wellue command:', error);
      return false;
    }
  }

  /**
   * Handle received data
   */
  handleDataReceived(deviceId, base64Data, protocolHandler) {
    const parsedData = protocolHandler.parseData(base64Data);
    
    if (parsedData && this.onDataReceived) {
      // Add device info
      parsedData.deviceId = deviceId;
      parsedData.deviceType = this.connectedDevices.get(deviceId)?.type;
      
      // Notify callback
      this.onDataReceived(parsedData);
    }
  }

  /**
   * Disconnect device
   */
  async disconnect(deviceId = null) {
    if (!deviceId) {
      // Disconnect all devices
      for (const id of this.connectedDevices.keys()) {
        await this.disconnectDevice(id);
      }
      return;
    }
    
    await this.disconnectDevice(deviceId);
  }

  /**
   * Disconnect specific device
   */
  async disconnectDevice(deviceId) {
    const connectionInfo = this.connectedDevices.get(deviceId);
    
    if (!connectionInfo) {
      return;
    }
    
    log.info(`📱 Disconnecting device ${deviceId}...`);
    
    // Clear subscriptions
    const subscription = this.subscriptions.get(deviceId);
    if (subscription) {
      subscription.remove();
      this.subscriptions.delete(deviceId);
    }
    
    // Clear data intervals
    const interval = this.dataIntervals.get(deviceId);
    if (interval) {
      clearInterval(interval);
      this.dataIntervals.delete(deviceId);
    }
    
    // Disconnect device
    try {
      await connectionInfo.device.cancelConnection();
    } catch (error) {
      // Ignore disconnection errors
    }
    
    // Clean up
    this.connectedDevices.delete(deviceId);
    ProtocolFactory.clearProtocol(deviceId);
    
    // Notify disconnection
    this.notifyConnectionStatus(deviceId, false);
    
    log.info(`✅ Device ${deviceId} disconnected`);
  }

  /**
   * Handle unexpected disconnection
   */
  handleDisconnection(deviceId, error) {
    log.warn(`⚠️ Device ${deviceId} disconnected unexpectedly`);
    
    const connectionInfo = this.connectedDevices.get(deviceId);
    
    if (!connectionInfo) {
      return;
    }
    
    // Clean up subscriptions
    const subscription = this.subscriptions.get(deviceId);
    if (subscription) {
      subscription.remove();
      this.subscriptions.delete(deviceId);
    }
    
    // Clear data interval
    const interval = this.dataIntervals.get(deviceId);
    if (interval) {
      clearInterval(interval);
      this.dataIntervals.delete(deviceId);
    }
    
    this.lastDisconnectTime = Date.now();
    
    // Attempt recovery if within limits
    if (connectionInfo.recoveryAttempts < this.MAX_RECOVERY_ATTEMPTS) {
      this.startRecoveryTimer(deviceId, connectionInfo);
    } else {
      // Give up after max attempts
      log.error(`❌ Max recovery attempts reached for ${deviceId}`);
      this.connectedDevices.delete(deviceId);
      ProtocolFactory.clearProtocol(deviceId);
    }
    
    // Notify disconnection
    this.notifyConnectionStatus(deviceId, false);
  }

  /**
   * Start connection recovery timer
   */
  startRecoveryTimer(deviceId, connectionInfo) {
    if (this.connectionRecoveryTimer) {
      clearTimeout(this.connectionRecoveryTimer);
    }
    
    const attemptNumber = connectionInfo.recoveryAttempts + 1;
    const delay = this.RECOVERY_DELAY * attemptNumber;
    
    log.info(`🔄 Will attempt reconnection #${attemptNumber} in ${delay}ms...`);
    
    this.connectionRecoveryTimer = setTimeout(async () => {
      connectionInfo.recoveryAttempts++;
      
      try {
        log.info(`🔄 Attempting to reconnect to ${connectionInfo.device.name}...`);
        const success = await this.connect(connectionInfo.device);
        
        if (success) {
          log.info('✅ Reconnection successful');
          connectionInfo.recoveryAttempts = 0;
        }
      } catch (error) {
        log.error('❌ Reconnection failed:', error);
      }
    }, delay);
  }

  /**
   * Get device type
   */
  getDeviceType(device) {
    const protocolType = ProtocolFactory.identifyProtocol(device);
    return protocolType || 'unknown';
  }

  /**
   * Notify connection status change
   */
  notifyConnectionStatus(deviceId, isConnected) {
    if (this.onConnectionStatusChanged) {
      const deviceInfo = this.connectedDevices.get(deviceId);
      this.onConnectionStatusChanged({
        deviceId,
        isConnected,
        deviceType: deviceInfo?.type,
        deviceName: deviceInfo?.device.name
      });
    }
  }

  /**
   * Set callbacks
   */
  setCallbacks(onDataReceived, onConnectionStatusChanged) {
    this.onDataReceived = onDataReceived;
    this.onConnectionStatusChanged = onConnectionStatusChanged;
  }

  /**
   * Get connection status
   */
  get connectionStatus() {
    const status = {
      isAnyConnected: this.connectedDevices.size > 0,
      connectedCount: this.connectedDevices.size,
      devices: []
    };
    
    for (const [id, info] of this.connectedDevices) {
      status.devices.push({
        id,
        name: info.device.name,
        type: info.type,
        connectedAt: info.connectedAt
      });
    }
    
    return status;
  }

  /**
   * Check if specific device type is connected
   */
  isDeviceTypeConnected(type) {
    for (const info of this.connectedDevices.values()) {
      if (info.type === type) {
        return true;
      }
    }
    return false;
  }

  /**
   * Clean up all connections
   */
  async cleanup() {
    // Clear recovery timer
    if (this.connectionRecoveryTimer) {
      clearTimeout(this.connectionRecoveryTimer);
      this.connectionRecoveryTimer = null;
    }
    
    // Disconnect all devices
    await this.disconnect();
    
    // Clear protocol factory
    ProtocolFactory.clearAll();
  }
}

export default BluetoothConnectionManager;