import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';

const DashboardScreen = ({ navigation }) => {
  const handleStartSession = () => {
    navigation.navigate('SessionSetup');
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Vitaliti Air</Text>
        <Text style={styles.subtitle}>Intermittent Hypoxic-Hyperoxic Training</Text>
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeIcon}>🫁</Text>
          <Text style={styles.welcomeText}>Ready to start your training session?</Text>
          <Text style={styles.welcomeSubtext}>
            Connect your pulse oximeter and begin monitoring your oxygen levels
          </Text>
        </View>

        <TouchableOpacity 
          style={styles.startButton}
          onPress={handleStartSession}
        >
          <Text style={styles.startButtonText}>Start Session</Text>
        </TouchableOpacity>

        <View style={styles.infoSection}>
          <Text style={styles.infoText}>
            🔹 Connect your pulse oximeter{'\n'}
            🔹 Follow the guided setup{'\n'}
            🔹 Begin your IHHT training
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  welcomeSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  welcomeIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 12,
  },
  welcomeSubtext: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  startButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 40,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  infoSection: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  infoText: {
    fontSize: 16,
    color: '#374151',
    lineHeight: 24,
  },
});

export default DashboardScreen; 