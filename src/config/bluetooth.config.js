/**
 * Bluetooth Configuration
 * Controls when to use real Bluetooth vs mock data
 */

import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Environment detection
export const Environment = {
  isExpoGo: Constants.appOwnership === 'expo',
  isDevelopment: __DEV__,
  isProduction: !__DEV__,
  isTestFlight: Constants.appOwnership === 'standalone' && !__DEV__,
  isEASBuild: Constants.appOwnership === undefined && Constants.executionEnvironment === 'standalone',
  isSimulator: Platform.OS === 'ios' && !Platform.isPad && !Platform.isTVOS && 
               (Constants.isDevice === false || Constants.deviceName?.includes('Simulator')),
};

// Configuration for different environments
export const BluetoothConfig = {
  // Force mock data in these environments
  forceMockEnvironments: [
    'expo-go',      // Expo Go doesn't support native Bluetooth
    'simulator',    // iOS Simulator doesn't have Bluetooth
  ],
  
  // Allow real Bluetooth in these environments
  realBluetoothEnvironments: [
    'eas-build',    // EAS builds (development, preview, production)
    'testflight',   // TestFlight builds
    'standalone',   // Standalone production builds
  ],
  
  // Development override - set this to true to use mock data in development builds
  useMockInDevelopment: process.env.EXPO_PUBLIC_USE_MOCK_BLE === 'true',
};

// Main decision function
export const shouldUseMockBluetooth = () => {
  // Always use mock in Expo Go
  if (Environment.isExpoGo) {
    console.log('📱 Expo Go detected - using mock Bluetooth');
    return true;
  }
  
  // Always use mock in simulator
  if (Environment.isSimulator) {
    console.log('📱 Simulator detected - using mock Bluetooth');
    return true;
  }
  
  // In development builds, check the override flag
  if (Environment.isDevelopment && BluetoothConfig.useMockInDevelopment) {
    console.log('📱 Development with mock flag - using mock Bluetooth');
    return true;
  }
  
  // For EAS builds and TestFlight, use real Bluetooth
  if (Environment.isEASBuild || Environment.isTestFlight) {
    console.log('📱 Native build detected - using real Bluetooth');
    return false;
  }
  
  // Default to real Bluetooth for production builds
  console.log('📱 Production build - using real Bluetooth');
  return false;
};

// Export a summary for debugging
export const getEnvironmentInfo = () => ({
  platform: Platform.OS,
  isDevice: Constants.isDevice,
  appOwnership: Constants.appOwnership,
  executionEnvironment: Constants.executionEnvironment,
  ...Environment,
  shouldUseMock: shouldUseMockBluetooth(),
});