/**
 * BluetoothScanner - Handles BLE device discovery and identification
 */

import logger from '../../utils/logger';

const log = logger.createModuleLogger('BluetoothScanner');

class BluetoothScanner {
  constructor(bleManager) {
    this.manager = bleManager;
    this.isScanning = false;
    this.currentScanType = null;
    this.discoveredDevices = new Map();
    this.scanSubscription = null;
    this.onDeviceFound = null;
  }

  /**
   * Start scanning for BLE devices
   */
  async startScanning(deviceType = 'pulse-ox', onDeviceFound = null) {
    if (this.isScanning) {
      log.warn('Already scanning, stopping previous scan...');
      await this.stopScanning();
    }

    this.currentScanType = deviceType;
    this.onDeviceFound = onDeviceFound;
    this.discoveredDevices.clear();

    log.info(`🔍 Starting ${deviceType} device scan...`);
    
    // Start BLE scan
    this.isScanning = true;
    
    this.scanSubscription = this.manager.startDeviceScan(
      null, // No specific UUIDs filter
      {
        allowDuplicates: false,
        scanMode: 'LowLatency'
      },
      (error, device) => {
        if (error) {
          log.error('Scan error:', error);
          this.stopScanning();
          return;
        }
        
        if (device && device.name) {
          this.handleDeviceDiscovered(device);
        }
      }
    );

    // Auto-stop scan after 30 seconds
    setTimeout(() => {
      if (this.isScanning) {
        log.info('⏱️ Auto-stopping scan after 30 seconds');
        this.stopScanning();
      }
    }, 30000);
  }

  /**
   * Stop scanning
   */
  async stopScanning() {
    if (!this.isScanning) {
      return;
    }

    log.info('🛑 Stopping device scan');
    
    if (this.scanSubscription) {
      this.scanSubscription.remove();
      this.scanSubscription = null;
    }
    
    this.manager.stopDeviceScan();
    this.isScanning = false;
    this.currentScanType = null;
  }

  /**
   * Handle discovered device
   */
  handleDeviceDiscovered(device) {
    // Skip if already discovered
    if (this.discoveredDevices.has(device.id)) {
      return;
    }

    const deviceType = this.getDeviceType(device);
    
    // Filter by current scan type
    if (this.currentScanType === 'pulse-ox' && deviceType !== 'pulse-ox') {
      return;
    }

    log.info(`📱 Found ${deviceType} device: ${device.name} (${device.id})`);
    
    this.discoveredDevices.set(device.id, {
      device,
      type: deviceType,
      discoveredAt: Date.now()
    });

    // Notify callback
    if (this.onDeviceFound) {
      this.onDeviceFound(device, deviceType);
    }
  }

  /**
   * Identify device type from device info
   */
  getDeviceType(device) {
    const name = device.name?.toLowerCase() || '';
    
    // Pulse oximeter patterns
    if (name.includes('oximeter') || 
        name.includes('o2ring') || 
        name.includes('checkme') ||
        name.includes('o2') ||
        name.includes('spo2') ||
        name.includes('berry') ||
        name.includes('cms50')) {
      return 'pulse-ox';
    }
    
    // Future device types can be added here
    // if (name.includes('hr') || name.includes('heart')) {
    //   return 'heart-rate';
    // }
    
    return 'unknown';
  }

  /**
   * Get list of discovered devices
   */
  getDiscoveredDevices(type = null) {
    const devices = Array.from(this.discoveredDevices.values());
    
    if (type) {
      return devices.filter(d => d.type === type);
    }
    
    return devices;
  }

  /**
   * Clear discovered devices
   */
  clearDiscoveredDevices() {
    this.discoveredDevices.clear();
  }

  /**
   * Check if currently scanning
   */
  get scanning() {
    return this.isScanning;
  }
}

export default BluetoothScanner;