// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Redirect react-native-reanimated to our proxy module
config.resolver = {
  ...config.resolver,
  extraNodeModules: {
    'react-native-reanimated': path.resolve(__dirname, 'react-native-reanimated.js'),
  },
};

module.exports = config;
