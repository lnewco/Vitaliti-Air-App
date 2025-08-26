/**
 * HKWorkoutService - JavaScript interface for HKWorkoutSession native module
 * This service manages iOS HealthKit workout sessions for background execution
 */

import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

// Get the native module
const { IHHTWorkoutModule } = NativeModules;

class HKWorkoutService {
  constructor() {
    this.isAvailable = Platform.OS === 'ios' && !!IHHTWorkoutModule;
    this.eventEmitter = null;
    this.listeners = {};
    this.isRunning = false;
    this.elapsedSeconds = 0;
    this.isBackground = false;
    this.bluetoothDevice = null;
    this.isBluetoothConnected = false;
    
    if (this.isAvailable) {
      this.eventEmitter = new NativeEventEmitter(IHHTWorkoutModule);
      console.log('✅ HKWorkoutService: Native module available');
    } else {
      console.log('⚠️ HKWorkoutService: Native module NOT available (Expo Go or Android)');
    }
  }

  /**
   * Set the Bluetooth device for background connection maintenance
   */
  async setBluetoothDevice(deviceId) {
    if (!this.isAvailable) {
      return { success: false, error: 'Native module not available' };
    }

    try {
      this.bluetoothDevice = deviceId;
      await IHHTWorkoutModule.setBluetoothDevice(deviceId);
      console.log('📱 HKWorkoutService: Bluetooth device set:', deviceId);
      return { success: true };
    } catch (error) {
      console.error('❌ HKWorkoutService: Failed to set Bluetooth device', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Notify native module of Bluetooth connection status
   */
  async notifyBluetoothConnected() {
    if (!this.isAvailable) return;
    
    try {
      this.isBluetoothConnected = true;
      await IHHTWorkoutModule.notifyBluetoothConnected();
      console.log('✅ HKWorkoutService: Notified native of BLE connection');
    } catch (error) {
      console.error('❌ HKWorkoutService: Failed to notify BLE connection', error);
    }
  }

  async notifyBluetoothDisconnected() {
    if (!this.isAvailable) return;
    
    try {
      this.isBluetoothConnected = false;
      await IHHTWorkoutModule.notifyBluetoothDisconnected();
      console.log('❌ HKWorkoutService: Notified native of BLE disconnection');
    } catch (error) {
      console.error('❌ HKWorkoutService: Failed to notify BLE disconnection', error);
    }
  }

  /**
   * Start a workout session with BLE background support
   */
  async startWorkout(withBluetoothDevice = null) {
    if (!this.isAvailable) {
      console.log('⚠️ HKWorkoutService: Cannot start - native module not available');
      return { success: false, error: 'Native module not available' };
    }

    try {
      console.log('🏃 HKWorkoutService: Starting workout...');
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Set Bluetooth device if provided
      if (withBluetoothDevice) {
        await this.setBluetoothDevice(withBluetoothDevice);
      }
      
      // Start the workout
      const result = await IHHTWorkoutModule.startWorkout();
      
      this.isRunning = true;
      this.elapsedSeconds = 0;
      
      console.log('✅ HKWorkoutService: Workout started', result);
      return { success: true, result };
    } catch (error) {
      console.error('❌ HKWorkoutService: Failed to start workout', error);
      this.cleanup();
      return { success: false, error: error.message };
    }
  }

  /**
   * Stop the workout session
   */
  async stopWorkout() {
    if (!this.isAvailable || !this.isRunning) {
      console.log('⚠️ HKWorkoutService: Cannot stop - not running');
      return { success: false, error: 'Workout not running' };
    }

    try {
      console.log('🛑 HKWorkoutService: Stopping workout...');
      
      const result = await IHHTWorkoutModule.stopWorkout();
      
      this.isRunning = false;
      this.cleanup();
      
      console.log('✅ HKWorkoutService: Workout stopped', result);
      return { success: true, result };
    } catch (error) {
      console.error('❌ HKWorkoutService: Failed to stop workout', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Set up event listeners for native module events
   */
  setupEventListeners() {
    if (!this.eventEmitter) return;

    // Timer tick event (every 5 seconds)
    this.listeners.tick = this.eventEmitter.addListener(
      'onWorkoutTick',
      (data) => {
        this.elapsedSeconds = data.elapsedSeconds;
        this.isBackground = data.isBackground;
        
        const emoji = data.isBackground ? '🌙' : '☀️';
        console.log(`${emoji} HKWorkout Timer: ${data.elapsedSeconds}s`);
        
        // Notify any registered callbacks
        if (this.onTickCallback) {
          this.onTickCallback(data);
        }
      }
    );

    // Workout state change event
    this.listeners.stateChange = this.eventEmitter.addListener(
      'onWorkoutStateChange',
      (data) => {
        console.log('🔄 HKWorkout State:', data);
        
        if (this.onStateChangeCallback) {
          this.onStateChangeCallback(data);
        }
      }
    );

    // App state change event
    this.listeners.appState = this.eventEmitter.addListener(
      'onAppStateChange',
      (data) => {
        console.log('📱 HKWorkout App State:', data.state);
        this.isBackground = data.state === 'background';
        
        if (this.onAppStateChangeCallback) {
          this.onAppStateChangeCallback(data);
        }
      }
    );

    // Error event
    this.listeners.error = this.eventEmitter.addListener(
      'onWorkoutError',
      (data) => {
        console.error('❌ HKWorkout Error:', data.error);
        
        if (this.onErrorCallback) {
          this.onErrorCallback(data);
        }
      }
    );

    // Bluetooth state change event
    this.listeners.bluetooth = this.eventEmitter.addListener(
      'onBluetoothStateChange',
      (data) => {
        console.log('📱 HKWorkout Bluetooth State:', data);
        
        if (data.connected !== undefined) {
          this.isBluetoothConnected = data.connected;
        }
        
        if (data.needsReconnection && this.onBluetoothReconnectCallback) {
          this.onBluetoothReconnectCallback(data.deviceId);
        }
        
        if (this.onBluetoothStateChangeCallback) {
          this.onBluetoothStateChangeCallback(data);
        }
      }
    );
  }

  /**
   * Register a callback for timer ticks
   */
  onTick(callback) {
    this.onTickCallback = callback;
  }

  /**
   * Register a callback for state changes
   */
  onStateChange(callback) {
    this.onStateChangeCallback = callback;
  }

  /**
   * Register a callback for app state changes
   */
  onAppStateChange(callback) {
    this.onAppStateChangeCallback = callback;
  }

  /**
   * Register a callback for errors
   */
  onError(callback) {
    this.onErrorCallback = callback;
  }

  /**
   * Register a callback for Bluetooth state changes
   */
  onBluetoothStateChange(callback) {
    this.onBluetoothStateChangeCallback = callback;
  }

  /**
   * Register a callback for Bluetooth reconnection requests
   */
  onBluetoothReconnect(callback) {
    this.onBluetoothReconnectCallback = callback;
  }

  /**
   * Clean up event listeners
   */
  cleanup() {
    Object.values(this.listeners).forEach(listener => {
      if (listener) listener.remove();
    });
    this.listeners = {};
    
    this.onTickCallback = null;
    this.onStateChangeCallback = null;
    this.onAppStateChangeCallback = null;
    this.onErrorCallback = null;
    this.onBluetoothStateChangeCallback = null;
    this.onBluetoothReconnectCallback = null;
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      isAvailable: this.isAvailable,
      isRunning: this.isRunning,
      elapsedSeconds: this.elapsedSeconds,
      isBackground: this.isBackground,
      isBluetoothConnected: this.isBluetoothConnected,
      bluetoothDevice: this.bluetoothDevice
    };
  }
}

// Export singleton instance
export default new HKWorkoutService();