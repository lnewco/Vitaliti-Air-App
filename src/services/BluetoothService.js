import { BleManager } from 'react-native-ble-plx';
import { Platform, PermissionsAndroid } from 'react-native';
import { Buffer } from 'buffer';
import EnhancedSessionManager from './EnhancedSessionManager';
import HRV_CONFIG, { HRV_HELPERS } from '../config/hrvConfig';
import logger from '../utils/logger';

const log = logger.createModuleLogger('BluetoothService');

// Sliding Window class for managing RR intervals
class SlidingWindow {
  constructor(maxSize) {
    this.maxSize = maxSize;
    this.intervals = [];
    this.timestamps = [];
  }

  add(interval, timestamp = Date.now()) {
    // Validate interval before adding
    if (!HRV_HELPERS.isValidRRInterval(interval)) {
      log.debug(`Invalid RR interval rejected: ${interval}ms`);
      return false;
    }

    this.intervals.push(interval);
    this.timestamps.push(timestamp);

    // Keep only the most recent intervals
    if (this.intervals.length > this.maxSize) {
      this.intervals.shift();
      this.timestamps.shift();
    }

    return true;
  }

  getSize() {
    return this.intervals.length;
  }

  getAll() {
    return [...this.intervals];
  }

  getRecent(count) {
    if (count >= this.intervals.length) {
      return [...this.intervals];
    }
    return this.intervals.slice(-count);
  }

  clear() {
    this.intervals = [];
    this.timestamps = [];
  }

  getTimespan() {
    if (this.timestamps.length < 2) return 0;
    return this.timestamps[this.timestamps.length - 1] - this.timestamps[0];
  }
}

class BluetoothService {
  constructor() {
    this.manager = new BleManager();
    this.pulseOxDevice = null;
    this.hrDevice = null;
    this.onDeviceFound = null;
    this.onPulseOxDataReceived = null;
    this.onHRDataReceived = null;
    this.onConnectionStatusChanged = null;
    this.isScanning = false;
    this.isPulseOxConnected = false;
    this.isHRConnected = false;
    this.currentScanType = 'pulse-ox'; // 'pulse-ox' or 'hr-monitor'
    
    // Connection resilience properties
    this.connectionRecoveryTimer = null;
    this.lastDisconnectTime = null;

    // BCI Protocol specific UUIDs (Pulse Oximeter)
    this.BCI_SERVICE_UUID = '49535343-FE7D-4AE5-8FA9-9FAFD205E455';
    this.BCI_DATA_CHARACTERISTIC_UUID = '49535343-1E4D-4BD9-BA61-23C647249616'; // Device sends data to app (notifiable)
    this.BCI_COMMAND_CHARACTERISTIC_UUID = '49535343-8841-43F4-A8D4-ECBE34729BB3'; // App sends commands to device

    // Standard BLE Heart Rate Service UUIDs (WHOOP/HR Monitors)
    this.HR_SERVICE_UUID = '180D';
    this.HR_MEASUREMENT_CHARACTERISTIC_UUID = '2A37';
    this.HR_CONTROL_POINT_CHARACTERISTIC_UUID = '2A39';
    
    // Dual-Timeframe HRV calculation state
    this.quickHRVWindow = new SlidingWindow(HRV_CONFIG.QUICK.MAX_WINDOW_SIZE);
    this.realHRVWindow = new SlidingWindow(HRV_CONFIG.REAL.MAX_WINDOW_SIZE);
    this.lastQuickHRVCalculation = 0;
    this.lastRealHRVCalculation = 0;
    this.sessionStartTime = Date.now();
    
    // Current HRV values
    this.currentQuickHRV = null;
    this.currentRealHRV = null;
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
      const state = await this.manager.state();
      return state === 'PoweredOn';
    } catch (error) {
      log.error('Error checking Bluetooth state:', error);
      return false;
    }
  }

  async startScanning(deviceType = 'pulse-ox') {
    try {
      log.info(`Starting ${deviceType} device scan...`);
      this.currentScanType = deviceType;
      this.isScanning = true;
      
      // Determine which services to scan for
      let serviceUUIDs = null; // null means scan all devices
      if (deviceType === 'pulse-ox') {
        // Pulse oximeters reliably advertise their service UUID
        serviceUUIDs = [this.BCI_SERVICE_UUID];
      } else if (deviceType === 'hr-monitor') {
        // HR monitors (like WHOOP) often don't advertise HR service in advertisements
        // Scan all devices and filter by name patterns instead
        serviceUUIDs = null;
      } else {
        // Scan for both types - use no filter to catch HR monitors
        serviceUUIDs = null;
      }
      
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

  async stopScanning() {
    try {
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
    
    // Debug WHOOP detection specifically
    if (device.name && device.name.toLowerCase().includes('whoop')) {
      log.info('WHOOP device detected by name!', device.name);
    }

    // Determine device type and log appropriate message
    const deviceType = this.getDeviceType(device);
    if (deviceType === 'pulse-ox') {
      log.info('Pulse Oximeter device found:', device.name || device.localName || 'Unknown');
    } else if (deviceType === 'hr-monitor') {
      log.info('Heart Rate Monitor device found:', device.name || device.localName || 'Unknown');
    } else {
      log.info('Unknown device found:', device.name || device.localName || 'Unknown', 'Services:', device.serviceUUIDs);
    }

    // Only report devices that match the current scan type (or if scanning for 'all')
    const shouldReport = this.currentScanType === 'all' || 
                        this.currentScanType === deviceType ||
                        (this.currentScanType === 'both' && (deviceType === 'pulse-ox' || deviceType === 'hr-monitor'));

    if (shouldReport && this.onDeviceFound) {
      log.info(`� Reporting ${deviceType} device (scan type: ${this.currentScanType})`);
      // Add deviceType property while preserving device methods
      device.deviceType = deviceType;
      this.onDeviceFound(device);
    } else if (deviceType !== 'unknown') {
      log.info(`⏭️ Skipping ${deviceType} device (looking for ${this.currentScanType})`);
    }
  }

  getDeviceType(device) {
    // Check service UUIDs first (most reliable)
    if (device.serviceUUIDs) {
      if (device.serviceUUIDs.includes(this.BCI_SERVICE_UUID)) {
        return 'pulse-ox';
      }
      if (device.serviceUUIDs.includes(this.HR_SERVICE_UUID)) {
        return 'hr-monitor';
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

    // Check for HR monitor keywords - expanded for WHOOP and other devices
    const hrKeywords = ['whoop', 'heart', 'rate', 'hr', 'polar', 'garmin', 'chest', 'hrm', 'strap', 'monitor', 'wahoo', 'suunto', 'sensor'];
    const hasHRKeyword = hrKeywords.some(keyword =>
      deviceText.includes(keyword.toLowerCase())
    );
    
    // Also check for devices that might not have descriptive names but have HR service
    const hasHRService = device.serviceUUIDs && device.serviceUUIDs.includes(this.HR_SERVICE_UUID);

    if (hasPulseOxKeyword) return 'pulse-ox';
    if (hasHRKeyword || hasHRService) return 'hr-monitor';
    
    return 'unknown';
  }

  isBCIDevice(device) {
    return this.getDeviceType(device) === 'pulse-ox';
  }

  isHRDevice(device) {
    return this.getDeviceType(device) === 'hr-monitor';
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
      
      // Store device reference based on type
      if (deviceType === 'pulse-ox') {
        this.pulseOxDevice = discoveredDevice;
        this.isPulseOxConnected = true;
        log.info('Pulse Oximeter services discovered');
        await this.setupBCINotifications(discoveredDevice);
      } else if (deviceType === 'hr-monitor') {
        this.hrDevice = discoveredDevice;
        this.isHRConnected = true;
        log.info('Heart Rate Monitor services discovered');
        await this.setupHRNotifications(discoveredDevice);
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
      } else if (deviceType === 'hr-monitor') {
        this.isHRConnected = false;
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

  async setupHRNotifications(device) {
    try {
      log.info('Setting up HR notifications...');
      
      // Get the HR service
      const services = await device.services();
      log.info('Available services:', services.map(s => s.uuid));
      
      const hrService = services.find(service => {
        const serviceUUID = service.uuid.toUpperCase();
        const targetUUID = this.HR_SERVICE_UUID.toUpperCase();
        
        log.debug(`UUID Comparison: Service="${serviceUUID}" vs Target="${targetUUID}"`);
        
        // Handle both short (180D) and full (0000180D-0000-1000-8000-00805F9B34FB) UUID formats
        const matches = serviceUUID === targetUUID || 
                       serviceUUID === `0000${targetUUID}-0000-1000-8000-00805F9B34FB` ||
                       serviceUUID.includes(targetUUID);
        
        if (matches) {
          log.info(`Found matching HR service: ${serviceUUID}`);
        }
        
        return matches;
      });
      
      if (!hrService) {
        log.error('❌ HR service not found!');
        log.info('Available services:', services.map(s => s.uuid));
        return;
      }
      
      log.info('Found HR service:', hrService.uuid);
      
      // Get characteristics
      const characteristics = await hrService.characteristics();
      log.info('HR service characteristics:', characteristics.map(c => ({
        uuid: c.uuid,
        isNotifiable: c.isNotifiable,
        isReadable: c.isReadable,
        isWritable: c.isWritable
      })));
      
      // Find the HR measurement characteristic
      const hrMeasurementCharacteristic = characteristics.find(char => {
        const charUUID = char.uuid.toUpperCase();
        const targetUUID = this.HR_MEASUREMENT_CHARACTERISTIC_UUID.toUpperCase();
        
        // Handle both short (2A37) and full (00002A37-0000-1000-8000-00805F9B34FB) UUID formats
        return charUUID === targetUUID || 
               charUUID === `0000${targetUUID}-0000-1000-8000-00805F9B34FB` ||
               charUUID.includes(targetUUID);
      });
      
      if (!hrMeasurementCharacteristic) {
        log.error('❌ HR measurement characteristic not found!');
        return;
      }
      
      log.info('Found HR measurement characteristic:', hrMeasurementCharacteristic.uuid);
      log.info('� Characteristic properties:', {
        isNotifiable: hrMeasurementCharacteristic.isNotifiable,
        isReadable: hrMeasurementCharacteristic.isReadable,
        isWritable: hrMeasurementCharacteristic.isWritable
      });
      
      // Enable notifications for HR data
      if (hrMeasurementCharacteristic.isNotifiable) {
        log.info('� Enabling HR data notifications...');
        
        hrMeasurementCharacteristic.monitor((error, characteristic) => {
          if (error) {
            if (error.message && error.message.includes('cancelled')) {
              log.info('� HR data monitoring stopped (connection cancelled)');
            } else {
              log.error('HR notification error:', error);
            }
            return;
          }
          
          if (characteristic && characteristic.value) {
            // log.info('� Raw HR data received:', characteristic.value); // Disabled: high frequency logging
            this.handleHRDataReceived(characteristic.value);
          }
        });
        
        log.info('HR notifications enabled');
      } else {
        log.error('❌ HR measurement characteristic is not notifiable');
      }
      
    } catch (error) {
      log.error('Error setting up HR notifications:', error);
    }
  }

  handleBCIDataReceived(data) {
    try {
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

  handleHRDataReceived(data) {
    try {
      const parsedData = this.parseHRData(data);
      if (parsedData) {
        // Send to UI callback if available
        if (this.onHRDataReceived) {
          this.onHRDataReceived(parsedData);
        }
        
        // Send to session manager if session is active
        if (EnhancedSessionManager.getSessionInfo().isActive) {
          EnhancedSessionManager.addReading(parsedData);
        }
      }
    } catch (error) {
      log.error('Error handling HR data:', error);
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
      //   isPlethValid
      // });
      
      // Return data even if values are invalid so we can show status
      const result = {
        spo2,
        heartRate: pulseRate,
        signalStrength,
        isFingerDetected,
        isSearchingForPulse,
        pleth: isPlethValid ? pleth : null,
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

  parseHRData(base64Data) {
    try {
      // log.info('Parsing HR data:', base64Data); // Disabled: high frequency logging
      
      // Decode base64 to buffer
      const buffer = Buffer.from(base64Data, 'base64');
      // log.info('HR Buffer length:', buffer.length); // Disabled: high frequency logging
      // log.info('HR Raw bytes (hex):', Array.from(buffer).map(b => '0x' + b.toString(16).padStart(2, '0').toUpperCase()).join(' ')); // Disabled: high frequency logging
      
      if (buffer.length < 2) {
        log.info('HR buffer too short');
        return null;
      }

      // Parse according to BLE Heart Rate Measurement specification
      // https://www.bluetooth.com/specifications/gatt/characteristics/
      
      // First byte contains flags
      const flags = buffer[0];
      const hrFormat16Bit = (flags & 0x01) !== 0; // Bit 0: HR format (0=8bit, 1=16bit)
      const sensorContactSupported = (flags & 0x04) !== 0; // Bit 2: Sensor contact supported
      const sensorContactDetected = (flags & 0x02) !== 0; // Bit 1: Sensor contact detected
      const energyExpendedPresent = (flags & 0x08) !== 0; // Bit 3: Energy expended present
      const rrIntervalsPresent = (flags & 0x10) !== 0; // Bit 4: RR intervals present

      let offset = 1;
      let heartRate = 0;

      // Parse heart rate value
      if (hrFormat16Bit) {
        if (buffer.length < offset + 2) {
          log.info('Insufficient data for 16-bit HR');
          return null;
        }
        heartRate = buffer.readUInt16LE(offset);
        offset += 2;
      } else {
        heartRate = buffer[offset];
        offset += 1;
      }

      // Skip energy expended if present
      if (energyExpendedPresent) {
        if (buffer.length < offset + 2) {
          log.info('Energy expended flag set but no data');
        } else {
          offset += 2; // Skip 2 bytes for energy expended
        }
      }

      // Parse RR intervals if present
      let rrIntervals = [];
      if (rrIntervalsPresent && buffer.length > offset) {
        const rrDataLength = buffer.length - offset;
        const numRRIntervals = Math.floor(rrDataLength / 2);
        
        for (let i = 0; i < numRRIntervals; i++) {
          if (offset + 2 <= buffer.length) {
            // RR intervals are in 1/1024 second units
            const rrRaw = buffer.readUInt16LE(offset);
            const rrMs = (rrRaw / 1024) * 1000; // Convert to milliseconds
            rrIntervals.push(rrMs);
            offset += 2;
          }
        }
      }

      // log.info('� HR Parsed Values:', { // Disabled: high frequency logging
      //   flags: '0x' + flags.toString(16).padStart(2, '0'),
      //   hrFormat16Bit,
      //   sensorContactSupported,
      //   sensorContactDetected,
      //   energyExpendedPresent,
      //   rrIntervalsPresent,
      //   heartRate,
      //   rrIntervals
      // });

      // Store RR intervals in dual timeframe windows
      if (rrIntervals.length > 0) {
        const now = Date.now();
        
        // Add intervals to both windows
        rrIntervals.forEach(interval => {
          this.quickHRVWindow.add(interval, now);
          this.realHRVWindow.add(interval, now);
        });
        
        // log.info(`Quick HRV: ${this.quickHRVWindow.getSize()} intervals, Real HRV: ${this.realHRVWindow.getSize()} intervals`); // Disabled: frequent logging
        
        // Calculate dual-timeframe HRV
        const hrvResults = this.calculateDualHRV(now);
        
        if (hrvResults) {
          // log.info('HRV Results:', hrvResults); // Disabled: frequent logging
        }
      }

      // Prepare HRV data for context (maintain backward compatibility)
      const legacyHRV = this.currentQuickHRV || this.currentRealHRV;
      
      // Format HRV data for database storage
      let formattedHRV = null;
      if (this.currentRealHRV) {
        // Prefer real HRV if available
        formattedHRV = {
          rmssd: this.currentRealHRV.rmssd,
          type: this.currentRealHRV.type,
          intervalCount: this.currentRealHRV.intervalCount,
          dataQuality: this.currentRealHRV.dataQuality,
          confidence: this.currentRealHRV.confidence
        };
      } else if (this.currentQuickHRV) {
        // Fall back to quick HRV
        formattedHRV = {
          rmssd: this.currentQuickHRV.rmssd,
          type: this.currentQuickHRV.type,
          intervalCount: this.currentQuickHRV.intervalCount,
          dataQuality: this.currentQuickHRV.dataQuality,
          confidence: this.currentQuickHRV.confidence
        };
      }

      const result = {
        heartRate: heartRate > 0 ? heartRate : null,
        sensorContactDetected,
        sensorContactSupported,
        rrIntervals,
        hrv: formattedHRV, // Formatted for database storage
        legacyHRV, // For backward compatibility
        quickHRV: this.currentQuickHRV,
        realHRV: this.currentRealHRV,
        sessionDuration: Date.now() - this.sessionStartTime,
        timestamp: Date.now(),
        rawData: base64Data
      };

      if (heartRate > 0) {
        // log.info('Valid HR data:', result); // Disabled: high frequency logging
      } else {
        // log.info('HR status data (no valid measurement):', result); // Disabled: high frequency logging
      }

      return result;

    } catch (error) {
      log.error('❌ Error parsing HR data:', error);
      return null;
    }
  }

  /**
   * Calculate dual-timeframe HRV (Quick HRV + Real HRV)
   * Based on research-backed approach for optimal user experience
   */
  calculateDualHRV(currentTime) {
    const results = {};
    
    // Calculate Quick HRV if we have enough intervals
    if (this.quickHRVWindow.getSize() >= HRV_CONFIG.QUICK.MIN_INTERVALS) {
      const shouldCalculateQuick = currentTime - this.lastQuickHRVCalculation >= HRV_CONFIG.QUICK.UPDATE_FREQUENCY;
      
      if (shouldCalculateQuick) {
        const quickHRV = this.calculateRMSSD(this.quickHRVWindow.getAll(), 'Quick');
        if (quickHRV) {
          this.currentQuickHRV = {
            ...quickHRV,
            type: 'quick',
            stage: HRV_HELPERS.getStageInfo(this.quickHRVWindow.getSize()),
            confidence: HRV_HELPERS.getConfidence(this.quickHRVWindow.getSize()),
            timespan: this.quickHRVWindow.getTimespan()
          };
          this.lastQuickHRVCalculation = currentTime;
          results.quickHRV = this.currentQuickHRV;
        }
      }
    }
    
    // Calculate Real HRV if we have enough intervals
    if (this.realHRVWindow.getSize() >= HRV_CONFIG.REAL.MIN_INTERVALS) {
      const shouldCalculateReal = currentTime - this.lastRealHRVCalculation >= HRV_CONFIG.REAL.UPDATE_FREQUENCY;
      
      if (shouldCalculateReal) {
        const realHRV = this.calculateRMSSD(this.realHRVWindow.getAll(), 'Real');
        if (realHRV) {
          this.currentRealHRV = {
            ...realHRV,
            type: 'real',
            stage: HRV_HELPERS.getStageInfo(this.realHRVWindow.getSize()),
            confidence: HRV_HELPERS.getConfidence(this.realHRVWindow.getSize()),
            timespan: this.realHRVWindow.getTimespan()
          };
          this.lastRealHRVCalculation = currentTime;
          results.realHRV = this.currentRealHRV;
        }
      }
    }
    
    // Always return current HRV values for context
    if (this.currentQuickHRV) {
      results.currentQuickHRV = this.currentQuickHRV;
    }
    if (this.currentRealHRV) {
      results.currentRealHRV = this.currentRealHRV;
    }
    
    return Object.keys(results).length > 0 ? results : null;
  }

  /**
   * Calculate RMSSD from RR intervals array
   * Research shows RMSSD is more reliable than pNN50
   */
  calculateRMSSD(intervals, type = 'Unknown') {
    if (intervals.length < 2) {
      log.info(`${type} HRV: Not enough intervals (${intervals.length} < 2)`);
      return null;
    }

    try {
      log.info(`🧠 ${type} HRV calculation: ${intervals.length} intervals`);
      
      // Calculate RMSSD (Root Mean Square of Successive Differences)
      const successiveDifferences = [];
      for (let i = 1; i < intervals.length; i++) {
        const diff = intervals[i] - intervals[i - 1];
        successiveDifferences.push(diff * diff);
      }

      if (successiveDifferences.length === 0) {
        log.info(`${type} HRV: No successive differences calculated`);
        return null;
      }

      const meanSquaredDiff = successiveDifferences.reduce((sum, diff) => sum + diff, 0) / successiveDifferences.length;
      const rmssd = Math.sqrt(meanSquaredDiff);

      // Get data quality using our new helper
      const dataQuality = HRV_HELPERS.getDataQuality(intervals.length);

      const result = {
        rmssd: Math.round(rmssd * 10) / 10, // Round to 1 decimal place
        intervalCount: intervals.length,
        dataQuality,
        timestamp: Date.now()
      };

      log.info(`${type} HRV calculated: RMSSD=${result.rmssd}ms (${result.dataQuality} quality)`);
      return result;
    } catch (error) {
      log.error(`❌ Error calculating ${type} HRV:`, error);
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

      if (deviceType === 'all' || deviceType === 'hr-monitor') {
        if (this.hrDevice) {
          log.info('Disconnecting from heart rate monitor...');
          await this.hrDevice.cancelConnection();
          this.hrDevice = null;
          this.isHRConnected = false;
          
          // Clear dual HRV calculation state
          this.quickHRVWindow.clear();
          this.realHRVWindow.clear();
          this.lastQuickHRVCalculation = 0;
          this.lastRealHRVCalculation = 0;
          this.currentQuickHRV = null;
          this.currentRealHRV = null;
          this.sessionStartTime = Date.now();
          
          if (this.onConnectionStatusChanged) {
            this.onConnectionStatusChanged('hr-monitor', false);
          }
          
          log.info('Heart rate monitor disconnected');
        }
      }
    } catch (error) {
      log.error('Error disconnecting:', error);
    }
  }

  async restartScanningForMissingDevices() {
    // If we have both devices connected, no need to keep scanning
    if (this.isPulseOxConnected && this.isHRConnected) {
      log.info('Both devices connected - stopping scan');
      return;
    }
    
    // Determine what device type we still need
    let scanType = 'all';
    if (this.isPulseOxConnected && !this.isHRConnected) {
      scanType = 'hr-monitor';
      log.info('Pulse ox connected - scanning for heart rate monitor');
    } else if (!this.isPulseOxConnected && this.isHRConnected) {
      scanType = 'pulse-ox';
      log.info('Heart rate monitor connected - scanning for pulse oximeter');
    } else {
      log.info('No devices connected - scanning for all devices');
    }
    
    try {
      // Restart scanning for the missing device type
      await this.startScanning(scanType);
    } catch (error) {
      log.error('❌ Failed to restart scanning:', error);
    }
  }

  cleanup() {
    this.stopScanning();
    this.disconnect();
    this.manager.destroy();
  }

  // Event handlers
  setOnDeviceFound(callback) {
    this.onDeviceFound = callback;
  }

  setOnPulseOxDataReceived(callback) {
    this.onPulseOxDataReceived = callback;
  }

  setOnHRDataReceived(callback) {
    this.onHRDataReceived = callback;
  }

  setOnConnectionStatusChanged(callback) {
    this.onConnectionStatusChanged = callback;
  }

  // Convenience getters for connection status
  get isAnyDeviceConnected() {
    return this.isPulseOxConnected || this.isHRConnected;
  }

  get connectionStatus() {
    return {
      pulseOx: this.isPulseOxConnected,
      hrMonitor: this.isHRConnected,
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