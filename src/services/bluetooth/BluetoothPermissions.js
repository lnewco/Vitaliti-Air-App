/**
 * BluetoothPermissions - Handles platform-specific BLE permissions
 */

import { Platform, PermissionsAndroid } from 'react-native';
import logger from '../../utils/logger';

const log = logger.createModuleLogger('BluetoothPermissions');

class BluetoothPermissions {
  constructor(bleManager) {
    this.manager = bleManager;
  }

  /**
   * Request all required Bluetooth permissions
   */
  async requestPermissions() {
    log.info('📱 Requesting Bluetooth permissions...');
    
    if (Platform.OS === 'ios') {
      return this.requestIOSPermissions();
    } else if (Platform.OS === 'android') {
      return this.requestAndroidPermissions();
    }
    
    return true;
  }

  /**
   * Request iOS Bluetooth permissions
   */
  async requestIOSPermissions() {
    // iOS handles Bluetooth permissions automatically via Info.plist
    // Just check if Bluetooth is enabled
    const isEnabled = await this.isBluetoothEnabled();
    
    if (!isEnabled) {
      log.warn('⚠️ Bluetooth is disabled on iOS device');
      return false;
    }
    
    log.info('✅ iOS Bluetooth permissions granted');
    return true;
  }

  /**
   * Request Android Bluetooth permissions
   */
  async requestAndroidPermissions() {
    try {
      const apiLevel = Platform.Version;
      
      if (apiLevel >= 31) {
        // Android 12+ requires BLUETOOTH_SCAN and BLUETOOTH_CONNECT
        const permissions = [
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        ];
        
        const results = await PermissionsAndroid.requestMultiple(permissions);
        
        const allGranted = Object.values(results).every(
          result => result === PermissionsAndroid.RESULTS.GRANTED
        );
        
        if (!allGranted) {
          log.warn('⚠️ Not all Android 12+ Bluetooth permissions granted');
          return false;
        }
      } else {
        // Android < 12 requires location permission for BLE
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Bluetooth Permission',
            message: 'This app needs location permission to scan for Bluetooth devices',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          log.warn('⚠️ Location permission denied on Android');
          return false;
        }
      }
      
      log.info('✅ Android Bluetooth permissions granted');
      return true;
      
    } catch (error) {
      log.error('❌ Error requesting Android permissions:', error);
      return false;
    }
  }

  /**
   * Check if Bluetooth is enabled
   */
  async isBluetoothEnabled() {
    try {
      const state = await this.manager.state();
      const isEnabled = state === 'PoweredOn';
      
      log.info(`📱 Bluetooth state: ${state}`);
      
      if (!isEnabled) {
        log.warn('⚠️ Bluetooth is not enabled. Current state:', state);
      }
      
      return isEnabled;
    } catch (error) {
      log.error('❌ Error checking Bluetooth state:', error);
      return false;
    }
  }

  /**
   * Check current permission status
   */
  async checkPermissionStatus() {
    if (Platform.OS === 'ios') {
      // iOS doesn't have runtime permission check for Bluetooth
      return {
        bluetooth: true,
        location: true
      };
    }
    
    if (Platform.OS === 'android') {
      const apiLevel = Platform.Version;
      const status = {
        bluetooth: false,
        location: false
      };
      
      try {
        if (apiLevel >= 31) {
          const scanPermission = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN
          );
          const connectPermission = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT
          );
          status.bluetooth = scanPermission && connectPermission;
        } else {
          status.bluetooth = true; // Pre-Android 12 doesn't need explicit BT permissions
        }
        
        status.location = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        
      } catch (error) {
        log.error('Error checking permissions:', error);
      }
      
      return status;
    }
    
    return {
      bluetooth: false,
      location: false
    };
  }

  /**
   * Monitor Bluetooth state changes
   */
  monitorBluetoothState(callback) {
    return this.manager.onStateChange((state) => {
      log.info(`📱 Bluetooth state changed to: ${state}`);
      const isEnabled = state === 'PoweredOn';
      callback(isEnabled, state);
    }, true);
  }
}

export default BluetoothPermissions;