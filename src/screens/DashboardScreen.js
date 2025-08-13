import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  SafeAreaView,
  Alert 
} from 'react-native';
import EnhancedSessionManager from '../services/EnhancedSessionManager';

const DashboardScreen = ({ navigation }) => {
  const [sessionInfo, setSessionInfo] = useState(EnhancedSessionManager.getSessionInfo());

  useEffect(() => {
    const interval = setInterval(() => {
      setSessionInfo(EnhancedSessionManager.getSessionInfo());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const navigateToSessionSetup = () => {
    navigation.navigate('SessionSetup');
  };

  const navigateToCalibrationSetup = () => {
    navigation.navigate('CalibrationSetup');
  };







  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Vitaliti Air</Text>
        <Text style={styles.subtitle}>Intermittent Hypoxic-Hyperoxic Training</Text>
      </View>

      {/* Main Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeIcon}>🫁</Text>
          <Text style={styles.welcomeText}>Welcome to Vitaliti Air</Text>
          <Text style={styles.welcomeSubtext}>
            Choose your session type to begin
          </Text>
        </View>

        {/* Session Options Cards */}
        <View style={styles.sessionCards}>
          {/* Calibration Session Card */}
          <TouchableOpacity 
            style={[styles.sessionCard, styles.calibrationCard]}
            onPress={navigateToCalibrationSetup}
            activeOpacity={0.8}
          >
            <View style={styles.cardIcon}>
              <Text style={styles.cardIconText}>🎯</Text>
            </View>
            <Text style={styles.cardTitle}>Calibration Session</Text>
            <Text style={styles.cardDescription}>
              Determine your optimal training intensity by finding your SpO2 threshold
            </Text>
            <View style={styles.cardFooter}>
              <Text style={styles.cardDuration}>~10 minutes</Text>
              <Text style={styles.cardArrow}>→</Text>
            </View>
          </TouchableOpacity>

          {/* Training Session Card */}
          <TouchableOpacity 
            style={[styles.sessionCard, styles.trainingCard]}
            onPress={navigateToSessionSetup}
            activeOpacity={0.8}
          >
            <View style={styles.cardIcon}>
              <Text style={styles.cardIconText}>💪</Text>
            </View>
            <Text style={styles.cardTitle}>Training Session</Text>
            <Text style={styles.cardDescription}>
              Start your IHHT training with customized hypoxic-hyperoxic cycles
            </Text>
            <View style={styles.cardFooter}>
              <Text style={styles.cardDuration}>30-60 minutes</Text>
              <Text style={styles.cardArrow}>→</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>Getting Started</Text>
          <Text style={styles.infoText}>
            🎯 New users: Start with a Calibration Session{'\n'}
            💪 Returning users: Jump into Training{'\n'}
            📊 Track your progress in Session History
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
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
    paddingTop: 30,
  },
  welcomeSection: {
    alignItems: 'center',
    marginBottom: 30,
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

  sessionCards: {
    marginBottom: 30,
  },
  sessionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  calibrationCard: {
    borderColor: '#F59E0B',
  },
  trainingCard: {
    borderColor: '#3B82F6',
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  cardIconText: {
    fontSize: 24,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  cardDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 16,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardDuration: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  cardArrow: {
    fontSize: 20,
    color: '#9CA3AF',
  },
  infoSection: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 22,
  },

});

export default DashboardScreen; 