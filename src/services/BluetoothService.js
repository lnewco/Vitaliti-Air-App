import { BleManager } from 'react-native-ble-plx';
import { Platform, PermissionsAndroid } from 'react-native';
import { Buffer } from 'buffer';
import EnhancedSessionManager from './EnhancedSessionManager';
import logger from '../utils/logger';

const log = logger.createModuleLogger('BluetoothService');


class BluetoothService {
  constructor() {
    this.manager = null;
    this.referenceCount = 0;
    this.isDestroyed = false;
    this.pulseOxDevice = null;
    this.onDeviceFound = null;
    this.onPulseOxDataReceived = null;
    this.onConnectionStatusChanged = null;
    this.isScanning = false;
    this.isPulseOxConnected = false;
    this.currentScanType = 'pulse-ox';
    
    // Connection resilience properties
    this.connectionRecoveryTimer = null;
    this.lastDisconnectTime = null;

    // Wellue Protocol specific UUIDs (Pulse Oximeter)
    this.WELLUE_SERVICE_UUID = '6E400001-B5A3-F393-E0A9-E50E24DCCA9E';
    this.WELLUE_TX_CHARACTERISTIC_UUID = '6E400003-B5A3-F393-E0A9-E50E24DCCA9E'; // Device sends data to app (notify)
    this.WELLUE_RX_CHARACTERISTIC_UUID = '6E400002-B5A3-F393-E0A9-E50E24DCCA9E'; // App sends commands to device (write)
  }

  // Reference counting for proper lifecycle management
  acquireReference() {
    this.referenceCount++;
    log.info(`📱 BluetoothService reference acquired (count: ${this.referenceCount})`);
    
    // Create manager if needed
    if (!this.manager || this.isDestroyed) {
      log.info('🔄 Creating new BleManager instance');
      this.manager = new BleManager();
      this.isDestroyed = false;
    }
    
    return this.referenceCount;
  }
  
  releaseReference() {
    if (this.referenceCount > 0) {
      this.referenceCount--;
      log.info(`📱 BluetoothService reference released (count: ${this.referenceCount})`);
      
      // Only destroy if no more references
      if (this.referenceCount === 0) {
        log.info('🧹 No more references, scheduling cleanup...');
        // Delay cleanup slightly to allow for quick re-acquisition
        setTimeout(() => {
          if (this.referenceCount === 0) {
            this._performCleanup();
          }
        }, 500);
      }
    }
    
    return this.referenceCount;
  }
  
  _performCleanup() {
    log.info('🧹 Performing full BluetoothService cleanup');
    this.stopScanning();
    this.disconnect();
    
    if (this.manager && !this.isDestroyed) {
      try {
        this.manager.destroy();
        this.isDestroyed = true;
        log.info('✅ BleManager destroyed successfully');
      } catch (error) {
        log.error('Error destroying BleManager:', error);
      }
    }
  }

  async requestPermissions() {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Bluetooth Permission',
            message: 'This app needs Bluetooth permission to connect to your pulse oximeter.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } else {
        return true; // iOS handles Bluetooth permissions automatically
      }
    } catch (error) {
      log.error('Permission request failed:', error);
      return false;
    }
  }

  async isBluetoothEnabled() {
    try {
      // Ensure manager exists before checking state
      if (!this.manager || this.isDestroyed) {
        log.warn('BleManager not initialized - cannot check Bluetooth state');
        return false;
      }
      const state = await this.manager.state();
      return state === 'PoweredOn';
    } catch (error) {
      log.error('Error checking Bluetooth state:', error);
      return false;
    }
  }

  // Alias for backward compatibility
  async startScan(deviceType = 'pulse-ox') {
    return this.startScanning(deviceType);
  }

  async startScanning(deviceType = 'pulse-ox') {
    try {
      // Ensure manager exists before scanning
      if (!this.manager || this.isDestroyed) {
        log.error('Cannot start scanning - BleManager not initialized');
        return;
      }
      
      // Only support pulse-ox scanning now
      if (deviceType !== 'pulse-ox') {
        log.warn(`Unsupported device type: ${deviceType}, defaulting to pulse-ox`);
        deviceType = 'pulse-ox';
      }
      
      log.info(`Starting ${deviceType} device scan...`);
      this.currentScanType = deviceType;
      this.isScanning = true;
      
      // Wellue pulse oximeters advertise their service UUID
      const serviceUUIDs = [this.WELLUE_SERVICE_UUID];
      
      log.info(`Starting ${deviceType} scan with service filter:`, serviceUUIDs);
      
      // Scan for devices
      this.manager.startDeviceScan(serviceUUIDs, null, (error, device) => {
        if (error) {
          log.error('Scan error:', error);
          return;
        }
        
        if (device) {
          this.handleDeviceDiscovered(device);
        }
      });
    } catch (error) {
      log.error('Error starting scan:', error);
      this.isScanning = false;
    }
  }

  // Alias for backward compatibility
  async stopScan() {
    return this.stopScanning();
  }

  async stopScanning() {
    try {
      if (!this.manager || this.isDestroyed) {
        log.warn('Cannot stop scanning - BleManager not initialized');
        return;
      }
      log.info('Stopping device scan...');
      this.manager.stopDeviceScan();
      this.isScanning = false;
    } catch (error) {
      log.error('Error stopping scan:', error);
    }
  }

  handleDeviceDiscovered(device) {
    log.info('Device discovered:', {
      name: device.name,
      localName: device.localName,
      id: device.id,
      rssi: device.rssi,
      serviceUUIDs: device.serviceUUIDs
    });

    // Determine device type and log appropriate message
    const deviceType = this.getDeviceType(device);
    if (deviceType === 'pulse-ox') {
      log.info('Pulse Oximeter device found:', device.name || device.localName || 'Unknown');
    } else {
      log.info('Unknown device found:', device.name || device.localName || 'Unknown', 'Services:', device.serviceUUIDs);
    }

    // Only report pulse oximeter devices
    const shouldReport = this.currentScanType === 'pulse-ox' && deviceType === 'pulse-ox';

    if (shouldReport && this.onDeviceFound) {
      log.info(`📱 Reporting ${deviceType} device (scan type: ${this.currentScanType})`);
      // Add deviceType property while preserving device methods
      device.deviceType = deviceType;
      this.onDeviceFound(device);
    } else if (deviceType === 'pulse-ox' && this.currentScanType !== 'pulse-ox') {
      log.info(`⏭️ Skipping ${deviceType} device (not currently scanning for pulse-ox)`);
    }
  }

  getDeviceType(device) {
    // Check service UUIDs first (most reliable)
    if (device.serviceUUIDs) {
      // Check for Wellue service UUID (case-insensitive comparison)
      const hasWellueService = device.serviceUUIDs.some(uuid => 
        uuid.toUpperCase() === this.WELLUE_SERVICE_UUID.toUpperCase()
      );
      if (hasWellueService) {
        return 'pulse-ox';
      }
    }

    // Fallback to device name patterns
    const name = device.name || '';
    const localName = device.localName || '';
    const deviceText = (name + ' ' + localName).toLowerCase();
    
    // Check for Wellue pulse oximeter keywords
    const pulseOxKeywords = ['wellue', 'o2ring', 'oxylink', 'pulse', 'oximeter', 'spo2', 'fingertip'];
    const hasPulseOxKeyword = pulseOxKeywords.some(keyword =>
      deviceText.includes(keyword.toLowerCase())
    );

    if (hasPulseOxKeyword) return 'pulse-ox';
    
    return 'unknown';
  }

  isWellueDevice(device) {
    return this.getDeviceType(device) === 'pulse-ox';
  }

  async connectToDevice(device) {
    try {
      const deviceType = device.deviceType || this.getDeviceType(device);
      log.info(`Connecting to ${deviceType} device:`, device.id);
      
      // Stop scanning before connecting
      await this.stopScanning();
      
      // Connect to device
      const connectedDevice = await device.connect();
      log.info('Connected to device');
      
      // Discover services and characteristics
      const discoveredDevice = await connectedDevice.discoverAllServicesAndCharacteristics();
      
      // Store device reference - only pulse ox supported now
      if (deviceType === 'pulse-ox') {
        this.pulseOxDevice = discoveredDevice;
        this.isPulseOxConnected = true;
        log.info('Wellue Pulse Oximeter services discovered');
        await this.setupWellueNotifications(discoveredDevice);
      } else {
        log.warn('Unsupported device type:', deviceType);
        throw new Error(`Unsupported device type: ${deviceType}`);
      }
      
      if (this.onConnectionStatusChanged) {
        this.onConnectionStatusChanged(deviceType, true);
      }
      
      // Restart scanning for other device types if we don't have both connected
      await this.restartScanningForMissingDevices();
      
      return discoveredDevice;
    } catch (error) {
      log.error('Connection error:', error);
      const deviceType = device.deviceType || this.getDeviceType(device);
      
      if (deviceType === 'pulse-ox') {
        this.isPulseOxConnected = false;
      }
      
      if (this.onConnectionStatusChanged) {
        this.onConnectionStatusChanged(deviceType, false);
      }
      
      // Restart scanning after failed connection attempt
      await this.restartScanningForMissingDevices();
      
      throw error;
    }
  }

  async setupWellueNotifications(device) {
    try {
      log.info('Setting up Wellue notifications...');
      
      // Get the Wellue service
      const services = await device.services();
      log.info('Available services:', services.map(s => s.uuid));
      
      const wellueService = services.find(service => 
        service.uuid.toUpperCase() === this.WELLUE_SERVICE_UUID.toUpperCase()
      );
      
      if (!wellueService) {
        log.error('❌ Wellue service not found!');
        log.info('Available services:', services.map(s => s.uuid));
        return;
      }
      
      log.info('Found Wellue service:', wellueService.uuid);
      
      // Get characteristics
      const characteristics = await wellueService.characteristics();
      log.info('Wellue service characteristics:', characteristics.map(c => ({
        uuid: c.uuid,
        isNotifiable: c.isNotifiable,
        isReadable: c.isReadable,
        isWritable: c.isWritable
      })));
      
      // Find the TX characteristic (device sends data to app)
      const txCharacteristic = characteristics.find(char =>
        char.uuid.toUpperCase() === this.WELLUE_TX_CHARACTERISTIC_UUID.toUpperCase()
      );
      
      if (!txCharacteristic) {
        log.error('❌ Wellue TX characteristic not found!');
        return;
      }
      
      log.info('Found Wellue TX characteristic:', txCharacteristic.uuid);
      log.info('� Characteristic properties:', {
        isNotifiable: txCharacteristic.isNotifiable,
        isReadable: txCharacteristic.isReadable,
        isWritable: txCharacteristic.isWritable
      });
      
      // Enable notifications
      if (txCharacteristic.isNotifiable) {
        log.info('� Enabling Wellue data notifications...');
        
        txCharacteristic.monitor((error, characteristic) => {
          if (error) {
            // Handle cancellation errors gracefully (happens when disconnecting or removing finger)
            if (error.message && error.message.includes('cancelled')) {
              log.info('� Wellue data monitoring stopped (connection cancelled)');
              this.handleDeviceDisconnected();
            } else {
              log.error('Notification error:', error);
              this.handleDeviceDisconnected();
            }
            return;
          }
          
          if (characteristic && characteristic.value) {
            // log.info('� Raw Wellue data received:', characteristic.value); // Disabled: high frequency logging
            this.handleWellueDataReceived(characteristic.value);
          }
        });
        
        log.info('Wellue notifications enabled');
      } else {
        log.error('❌ Wellue TX characteristic is not notifiable');
      }
      
    } catch (error) {
      log.error('Error setting up Wellue notifications:', error);
    }
  }

  handleWellueDataReceived(data) {
    try {
      // Safety check - ensure manager is not destroyed
      if (this.isDestroyed) {
        log.warn('Cannot handle Wellue data - BleManager is destroyed');
        return;
      }
      
      const parsedData = this.parseWellueData(data);
      if (parsedData) {
        // Send to UI callback if available
        if (this.onPulseOxDataReceived) {
          this.onPulseOxDataReceived(parsedData);
        }
        
        // Send to session manager if session is active
        if (EnhancedSessionManager.getSessionInfo().isActive) {
          EnhancedSessionManager.addReading(parsedData);
        }
      }
    } catch (error) {
      log.error('Error handling Wellue data:', error);
    }
  }

  parseWellueData(base64Data) {
    try {
      // log.info('Parsing Wellue data:', base64Data); // Disabled: high frequency logging
      
      // Decode base64 to buffer
      const buffer = Buffer.from(base64Data, 'base64');
      // log.info('Buffer length:', buffer.length); // Disabled: high frequency logging
      // log.info('Raw bytes (hex):', Array.from(buffer).map(b => '0x' + b.toString(16).padStart(2, '0').toUpperCase()).join(' ')); // Disabled: high frequency logging
      
      // Wellue protocol uses 8-byte packets
      if (buffer.length !== 8) {
        log.warn('Unexpected Wellue packet length:', buffer.length, 'bytes (expected 8)');
        // Try to process if we have at least 8 bytes
        if (buffer.length < 8) {
          return null;
        }
      }
      
      // Parse the 8-byte Wellue packet
      return this.parseWellue8BytePacket(buffer, base64Data);
      
    } catch (error) {
      log.error('❌ Error parsing Wellue data:', error);
      return null;
    }
  }

  parseWellue8BytePacket(buffer, originalBase64Data) {
    try {
      // Extract bytes according to Wellue protocol (8-byte packet)
      const byte1 = buffer[0]; // Status flags
      const byte2 = buffer[1]; // Plethysmogram waveform
      const byte3 = buffer[2]; // Bargraph (signal strength)
      const byte4 = buffer[3]; // Perfusion Index (PI)
      const byte5 = buffer[4]; // SpO2 value
      const byte6 = buffer[5]; // Pulse Rate value
      const byte7 = buffer[6]; // Reserved
      const byte8 = buffer[7]; // Reserved
      
      // log.info('Wellue Bytes:', { // Disabled: high frequency logging
      //   byte1: '0x' + byte1.toString(16).padStart(2, '0').toUpperCase(),
      //   byte2: '0x' + byte2.toString(16).padStart(2, '0').toUpperCase(),
      //   byte3: '0x' + byte3.toString(16).padStart(2, '0').toUpperCase(),
      //   byte4: '0x' + byte4.toString(16).padStart(2, '0').toUpperCase(),
      //   byte5: '0x' + byte5.toString(16).padStart(2, '0').toUpperCase(),
      //   byte6: '0x' + byte6.toString(16).padStart(2, '0').toUpperCase(),
      //   byte7: '0x' + byte7.toString(16).padStart(2, '0').toUpperCase(),
      //   byte8: '0x' + byte8.toString(16).padStart(2, '0').toUpperCase()
      // });
      
      // Parse status flags (byte 1)
      const isFingerDetected = (byte1 & 0x10) === 0;  // Bit 4: 0=finger in, 1=finger out
      const isSearchingForPulse = (byte1 & 0x08) !== 0; // Bit 3: 1=searching
      const isLowPerfusion = (byte1 & 0x02) !== 0; // Bit 1: 1=low PI
      const isMotionDetected = (byte1 & 0x01) !== 0; // Bit 0: 1=motion detected
      
      // Parse plethysmogram waveform (byte 2)
      const pleth = byte2; // Direct value 0-255
      const isPlethValid = pleth !== 0 && isFingerDetected;
      
      // Parse bargraph/signal strength (byte 3)
      const bargraph = byte3 & 0x0F; // Lower 4 bits
      const signalStrength = bargraph; // Use bargraph as signal strength indicator
      
      // Parse Perfusion Index (byte 4)
      const perfusionIndexRaw = byte4;
      // PI is typically expressed as percentage (0-20% range)
      const perfusionIndex = perfusionIndexRaw / 10.0; // Convert to percentage
      const isPIValid = isFingerDetected && !isSearchingForPulse;
      
      // Parse SpO2 (byte 5)
      const spo2Raw = byte5;
      const isSpo2Valid = spo2Raw !== 0xFF && spo2Raw >= 35 && spo2Raw <= 100 && isFingerDetected && !isSearchingForPulse;
      const spo2 = isSpo2Valid ? spo2Raw : null;
      
      // Parse Pulse Rate (byte 6)
      const pulseRateRaw = byte6;
      const isPulseRateValid = pulseRateRaw !== 0xFF && pulseRateRaw >= 25 && pulseRateRaw <= 250 && isFingerDetected && !isSearchingForPulse;
      const pulseRate = isPulseRateValid ? pulseRateRaw : null;
      
      // log.info('Wellue Parsed Values:', { // Disabled: high frequency logging
      //   status: byte1,
      //   isFingerDetected,
      //   isSearchingForPulse,
      //   isLowPerfusion,
      //   isMotionDetected,
      //   pleth,
      //   bargraph,
      //   perfusionIndex,
      //   spo2,
      //   pulseRate
      // });
      
      // Return enhanced data structure with Wellue-specific fields
      const result = {
        spo2,
        heartRate: pulseRate,
        perfusionIndex: isPIValid ? perfusionIndex : null,
        signalStrength,
        isFingerDetected,
        isSearchingForPulse,
        isLowPerfusion,
        isMotionDetected,
        pleth: isPlethValid ? pleth : null,
        bargraph,
        timestamp: Date.now(),
        rawData: originalBase64Data,
        protocol: 'wellue'
      };
      
      if (spo2 !== null || pulseRate !== null) {
        // log.info('Valid Wellue data:', result); // Disabled: high frequency logging
      } else {
        // log.info('Wellue status data (no valid measurements):', result); // Disabled: high frequency logging
      }
      
      return result;
      
    } catch (error) {
      log.error('Error parsing Wellue packet:', error);
      return null;
    }
  }



  async disconnect(deviceType = 'all') {
    try {
      if (deviceType === 'all' || deviceType === 'pulse-ox') {
        if (this.pulseOxDevice) {
          log.info('Disconnecting from pulse oximeter...');
          await this.pulseOxDevice.cancelConnection();
          this.pulseOxDevice = null;
          this.isPulseOxConnected = false;
          
          if (this.onConnectionStatusChanged) {
            this.onConnectionStatusChanged('pulse-ox', false);
          }
          
          log.info('Pulse oximeter disconnected');
        }
      }

    } catch (error) {
      log.error('Error disconnecting:', error);
    }
  }

  async restartScanningForMissingDevices() {
    // Since we only support pulse ox now, no need to restart scanning once connected
    if (this.isPulseOxConnected) {
      log.info('Pulse oximeter connected - no need to continue scanning');
      await this.stopScanning();
      return;
    }
    
    // If pulse ox not connected, keep scanning for it
    log.info('Pulse oximeter not connected - continuing scan');
    try {
      await this.startScanning('pulse-ox');
    } catch (error) {
      log.error('❌ Failed to restart scanning:', error);
    }
  }

  // Legacy cleanup method - now uses reference counting
  cleanup() {
    log.warn('⚠️ Direct cleanup() called - using releaseReference() instead');
    this.releaseReference();
  }

  // Event handlers
  setOnDeviceFound(callback) {
    this.onDeviceFound = callback;
  }

  setOnPulseOxDataReceived(callback) {
    this.onPulseOxDataReceived = callback;
  }

  setOnConnectionStatusChanged(callback) {
    this.onConnectionStatusChanged = callback;
  }

  // Convenience getters for connection status
  get isAnyDeviceConnected() {
    return this.isPulseOxConnected;
  }

  get connectionStatus() {
    return {
      pulseOx: this.isPulseOxConnected,
      any: this.isAnyDeviceConnected
    };
  }

  async handleDeviceDisconnected() {
    log.info('� Device disconnected - implementing resilient recovery');
    
    // Mark disconnection timestamp for recovery tracking
    this.lastDisconnectTime = Date.now();
    
    // Import EnhancedSessionManager here to avoid circular dependencies
    const { default: EnhancedSessionManager } = await import('./EnhancedSessionManager.js');
    
    // If there's an active session, try recovery instead of immediate termination
    if (EnhancedSessionManager.isActive) {
      log.info('Active session detected - attempting connection recovery');
      
      // Set session to connection lost state instead of terminating
      try {
        // Mark session as having connection issues but continue
        EnhancedSessionManager.setConnectionState('disconnected');
        log.info('Session marked as disconnected - will continue with cached data');
        
        // Start recovery timer (30 seconds before considering termination)
        this.startConnectionRecoveryTimer(EnhancedSessionManager);
        
      } catch (error) {
        log.error('❌ Failed to set session connection state:', error);
      }
    }
  }
  
  startConnectionRecoveryTimer(EnhancedSessionManager) {
    // Clear any existing recovery timer
    if (this.connectionRecoveryTimer) {
      clearTimeout(this.connectionRecoveryTimer);
    }
    
    log.info('⏱️ Starting connection recovery timer (30 seconds)');
    
    this.connectionRecoveryTimer = setTimeout(async () => {
      log.info('⏰ Connection recovery timeout reached');
      
      // Check if we're still disconnected and session is still active
      if (!this.isAnyDeviceConnected && EnhancedSessionManager.isActive) {
        log.info('� No recovery achieved - terminating session');
        try {
          await EnhancedSessionManager.stopSession();
          log.info('Session terminated after recovery timeout');
        } catch (error) {
          log.error('❌ Failed to terminate session after recovery timeout:', error);
          try {
            EnhancedSessionManager.resetSessionState();
            log.info('Session state reset after termination failure');
          } catch (resetError) {
            log.error('❌ Failed to reset session state:', resetError);
          }
        }
      } else if (this.isAnyDeviceConnected) {
        log.info('� Connection recovered - session continuing normally');
        EnhancedSessionManager.setConnectionState('connected');
      }
    }, 30000); // 30 second recovery window
  }
}

export default new BluetoothService(); 