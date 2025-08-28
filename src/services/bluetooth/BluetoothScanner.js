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
    // Log ALL devices for debugging
    log.info(`🔍 Discovered device: ${device.name || 'UNNAMED'} (${device.id})`);
    
    // Skip if already discovered
    if (this.discoveredDevices.has(device.id)) {
      return;
    }

    const deviceType = this.getDeviceType(device);
    log.info(`📱 Device type identified as: ${deviceType}`);
    
    // Filter by current scan type
    if (this.currentScanType === 'pulse-ox' && deviceType !== 'pulse-ox') {
      log.info(`⏭️ Skipping non-pulse-ox device: ${device.name}`);
      return;
    }

    log.info(`✅ Adding ${deviceType} device: ${device.name} (${device.id})`);
    
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
    
    log.info(`🔍 Checking device type for name: "${device.name}" (lowercase: "${name}")`);
    
    // Pulse oximeter patterns - EXPANDED list
    const pulseOxPatterns = [
      'oximeter', 'o2ring', 'checkme', 'o2', 'spo2', 
      'berry', 'cms50', 'pulse', 'wellue', 'vibeat',
      'o2max', 'masimo', 'nonin', 'contec'
    ];
    
    for (const pattern of pulseOxPatterns) {
      if (name.includes(pattern)) {
        log.info(`✅ Matched pulse-ox pattern: ${pattern}`);
        return 'pulse-ox';
      }
    }
    
    // Check if it starts with known prefixes
    if (name.startsWith('cm') || name.startsWith('po') || name.startsWith('ox')) {
      log.info(`✅ Matched pulse-ox prefix: ${name.substring(0, 2)}`);
      return 'pulse-ox';
    }
    
    log.info(`❌ No pulse-ox pattern matched for: ${device.name}`);
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