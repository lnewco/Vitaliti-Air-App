// Overall, I am suprised this project is done in plain Javascript rather than Typescript.
// Probably too late at this point to switch over, but Typescript the standard at this point.
import React from 'react';
import { LogBox } from 'react-native';
import { BluetoothProvider } from './src/context/BluetoothContext';
import { AuthProvider } from './src/auth/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import ErrorBoundary from './src/components/ErrorBoundary';
import logger from './src/utils/logger';

// Configure LogBox to ignore specific warnings that are not actionable
// Keep error reporting enabled for debugging
if (__DEV__) {
  // In development, only ignore specific non-critical warnings
  LogBox.ignoreLogs([
    'Non-serializable values were found in the navigation state',
    'VirtualizedLists should never be nested', // Common in ScrollView with FlatList
    'Require cycle:', // Some third-party libraries have these
  ]);
  logger.info('App', 'Development mode - selective warning suppression enabled');
} else {
  // In production, be more aggressive about hiding warnings from users
  // but still log them for debugging
  LogBox.ignoreLogs([
    'Warning:', // Hide all warnings in production
  ]);
  logger.setLogLevel('INFO');
  logger.info('App', 'Production mode - user-facing warnings suppressed');
}

export default function App() {
  logger.info('App', 'Initializing Vitaliti Air App');
  
  return (
    <ErrorBoundary name="App">
      <AuthProvider>
        <BluetoothProvider>
          <AppNavigator />
        </BluetoothProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
