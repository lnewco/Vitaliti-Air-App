import { BleManager } from 'react-native-ble-plx';
import { Platform, PermissionsAndroid } from 'react-native';
import { Buffer } from 'buffer';
import EnhancedSessionManager from './EnhancedSessionManager';
import logger from '../utils/logger';

const log = logger.createModuleLogger('BluetoothService');


class BluetoothService {
  constructor() {
    // Initialize BleManager immediately to avoid race conditions
    try {
      this.manager = new BleManager();
      this.isDestroyed = false;
      log.info('🔄 BleManager initialized on service creation');
    } catch (error) {
      log.error('Failed to initialize BleManager:', error);
      this.manager = null;
      this.isDestroyed = true;
    }
    this.referenceCount = 0;
    this.pulseOxDevice = null;
    this.onDeviceFound = null;
    this.onPulseOxDataReceived = null;
    this.onConnectionStatusChanged = null;
    this.onConnectionChangeCallback = null;
    this.isScanning = false;
    this.isPulseOxConnected = false;
    this.currentScanType = 'pulse-ox';
    
    // Connection resilience properties
    this.connectionRecoveryTimer = null;
    this.lastDisconnectTime = null;

    // Wellue O2Ring/Checkme O2 Bluetooth Protocol UUIDs
    this.WELLUE_SERVICE_UUID = '14839ac4-7d7e-415c-9a42-167340cf2339';
    this.WELLUE_TX_CHARACTERISTIC_UUID = '0734594a-a8e7-4b1a-a6b1-cd5243059a57'; // Read/Notify characteristic
    this.WELLUE_RX_CHARACTERISTIC_UUID = '8b00ace7-eb0b-49b0-bbe9-9aee0a26e1a3'; // Write characteristic
    
    // Berry Med BCI Protocol UUIDs (for testing)
    this.BCI_SERVICE_UUID = '49535343-FE7D-4AE5-8FA9-9FAFD205E455';
    this.BCI_DATA_CHARACTERISTIC_UUID = '49535343-1E4D-4BD9-BA61-23C647249616'; // Device sends data to app (notifiable)
    this.BCI_COMMAND_CHARACTERISTIC_UUID = '49535343-8841-43F4-A8D4-ECBE34729BB3'; // App sends commands to device
    
    // Wellue protocol commands
    this.WELLUE_CMD_GET_FILE_START = 0x03;  // Begin to read
    this.WELLUE_CMD_GET_FILE_DATA = 0x04;   // Read data
    this.WELLUE_CMD_GET_FILE_END = 0x05;    // End to read
    this.WELLUE_CMD_GET_DEVICE_INFO = 0x14; // Get device information
    this.WELLUE_CMD_PING = 0x15;            // For test
    this.WELLUE_CMD_PARA_SYNC = 0x16;       // Set the parameters
    this.WELLUE_CMD_GET_RT_DATA = 0x17;     // Get real-time data
    this.WELLUE_CMD_FACTORY_RESET = 0x18;   // Factory reset
    this.WELLUE_CMD_GET_RT_WAVE = 0x1B;     // Get real-time waveform
    this.WELLUE_CMD_GET_RT_PPG = 0x1C;      // Get raw data (PPG data)
    
    // Protocol constants
    this.WELLUE_CMD_HEADER = 0xAA;          // Command packet header
    this.WELLUE_ACK_HEADER = 0x55;          // Response packet header
    
    this.welluePacketNumber = 0;            // Packet counter
    this.realTimeDataInterval = null;
  }

  // Reference counting for proper lifecycle management
  acquireReference() {
    this.referenceCount++;
    log.info(`📱 BluetoothService reference acquired (count: ${this.referenceCount})`);
    
    // Recreate manager if it was destroyed
    if (!this.manager || this.isDestroyed) {
      try {
        log.info('🔄 Recreating BleManager instance');
        this.manager = new BleManager();
        this.isDestroyed = false;
      } catch (error) {
        log.error('Failed to recreate BleManager:', error);
        // Keep the destroyed state if recreation fails
      }
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
        // Android 12+ requires explicit Bluetooth permissions
        const androidVersion = Platform.Version;
        
        if (androidVersion >= 31) {
          // Android 12+ (API 31+)
          const permissions = [
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          ];
          
          const results = await PermissionsAndroid.requestMultiple(permissions);
          
          return (
            results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED &&
            results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED &&
            results[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED
          );
        } else {
          // Android 11 and below
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
        }
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
        log.error('Cannot start scanning - BleManager not initialized. This should not happen in standalone builds. Please ensure you are not running in Expo Go.');
        // Try to initialize if needed (fallback)
        if (!this.manager) {
          try {
            log.info('Attempting emergency BleManager initialization...');
            this.manager = new BleManager();
            this.isDestroyed = false;
          } catch (error) {
            log.error('Emergency initialization failed:', error);
            return;
          }
        } else {
          return;
        }
      }
      
      // Only support pulse-ox scanning now
      if (deviceType !== 'pulse-ox') {
        log.warn(`Unsupported device type: ${deviceType}, defaulting to pulse-ox`);
        deviceType = 'pulse-ox';
      }
      
      log.info(`Starting ${deviceType} device scan...`);
      this.currentScanType = deviceType;
      this.isScanning = true;
      
      // Scan for all devices since Wellue might not advertise service UUID
      // We'll filter by name and service UUIDs to find both device types
      const serviceUUIDs = null; // Scan for all devices to find both Wellue and Berry Med
      
      log.info(`Starting ${deviceType} scan without service filter to find Wellue devices`);
      
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
    const deviceName = device.name || device.localName || 'Unknown';
    const deviceType = this.getDeviceType(device);
    
    if (deviceType === 'pulse-ox') {
      log.info('✅ Wellue device found:', deviceName);
    } else {
      log.debug('Device discovered:', deviceName);
    }

    // Only report pulse oximeter devices
    const shouldReport = this.currentScanType === 'pulse-ox' && deviceType === 'pulse-ox';

    if (shouldReport && this.onDeviceFound) {
      log.debug(`Reporting ${deviceType} device to UI`);
      // Add deviceType property while preserving device methods
      device.deviceType = deviceType;
      this.onDeviceFound(device);
    } else if (deviceType === 'pulse-ox' && this.currentScanType !== 'pulse-ox') {
      log.debug(`Skipping ${deviceType} device (wrong scan type)`);
    }
  }

  getDeviceType(device) {
    // Check service UUIDs first (most reliable)
    if (device.serviceUUIDs && device.serviceUUIDs.length > 0) {
      // Check for Wellue service UUID (case-insensitive comparison)
      const hasWellueService = device.serviceUUIDs.some(uuid => 
        uuid.toUpperCase() === this.WELLUE_SERVICE_UUID.toUpperCase()
      );
      if (hasWellueService) {
        log.debug('Found Wellue device by service UUID');
        return 'pulse-ox';
      }
      
      // Check for Berry Med BCI service UUID
      const hasBCIService = device.serviceUUIDs.some(uuid => 
        uuid.toUpperCase() === this.BCI_SERVICE_UUID.toUpperCase()
      );
      if (hasBCIService) {
        log.debug('Found Berry Med BCI device by service UUID');
        return 'pulse-ox';
      }
      
      log.debug('Device service UUIDs:', device.serviceUUIDs);
    }

    // Fallback to device name patterns
    const name = device.name || '';
    const localName = device.localName || '';
    const deviceText = (name + ' ' + localName).toLowerCase();
    
    // IMPORTANT: According to the documentation, the device name is "Checkme O2 xxxx"
    // where xxxx is the last 4 digits of the serial number
    
    // Check for specific Checkme O2 pattern first (most specific)
    if (name.startsWith('Checkme O2') || localName.startsWith('Checkme O2')) {
      log.debug('Found Checkme O2 device by name pattern');
      return 'pulse-ox';
    }
    
    // Check for pulse oximeter keywords - both Wellue and Berry Med
    const pulseOxKeywords = [
      // Wellue devices
      'checkme o2',  // Full pattern (with space)
      'checkme',     // Partial pattern
      'wellue',      // Brand name
      'o2ring',      // Product name variant
      'oxylink',     // Product name variant
      'viatom',      // Manufacturer name
      // Berry Med devices
      'berry',       // Berry Med brand
      'berrymed',    // Full brand name
      'bci',         // BCI protocol
      'bm1000c',     // Specific model
      'bm-1000',     // Model variant
      // Generic keywords
      'pulse',       // Generic keywords
      'oximeter',    
      'spo2',        
      'fingertip',   
      'o2 '          // O2 with space to avoid false positives
    ];
    
    const hasPulseOxKeyword = pulseOxKeywords.some(keyword =>
      deviceText.includes(keyword.toLowerCase())
    );

    if (hasPulseOxKeyword) {
      log.debug('Found Wellue device by keyword match');
      return 'pulse-ox';
    }
    
    // Log devices that don't match for debugging
    if (name || localName) {
      // Non-matching device, ignore
    }
    
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
        
        // Notify connection change
        if (this.onConnectionChangeCallback) {
          this.onConnectionChangeCallback(true);
        }
        
        // Determine which protocol to use based on service UUIDs
        const services = await discoveredDevice.services();
        const serviceUUIDs = services.map(s => s.uuid.toUpperCase());
        
        const hasWellueService = serviceUUIDs.includes(this.WELLUE_SERVICE_UUID.toUpperCase());
        const hasBCIService = serviceUUIDs.includes(this.BCI_SERVICE_UUID.toUpperCase());
        
        if (hasWellueService) {
          log.info('Wellue device detected - using Wellue protocol');
          await this.setupWellueNotifications(discoveredDevice);
        } else if (hasBCIService) {
          log.info('Berry Med BCI device detected - using BCI protocol');
          await this.setupBCINotifications(discoveredDevice);
        } else {
          log.warn('Unknown pulse oximeter protocol - trying Wellue as fallback');
          await this.setupWellueNotifications(discoveredDevice);
        }
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
        
        // Notify connection change
        if (this.onConnectionChangeCallback) {
          this.onConnectionChangeCallback(false);
        }
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
      log.info(' Characteristic properties:', {
        isNotifiable: txCharacteristic.isNotifiable,
        isReadable: txCharacteristic.isReadable,
        isWritable: txCharacteristic.isWritable
      });
      
      // Enable notifications if available
      if (txCharacteristic.isNotifiable) {
        log.info('📡 Enabling Wellue data notifications...');
        
        txCharacteristic.monitor((error, characteristic) => {
          if (error) {
            // Handle cancellation errors gracefully (happens when disconnecting or removing finger)
            if (error.message && error.message.includes('cancelled')) {
              log.info('⏹️ Wellue data monitoring stopped (connection cancelled)');
              this.handleDeviceDisconnected();
            } else {
              log.error('Notification error:', error);
              this.handleDeviceDisconnected();
            }
            return;
          }
          
          if (characteristic && characteristic.value) {
            this.handleWellueDataReceived(characteristic.value);
          }
        });
        
        log.info('✅ Wellue notifications enabled');
      } else {
        log.error('❌ Wellue TX characteristic is not notifiable');
      }
      
      // Also try reading the characteristic directly if it's readable
      if (txCharacteristic.isReadable) {
        log.info('📖 TX characteristic is readable, attempting direct read...');
        
        // Try a direct read
        try {
          const value = await txCharacteristic.read();
          if (value) {
            log.info('📖 Direct read value:', value.value);
            this.handleWellueDataReceived(value.value);
          }
        } catch (readError) {
          log.error('Failed to read characteristic:', readError);
        }
        
        // Set up periodic reading as fallback
        this.readInterval = setInterval(async () => {
          try {
            const value = await txCharacteristic.read();
            if (value && value.value) {
              this.handleWellueDataReceived(value.value);
            }
          } catch (err) {
            // Silent fail for periodic reads
          }
        }, 1000);
      }
      
      // Some Wellue devices stream data automatically without commands
      log.info('🔍 Checking if device streams data automatically...');
      
      // Wait a moment to see if data comes automatically
      setTimeout(async () => {
        // If we haven't received valid data yet, try sending commands
        log.info('📋 Attempting to get device information...');
        await this.sendWellueCommand(this.WELLUE_CMD_GET_DEVICE_INFO);
        
        // Try PING
        setTimeout(async () => {
          log.info('🏓 Sending PING command...');
          await this.sendWellueCommand(this.WELLUE_CMD_PING);
        }, 1000);
        
        // Try real-time data command
        setTimeout(async () => {
          log.info('📊 Requesting real-time data...');
          await this.sendWellueCommand(this.WELLUE_CMD_GET_RT_DATA);
          
          // Start periodic polling if needed
          if (this.realTimeDataInterval) {
            clearInterval(this.realTimeDataInterval);
          }
          
          // Poll less frequently initially to see what works
          this.realTimeDataInterval = setInterval(() => {
            this.sendWellueCommand(this.WELLUE_CMD_GET_RT_DATA);
          }, 2000); // Try every 2 seconds
        }, 2000);
      }, 1000); // Wait 1 second before sending any commands
      
    } catch (error) {
      log.error('Error setting up Wellue notifications:', error);
    }
  }

  calculateCRC8(buffer) {
    // CRC8 table exactly as specified in Wellue documentation (page 6-7)
    const table = [
      0x00, 0x07, 0x0E, 0x09, 0x1C, 0x1B, 0x12, 0x15, 0x38, 0x3F, 0x36, 0x31, 0x24, 0x23, 0x2A, 0x2D,
      0x70, 0x77, 0x7E, 0x79, 0x6C, 0x6B, 0x62, 0x65, 0x48, 0x4F, 0x46, 0x41, 0x54, 0x53, 0x5A, 0x5D,
      0xE0, 0xE7, 0xEE, 0xE9, 0xFC, 0xFB, 0xF2, 0xF5, 0xD8, 0xDF, 0xD6, 0xD1, 0xC4, 0xC3, 0xCA, 0xCD,
      0x90, 0x97, 0x9E, 0x99, 0x8C, 0x8B, 0x82, 0x85, 0xA8, 0xAF, 0xA6, 0xA1, 0xB4, 0xB3, 0xBA, 0xBD,
      0xC7, 0xC0, 0xC9, 0xCE, 0xDB, 0xDC, 0xD5, 0xD2, 0xFF, 0xF8, 0xF1, 0xF6, 0xE3, 0xE4, 0xED, 0xEA,
      0xB7, 0xB0, 0xB9, 0xBE, 0xAB, 0xAC, 0xA5, 0xA2, 0x8F, 0x88, 0x81, 0x86, 0x93, 0x94, 0x9D, 0x9A,
      0x27, 0x20, 0x29, 0x2E, 0x3B, 0x3C, 0x35, 0x32, 0x1F, 0x18, 0x11, 0x16, 0x03, 0x04, 0x0D, 0x0A,
      0x57, 0x50, 0x59, 0x5E, 0x4B, 0x4C, 0x45, 0x42, 0x6F, 0x68, 0x61, 0x66, 0x73, 0x74, 0x7D, 0x7A,
      0x89, 0x8E, 0x87, 0x80, 0x95, 0x92, 0x9B, 0x9C, 0xB1, 0xB6, 0xBF, 0xB8, 0xAD, 0xAA, 0xA3, 0xA4,
      0xF9, 0xFE, 0xF7, 0xF0, 0xE5, 0xE2, 0xEB, 0xEC, 0xC1, 0xC6, 0xCF, 0xC8, 0xDD, 0xDA, 0xD3, 0xD4,
      0x69, 0x6E, 0x67, 0x60, 0x75, 0x72, 0x7B, 0x7C, 0x51, 0x56, 0x5F, 0x58, 0x4D, 0x4A, 0x43, 0x44,
      0x19, 0x1E, 0x17, 0x10, 0x05, 0x02, 0x0B, 0x0C, 0x21, 0x26, 0x2F, 0x28, 0x3D, 0x3A, 0x33, 0x34,
      0x4E, 0x49, 0x40, 0x47, 0x52, 0x55, 0x5C, 0x5B, 0x76, 0x71, 0x78, 0x7F, 0x6A, 0x6D, 0x64, 0x63,
      0x3E, 0x39, 0x30, 0x37, 0x22, 0x25, 0x2C, 0x2B, 0x06, 0x01, 0x08, 0x0F, 0x1A, 0x1D, 0x14, 0x13,
      0xAE, 0xA9, 0xA0, 0xA7, 0xB2, 0xB5, 0xBC, 0xBB, 0x96, 0x91, 0x98, 0x9F, 0x8A, 0x8D, 0x84, 0x83,
      0xDE, 0xD9, 0xD0, 0xD7, 0xC2, 0xC5, 0xCC, 0xCB, 0xE6, 0xE1, 0xE8, 0xEF, 0xFA, 0xFD, 0xF4, 0xF3
    ];
    
    let crc = 0;
    for (let i = 0; i < buffer.length; i++) {
      crc = table[crc ^ buffer[i]];
    }
    return crc;
  }

  async sendWellueCommand(command, data = null) {
    if (!this.pulseOxDevice || !this.isPulseOxConnected) {
      log.warn('Cannot send command - Wellue device not connected');
      return;
    }

    try {
      // Calculate packet size based on data
      const dataSize = data ? data.length : 0;
      const packetSize = 7 + dataSize + 1; // Header(7) + Data + CRC(1)
      
      const commandPacket = Buffer.alloc(packetSize);
      
      // Build packet according to Wellue protocol specification
      commandPacket[0] = this.WELLUE_CMD_HEADER;     // Magic (0xAA)
      commandPacket[1] = command;                    // CMD
      commandPacket[2] = ~command & 0xFF;            // NCMD (negated command)
      
      // PKT_NR (2 bytes, little-endian)
      commandPacket[3] = this.welluePacketNumber & 0xFF;        // PKT_NR_L
      commandPacket[4] = (this.welluePacketNumber >> 8) & 0xFF;  // PKT_NR_H
      
      // PKT_BUF_SIZE (2 bytes, little-endian)
      commandPacket[5] = dataSize & 0xFF;            // PKT_BUF_SIZE_L
      commandPacket[6] = (dataSize >> 8) & 0xFF;     // PKT_BUF_SIZE_H
      
      // DATA (if any)
      if (data) {
        data.copy(commandPacket, 7);
      }
      
      // Calculate CRC8 for all bytes except CRC itself
      const crc = this.calculateCRC8(commandPacket.slice(0, packetSize - 1));
      commandPacket[packetSize - 1] = crc;
      
      this.welluePacketNumber++; // Increment packet number for next command
      
      // Only log non-real-time commands to reduce verbosity
      if (command !== this.WELLUE_CMD_GET_RT_DATA) {
        log.info(`📤 Sending Wellue command: 0x${command.toString(16).toUpperCase()}, packet #${this.welluePacketNumber - 1}`);
      }
      
      await this.pulseOxDevice.writeCharacteristicWithoutResponseForService(
        this.WELLUE_SERVICE_UUID,
        this.WELLUE_RX_CHARACTERISTIC_UUID,
        commandPacket.toString('base64')
      );
    } catch (error) {
      log.error('Failed to send Wellue command:', error);
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
        // Handle different response types
        if (parsedData.type === 'device_info') {
          log.info('✅ Device info received:', parsedData.data);
          // Could emit device info event here if needed
        } else if (parsedData.type === 'ping') {
          log.info('✅ PING successful');
        } else if (parsedData.spo2 !== undefined || parsedData.heartRate !== undefined) {
          // This is real-time data
          // Send to UI callback if available
          if (this.onPulseOxDataReceived) {
            this.onPulseOxDataReceived(parsedData);
          }
          
          // Send to session manager if session is active
          if (EnhancedSessionManager.getSessionInfo().isActive) {
            EnhancedSessionManager.addReading(parsedData);
          }
        }
      }
    } catch (error) {
      log.error('Error handling Wellue data:', error);
    }
  }

  parseWellueData(base64Data) {
    try {
      const buffer = Buffer.from(base64Data, 'base64');
      
      // Log raw buffer for debugging
      if (buffer.length <= 20) {
        const hexString = Array.from(buffer).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ');
        log.info(`📦 Raw data (${buffer.length} bytes): ${hexString}`);
      }
      
      // Check for response packet header (0x55)
      if (buffer[0] === this.WELLUE_ACK_HEADER) {
        const ackCommand = buffer[1];
        
        // Handle different response types based on ACK command
        switch(ackCommand) {
          case this.WELLUE_CMD_GET_RT_DATA:
            // Don't log every real-time data response (too verbose)
            return this.parseWellueRealTimeData(buffer, base64Data);
            
          case this.WELLUE_CMD_GET_DEVICE_INFO:
            log.info('📋 Received device info response');
            return this.parseWellueDeviceInfo(buffer);
            
          case this.WELLUE_CMD_PING:
            log.info('🏓 Received PING response');
            return { type: 'ping', status: 'ok' };
            
          case 0x00: // Success ACK
            // Check if this ACK contains data
            if (buffer.length >= 13 && buffer[2] === 0xff) {
              const dataSize = buffer[5] | (buffer[6] << 8);
              
              if (dataSize === 13 && buffer.length >= 20) {
                // This is real-time data in ACK format
                log.debug('Real-time data in ACK response');
                return this.parseWellueRealTimeData(buffer, base64Data);
              }
            }
            log.info('✅ Command acknowledged successfully');
            return { type: 'ack', status: 'success' };
            
          case 0x01: // Failure ACK
            log.warn('❌ Command failed');
            return { type: 'ack', status: 'fail' };
            
          default:
            log.info(`📦 Received response for command 0x${ackCommand.toString(16)}`);
            // Check if this might be an error response
            if (buffer.length >= 8) {
              const errorCode = buffer.readInt32LE(7);
              if (errorCode !== 0) {
                log.warn(`Error code in response: ${errorCode}`);
              }
            }
            return null;
        }
      } else if (buffer.length === 8) {
        // Legacy 8-byte packet format (if still used)
        log.info('📊 Trying 8-byte packet format...');
        return this.parseWellue8BytePacket(buffer, base64Data);
      } else if (buffer.length === 1) {
        // Single byte response - might be streaming data byte-by-byte
        const byte = buffer[0];
        
        // Initialize streaming buffer if needed
        if (!this.streamingBuffer) {
          this.streamingBuffer = [];
          this.streamingStartTime = Date.now();
        }
        
        // Add byte to streaming buffer
        this.streamingBuffer.push(byte);
        
        // Log streaming pattern detection
        if (this.streamingBuffer.length === 1) {
          log.info(`🔄 Potential streaming data starting with: 0x${byte.toString(16)}`);
        }
        
        // Check if we have enough bytes for a complete packet
        if (this.streamingBuffer.length >= 8) {
          log.info(`📦 Assembled ${this.streamingBuffer.length} bytes, attempting to parse...`);
          const assembledBuffer = Buffer.from(this.streamingBuffer);
          
          // Try to parse assembled buffer
          const result = this.parseWellue8BytePacket(assembledBuffer, assembledBuffer.toString('base64'));
          
          // Reset streaming buffer
          this.streamingBuffer = [];
          
          if (result) {
            return result;
          }
        }
        
        // Clean up old streaming buffer if timeout
        if (Date.now() - this.streamingStartTime > 5000) {
          log.info('⏱️ Streaming buffer timeout, resetting...');
          this.streamingBuffer = [];
        }
        
        return null;
      } else {
        log.debug(`Unexpected packet format - Header: 0x${buffer[0]?.toString(16)}, Length: ${buffer.length}`);
        
        // Try to parse any packet that might contain SpO2/HR data
        if (buffer.length >= 7) {
          // Try parsing as potential real-time data in different format
          log.info('🔄 Attempting alternative parsing...');
          return this.parseAlternativeFormat(buffer, base64Data);
        }
        
        return null;
      }
      
    } catch (error) {
      // This is expected when trying different parsing formats
      log.debug('⚠️ Wellue data format not recognized, trying alternatives:', error.message);
      return null;
    }
  }
  
  parseAlternativeFormat(buffer, originalBase64Data) {
    try {
      // Log what we're trying to parse
      const hexString = Array.from(buffer.slice(0, Math.min(10, buffer.length)))
        .map(b => '0x' + b.toString(16).padStart(2, '0'))
        .join(' ');
      log.info(`🔄 Alternative format data: ${hexString}...`);
      
      // Common patterns in pulse oximeter data:
      // SpO2 is usually 0-100, HR is usually 30-250
      
      // Try different byte positions for SpO2 and HR
      const attempts = [
        { spo2Idx: 0, hrIdx: 1 },  // First two bytes
        { spo2Idx: 1, hrIdx: 2 },  // Second and third
        { spo2Idx: 4, hrIdx: 5 },  // Fifth and sixth (common in some protocols)
        { spo2Idx: 5, hrIdx: 6 },  // Sixth and seventh
      ];
      
      for (const attempt of attempts) {
        if (buffer.length > Math.max(attempt.spo2Idx, attempt.hrIdx)) {
          const spo2 = buffer[attempt.spo2Idx];
          const hr = buffer[attempt.hrIdx];
          
          // Validate ranges
          if (spo2 >= 70 && spo2 <= 100 && hr >= 30 && hr <= 250) {
            log.info(`✅ Found valid data at positions ${attempt.spo2Idx},${attempt.hrIdx}: SpO2=${spo2}, HR=${hr}`);
            
            return {
              spo2,
              heartRate: hr,
              perfusionIndex: null,
              signalStrength: null,
              isFingerDetected: true,
              isSearchingForPulse: false,
              isLowPerfusion: false,
              isMotionDetected: false,
              pleth: null,
              bargraph: null,
              timestamp: Date.now(),
              rawData: originalBase64Data,
              protocol: 'wellue-alternative'
            };
          }
        }
      }
      
      return null;
    } catch (error) {
      log.error('Error in alternative parsing:', error);
      return null;
    }
  }
  
  parseWellueDeviceInfo(buffer) {
    try {
      // Response packet structure from documentation
      const ackBufSizeL = buffer[5];
      const ackBufSizeH = buffer[6];
      const ackBufSize = ackBufSizeL | (ackBufSizeH << 8);
      
      if (ackBufSize > 0 && buffer.length > 7) {
        // Extract the JSON data from ACK_BUF
        const jsonData = buffer.slice(7, 7 + ackBufSize).toString('utf8');
        
        try {
          const deviceInfo = JSON.parse(jsonData);
          log.info('📋 Device information:', deviceInfo);
          
          // Store device info for reference
          this.wellueDeviceInfo = deviceInfo;
          
          return {
            type: 'device_info',
            data: deviceInfo
          };
        } catch (jsonError) {
          log.error('Failed to parse device info JSON:', jsonError);
          log.info('Raw JSON string:', jsonData);
        }
      }
      
      return null;
    } catch (error) {
      log.error('Error parsing device info:', error);
      return null;
    }
  }

  parseWellueRealTimeData(buffer, originalBase64Data) {
    try {
      // Check if this is an ACK response with data
      if (buffer.length >= 13 && buffer[2] === 0xff) {
        // This appears to be an ACK with embedded data
        // ACK format: 0x55 0x00 0xff [packet_nr] [buf_size] [data...]
        const dataSize = buffer[5] | (buffer[6] << 8);
        
        if (dataSize === 13 && buffer.length >= 20) {
          // Real-time data is 13 bytes starting at offset 7
          // Based on the documentation format (page 17)
          const dataOffset = 7;
          const spo2 = buffer[dataOffset + 0];  // Byte 0: SpO2
          const pulseRateLow = buffer[dataOffset + 1];  // Byte 1: PR low byte
          const pulseRateHigh = buffer[dataOffset + 2]; // Byte 2: PR high byte
          const pulseRate = pulseRateLow | (pulseRateHigh << 8);
          
          // Additional data
          const steps = buffer.readUInt32LE(dataOffset + 3); // Bytes 3-6: Steps
          const battery = buffer[dataOffset + 7]; // Byte 7: Battery %
          const chargeStatus = buffer[dataOffset + 8]; // Byte 8: Charging status
          const acceleration = buffer[dataOffset + 9]; // Byte 9: Acceleration
          const pi = buffer[dataOffset + 10]; // Byte 10: PI
          const wearStatus = buffer[dataOffset + 11]; // Byte 11: Wear status
          
          // Check for valid ranges
          const isSpo2Valid = spo2 > 0 && spo2 <= 100;
          const isPulseValid = pulseRate > 0 && pulseRate < 300;
          
          // Check wear status (bit 0 of byte 11: 1=wearing, 0=not wearing)
          const isWearing = (wearStatus & 0x01) === 1;
          
          if ((isSpo2Valid || isPulseValid) && isWearing) {
            const result = {
              spo2: isSpo2Valid ? spo2 : null,
              heartRate: isPulseValid ? pulseRate : null,
              perfusionIndex: pi / 10.0, // PI is in tenths
              signalStrength: acceleration, // Use acceleration as signal indicator
              isFingerDetected: isWearing,
              isSearchingForPulse: false,
              isLowPerfusion: pi < 10, // PI less than 1.0%
              isMotionDetected: acceleration > 50,
              pleth: null,
              bargraph: null,
              battery: battery,
              chargeStatus: chargeStatus, // 0=not charging, 1=charging, 2=fully charged
              timestamp: Date.now(),
              rawData: originalBase64Data,
              protocol: 'wellue-rt-ack'
            };
            
            log.info(`✅ Valid readings - SpO2: ${result.spo2}%, HR: ${result.heartRate} bpm, PI: ${result.perfusionIndex}%, Battery: ${battery}%`);
            return result;
          } else if (!isWearing) {
            // Device is not being worn
            return {
              spo2: null,
              heartRate: null,
              perfusionIndex: null,
              signalStrength: 0,
              isFingerDetected: false,
              isSearchingForPulse: false,
              isLowPerfusion: false,
              isMotionDetected: false,
              pleth: null,
              bargraph: null,
              battery: battery,
              timestamp: Date.now(),
              rawData: originalBase64Data,
              protocol: 'wellue-rt-ack'
            };
          }
        }
      }
      
      // Try standard format from documentation
      if (buffer.length >= 21) {
        const dataOffset = 7;
        const spo2 = buffer[dataOffset + 0];
        const pulseRate = buffer.readUInt16LE(dataOffset + 1);
        const perfusionIndex = buffer[dataOffset + 10] / 10.0;
        const isFingerDetected = (buffer[dataOffset + 11] & 0x01) !== 0;

        const result = {
          spo2: isFingerDetected ? spo2 : null,
          heartRate: isFingerDetected ? pulseRate : null,
          perfusionIndex: isFingerDetected ? perfusionIndex : null,
          signalStrength: null,
          isFingerDetected,
          isSearchingForPulse: false,
          isLowPerfusion: false,
          isMotionDetected: false,
          pleth: null,
          bargraph: null,
          timestamp: Date.now(),
          rawData: originalBase64Data,
          protocol: 'wellue-rt'
        };

        if (result.spo2 !== null && result.heartRate !== null) {
          log.info(`✅ Valid readings - SpO2: ${result.spo2}%, HR: ${result.heartRate} bpm`);
        }

        return result;
      }
      
      return null;
    } catch (error) {
      log.error('Error parsing Wellue real-time data:', error);
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

          if (this.realTimeDataInterval) {
            clearInterval(this.realTimeDataInterval);
            this.realTimeDataInterval = null;
          }
          
          if (this.readInterval) {
            clearInterval(this.readInterval);
            this.readInterval = null;
          }
          
          // Clear streaming buffer
          this.streamingBuffer = [];

          await this.pulseOxDevice.cancelConnection();
          this.pulseOxDevice = null;
          this.isPulseOxConnected = false;
          
          // Notify connection change
          if (this.onConnectionChangeCallback) {
            this.onConnectionChangeCallback(false);
          }
          
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

  setOnConnectionChange(callback) {
    this.onConnectionChangeCallback = callback;
    // Also call the callback with current connection status
    if (callback) {
      callback(this.isPulseOxConnected);
    }
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
    log.info(' Device disconnected - implementing resilient recovery');
    
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
        log.info(' No recovery achieved - terminating session');
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
        log.info(' Connection recovered - session continuing normally');
        EnhancedSessionManager.setConnectionState('connected');
      }
    }, 30000); // 30 second recovery window
  }

  // Berry Med BCI Protocol Methods (for testing compatibility)
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
      
      log.info('✅ Found BCI service:', bciService.uuid);
      
      // Get characteristics
      const characteristics = await bciService.characteristics();
      log.info('BCI service characteristics:', characteristics.map(c => ({
        uuid: c.uuid,
        isNotifiable: c.isNotifiable,
        isReadable: c.isReadable,
        isWritable: c.isWritable
      })));
      
      // Find the data characteristic
      const dataCharacteristic = characteristics.find(char =>
        char.uuid.toUpperCase() === this.BCI_DATA_CHARACTERISTIC_UUID.toUpperCase()
      );
      
      if (!dataCharacteristic) {
        log.error('❌ BCI data characteristic not found!');
        return;
      }
      
      log.info('✅ Found BCI data characteristic:', dataCharacteristic.uuid);
      
      // Enable notifications
      if (dataCharacteristic.isNotifiable) {
        log.info('📡 Enabling BCI data notifications...');
        
        dataCharacteristic.monitor((error, characteristic) => {
          if (error) {
            if (error.message && error.message.includes('cancelled')) {
              log.info('📡 BCI data monitoring stopped (connection cancelled)');
              this.handleDeviceDisconnected();
            } else {
              log.error('BCI notification error:', error);
            }
            return;
          }
          
          if (characteristic && characteristic.value) {
            // log.info('📦 Raw BCI data received:', characteristic.value); // Disabled: high frequency logging
            this.handleBCIDataReceived(characteristic.value);
          }
        });
        
        log.info('✅ BCI notifications enabled');
      } else {
        log.error('❌ BCI data characteristic is not notifiable');
      }
      
    } catch (error) {
      log.error('Error setting up BCI notifications:', error);
    }
  }

  handleBCIDataReceived(data) {
    try {
      // Safety check
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
        
        // Send to session manager if active
        if (EnhancedSessionManager && EnhancedSessionManager.isActive) {
          EnhancedSessionManager.addReading(parsedData);
        }
      }
    } catch (error) {
      log.error('Error handling BCI data:', error);
    }
  }

  parseBCIData(base64Data) {
    try {
      // log.info('🔍 Parsing BCI data:', base64Data); // Disabled: high frequency logging
      
      // Decode base64 to buffer
      const buffer = Buffer.from(base64Data, 'base64');
      // log.info('📊 Buffer length:', buffer.length); // Disabled: high frequency logging
      
      // Handle different packet sizes
      let packets = [];
      
      if (buffer.length === 5) {
        // Single 5-byte packet
        packets = [buffer];
      } else if (buffer.length === 20) {
        // Four 5-byte packets concatenated
        for (let i = 0; i < 4; i++) {
          const packetStart = i * 5;
          const packet = buffer.slice(packetStart, packetStart + 5);
          packets.push(packet);
        }
      } else {
        // Try to process first 5 bytes if available
        if (buffer.length >= 5) {
          packets = [buffer.slice(0, 5)];
        } else {
          log.warn('Buffer too short for BCI parsing');
          return null;
        }
      }
      
      // Process the latest packet
      const latestPacket = packets[packets.length - 1];
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
      
      // Parse according to BCI protocol specification
      
      // Signal strength (byte 1, bits 0-3)
      const signalStrength = byte1 & 0x0F;
      
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
      
      // Return data compatible with Wellue format
      const result = {
        spo2,
        heartRate: pulseRate,
        signalStrength,
        isFingerDetected,
        isSearchingForPulse,
        isLowPerfusion: false, // BCI doesn't have this
        isMotionDetected: false, // BCI doesn't have this
        pleth: isPlethValid ? pleth : null,
        perfusionIndex: null, // BCI doesn't have PI
        bargraph: null,
        timestamp: Date.now(),
        rawData: originalBase64Data,
        protocol: 'bci' // Mark as BCI protocol
      };
      
      if (spo2 !== null || pulseRate !== null) {
        // log.info('✅ Valid BCI data:', result); // Disabled: high frequency logging
      } else {
        // log.info('⚠️ BCI status data (no valid measurements):', result); // Disabled: high frequency logging
      }
      
      return result;
      
    } catch (error) {
      log.error('Error parsing BCI packet:', error);
      return null;
    }
  }
}

export default new BluetoothService();