/**
 * ModuleLoader - Conditionally loads native modules based on runtime environment
 * 
 * This module provides a safe way to load native modules that may not be
 * available in Expo Go, with appropriate fallbacks for each environment.
 */

import runtimeEnvironment from '../utils/RuntimeEnvironment';

class ModuleLoader {
  constructor() {
    this.modules = {};
    this.loadAttempts = {};
  }

  /**
   * Load react-native-background-timer or fallback
   */
  async loadBackgroundTimer() {
    const moduleName = 'backgroundTimer';
    
    // Return cached module if already loaded
    if (this.modules[moduleName]) {
      return this.modules[moduleName];
    }

    // Check if we should even try to load the native module
    if (!runtimeEnvironment.hasCapability('backgroundTimer')) {
      console.log('📱 BackgroundTimer: Using fallback (Expo Go mode)');
      return this.createBackgroundTimerFallback();
    }

    try {
      // Attempt to load native module
      const BackgroundTimer = require('react-native-background-timer').default;
      
      // Verify the module loaded correctly
      if (BackgroundTimer && typeof BackgroundTimer.setTimeout === 'function') {
        console.log('✅ BackgroundTimer: Native module loaded successfully');
        this.modules[moduleName] = BackgroundTimer;
        return BackgroundTimer;
      }
    } catch (error) {
      console.warn('⚠️ BackgroundTimer: Native module not available, using fallback', error.message);
    }

    // Return fallback implementation
    return this.createBackgroundTimerFallback();
  }

  /**
   * Create fallback implementation for BackgroundTimer
   */
  createBackgroundTimerFallback() {
    const fallback = {
      setTimeout: (callback, delay) => {
        console.debug('BackgroundTimer.setTimeout: Using standard setTimeout');
        return global.setTimeout(callback, delay);
      },
      clearTimeout: (timeoutId) => {
        global.clearTimeout(timeoutId);
      },
      setInterval: (callback, delay) => {
        console.debug('BackgroundTimer.setInterval: Using standard setInterval');
        return global.setInterval(callback, delay);
      },
      clearInterval: (intervalId) => {
        global.clearInterval(intervalId);
      },
      runBackgroundTimer: (callback, delay) => {
        console.warn('BackgroundTimer.runBackgroundTimer: Not supported in Expo Go, using setInterval');
        return global.setInterval(callback, delay);
      },
      stopBackgroundTimer: () => {
        console.warn('BackgroundTimer.stopBackgroundTimer: No-op in Expo Go');
      },
      start: (delay = 0) => {
        console.warn('BackgroundTimer.start: No-op in Expo Go');
      },
      stop: () => {
        console.warn('BackgroundTimer.stop: No-op in Expo Go');
      },
      isAvailable: false,
      isNative: false
    };

    this.modules.backgroundTimer = fallback;
    return fallback;
  }

  /**
   * Load notifee or fallback
   */
  async loadNotifee() {
    const moduleName = 'notifee';
    
    if (this.modules[moduleName]) {
      return this.modules[moduleName];
    }

    if (!runtimeEnvironment.hasCapability('richNotifications')) {
      console.log('📱 Notifee: Using basic notifications (Expo Go mode)');
      return this.createNotifeeFallback();
    }

    try {
      const notifee = require('@notifee/react-native').default;
      
      if (notifee) {
        console.log('✅ Notifee: Native module loaded successfully');
        this.modules[moduleName] = notifee;
        return notifee;
      }
    } catch (error) {
      console.warn('⚠️ Notifee: Native module not available, using fallback', error.message);
    }

    return this.createNotifeeFallback();
  }

  /**
   * Create fallback for notifee using Expo Notifications
   */
  createNotifeeFallback() {
    // Import Expo notifications as fallback
    const Notifications = require('expo-notifications');
    
    const fallback = {
      // Basic notification display
      displayNotification: async (notification) => {
        console.log('📱 Displaying notification via Expo:', notification.title);
        
        await Notifications.scheduleNotificationAsync({
          content: {
            title: notification.title,
            body: notification.body,
            data: notification.data || {},
          },
          trigger: null, // Immediate
        });
      },
      
      // Scheduled notification
      createTriggerNotification: async (notification, trigger) => {
        console.log('📱 Scheduling notification via Expo');
        
        let triggerConfig = null;
        if (trigger && trigger.type === 'TIMESTAMP' && trigger.timestamp) {
          const seconds = Math.max(1, Math.floor((trigger.timestamp - Date.now()) / 1000));
          triggerConfig = { seconds };
        }
        
        await Notifications.scheduleNotificationAsync({
          content: {
            title: notification.title,
            body: notification.body,
            data: notification.data || {},
          },
          trigger: triggerConfig,
        });
      },
      
      // Cancel notifications
      cancelAllNotifications: async () => {
        await Notifications.cancelAllScheduledNotificationsAsync();
      },
      
      // Request permissions
      requestPermission: async () => {
        const { status } = await Notifications.requestPermissionsAsync();
        return { authorizationStatus: status === 'granted' ? 1 : 0 };
      },
      
      // Trigger types enum
      TriggerType: {
        TIMESTAMP: 'TIMESTAMP',
        INTERVAL: 'INTERVAL',
      },
      
      // Mark as fallback
      isAvailable: false,
      isNative: false
    };

    this.modules.notifee = fallback;
    return fallback;
  }

  /**
   * Load Live Activity module (iOS only)
   */
  async loadLiveActivityModule() {
    const moduleName = 'liveActivity';
    
    if (this.modules[moduleName]) {
      return this.modules[moduleName];
    }

    if (!runtimeEnvironment.hasCapability('liveActivities')) {
      console.log('📱 LiveActivity: Not available (Expo Go or non-iOS)');
      return this.createLiveActivityFallback();
    }

    try {
      // This will be our custom native module
      const LiveActivityModule = require('../../modules/live-activity').default;
      
      if (LiveActivityModule) {
        console.log('✅ LiveActivity: Native module loaded successfully');
        this.modules[moduleName] = LiveActivityModule;
        return LiveActivityModule;
      }
    } catch (error) {
      console.warn('⚠️ LiveActivity: Native module not available', error.message);
    }

    return this.createLiveActivityFallback();
  }

  /**
   * Create no-op fallback for Live Activities
   */
  createLiveActivityFallback() {
    const fallback = {
      isSupported: async () => false,
      
      startActivity: async (config) => {
        console.debug('LiveActivity.startActivity: No-op in current environment');
        return { success: false, reason: 'Not supported in Expo Go' };
      },
      
      updateActivity: async (activityId, state) => {
        console.debug('LiveActivity.updateActivity: No-op in current environment');
        return { success: false };
      },
      
      endActivity: async (activityId) => {
        console.debug('LiveActivity.endActivity: No-op in current environment');
        return { success: false };
      },
      
      endAllActivities: async () => {
        console.debug('LiveActivity.endAllActivities: No-op in current environment');
        return { success: false };
      },
      
      isAvailable: false,
      isNative: false
    };

    this.modules.liveActivity = fallback;
    return fallback;
  }

  /**
   * Load background task module
   */
  async loadBackgroundTask() {
    const moduleName = 'backgroundTask';
    
    if (this.modules[moduleName]) {
      return this.modules[moduleName];
    }

    if (!runtimeEnvironment.hasCapability('backgroundFetch')) {
      console.log('📱 BackgroundTask: Not available in Expo Go');
      return this.createBackgroundTaskFallback();
    }

    try {
      // Try to load expo-background-task (works in dev builds)
      const BackgroundTask = require('expo-background-task');
      const TaskManager = require('expo-task-manager');
      
      console.log('✅ BackgroundTask: Module loaded successfully');
      this.modules[moduleName] = { BackgroundTask, TaskManager };
      return this.modules[moduleName];
    } catch (error) {
      console.warn('⚠️ BackgroundTask: Not available', error.message);
    }

    return this.createBackgroundTaskFallback();
  }

  /**
   * Create no-op fallback for background task
   */
  createBackgroundTaskFallback() {
    const fallback = {
      BackgroundTask: {
        registerTaskAsync: async () => {
          console.warn('BackgroundTask: Not supported in Expo Go');
        },
        unregisterTaskAsync: async () => {
          console.warn('BackgroundTask: Not supported in Expo Go');
        },
        getStatusAsync: async () => 3, // Denied status
        BackgroundTaskStatus: {
          Available: 1,
          Denied: 2,
          Restricted: 3
        },
        BackgroundTaskResult: {
          NewData: 1,
          NoData: 2,
          Failed: 3
        }
      },
      TaskManager: {
        defineTask: () => {
          console.warn('TaskManager: Not supported in Expo Go');
        },
        isTaskRegisteredAsync: async () => false,
      },
      isAvailable: false,
      isNative: false
    };

    this.modules.backgroundTask = fallback;
    return fallback;
  }

  /**
   * Clear all cached modules (useful for testing)
   */
  clearCache() {
    this.modules = {};
    this.loadAttempts = {};
  }

  /**
   * Get loading status for all modules
   */
  getLoadingStatus() {
    return Object.entries(this.modules).map(([name, module]) => ({
      name,
      loaded: true,
      isNative: module.isNative !== false,
      isAvailable: module.isAvailable !== false
    }));
  }
}

// Create singleton instance
const moduleLoader = new ModuleLoader();

// Export both class and instance
export { ModuleLoader };
export default moduleLoader;