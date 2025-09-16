/**
 * Jest Test Setup Configuration
 *
 * This file configures the test environment and mocks for all tests
 */

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock Expo modules
jest.mock('expo-constants', () => ({
  appOwnership: 'expo',
  __esModule: true,
  default: {
    appOwnership: 'expo',
    manifest: {},
    platform: {
      ios: { buildNumber: '1' },
      android: { versionCode: 1 }
    }
  }
}));

// Mock Expo SQLite
jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn().mockResolvedValue({
    execAsync: jest.fn(),
    runAsync: jest.fn(),
    getAllAsync: jest.fn().mockResolvedValue([]),
    getFirstAsync: jest.fn().mockResolvedValue(null)
  }),
  SQLiteDatabase: jest.fn()
}));

// Mock React Native modules
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  RN.NativeModules.BleManager = {
    start: jest.fn(),
    scan: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn()
  };
  return RN;
});

// Mock BLE PLX
jest.mock('react-native-ble-plx', () => ({
  BleManager: jest.fn().mockImplementation(() => ({
    startDeviceScan: jest.fn(),
    stopDeviceScan: jest.fn(),
    connectToDevice: jest.fn(),
    cancelDeviceConnection: jest.fn(),
    onStateChange: jest.fn(),
    state: jest.fn().mockResolvedValue('PoweredOn'),
    destroy: jest.fn()
  }))
}));

// Mock Supabase
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
      getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null })
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null })
    }))
  }))
}));

// Mock console methods to reduce test output noise
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Add custom matchers (if using @testing-library/jest-native)
// Note: As per the deprecation warning, these are now built into @testing-library/react-native v12.4+

// Set test environment
process.env.NODE_ENV = 'test';