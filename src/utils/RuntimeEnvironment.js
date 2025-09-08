/**
 * RuntimeEnvironment - Detects and manages app runtime capabilities
 * 
 * This module determines whether we're running in:
 * - Expo Go (limited features)
 * - Development build (full features)
 * - TestFlight/Production (full features)
 * 
 * And provides capability flags for conditional feature loading
 */

import Constants from 'expo-constants';
import { Platform } from 'react-native';

class RuntimeEnvironment {
  constructor() {
    // Detect runtime environment
    this.appOwnership = Constants.appOwnership || 'standalone';
    this.isExpoGo = this.appOwnership === 'expo';
    this.isStandalone = this.appOwnership === 'standalone';
    this.isDevelopment = __DEV__;
    this.isProduction = !__DEV__ && this.isStandalone;
    this.platform = Platform.OS;
    
    // Log environment on initialization
    this.logEnvironment();
  }

  /**
   * Get current runtime capabilities
   * These flags determine which features are available
   */
  get capabilities() {
    return {
      // Live Activities - iOS 16.2+ only, not in Expo Go
      liveActivities: !this.isExpoGo && this.platform === 'ios' && this.isStandalone,
      
      // Background timers - native module required
      backgroundTimer: !this.isExpoGo,
      
      // Background BLE - requires native module
      backgroundBLE: !this.isExpoGo,
      
      // Background fetch - requires native module
      backgroundFetch: !this.isExpoGo,
      
      // Rich notifications - works everywhere but limited in Expo Go
      richNotifications: !this.isExpoGo,
      
      // Basic notifications - works everywhere
      basicNotifications: true,
      
      // Keep awake - works everywhere via expo-keep-awake
      keepAwake: true,
      
      // Background audio - requires native module
      backgroundAudio: !this.isExpoGo,
    };
  }

  /**
   * Get human-readable environment name
   */
  get environmentName() {
    if (this.isExpoGo) return 'Expo Go';
    if (this.isDevelopment) return 'Development Build';
    if (this.isProduction) return 'Production';
    return 'Unknown';
  }

  /**
   * Check if a specific feature is available
   */
  hasCapability(feature) {
    return this.capabilities[feature] || false;
  }

  /**
   * Log current environment and capabilities
   */
  logEnvironment() {
    const capabilities = this.capabilities;
    const availableFeatures = Object.entries(capabilities)
      .filter(([_, enabled]) => enabled)
      .map(([feature]) => feature);
    
    const unavailableFeatures = Object.entries(capabilities)
      .filter(([_, enabled]) => !enabled)
      .map(([feature]) => feature);

    console.log('📱 Runtime Environment:', {
      environment: this.environmentName,
      platform: this.platform,
      ownership: this.appOwnership,
      isDevelopment: this.isDevelopment,
      availableFeatures,
      unavailableFeatures
    });

    // Show warning banner in Expo Go
    if (this.isExpoGo && this.isDevelopment) {
      console.warn(`
⚠️  Running in Expo Go - Limited Features Available
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ Live Activities (Dynamic Island)
❌ True Background Processing
❌ Background BLE Data Collection
❌ Rich Notifications
✅ Basic UI and Functionality
✅ Basic Notifications
✅ Keep Awake Mode

To test all features, create a development build:
npx eas build --profile development --platform ios
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      `);
    } else if (this.isStandalone) {
      console.log(`
✅ Running ${this.environmentName} Build - Full Features Enabled
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${this.platform === 'ios' ? '✅ Live Activities (Dynamic Island)' : ''}
✅ Background Processing
✅ Background BLE Data Collection
✅ Rich Notifications
✅ All Features Available
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      `);
    }
  }

  /**
   * Show capability warning in UI (for development)
   */
  getCapabilityWarning() {
    if (!this.isExpoGo) return null;
    
    return {
      title: 'Limited Features in Expo Go',
      message: 'Some features like Live Activities and background processing are only available in the TestFlight or App Store version.',
      features: {
        unavailable: [
          'Live Activities (Dynamic Island)',
          'Background Session Monitoring',
          'Background BLE Data Collection',
          'Rich Notifications'
        ],
        available: [
          'Session Timer',
          'Basic Notifications',
          'BLE Connection (Foreground)',
          'Keep Awake Mode'
        ]
      }
    };
  }
}

// Create singleton instance
const runtimeEnvironment = new RuntimeEnvironment();

// Export both the class and instance
export { RuntimeEnvironment };
export default runtimeEnvironment;