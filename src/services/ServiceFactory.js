/**
 * ServiceFactory - Creates appropriate service instances based on runtime environment
 * 
 * This factory automatically selects between native and Expo implementations
 * based on the current runtime environment and available modules.
 */

import runtimeEnvironment from '../utils/RuntimeEnvironment';
import moduleLoader from '../modules/ModuleLoader';

// Service implementations will be loaded dynamically
let NativeBackgroundService = null;
let ExpoBackgroundService = null;
let NativeLiveActivityService = null;
let ExpoLiveActivityService = null;

class ServiceFactory {
  constructor() {
    this.services = {};
    this.initialized = false;
  }

  /**
   * Initialize the factory and pre-load service classes
   */
  async initialize() {
    if (this.initialized) return;
    
    console.log('🏭 Initializing ServiceFactory');
    
    // Log current environment
    const env = runtimeEnvironment.environmentName;
    const capabilities = runtimeEnvironment.capabilities;
    
    console.log(`🏭 Environment: ${env}`);
    console.log('🏭 Capabilities:', capabilities);
    
    this.initialized = true;
  }

  /**
   * Create or return cached background service
   */
  async createBackgroundService() {
    // Return cached service if already created
    if (this.services.background) {
      return this.services.background;
    }

    console.log('🏭 Creating Background Service...');
    
    // Check if we can use native implementation
    if (runtimeEnvironment.hasCapability('backgroundTimer')) {
      try {
        // Dynamically import native service
        if (!NativeBackgroundService) {
          NativeBackgroundService = require('./native/NativeBackgroundService').default;
        }
        
        const service = new NativeBackgroundService();
        await service.initialize();
        
        // Verify it actually has native capabilities
        if (service.isNative) {
          console.log('✅ Created Native Background Service');
          this.services.background = service;
          return service;
        }
      } catch (error) {
        console.warn('⚠️ Failed to create Native Background Service:', error.message);
      }
    }
    
    // Fallback to Expo implementation
    console.log('📱 Falling back to Expo Background Service');
    
    if (!ExpoBackgroundService) {
      ExpoBackgroundService = require('./expo/ExpoBackgroundService').default;
    }
    
    const service = new ExpoBackgroundService();
    await service.initialize();
    
    this.services.background = service;
    return service;
  }

  /**
   * Create or return cached Live Activity service
   */
  async createLiveActivityService() {
    // Return cached service if already created
    if (this.services.liveActivity) {
      return this.services.liveActivity;
    }

    console.log('🏭 Creating Live Activity Service...');
    
    // Check if we can use native implementation
    if (runtimeEnvironment.hasCapability('liveActivities')) {
      try {
        // Try to load the native Live Activity module
        const liveActivityModule = await moduleLoader.loadLiveActivityModule();
        
        if (liveActivityModule && liveActivityModule.isNative) {
          // Create native service wrapper
          if (!NativeLiveActivityService) {
            // We'll create this service class inline since it's simple
            NativeLiveActivityService = class {
              constructor(module) {
                this.module = module;
                this.isNative = true;
                this.activityId = null;
              }
              
              async isSupported() {
                return await this.module.isSupported();
              }
              
              async startActivity(config) {
                const result = await this.module.startActivity(config);
                if (result.activityId) {
                  this.activityId = result.activityId;
                }
                return result;
              }
              
              async updateActivity(state) {
                if (!this.activityId) return { success: false };
                return await this.module.updateActivity(this.activityId, state);
              }
              
              async endActivity() {
                if (!this.activityId) return { success: false };
                const result = await this.module.endActivity(this.activityId);
                this.activityId = null;
                return result;
              }
            };
          }
          
          const service = new NativeLiveActivityService(liveActivityModule);
          console.log('✅ Created Native Live Activity Service');
          this.services.liveActivity = service;
          return service;
        }
      } catch (error) {
        console.warn('⚠️ Failed to create Native Live Activity Service:', error.message);
      }
    }
    
    // Fallback to no-op implementation
    console.log('📱 Live Activities not available in current environment');
    
    if (!ExpoLiveActivityService) {
      // Create simple no-op service
      ExpoLiveActivityService = class {
        constructor() {
          this.isNative = false;
        }
        
        async isSupported() {
          return false;
        }
        
        async startActivity(config) {
          console.debug('Live Activity: Not supported in Expo Go');
          return { success: false, reason: 'Not available in Expo Go' };
        }
        
        async updateActivity(state) {
          return { success: false };
        }
        
        async endActivity() {
          return { success: false };
        }
      };
    }
    
    const service = new ExpoLiveActivityService();
    this.services.liveActivity = service;
    return service;
  }

  /**
   * Create notification service
   */
  async createNotificationService() {
    // Return cached service if already created
    if (this.services.notification) {
      return this.services.notification;
    }

    console.log('🏭 Creating Notification Service...');
    
    // Load notifee or fallback
    const notifeeModule = await moduleLoader.loadNotifee();
    
    // Create wrapper service
    const NotificationService = class {
      constructor(module) {
        this.module = module;
        this.isNative = module.isNative !== false;
      }
      
      async requestPermission() {
        return await this.module.requestPermission();
      }
      
      async displayNotification(config) {
        return await this.module.displayNotification(config);
      }
      
      async scheduleNotification(config, trigger) {
        return await this.module.createTriggerNotification(config, trigger);
      }
      
      async cancelAll() {
        return await this.module.cancelAllNotifications();
      }
      
      getTriggerType() {
        return this.module.TriggerType || { TIMESTAMP: 'TIMESTAMP' };
      }
    };
    
    const service = new NotificationService(notifeeModule);
    console.log(`✅ Created ${service.isNative ? 'Native' : 'Expo'} Notification Service`);
    
    this.services.notification = service;
    return service;
  }

  /**
   * Get all created services
   */
  getServices() {
    return this.services;
  }

  /**
   * Clear all cached services (useful for testing)
   */
  clearCache() {
    this.services = {};
    moduleLoader.clearCache();
  }

  /**
   * Get service status report
   */
  getServiceStatus() {
    const status = {
      environment: runtimeEnvironment.environmentName,
      services: {}
    };
    
    for (const [name, service] of Object.entries(this.services)) {
      status.services[name] = {
        created: true,
        isNative: service.isNative,
        type: service.constructor.name
      };
    }
    
    return status;
  }
}

// Create singleton instance
const serviceFactory = new ServiceFactory();

// Export both class and instance
export { ServiceFactory };
export default serviceFactory;