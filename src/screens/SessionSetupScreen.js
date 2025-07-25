import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { useBluetooth } from '../context/BluetoothContext';
import StepIndicator from '../components/StepIndicator';
import ConnectionManager from '../components/ConnectionManager';

const SessionSetupScreen = ({ navigation }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const { isConnected, pulseOximeterData } = useBluetooth();

  // Auto-advance to step 2 when device connects
  useEffect(() => {
    if (isConnected && currentStep === 1) {
      setCurrentStep(2);
    }
  }, [isConnected, currentStep]);

  // Auto-regress to step 1 if device disconnects
  useEffect(() => {
    if (!isConnected && currentStep === 2) {
      setCurrentStep(1);
    }
  }, [isConnected, currentStep]);

  const handleBack = () => {
    if (currentStep === 1) {
      navigation.goBack();
    } else {
      setCurrentStep(1);
    }
  };

  const handleStartSession = () => {
    if (!isConnected) {
      Alert.alert(
        'Device Not Connected',
        'Please connect your pulse oximeter before starting the session.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Navigate to IHHT training session
    navigation.navigate('AirSession');
  };

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <ScrollView 
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.stepHeader}>
          <Text style={styles.stepTitle}>Connect Your Pulse Oximeter</Text>
          <Text style={styles.stepDescription}>
            Find and connect your pulse oximeter to begin monitoring your oxygen levels.
          </Text>
        </View>

        <View style={styles.stepContent}>
          <ConnectionManager />
        </View>
      </ScrollView>

      <View style={styles.stepActions}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.continueButton, !isConnected && styles.continueButtonDisabled]}
          onPress={() => isConnected && setCurrentStep(2)}
          disabled={!isConnected}
        >
          <Text style={[styles.continueButtonText, !isConnected && styles.continueButtonTextDisabled]}>
            Continue →
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <ScrollView 
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.stepHeader}>
          <Text style={styles.stepTitle}>Ready to Begin</Text>
          <Text style={styles.stepDescription}>
            Your device is connected and reading data. You're ready to start your IHHT training session.
          </Text>
        </View>

        <View style={styles.stepContent}>
          <View style={styles.readyCard}>
            <Text style={styles.readyIcon}>✅</Text>
            <Text style={styles.readyTitle}>Device Connected</Text>
            <Text style={styles.readySubtitle}>Pulse oximeter is ready</Text>
            
            {pulseOximeterData && (
              <View style={styles.liveData}>
                <View style={styles.dataRow}>
                  <Text style={styles.dataLabel}>SpO2:</Text>
                  <Text style={styles.dataValue}>{pulseOximeterData.spo2}%</Text>
                </View>
                <View style={styles.dataRow}>
                  <Text style={styles.dataLabel}>Heart Rate:</Text>
                  <Text style={styles.dataValue}>{pulseOximeterData.heartRate} bpm</Text>
                </View>
              </View>
            )}
          </View>

          <View style={styles.sessionInfo}>
            <Text style={styles.sessionInfoTitle}>🎯 IHHT Training Session</Text>
            <Text style={styles.sessionInfoText}>
              • 5 cycles of hypoxic-hyperoxic training{'\n'}
              • Approximately 35 minutes duration{'\n'}
              • Real-time safety monitoring{'\n'}
              • Guided breathing phases
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.stepActions}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.startSessionButton} onPress={handleStartSession}>
          <Text style={styles.startSessionButtonText}>Start Air Session</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StepIndicator currentStep={currentStep} totalSteps={2} />
      
      {currentStep === 1 && renderStep1()}
      {currentStep === 2 && renderStep2()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  stepContainer: {
    flex: 1,
  },
  scrollContainer: {
    flex: 1,
  },
     scrollContent: {
     paddingHorizontal: 20,
     paddingBottom: 40, // Extra padding to prevent content hiding behind actions
   },
  stepHeader: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  stepDescription: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 320,
  },
  stepContent: {
    paddingVertical: 20,
  },
  stepActions: {
    flexDirection: 'row',
    paddingVertical: 24,
    paddingHorizontal: 20,
    gap: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  backButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  continueButton: {
    flex: 1,
    backgroundColor: '#3B82F6',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  continueButtonDisabled: {
    backgroundColor: '#E5E7EB',
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  continueButtonTextDisabled: {
    color: '#9CA3AF',
  },
  readyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  readyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  readyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  readySubtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 24,
  },
  liveData: {
    alignItems: 'center',
  },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  dataLabel: {
    fontSize: 16,
    color: '#6B7280',
    marginRight: 12,
    minWidth: 80,
  },
  dataValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  sessionInfo: {
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    padding: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
    marginBottom: 10,
  },
  sessionInfoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 12,
  },
  sessionInfoText: {
    fontSize: 16,
    color: '#374151',
    lineHeight: 24,
  },
  startSessionButton: {
    flex: 1,
    backgroundColor: '#10B981',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  startSessionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default SessionSetupScreen; 