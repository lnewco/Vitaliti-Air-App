module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ['module:react-native-dotenv', {
        envName: 'APP_ENV',
        moduleName: '@env',
        path: '.env.local',
        safe: false,
        allowUndefined: true,
        verbose: false,
      }],
      // Temporarily disabled reanimated plugin for Expo Go compatibility
      // Uncomment for development builds:
      // 'react-native-reanimated/plugin',
    ],
  };
};