import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet } from 'react-native';
import { BluetoothProvider } from './src/context/BluetoothContext';
import DashboardScreen from './src/screens/DashboardScreen';

export default function App() {
  return (
    <BluetoothProvider>
      <SafeAreaView style={styles.container}>
        <StatusBar style="auto" />
        <DashboardScreen />
      </SafeAreaView>
    </BluetoothProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
});
