import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { BluetoothProvider } from './src/context/BluetoothContext';
import DashboardScreen from './src/screens/DashboardScreen';
import SessionHistoryScreen from './src/screens/SessionHistoryScreen';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const renderContent = () => {
  console.log("📱 App.js setActiveTab function created:", typeof setActiveTab);
    switch (activeTab) {
      case 'dashboard':
        return <DashboardScreen />;
      case 'history':
        return <SessionHistoryScreen />;
      default:
        return <DashboardScreen />;
    }
  };

  return (
    <BluetoothProvider>
      <SafeAreaView style={styles.container}>
        <StatusBar style="auto" />
        
        {/* Main Content */}
        <View style={styles.content}>
          {renderContent()}
        </View>

        {/* Bottom Tab Navigation */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'dashboard' && styles.activeTab]}
            onPress={() => setActiveTab('dashboard')}
          >
            <Text style={[styles.tabText, activeTab === 'dashboard' && styles.activeTabText]}>
              📊 Monitor
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'history' && styles.activeTab]}
            onPress={() => setActiveTab('history')}
          >
            <Text style={[styles.tabText, activeTab === 'history' && styles.activeTabText]}>
              📈 History
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </BluetoothProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingBottom: 10,
    paddingTop: 5,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 5,
  },
  activeTab: {
    backgroundColor: '#f0f8ff',
    borderRadius: 8,
    marginHorizontal: 10,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
  },
  activeTabText: {
    color: '#2196F3',
  },
});
