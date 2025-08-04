import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useBluetoothConnection } from '../context/BluetoothContext';
import StepIndicator from '../components/StepIndicator';
import OptimizedConnectionManager from '../components/OptimizedConnectionManager';
import SupabaseService from '../services/SupabaseService';
import HRV_CONFIG from '../config/hrvConfig';
import { useAuth } from '../auth/AuthContext';
import BluetoothService from '../services/BluetoothService';

// Dual-Timeframe HRV Display Component for Session Setup
const DualHRVDisplay = ({ heartRateData }) => {
  const [sessionStartTime] = useState(Date.now());
  
  const shortTermHRV = useMemo(() => {
    if (!heartRateData?.hrv?.rmssd) return null;
    return {
      rmssd: heartRateData.hrv.rmssd,
      timeframe: '30s',
      status: heartRateData.hrv.rmssd > 30 ? 'Good' : heartRateData.hrv.rmssd > 20 ? 'Fair' : 'Low'
    };
  }, [heartRateData?.hrv?.rmssd]);

  const longTermHRV = useMemo(() => {
    const sessionDuration = Math.floor((Date.now() - sessionStartTime) / 1000);
    if (!heartRateData?.hrv?.rmssd || sessionDuration < HRV_CONFIG.LONG_TERM_MIN_DURATION) {
      return { rmssd: null, timeframe: '5min', status: 'Collecting...' };
    }
    
    return {
      rmssd: heartRateData.hrv.rmssd,
      timeframe: '5min',
      status: heartRateData.hrv.rmssd > 35 ? 'Excellent' : heartRateData.hrv.rmssd > 25 ? 'Good' : 'Fair'
    };
  }, [heartRateData?.hrv?.rmssd, sessionStartTime]);

  return (
    <View style={styles.hrvContainer}>
      <Text style={styles.hrvTitle}>Heart Rate Variability Analysis</Text>
      <View style={styles.hrvDualDisplay}>
        <View style={styles.hrvTimeframe}>
          <Text style={styles.hrvTimeframeLabel}>Short-term ({shortTermHRV?.timeframe})</Text>
          <Text style={styles.hrvValue}>
            {shortTermHRV?.rmssd ? `${shortTermHRV.rmssd.toFixed(1)}ms` : '--'}
          </Text>
          <Text style={[styles.hrvStatus, { color: getHRVStatusColor(shortTermHRV?.status) }]}>
            {shortTermHRV?.status || 'Loading...'}
          </Text>
        </View>
        <View style={styles.hrvTimeframe}>
          <Text style={styles.hrvTimeframeLabel}>Long-term ({longTermHRV.timeframe})</Text>
          <Text style={styles.hrvValue}>
            {longTermHRV.rmssd ? `${longTermHRV.rmssd.toFixed(1)}ms` : '--'}
          </Text>
          <Text style={[styles.hrvStatus, { color: getHRVStatusColor(longTermHRV.status) }]}>
            {longTermHRV.status}
          </Text>
        </View>
      </View>
    </View>
  );
};

const getHRVStatusColor = (status) => {
  switch (status) {
    case 'Excellent': return '#22c55e';
    case 'Good': return '#16a34a';
    case 'Fair': return '#eab308';
    case 'Low': return '#ef4444';
    default: return '#6b7280';
  }
};

const SessionSetupScreen = ({ navigation }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedHypoxiaLevel, setSelectedHypoxiaLevel] = useState(16);
  const [protocolConfig, setProtocolConfig] = useState({
    totalCycles: 3,
    hypoxicDuration: 7, // minutes
    hyperoxicDuration: 3 // minutes
  });
  const [sessionId, setSessionId] = useState(null);

  // Only use connection state - no high-frequency data to prevent re-renders
  const { 
    isPulseOxConnected, 
    isHRConnected, 
    isAnyDeviceConnected 
  } = useBluetoothConnection();

  // Auto-regress to step 1 if no devices are connected
  useEffect(() => {
    if (!isAnyDeviceConnected && (currentStep === 2 || currentStep === 3)) {
      setCurrentStep(1);
    }
  }, [isAnyDeviceConnected, currentStep]);

  const generateSessionId = () => {
    const timestamp = Date.now();
    const randomPart = Math.random().toString(36).substring(2, 15);
    return `session_${timestamp}_${randomPart}`;
  };

  const handleBack = () => {
    if (currentStep === 1) {
      navigation.goBack();
    } else if (currentStep === 2) {
      setCurrentStep(1);
    } else {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleStartSession = () => {
    // Check if at least one device is connected
    if (!isAnyDeviceConnected) {
      Alert.alert(
        'Device Required',
        'Please connect either a heart rate monitor or pulse oximeter before starting the session.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Generate session ID and navigate to pre-session survey
    const newSessionId = generateSessionId();
    setSessionId(newSessionId);
    navigation.navigate('PreSessionSurvey', { sessionId: newSessionId });
  };

  const handleDirectStartTraining = () => {
    console.log('🚀 Starting training directly from Ready to Begin step with sessionId:', sessionId);
    navigation.navigate('AirSession', { sessionId: sessionId });
  };

  // Protocol configuration handlers
  const handleHypoxiaLevelChange = (level) => {
    setSelectedHypoxiaLevel(level);
  };

  const handleProtocolChange = (field, value) => {
    setProtocolConfig(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const renderStep1 = () => {
    return (
      <View style={styles.stepContainer}>
        <View style={styles.stepHeader}>
          <Text style={styles.stepTitle}>Connect Your Devices</Text>
          <Text style={styles.stepSubtitle}>
            Connect at least one device to monitor your vitals during IHHT training
          </Text>
        </View>

        <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
          <OptimizedConnectionManager />
        </ScrollView>

        <View style={styles.stepActions}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.continueButton, !isAnyDeviceConnected && styles.continueButtonDisabled]}
            onPress={() => isAnyDeviceConnected && handleStartSession()}
            disabled={!isAnyDeviceConnected}
          >
            <Text style={[styles.continueButtonText, !isAnyDeviceConnected && styles.continueButtonTextDisabled]}>
              {isAnyDeviceConnected ? 'Continue →' : 'Connect a Device First'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderStep3 = () => {
    // Dynamic title and description based on connected devices
    let title = "Ready to Begin IHHT Training";
    let description = "Your devices are connected and reading data. You're ready to start your IHHT training session.";
    
    if (isHRConnected && isPulseOxConnected) {
      title = "Dual Device Setup Complete";
      description = "Both heart rate monitor and pulse oximeter are connected. You have complete monitoring with enhanced analysis and SpO2 tracking.";
    } else if (isHRConnected && !isPulseOxConnected) {
      title = "Heart Rate Monitor Connected";
      description = "Your heart rate monitor is connected for detailed analysis. You're ready for HR-focused IHHT training.";
    } else if (!isHRConnected && isPulseOxConnected) {
      title = "Pulse Oximeter Connected";
      description = "Your pulse oximeter is connected for SpO2 monitoring. You're ready for oxygen-focused IHHT training.";
    }

    return (
      <View style={styles.stepContainer}>
        <View style={styles.stepHeader}>
          <Text style={styles.stepTitle}>{title}</Text>
          <Text style={styles.stepSubtitle}>{description}</Text>
        </View>

        <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
          <View style={styles.stepContent}>
            {/* Heart Rate Monitor Section - Show FIRST when connected */}
            {isHRConnected && (
              <View style={[styles.readyCard, styles.primaryCard]}>
                <Text style={styles.readyIcon}>❤️</Text>
                <Text style={styles.readyTitle}>Heart Rate Monitor Connected</Text>
                <Text style={styles.readySubtitle}>Enhanced HR accuracy and analysis active</Text>
              </View>
            )}

            {/* Pulse Oximeter Section - Show SECOND when both connected, or first if only pulse ox */}
            {isPulseOxConnected && (
              <View style={[styles.readyCard, isHRConnected ? styles.secondaryCard : styles.primaryCard]}>
                <Text style={styles.readyIcon}>📱</Text>
                <Text style={styles.readyTitle}>Pulse Oximeter Connected</Text>
                <Text style={styles.readySubtitle}>SpO2 and heart rate monitoring active</Text>
              </View>
            )}

            {/* Show connection encouragement if only one device connected */}
            {(isHRConnected && !isPulseOxConnected) && (
              <View style={styles.optionalDeviceCard}>
                <Text style={styles.optionalIcon}>📱</Text>
                <Text style={styles.optionalTitle}>Optional: Add Pulse Oximeter</Text>
                <Text style={styles.optionalDescription}>
                  For complete monitoring, consider connecting a pulse oximeter for SpO2 tracking.
                </Text>
              </View>
            )}

            {(!isHRConnected && isPulseOxConnected) && (
              <View style={styles.optionalDeviceCard}>
                <Text style={styles.optionalIcon}>❤️</Text>
                <Text style={styles.optionalTitle}>Optional: Add Heart Rate Monitor</Text>
                <Text style={styles.optionalDescription}>
                  For enhanced analysis, consider connecting a heart rate monitor.
                </Text>
              </View>
            )}

            {/* Session Overview */}
            <View style={styles.sessionOverview}>
              <Text style={styles.overviewTitle}>📋 Session Overview</Text>
              <Text style={styles.overviewContent}>
                • 5 cycles of hypoxic-hyperoxic training{'\n'}
                • Approximately 35 minutes duration{'\n'}
                • Real-time safety monitoring{'\n'}
                • Guided breathing phases
              </Text>
            </View>
          </View>
        </ScrollView>

        <View style={styles.stepActions}>
          <TouchableOpacity style={styles.backButton} onPress={() => setCurrentStep(1)}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.startSessionButton} onPress={handleDirectStartTraining}>
            <Text style={styles.startSessionButtonText}>Start Training</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StepIndicator 
        currentStep={currentStep} 
        totalSteps={3}
        steps={['Connect Device', 'Complete check-in', 'Ready to Begin']}
      />
      
      {currentStep === 1 && renderStep1()}
      {currentStep === 3 && renderStep3()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  stepContainer: {
    flex: 1,
    padding: 20,
  },
  stepHeader: {
    marginBottom: 24,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  stepSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  stepContent: {
    flex: 1,
  },
  stepActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  backButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#F9FAFB',
    minWidth: 100,
  },
  backButtonText: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
    textAlign: 'center',
  },
  continueButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#3B82F6',
    minWidth: 140,
  },
  continueButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  continueButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
    textAlign: 'center',
  },
  continueButtonTextDisabled: {
    color: '#D1D5DB',
  },
  startSessionButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#10B981',
    minWidth: 140,
  },
  startSessionButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
    textAlign: 'center',
  },
  readyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryCard: {
    borderColor: '#10B981',
    borderWidth: 2,
  },
  secondaryCard: {
    borderColor: '#3B82F6',
    borderWidth: 1,
  },
  readyIcon: {
    fontSize: 32,
    textAlign: 'center',
    marginBottom: 8,
  },
  readyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 4,
  },
  readySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 12,
  },
  liveData: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
  },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  dataLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  dataValue: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '600',
  },
  primaryDataValue: {
    color: '#10B981',
  },
  optionalDeviceCard: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderStyle: 'dashed',
  },
  optionalIcon: {
    fontSize: 24,
    textAlign: 'center',
    marginBottom: 8,
    opacity: 0.7,
  },
  optionalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4B5563',
    textAlign: 'center',
    marginBottom: 4,
  },
  optionalDescription: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  sessionOverview: {
    backgroundColor: '#EBF8FF',
    borderRadius: 12,
    padding: 20,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  overviewTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E40AF',
    marginBottom: 12,
    textAlign: 'center',
  },
  overviewContent: {
    fontSize: 15,
    color: '#1E3A8A',
    lineHeight: 24,
  },
  // HRV Display Styles
  hrvContainer: {
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  hrvTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0369A1',
    textAlign: 'center',
    marginBottom: 8,
  },
  hrvDualDisplay: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  hrvTimeframe: {
    flex: 1,
    alignItems: 'center',
  },
  hrvTimeframeLabel: {
    fontSize: 12,
    color: '#0369A1',
    marginBottom: 4,
  },
  hrvValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0C4A6E',
    marginBottom: 2,
  },
  hrvStatus: {
    fontSize: 11,
    fontWeight: '500',
  },
});

export default SessionSetupScreen; 