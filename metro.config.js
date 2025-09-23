// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add resolver for react-native-reanimated shim in Expo Go
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Use shim for reanimated in Expo Go
  if (moduleName === 'react-native-reanimated' && process.env.EXPO_PUBLIC_USE_MOCK_BLE !== 'false') {
    return {
      filePath: path.resolve(__dirname, 'src/utils/reanimatedShim.js'),
      type: 'sourceFile',
    };
  }

  // Default resolver
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
