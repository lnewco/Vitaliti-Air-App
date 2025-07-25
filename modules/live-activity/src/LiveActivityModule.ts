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

// Import the native module
const LiveActivityModuleNative = NativeModulesProxy.LiveActivityModule;

class LiveActivityModuleImpl implements LiveActivityModuleInterface {
  /**
   * Check if Live Activities are supported on this device
   */
  async isSupported(): Promise<boolean> {
    if (Platform.OS !== 'ios') {
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
    if (Platform.OS !== 'ios') {
      throw new Error('Live Activities are only supported on iOS');
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
    if (Platform.OS !== 'ios') {
      throw new Error('Live Activities are only supported on iOS');
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
    if (Platform.OS !== 'ios') {
      return { success: true, message: 'Live Activities not supported on this platform' };
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
    if (Platform.OS !== 'ios') {
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