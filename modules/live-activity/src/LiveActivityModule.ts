import { NativeModulesProxy } from 'expo-modules-core';
import { Platform } from 'react-native';

import {
  LiveActivityModuleInterface,
  IHHTSessionData,
  IHHTActivityUpdateData,
  LiveActivityResponse,
  ActivityStatus,
  ActivityStateChangeEvent
} from './LiveActivityModule.types';

// Import the native module safely
let LiveActivityModuleNative = null;
try {
  LiveActivityModuleNative = NativeModulesProxy.LiveActivityModule;
} catch (error) {
  console.log('Live Activity native module not available');
}

class LiveActivityModuleImpl implements LiveActivityModuleInterface {
  /**
   * Check if Live Activities are supported on this device
   */
  async isSupported(): Promise<boolean> {
    if (Platform.OS !== 'ios' || !LiveActivityModuleNative) {
      return false;
    }
    
    try {
      return await LiveActivityModuleNative.isSupported();
    } catch (error) {
      console.warn('Failed to check Live Activity support:', error);
      return false;
    }
  }

  /**
   * Start a new Live Activity for an IHHT session
   */
  async startActivity(sessionData: IHHTSessionData): Promise<LiveActivityResponse> {
    if (Platform.OS !== 'ios' || !LiveActivityModuleNative) {
      return { success: false, message: 'Live Activities not available' };
    }

    try {
      const result = await LiveActivityModuleNative.startActivity(sessionData);
      return result;
    } catch (error) {
      console.error('Failed to start Live Activity:', error);
      throw error;
    }
  }

  /**
   * Update the current Live Activity with new session data
   */
  async updateActivity(updateData: IHHTActivityUpdateData): Promise<LiveActivityResponse> {
    if (Platform.OS !== 'ios' || !LiveActivityModuleNative) {
      return { success: false, message: 'Live Activities not available' };
    }

    try {
      const result = await LiveActivityModuleNative.updateActivity(updateData);
      return result;
    } catch (error) {
      console.error('Failed to update Live Activity:', error);
      throw error;
    }
  }

  /**
   * Stop the current Live Activity
   */
  async stopActivity(): Promise<LiveActivityResponse> {
    if (Platform.OS !== 'ios' || !LiveActivityModuleNative) {
      return { success: true, message: 'Live Activities not available' };
    }

    try {
      const result = await LiveActivityModuleNative.stopActivity();
      return result;
    } catch (error) {
      console.error('Failed to stop Live Activity:', error);
      throw error;
    }
  }

  /**
   * Get the current activity status
   */
  getActivityStatus(): ActivityStatus {
    if (Platform.OS !== 'ios' || !LiveActivityModuleNative) {
      return { hasActiveActivity: false };
    }

    try {
      return LiveActivityModuleNative.getActivityStatus();
    } catch (error) {
      console.error('Failed to get activity status:', error);
      return { hasActiveActivity: false };
    }
  }

  // Event listeners will be implemented in a future update
}

// Export the singleton instance
export default new LiveActivityModuleImpl(); 