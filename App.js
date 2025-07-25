import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { LogBox } from 'react-native';
import { BluetoothProvider } from './src/context/BluetoothContext';

// Hide error overlays from app UI but keep console logging for debugging
LogBox.ignoreAllLogs();

// Authentication imports
import { AuthProvider } from './src/auth/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';

// Enable authentication now that core functionality is working
const USE_AUTHENTICATION = true;

export default function App() {
  if (USE_AUTHENTICATION) {
    // Use authentication system
    return (
      <AuthProvider>
        <BluetoothProvider>
          <AppNavigator />
        </BluetoothProvider>
      </AuthProvider>
    );
  }

  // Fallback - should not be used but kept for reference
  return (
    <BluetoothProvider>
      <StatusBar style="auto" />
    </BluetoothProvider>
  );
}
