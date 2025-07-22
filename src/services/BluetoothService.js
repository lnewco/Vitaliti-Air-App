import { BleManager } from 'react-native-ble-plx';
import { Platform, PermissionsAndroid } from 'react-native';
import { Buffer } from 'buffer';
import SessionManager from './SessionManager';

class BluetoothService {
  constructor() {
    this.manager = new BleManager();
    this.currentDevice = null;
    this.onDeviceFound = null;
    this.onDataReceived = null;
    this.onConnectionStatusChanged = null;
    this.isScanning = false;
    this.isConnected = false;

    // BCI Protocol specific UUIDs
    this.BCI_SERVICE_UUID = '49535343-FE7D-4AE5-8FA9-9FAFD205E455';
    this.BCI_DATA_CHARACTERISTIC_UUID = '49535343-1E4D-4BD9-BA61-23C647249616'; // Device sends data to app (notifiable)
    this.BCI_COMMAND_CHARACTERISTIC_UUID = '49535343-8841-43F4-A8D4-ECBE34729BB3'; // App sends commands to device
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
      console.error('Permission request failed:', error);
      return false;
    }
  }

  async isBluetoothEnabled() {
    try {
      const state = await this.manager.state();
      return state === 'PoweredOn';
    } catch (error) {
      console.error('Error checking Bluetooth state:', error);
      return false;
    }
  }

  async startScanning() {
    try {
      console.log('Starting BCI device scan...');
      this.isScanning = true;
      
      // Scan for devices with the BCI service UUID
      this.manager.startDeviceScan([this.BCI_SERVICE_UUID], null, (error, device) => {
        if (error) {
          console.error('Scan error:', error);
          return;
        }
        
        if (device) {
          this.handleDeviceDiscovered(device);
        }
      });
    } catch (error) {
      console.error('Error starting scan:', error);
      this.isScanning = false;
    }
  }

  async stopScanning() {
    try {
      console.log('Stopping device scan...');
      this.manager.stopDeviceScan();
      this.isScanning = false;
    } catch (error) {
      console.error('Error stopping scan:', error);
    }
  }

  handleDeviceDiscovered(device) {
    console.log('BCI Device discovered:', {
      name: device.name,
      localName: device.localName,
      id: device.id,
      rssi: device.rssi,
      serviceUUIDs: device.serviceUUIDs
    });

    // Check if this looks like a BCI/Berry Med device
    if (this.isBCIDevice(device)) {
      console.log('✅ BCI Protocol device found:', device.name || device.localName || 'Unknown');
    }

    if (this.onDeviceFound) {
      this.onDeviceFound(device);
    }
  }

  isBCIDevice(device) {
    const name = device.name || '';
    const localName = device.localName || '';
    const deviceText = (name + ' ' + localName).toLowerCase();
    
    // Check for BCI service UUID or device name patterns
    const hasBCIService = device.serviceUUIDs && 
      device.serviceUUIDs.includes(this.BCI_SERVICE_UUID);
    
    const bciKeywords = [
      'berry', 'med', 'bci', 'pulse', 'oximeter', 'spo2'
    ];
    
    const hasKeyword = bciKeywords.some(keyword =>
      deviceText.includes(keyword.toLowerCase())
    );

    return hasBCIService || hasKeyword;
  }

  async connectToDevice(device) {
    try {
      console.log('Connecting to BCI device:', device.id);
      
      // Stop scanning before connecting
      await this.stopScanning();
      
      // Connect to device
      const connectedDevice = await device.connect();
      console.log('✅ Connected to device');
      
      // Discover services and characteristics
      const discoveredDevice = await connectedDevice.discoverAllServicesAndCharacteristics();
      this.currentDevice = discoveredDevice;
      this.isConnected = true;
      
      console.log('✅ Services discovered');
      
      // Setup notifications for BCI data
      await this.setupBCINotifications(discoveredDevice);
      
      if (this.onConnectionStatusChanged) {
        this.onConnectionStatusChanged(true);
      }
      
      return discoveredDevice;
    } catch (error) {
      console.error('Connection error:', error);
      this.isConnected = false;
      if (this.onConnectionStatusChanged) {
        this.onConnectionStatusChanged(false);
      }
      throw error;
    }
  }

  async setupBCINotifications(device) {
    try {
      console.log('Setting up BCI notifications...');
      
      // Get the BCI service
      const services = await device.services();
      console.log('Available services:', services.map(s => s.uuid));
      
      const bciService = services.find(service => 
        service.uuid.toUpperCase() === this.BCI_SERVICE_UUID.toUpperCase()
      );
      
      if (!bciService) {
        console.error('❌ BCI service not found!');
        console.log('Available services:', services.map(s => s.uuid));
        return;
      }
      
      console.log('✅ Found BCI service:', bciService.uuid);
      
      // Get characteristics
      const characteristics = await bciService.characteristics();
      console.log('BCI service characteristics:', characteristics.map(c => ({
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
        console.error('❌ BCI data characteristic not found!');
        return;
      }
      
      console.log('✅ Found BCI data characteristic:', dataCharacteristic.uuid);
      console.log('📋 Characteristic properties:', {
        isNotifiable: dataCharacteristic.isNotifiable,
        isReadable: dataCharacteristic.isReadable,
        isWritable: dataCharacteristic.isWritable
      });
      
      // Enable notifications
      if (dataCharacteristic.isNotifiable) {
        console.log('📡 Enabling BCI data notifications...');
        
        dataCharacteristic.monitor((error, characteristic) => {
          if (error) {
            // Handle cancellation errors gracefully (happens when disconnecting or removing finger)
            if (error.message && error.message.includes('cancelled')) {
              console.log('📡 BCI data monitoring stopped (connection cancelled)');
            } else {
              console.error('Notification error:', error);
            }
            return;
          }
          
          if (characteristic && characteristic.value) {
            console.log('📦 Raw BCI data received:', characteristic.value);
            this.handleBCIDataReceived(characteristic.value);
          }
        });
        
        console.log('✅ BCI notifications enabled');
      } else {
        console.error('❌ BCI data characteristic is not notifiable');
      }
      
    } catch (error) {
      console.error('Error setting up BCI notifications:', error);
    }
  }

  handleBCIDataReceived(data) {
    try {
      const parsedData = this.parseBCIData(data);
      if (parsedData) {
        // Send to UI callback if available
        if (this.onDataReceived) {
          this.onDataReceived(parsedData);
        }
        
        // Send to session manager if session is active
        if (SessionManager.isSessionActive()) {
          SessionManager.addReading(parsedData);
        }
      }
    } catch (error) {
      console.error('Error handling BCI data:', error);
    }
  }

  parseBCIData(base64Data) {
    try {
      console.log('🔍 Parsing BCI data:', base64Data);
      
      // Decode base64 to buffer
      const buffer = Buffer.from(base64Data, 'base64');
      console.log('📊 Buffer length:', buffer.length);
      console.log('📊 Raw bytes (hex):', Array.from(buffer).map(b => '0x' + b.toString(16).padStart(2, '0').toUpperCase()).join(' '));
      
      // Handle different packet sizes
      let packets = [];
      
      if (buffer.length === 5) {
        // Single 5-byte packet
        packets = [buffer];
      } else if (buffer.length === 20) {
        // Four 5-byte packets concatenated
        console.log('📦 Processing 20-byte packet as 4x5-byte packets');
        for (let i = 0; i < 4; i++) {
          const packetStart = i * 5;
          const packet = buffer.slice(packetStart, packetStart + 5);
          packets.push(packet);
        }
      } else {
        console.log('⚠️ Unexpected buffer length:', buffer.length, 'bytes. Processing as best effort...');
        // Try to process first 5 bytes if available
        if (buffer.length >= 5) {
          packets = [buffer.slice(0, 5)];
        } else {
          console.log('❌ Buffer too short for BCI parsing');
          return null;
        }
      }
      
      // Process the latest (most recent) packet
      const latestPacket = packets[packets.length - 1];
      console.log('🎯 Processing latest packet:', Array.from(latestPacket).map(b => '0x' + b.toString(16).padStart(2, '0').toUpperCase()).join(' '));
      
      return this.parseSingle5BytePacket(latestPacket, base64Data);
      
    } catch (error) {
      console.error('❌ Error parsing BCI data:', error);
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
      
      console.log('📊 BCI Bytes:', {
        byte1: '0x' + byte1.toString(16).padStart(2, '0').toUpperCase(),
        byte2: '0x' + byte2.toString(16).padStart(2, '0').toUpperCase(), 
        byte3: '0x' + byte3.toString(16).padStart(2, '0').toUpperCase(),
        byte4: '0x' + byte4.toString(16).padStart(2, '0').toUpperCase(),
        byte5: '0x' + byte5.toString(16).padStart(2, '0').toUpperCase()
      });
      
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
      
      console.log('🔬 BCI Parsed Values:', {
        signalStrength,
        isSignalValid,
        isProbePlugged,
        isFingerDetected,
        isSearchingForPulse,
        pulseRateRaw,
        pulseRate,
        spo2Raw, 
        spo2,
        pleth,
        isPlethValid
      });
      
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
        console.log('✅ Valid BCI data:', result);
      } else {
        console.log('⚠️ BCI status data (no valid measurements):', result);
      }
      
      return result;
      
    } catch (error) {
      console.error('Error parsing individual BCI packet:', error);
      return null;
    }
  }

  async disconnect() {
    try {
      if (this.currentDevice) {
        console.log('Disconnecting from device...');
        await this.currentDevice.cancelConnection();
        this.currentDevice = null;
        this.isConnected = false;
        
        if (this.onConnectionStatusChanged) {
          this.onConnectionStatusChanged(false);
        }
        
        console.log('✅ Disconnected');
      }
    } catch (error) {
      console.error('Error disconnecting:', error);
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

  setOnDataReceived(callback) {
    this.onDataReceived = callback;
  }

  setOnConnectionStatusChanged(callback) {
    this.onConnectionStatusChanged = callback;
  }
}

export default new BluetoothService(); 