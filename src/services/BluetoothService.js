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

    // BCI Protocol specific UUIDs (Pulse Oximeter)
    this.BCI_SERVICE_UUID = '49535343-FE7D-4AE5-8FA9-9FAFD205E455';
    this.BCI_DATA_CHARACTERISTIC_UUID = '49535343-1E4D-4BD9-BA61-23C647249616'; // Device sends data to app (notifiable)
    this.BCI_COMMAND_CHARACTERISTIC_UUID = '49535343-8841-43F4-A8D4-ECBE34729BB3'; // App sends commands to device
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
      
      // Pulse oximeters reliably advertise their service UUID
      const serviceUUIDs = [this.BCI_SERVICE_UUID];
      
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
      if (device.serviceUUIDs.includes(this.BCI_SERVICE_UUID)) {
        return 'pulse-ox';
      }
    }

    // Fallback to device name patterns
    const name = device.name || '';
    const localName = device.localName || '';
    const deviceText = (name + ' ' + localName).toLowerCase();
    
    // Check for pulse oximeter keywords
    const pulseOxKeywords = ['berry', 'med', 'bci', 'pulse', 'oximeter', 'spo2'];
    const hasPulseOxKeyword = pulseOxKeywords.some(keyword =>
      deviceText.includes(keyword.toLowerCase())
    );

    if (hasPulseOxKeyword) return 'pulse-ox';
    
    return 'unknown';
  }

  isBCIDevice(device) {
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
        log.info('Pulse Oximeter services discovered');
        await this.setupBCINotifications(discoveredDevice);
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

  async setupBCINotifications(device) {
    try {
      log.info('Setting up BCI notifications...');
      
      // Get the BCI service
      const services = await device.services();
      log.info('Available services:', services.map(s => s.uuid));
      
      const bciService = services.find(service => 
        service.uuid.toUpperCase() === this.BCI_SERVICE_UUID.toUpperCase()
      );
      
      if (!bciService) {
        log.error('❌ BCI service not found!');
        log.info('Available services:', services.map(s => s.uuid));
        return;
      }
      
      log.info('Found BCI service:', bciService.uuid);
      
      // Get characteristics
      const characteristics = await bciService.characteristics();
      log.info('BCI service characteristics:', characteristics.map(c => ({
        uuid: c.uuid,
        isNotifiable: c.isNotifiable,
        isReadable: c.isReadable,
        isWritable: c.isWritable
      })));
      
      // Find the send characteristic (this is the one that sends data TO us)
      // Note: The protocol naming is from device perspective, so "Send" means device sends to us
      const dataCharacteristic = characteristics.find(char =>
        char.uuid.toUpperCase() === this.BCI_DATA_CHARACTERISTIC_UUID.toUpperCase()
      );
      
      if (!dataCharacteristic) {
        log.error('❌ BCI data characteristic not found!');
        return;
      }
      
      log.info('Found BCI data characteristic:', dataCharacteristic.uuid);
      log.info('� Characteristic properties:', {
        isNotifiable: dataCharacteristic.isNotifiable,
        isReadable: dataCharacteristic.isReadable,
        isWritable: dataCharacteristic.isWritable
      });
      
      // Enable notifications
      if (dataCharacteristic.isNotifiable) {
        log.info('� Enabling BCI data notifications...');
        
        dataCharacteristic.monitor((error, characteristic) => {
          if (error) {
            // Handle cancellation errors gracefully (happens when disconnecting or removing finger)
            if (error.message && error.message.includes('cancelled')) {
              log.info('� BCI data monitoring stopped (connection cancelled)');
              this.handleDeviceDisconnected();
            } else {
              log.error('Notification error:', error);
              this.handleDeviceDisconnected();
            }
            return;
          }
          
          if (characteristic && characteristic.value) {
            // log.info('� Raw BCI data received:', characteristic.value); // Disabled: high frequency logging
            this.handleBCIDataReceived(characteristic.value);
          }
        });
        
        log.info('BCI notifications enabled');
      } else {
        log.error('❌ BCI data characteristic is not notifiable');
      }
      
    } catch (error) {
      log.error('Error setting up BCI notifications:', error);
    }
  }

  handleBCIDataReceived(data) {
    try {
      // Safety check - ensure manager is not destroyed
      if (this.isDestroyed) {
        log.warn('Cannot handle BCI data - BleManager is destroyed');
        return;
      }
      
      const parsedData = this.parseBCIData(data);
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
      log.error('Error handling BCI data:', error);
    }
  }

  parseBCIData(base64Data) {
    try {
      // log.info('Parsing BCI data:', base64Data); // Disabled: high frequency logging
      
      // Decode base64 to buffer
      const buffer = Buffer.from(base64Data, 'base64');
      // log.info('Buffer length:', buffer.length); // Disabled: high frequency logging
      // log.info('Raw bytes (hex):', Array.from(buffer).map(b => '0x' + b.toString(16).padStart(2, '0').toUpperCase()).join(' ')); // Disabled: high frequency logging
      
      // Handle different packet sizes
      let packets = [];
      
      if (buffer.length === 5) {
        // Single 5-byte packet
        packets = [buffer];
      } else if (buffer.length === 20) {
        // Four 5-byte packets concatenated
        // log.info('� Processing 20-byte packet as 4x5-byte packets'); // Disabled: high frequency logging
        for (let i = 0; i < 4; i++) {
          const packetStart = i * 5;
          const packet = buffer.slice(packetStart, packetStart + 5);
          packets.push(packet);
        }
      } else {
        log.info('Unexpected buffer length:', buffer.length, 'bytes. Processing as best effort...');
        // Try to process first 5 bytes if available
        if (buffer.length >= 5) {
          packets = [buffer.slice(0, 5)];
        } else {
          log.info('Buffer too short for BCI parsing');
          return null;
        }
      }
      
      // Process the latest (most recent) packet
      const latestPacket = packets[packets.length - 1];
      // log.info('Processing latest packet:', Array.from(latestPacket).map(b => '0x' + b.toString(16).padStart(2, '0').toUpperCase()).join(' ')); // Disabled: high frequency logging
      
      return this.parseSingle5BytePacket(latestPacket, base64Data);
      
    } catch (error) {
      log.error('❌ Error parsing BCI data:', error);
      return null;
    }
  }

  parseSingle5BytePacket(buffer, originalBase64Data) {
    try {
      // Extract bytes according to BCI protocol
      const byte1 = buffer[0]; // Signal strength, probe status, pulse beep, sync bit
      const byte2 = buffer[1]; // Pleth, sync bit  
      const byte3 = buffer[2]; // Bargraph, finger detection, pulse searching, pulse rate bit 7
      const byte4 = buffer[3]; // Pulse rate bits 0-6, sync bit
      const byte5 = buffer[4]; // SpO2 bits 0-6, sync bit
      
      // log.info('BCI Bytes:', { // Disabled: high frequency logging
      //   byte1: '0x' + byte1.toString(16).padStart(2, '0').toUpperCase(),
      //   byte2: '0x' + byte2.toString(16).padStart(2, '0').toUpperCase(), 
      //   byte3: '0x' + byte3.toString(16).padStart(2, '0').toUpperCase(),
      //   byte4: '0x' + byte4.toString(16).padStart(2, '0').toUpperCase(),
      //   byte5: '0x' + byte5.toString(16).padStart(2, '0').toUpperCase()
      // });
      
      // Parse according to BCI protocol specification
      
      // Signal strength (byte 1, bits 0-3)
      const signalStrength = byte1 & 0x0F;
      const isSignalValid = signalStrength !== 0x0F;
      
      // Probe status (byte 1, bit 5)
      const isProbePlugged = (byte1 & 0x20) === 0;
      
      // Finger detection (byte 3, bit 4) 
      const isFingerDetected = (byte3 & 0x10) === 0;
      
      // Pulse searching (byte 3, bit 5)
      const isSearchingForPulse = (byte3 & 0x20) !== 0;
      
      // Parse pulse rate: ((byte3 & 0x40) << 1) | (byte4 & 0x7F)
      const pulseRateRaw = ((byte3 & 0x40) << 1) | (byte4 & 0x7F);
      const isPulseRateValid = pulseRateRaw !== 0xFF && pulseRateRaw >= 25 && pulseRateRaw <= 250;
      const pulseRate = isPulseRateValid ? pulseRateRaw : null;
      
      // Parse SpO2: byte5 & 0x7F  
      const spo2Raw = byte5 & 0x7F;
      const isSpo2Valid = spo2Raw !== 0x7F && spo2Raw >= 35 && spo2Raw <= 100;
      const spo2 = isSpo2Valid ? spo2Raw : null;
      
      // Parse pleth (waveform) - byte 2, bits 0-6
      const pleth = byte2 & 0x7F;
      const isPlethValid = pleth !== 0;
      
      // Extract bargraph (Byte 3, bits 0-3) - likely the PI indicator
      const bargraph = byte3 & 0x0F;
      const isBargraphValid = bargraph !== 0;
      
      // log.info('� BCI Parsed Values:', { // Disabled: high frequency logging
      //   signalStrength,
      //   isSignalValid,
      //   isProbePlugged,
      //   isFingerDetected,
      //   isSearchingForPulse,
      //   pulseRateRaw,
      //   pulseRate,
      //   spo2Raw,
      //   spo2,
      //   pleth,
      //   isPlethValid,
      //   bargraph,
      //   isBargraphValid
      // });
      
      // Return data even if values are invalid so we can show status
      const result = {
        spo2,
        heartRate: pulseRate,
        signalStrength,
        isFingerDetected,
        isSearchingForPulse,
        pleth: isPlethValid ? pleth : null,
        bargraph: isBargraphValid ? bargraph : null,  // Add bargraph to returned data
        timestamp: Date.now(),
        rawData: originalBase64Data
      };
      
      if (spo2 !== null || pulseRate !== null) {
        // log.info('Valid BCI data:', result); // Disabled: high frequency logging
      } else {
        // log.info('BCI status data (no valid measurements):', result); // Disabled: high frequency logging
      }
      
      return result;
      
    } catch (error) {
      log.error('Error parsing individual BCI packet:', error);
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