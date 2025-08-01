import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { useBluetooth } from '../context/BluetoothContext';
import StepIndicator from '../components/StepIndicator';
import DualDeviceConnectionManager from '../components/DualDeviceConnectionManager';
import HRV_CONFIG from '../config/hrvConfig';

// Dual-Timeframe HRV Display Component for Session Setup
const DualHRVDisplay = ({ heartRateData }) => {
  const [sessionStartTime] = useState(Date.now());
  
  // Helper to get confidence color
  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.8) return '#4ECDC4'; // Teal
    if (confidence >= 0.6) return '#FFE66D'; // Yellow
    if (confidence >= 0.4) return '#FF6B6B'; // Red
    return '#9CA3AF'; // Gray
  };

  const sessionDuration = Math.round((Date.now() - sessionStartTime) / 1000);
  const quickHRV = heartRateData?.quickHRV;
  const realHRV = heartRateData?.realHRV;

  return (
    <View style={styles.dualHrvContainer}>
      <Text style={styles.hrvTitle}>Heart Rate Variability</Text>
      
      {/* Quick HRV */}
      <View style={styles.hrvMetricCard}>
        <View style={styles.hrvHeader}>
          <Text style={styles.hrvTypeLabel}>
            {HRV_CONFIG.UI.STAGE_ICONS.QUICK} Quick HRV
          </Text>
          {quickHRV && (
            <View style={[
              styles.confidenceBadge, 
              { backgroundColor: getConfidenceColor(quickHRV.confidence) }
            ]}>
              <Text style={styles.confidenceText}>
                {Math.round(quickHRV.confidence * 100)}%
              </Text>
            </View>
          )}
        </View>
        <Text style={styles.hrvMainValue}>
          {quickHRV ? `${quickHRV.rmssd}ms` : '--'}
        </Text>
        <Text style={styles.hrvSubtext}>
          {quickHRV 
            ? `${quickHRV.stage.description} • ${quickHRV.intervalCount} intervals`
            : 'Calculating from incoming data...'
          }
        </Text>
      </View>
      
      {/* Real HRV */}
      <View style={styles.hrvMetricCard}>
        <View style={styles.hrvHeader}>
          <Text style={styles.hrvTypeLabel}>
            {HRV_CONFIG.UI.STAGE_ICONS.REAL} Real HRV
          </Text>
          {realHRV && (
            <View style={[
              styles.confidenceBadge, 
              { backgroundColor: getConfidenceColor(realHRV.confidence) }
            ]}>
              <Text style={styles.confidenceText}>
                {Math.round(realHRV.confidence * 100)}%
              </Text>
            </View>
          )}
        </View>
        <Text style={styles.hrvMainValue}>
          {realHRV ? `${realHRV.rmssd}ms` : '--'}
        </Text>
        <Text style={styles.hrvSubtext}>
          {realHRV 
            ? `${realHRV.stage.description} • ${realHRV.intervalCount} intervals`
            : sessionDuration < 60 
              ? `Available after 1 minute (${60 - sessionDuration}s remaining)`
              : 'Building accuracy...'
          }
        </Text>
      </View>
      
      {/* Session Info */}
      <Text style={styles.sessionInfo}>
        Session Duration: {sessionDuration}s
      </Text>
      
      {/* Explanatory text */}
      <Text style={styles.hrvNote}>
        💡 Quick HRV provides immediate feedback, Real HRV builds to research-grade accuracy
      </Text>
    </View>
  );
};

const SessionSetupScreen = ({ navigation }) => {
  const [currentStep, setCurrentStep] = useState(1);
  
  // Protocol configuration state
  const [protocolConfig, setProtocolConfig] = useState({
    totalCycles: 5,           // Default 5 rounds
    hypoxicDuration: 5,       // Default 5 minutes  
    hyperoxicDuration: 2      // Default 2 minutes
  });

  const { 
    isPulseOxConnected, 
    isHRConnected, 
    pulseOximeterData, 
    heartRateData,
    persistentHRV,  // ✅ Add persistentHRV from context
    isAnyDeviceConnected 
  } = useBluetooth();

  // Calculate total session duration in minutes
  const calculateTotalDuration = () => {
    return (protocolConfig.hypoxicDuration + protocolConfig.hyperoxicDuration) * protocolConfig.totalCycles;
  };

  // Auto-regress to step 1 if no devices are connected
  useEffect(() => {
    if (!isAnyDeviceConnected && (currentStep === 2 || currentStep === 3)) {
      setCurrentStep(1);
    }
  }, [isAnyDeviceConnected, currentStep]);

  const handleBack = () => {
    if (currentStep === 1) {
      navigation.goBack();
    } else {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleStartSession = () => {
    if (!isAnyDeviceConnected) {
      Alert.alert(
        'Device Required',
        'Please connect either a heart rate monitor or pulse oximeter before starting the session.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Pass protocol configuration to the training session
    navigation.navigate('AirSession', { protocolConfig });
  };

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <ScrollView 
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.stepHeader}>
          <Text style={styles.stepTitle}>Connect Your Devices</Text>
          <Text style={styles.stepDescription}>
            Connect your devices for IHHT training. You can use either a pulse oximeter (for SpO2 monitoring) or heart rate monitor (for enhanced HRV analysis), or both for complete monitoring.
          </Text>
        </View>

        <View style={styles.stepContent}>
          <DualDeviceConnectionManager />
        </View>
      </ScrollView>

      <View style={styles.stepActions}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.continueButton, !isAnyDeviceConnected && styles.continueButtonDisabled]}
          onPress={() => isAnyDeviceConnected && setCurrentStep(2)}
          disabled={!isAnyDeviceConnected}
        >
          <Text style={[styles.continueButtonText, !isAnyDeviceConnected && styles.continueButtonTextDisabled]}>
            {isAnyDeviceConnected ? 'Continue →' : 'Connect a Device First'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Configuration Slider Component
  const ConfigSlider = ({ label, value, onValueChange, min, max, suffix, step = 1 }) => (
    <View style={styles.configSliderContainer}>
      <View style={styles.configSliderHeader}>
        <Text style={styles.configSliderLabel}>{label}</Text>
        <Text style={styles.configSliderValue}>{value} {suffix}</Text>
      </View>
      <CustomSlider
        value={value}
        onValueChange={onValueChange}
        minimumValue={min}
        maximumValue={max}
        step={step}
      />
      <View style={styles.configSliderRange}>
        <Text style={styles.configSliderRangeText}>{min}</Text>
        <Text style={styles.configSliderRangeText}>{max}</Text>
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
          <Text style={styles.stepTitle}>Configure Your Session</Text>
          <Text style={styles.stepDescription}>
            Customize your IHHT training protocol. Adjust the number of rounds and phase durations to match your training goals.
          </Text>
        </View>

        <View style={styles.stepContent}>
          <View style={styles.configContainer}>
            <ConfigSlider
              label="Number of Rounds"
              value={protocolConfig.totalCycles}
              onValueChange={(value) => setProtocolConfig(prev => ({ ...prev, totalCycles: Math.round(value) }))}
              min={1}
              max={10}
              suffix="rounds"
            />

            <ConfigSlider
              label="Hypoxia Phase"
              value={protocolConfig.hypoxicDuration}
              onValueChange={(value) => setProtocolConfig(prev => ({ ...prev, hypoxicDuration: Math.round(value) }))}
              min={3}
              max={15}
              suffix="minutes"
            />

            <ConfigSlider
              label="Hyperoxia Phase"
              value={protocolConfig.hyperoxicDuration}
              onValueChange={(value) => setProtocolConfig(prev => ({ ...prev, hyperoxicDuration: Math.round(value) }))}
              min={1}
              max={10}
              suffix="minutes"
            />

            <View style={styles.totalDurationCard}>
              <Text style={styles.totalDurationLabel}>Total Session Duration</Text>
              <Text style={styles.totalDurationValue}>{calculateTotalDuration()} minutes</Text>
              <Text style={styles.totalDurationBreakdown}>
                {protocolConfig.totalCycles} × ({protocolConfig.hypoxicDuration} + {protocolConfig.hyperoxicDuration}) minutes
              </Text>
            </View>

            {calculateTotalDuration() > 60 && (
              <View style={styles.warningCard}>
                <Text style={styles.warningIcon}>⚠️</Text>
                <Text style={styles.warningText}>
                  Long session detected ({calculateTotalDuration()} min). Consider shorter durations for your first sessions.
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      <View style={styles.stepActions}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.continueButton}
          onPress={() => setCurrentStep(3)}
        >
          <Text style={styles.continueButtonText}>Continue →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderStep3 = () => {
    // Dynamic title and description based on connected devices
    let title = "Ready to Begin";
    let description = "Your devices are connected and reading data. You're ready to start your IHHT training session.";
    
    if (isHRConnected && isPulseOxConnected) {
      title = heartRateData?.hrv ? "Dual Device Setup Complete" : "Dual Device Setup - HRV Loading";
      description = heartRateData?.hrv 
        ? "Both heart rate monitor and pulse oximeter are connected. You have complete monitoring with enhanced HRV analysis and SpO2 tracking."
        : "Both devices are connected! Pulse oximeter is providing SpO2 data while your heart rate monitor is collecting data for HRV analysis.";
    } else if (isHRConnected && !isPulseOxConnected) {
      title = heartRateData?.hrv ? "WHOOP Connected - Enhanced HRV Ready" : "WHOOP Connected - HRV Loading";
      description = heartRateData?.hrv 
        ? "Your heart rate monitor is connected and providing detailed HRV analysis. You're ready for HRV-focused IHHT training."
        : "Your heart rate monitor is connected and collecting data for HRV analysis. HRV metrics will appear shortly.";
    } else if (!isHRConnected && isPulseOxConnected) {
      title = "Pulse Oximeter Connected";
      description = "Your pulse oximeter is connected for SpO2 monitoring. You're ready for oxygen-focused IHHT training.";
    }

    return (
      <View style={styles.stepContainer}>
        <ScrollView 
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.stepHeader}>
            <Text style={styles.stepTitle}>{title}</Text>
            <Text style={styles.stepDescription}>
              {description}
            </Text>
          </View>

          <View style={styles.stepContent}>
            {/* Heart Rate Monitor Section - Show FIRST when connected */}
            {isHRConnected && (
              <View style={[styles.readyCard, styles.primaryCard]}>
                <Text style={styles.readyIcon}>❤️</Text>
                <Text style={styles.readyTitle}>Heart Rate Monitor Connected</Text>
                <Text style={styles.readySubtitle}>Enhanced HR accuracy and HRV analysis active</Text>
                
                {heartRateData && (
                  <View style={styles.liveData}>
                    <View style={styles.dataRow}>
                      <Text style={styles.dataLabel}>Heart Rate:</Text>
                      <Text style={[styles.dataValue, styles.primaryDataValue]}>{heartRateData.heartRate || '--'} bpm</Text>
                    </View>
                    
                    {/* Dual-Timeframe HRV Display */}
                    <View style={styles.hrvSection}>
                      <DualHRVDisplay 
                        heartRateData={heartRateData} 
                      />
                    </View>
                    
                    <View style={styles.dataRow}>
                      <Text style={styles.dataLabel}>Sensor Contact:</Text>
                      <Text style={styles.dataValue}>
                        {heartRateData.sensorContactDetected ? '✅ Good' : '⚠️ Check placement'}
                      </Text>
                    </View>
                    
                    {!heartRateData.sensorContactDetected && (
                      <View style={styles.sensorTipCard}>
                        <Text style={styles.sensorTipTitle}>💡 WHOOP Placement Tips</Text>
                        <Text style={styles.sensorTipText}>
                          • Ensure WHOOP is snug but not too tight{'\n'}
                          • Position on wrist bone, not muscle{'\n'}
                          • Clean sensor and skin if needed{'\n'}
                          • Try different wrist position{'\n'}
                          • Note: Some WHOOPs don't report contact but still work fine
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* Pulse Oximeter Section - Show SECOND when both connected, or first if only pulse ox */}
            {isPulseOxConnected && (
              <View style={[styles.readyCard, isHRConnected ? styles.secondaryCard : styles.primaryCard]}>
                <Text style={styles.readyIcon}>📱</Text>
                <Text style={styles.readyTitle}>Pulse Oximeter Connected</Text>
                <Text style={styles.readySubtitle}>SpO2 and heart rate monitoring active</Text>
                
                {pulseOximeterData && (
                  <View style={styles.liveData}>
                    <View style={styles.dataRow}>
                      <Text style={styles.dataLabel}>SpO2:</Text>
                      <Text style={[styles.dataValue, !isHRConnected && styles.primaryDataValue]}>{pulseOximeterData.spo2 || '--'}%</Text>
                    </View>
                    <View style={styles.dataRow}>
                      <Text style={styles.dataLabel}>Heart Rate:</Text>
                      <Text style={styles.dataValue}>{pulseOximeterData.heartRate || '--'} bpm</Text>
                    </View>
                    <View style={styles.dataRow}>
                      <Text style={styles.dataLabel}>Signal:</Text>
                      <Text style={styles.dataValue}>
                        {pulseOximeterData.signalStrength ? `${pulseOximeterData.signalStrength}/15` : '--'}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* Show connection encouragement if only one device connected */}
            {(isHRConnected && !isPulseOxConnected) && (
              <View style={styles.optionalDeviceCard}>
                <Text style={styles.optionalIcon}>📱</Text>
                <Text style={styles.optionalTitle}>Pulse Oximeter (Optional)</Text>
                <Text style={styles.optionalDescription}>
                  Add a pulse oximeter for SpO2 monitoring and enhanced safety during training. 
                  Click "Back" to connect additional devices.
                </Text>
              </View>
            )}

            {(!isHRConnected && isPulseOxConnected) && (
              <View style={styles.optionalDeviceCard}>
                <Text style={styles.optionalIcon}>❤️</Text>
                <Text style={styles.optionalTitle}>Heart Rate Monitor (Optional)</Text>
                <Text style={styles.optionalDescription}>
                  Add a WHOOP or other heart rate monitor for detailed HRV analysis and enhanced training insights. 
                  Click "Back" to connect additional devices.
                </Text>
              </View>
            )}

            <View style={styles.sessionInfo}>
              <Text style={styles.sessionInfoTitle}>🎯 Your IHHT Training Session</Text>
              <Text style={styles.sessionInfoText}>
                • {protocolConfig.totalCycles} cycles of hypoxic-hyperoxic training{'\n'}
                • {protocolConfig.hypoxicDuration} min hypoxia + {protocolConfig.hyperoxicDuration} min hyperoxia per cycle{'\n'}
                • Total duration: {calculateTotalDuration()} minutes{'\n'}
                • Real-time {isHRConnected ? (heartRateData?.hrv ? 'HRV and ' : 'HRV (loading) and ') : ''}safety monitoring{'\n'}
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
  };

  return (
    <SafeAreaView style={styles.container}>
      <StepIndicator currentStep={currentStep} totalSteps={3} />
      
      {currentStep === 1 && renderStep1()}
      {currentStep === 2 && renderStep2()}
      {currentStep === 3 && renderStep3()}
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
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  hrCard: {
    borderWidth: 2,
    borderColor: '#E5E7EB',
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
  optionalNote: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 16,
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
  primaryCard: {
    backgroundColor: '#F0F9FF',
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
  },
  secondaryCard: {
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 2,
    borderLeftColor: '#E5E7EB',
  },
  hrvSection: {
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  hrvTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  // Dual-Timeframe HRV Styles
  dualHrvContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  hrvTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  hrvMetricCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#4ECDC4',
  },
  hrvHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  hrvTypeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 44,
    alignItems: 'center',
  },
  confidenceText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  hrvMainValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#059669',
    marginBottom: 4,
  },
  hrvSubtext: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 16,
  },
  sessionInfo: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  hrvNote: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 16,
    backgroundColor: '#F0F9FF',
    padding: 8,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#4ECDC4',
  },
  primaryDataValue: {
    color: '#3B82F6',
    fontWeight: 'bold',
  },
  optionalDeviceCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  optionalIcon: {
    fontSize: 48,
    marginBottom: 12,
    opacity: 0.6,
  },
  optionalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  optionalDescription: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
     sensorTipCard: {
     backgroundColor: '#FEF3C7',
     borderRadius: 12,
     padding: 16,
     marginTop: 12,
     borderLeftWidth: 4,
     borderLeftColor: '#F59E0B',
   },
     sensorTipTitle: {
     fontSize: 16,
     fontWeight: 'bold',
     color: '#92400E',
     marginBottom: 8,
   },
     sensorTipText: {
     fontSize: 14,
     color: '#92400E',
     lineHeight: 20,
   },
  hrvLoadingContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
     hrvLoadingMessage: {
     fontSize: 16,
     fontWeight: 'bold',
     color: '#1F2937',
     marginBottom: 15,
     textAlign: 'center',
     lineHeight: 22,
   },
     progressBarContainer: {
     width: '100%',
     marginBottom: 8,
   },
     progressBarBackground: {
     height: 10,
     backgroundColor: '#E5E7EB',
     borderRadius: 5,
     overflow: 'hidden',
     marginBottom: 8,
   },
  progressBarFill: {
    height: '100%',
    borderRadius: 5,
  },
     progressText: {
     fontSize: 14,
     fontWeight: 'bold',
     color: '#3B82F6',
     textAlign: 'center',
     marginBottom: 12,
   },
  intervalStatus: {
    backgroundColor: '#E0F2FE',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
  },
  intervalStatusText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  intervalReadyText: {
    fontSize: 14,
    color: '#10B981',
    marginTop: 8,
    textAlign: 'center',
  },
  timeConnectedText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 10,
  },
  hrvTipContainer: {
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
  },
  hrvTipText: {
    fontSize: 14,
    color: '#374151',
    textAlign: 'center',
  },
  stableHrvContainer: {
    paddingVertical: 12,
  },
  
  // Configuration step styles
  configContainer: {
    paddingVertical: 10,
  },
  configSliderContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  configSliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  configSliderLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  configSliderValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#3B82F6',
  },
  configSliderRange: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  configSliderRangeText: {
    fontSize: 12,
    color: '#6B7280',
  },
  totalDurationCard: {
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    padding: 20,
    marginVertical: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
    alignItems: 'center',
  },
  totalDurationLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  totalDurationValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  totalDurationBreakdown: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  warningCard: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  warningIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: '#92400E',
    lineHeight: 20,
  },

});

export default SessionSetupScreen; 