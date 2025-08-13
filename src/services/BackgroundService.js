/**
 * Background Service - Manages iOS background execution for IHHT sessions
 * This service uses native iOS capabilities when available (development builds)
 * and provides fallbacks for Expo Go
 */

import { NativeModules, NativeEventEmitter, Platform, AppState } from 'react-native';
import Constants from 'expo-constants';

const isExpoGo = Constants.executionEnvironment === 'storeClient';

// Try to load the native module (only available in development builds)
let IHHTBackgroundModule = null;
let backgroundEmitter = null;

try {
  IHHTBackgroundModule = NativeModules.IHHTBackgroundModule;
  if (IHHTBackgroundModule && !isExpoGo) {
    backgroundEmitter = new NativeEventEmitter(IHHTBackgroundModule);
  }
} catch (error) {
  console.log('📱 Background module not available - using fallback mode');
}

class BackgroundService {
  constructor() {
    this.isNativeAvailable = !!IHHTBackgroundModule;
    this.sessionActive = false;
    this.backgroundTask = null;
    this.listeners = [];
    this.appStateSubscription = null;
    
    console.log(`📱 Background Service initialized - Native support: ${this.isNativeAvailable ? 'YES' : 'NO (Expo Go mode)'}`);
    
    this.setupAppStateHandling();
  }
  
  setupAppStateHandling() {
    this.appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'background' && this.sessionActive) {
        this.handleAppBackground();
      } else if (nextAppState === 'active' && this.sessionActive) {
        this.handleAppForeground();
      }
    });
  }
  
  // Start background session monitoring
  async startSession(sessionId) {
    console.log(`🚀 Starting background session: ${sessionId}`);
    this.sessionActive = true;
    
    if (this.isNativeAvailable && Platform.OS === 'ios') {
      try {
        // Use native iOS background capabilities
        const result = await IHHTBackgroundModule.startSession(sessionId);
        console.log('✅ Native background session started:', result);
        
        // Start extended background execution
        await this.startBackgroundExecution();
        
        return { success: true, native: true };
      } catch (error) {
        console.error('❌ Failed to start native background session:', error);
        return { success: false, error: error.message };
      }
    } else {
      // Expo Go fallback
      console.log('⚠️ Using Expo Go fallback - limited background support');
      
      // Best effort background support in Expo Go
      // The app will still pause after ~30 seconds in background
      return { success: true, native: false, limited: true };
    }
  }
  
  // End background session
  async endSession() {
    console.log('🛑 Ending background session');
    this.sessionActive = false;
    
    if (this.isNativeAvailable && Platform.OS === 'ios') {
      try {
        await IHHTBackgroundModule.endSession();
        await this.endBackgroundExecution();
        console.log('✅ Native background session ended');
      } catch (error) {
        console.error('❌ Failed to end native background session:', error);
      }
    }
  }
  
  // Update session state (for notifications)
  async updateSessionState(phase, cycle, timeRemaining) {
    if (this.isNativeAvailable && Platform.OS === 'ios') {
      try {
        await IHHTBackgroundModule.updateSessionState(phase, cycle, timeRemaining);
      } catch (error) {
        console.error('❌ Failed to update session state:', error);
      }
    }
  }
  
  // Start extended background execution (iOS specific)
  async startBackgroundExecution() {
    if (!this.isNativeAvailable || Platform.OS !== 'ios') {
      return { success: false, reason: 'Not available' };
    }
    
    try {
      const result = await IHHTBackgroundModule.startBackgroundExecution();
      console.log(`✅ Background execution started - Time remaining: ${result.remainingTime}s`);
      
      // Set up periodic time check
      this.startBackgroundTimeMonitoring();
      
      return result;
    } catch (error) {
      console.error('❌ Failed to start background execution:', error);
      return { success: false, error: error.message };
    }
  }
  
  // End extended background execution
  async endBackgroundExecution() {
    if (!this.isNativeAvailable || Platform.OS !== 'ios') {
      return;
    }
    
    try {
      await IHHTBackgroundModule.endBackgroundExecution();
      this.stopBackgroundTimeMonitoring();
      console.log('✅ Background execution ended');
    } catch (error) {
      console.error('❌ Failed to end background execution:', error);
    }
  }
  
  // Monitor remaining background time
  startBackgroundTimeMonitoring() {
    if (this.backgroundTimeMonitor) {
      clearInterval(this.backgroundTimeMonitor);
    }
    
    this.backgroundTimeMonitor = setInterval(async () => {
      if (this.isNativeAvailable && Platform.OS === 'ios') {
        try {
          const remainingTime = await IHHTBackgroundModule.getRemainingBackgroundTime();
          
          // Log every 30 seconds
          if (Math.floor(remainingTime) % 30 === 0) {
            console.log(`⏱️ Background time remaining: ${remainingTime}s`);
          }
          
          // Renew if getting low (handled by native code)
          if (remainingTime < 10 && remainingTime > 0) {
            console.log('⚠️ Background time running low - renewal will be attempted');
          }
        } catch (error) {
          console.error('Failed to get remaining time:', error);
        }
      }
    }, 5000); // Check every 5 seconds
  }
  
  stopBackgroundTimeMonitoring() {
    if (this.backgroundTimeMonitor) {
      clearInterval(this.backgroundTimeMonitor);
      this.backgroundTimeMonitor = null;
    }
  }
  
  // Handle app going to background
  async handleAppBackground() {
    console.log('📱 App entered background - maintaining session');
    
    if (this.isNativeAvailable && Platform.OS === 'ios') {
      // Native handling will keep the session alive
      await this.startBackgroundExecution();
    } else {
      // Expo Go - warn user about limitations
      console.warn('⚠️ Background execution limited in Expo Go - session may pause after 30 seconds');
    }
  }
  
  // Handle app returning to foreground
  async handleAppForeground() {
    console.log('📱 App entered foreground - resuming normal operation');
    
    if (this.isNativeAvailable && Platform.OS === 'ios') {
      // Check remaining background time
      const remainingTime = await IHHTBackgroundModule.getRemainingBackgroundTime();
      console.log(`✅ Returned to foreground - Background time was: ${remainingTime}s`);
    }
  }
  
  // Check if background execution is available
  async isBackgroundExecutionAvailable() {
    if (!this.isNativeAvailable || Platform.OS !== 'ios') {
      return false;
    }
    
    try {
      const available = await IHHTBackgroundModule.isBackgroundExecutionAvailable();
      return available;
    } catch (error) {
      console.error('Failed to check background availability:', error);
      return false;
    }
  }
  
  // Get remaining background time
  async getRemainingBackgroundTime() {
    if (!this.isNativeAvailable || Platform.OS !== 'ios') {
      return 0;
    }
    
    try {
      const time = await IHHTBackgroundModule.getRemainingBackgroundTime();
      return time;
    } catch (error) {
      console.error('Failed to get remaining time:', error);
      return 0;
    }
  }
  
  // Clean up
  dispose() {
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
    }
    this.stopBackgroundTimeMonitoring();
  }
}

// Export singleton instance
export default new BackgroundService();