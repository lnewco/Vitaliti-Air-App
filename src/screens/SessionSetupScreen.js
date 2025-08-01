import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useBluetoothConnection } from '../context/BluetoothContext';
import StepIndicator from '../components/StepIndicator';
import OptimizedConnectionManager from '../components/OptimizedConnectionManager';
import PreSessionSurveyScreen from './PreSessionSurveyScreen';
import SupabaseService from '../services/SupabaseService';
import HRV_CONFIG from '../config/hrvConfig';



const SessionSetupScreen = ({ navigation }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedHypoxiaLevel, setSelectedHypoxiaLevel] = useState(16);
  const [protocolConfig, setProtocolConfig] = useState({
    totalCycles: 3,
    hypoxicDuration: 7, // minutes
    hyperoxicDuration: 3 // minutes
  });
  const [sessionId, setSessionId] = useState(null);
  const [showPreSessionSurvey, setShowPreSessionSurvey] = useState(false);

  // Only use connection state - no high-frequency data to prevent re-renders
  const { 
    isPulseOxConnected, 
    isHRConnected, 
    isAnyDeviceConnected 
  } = useBluetoothConnection();

  // Calculate total session duration in minutes
  const calculateTotalDuration = useMemo(() => {
    return (protocolConfig.hypoxicDuration + protocolConfig.hyperoxicDuration) * protocolConfig.totalCycles;
  }, [protocolConfig.hypoxicDuration, protocolConfig.hyperoxicDuration, protocolConfig.totalCycles]);

  // Memoized onValueChange handlers to prevent re-renders
  const handleTotalCyclesChange = useCallback((value) => {
    setProtocolConfig(prev => ({ ...prev, totalCycles: Math.round(value) }));
  }, []);

  const handleHypoxicDurationChange = useCallback((value) => {
    setProtocolConfig(prev => ({ ...prev, hypoxicDuration: Math.round(value) }));
  }, []);

  const handleHyperoxicDurationChange = useCallback((value) => {
    setProtocolConfig(prev => ({ ...prev, hyperoxicDuration: Math.round(value) }));
  }, []);

  // Auto-regress to step 1 if no devices are connected
  useEffect(() => {
    if (!isAnyDeviceConnected && (currentStep === 2 || currentStep === 3)) {
      setCurrentStep(1);
    }
  }, [isAnyDeviceConnected, currentStep]);

  // Generate session ID when needed
  const generateSessionId = () => {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
    if (!isAnyDeviceConnected) {
      Alert.alert(
        'Device Required',
        'Please connect either a heart rate monitor or pulse oximeter before starting the session.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Generate session ID and show pre-session survey
    const newSessionId = generateSessionId();
    setSessionId(newSessionId);
    setShowPreSessionSurvey(true);
  };

  const handleSurveyComplete = () => {
    console.log('✅ Pre-session survey completed for session:', sessionId);
    
    // Show confirmation popup immediately - no waiting for async operations
    Alert.alert(
      '🎯 Starting Your IHHT Session',
      `Great! Your pre-session survey is complete.\n\n• 5 cycles of hypoxic-hyperoxic training\n• Approximately 35 minutes duration\n• Real-time safety monitoring\n\nGet comfortable and prepare to begin!`,
      [
        {
          text: 'Start Training',
          onPress: () => {
            console.log('🚀 Starting IHHT session directly after survey completion with sessionId:', sessionId);
            // Hide survey and navigate directly to training
            setShowPreSessionSurvey(false);
            navigation.navigate('AirSession', { sessionId: sessionId });
          }
        }
      ]
    );

    // Create Supabase session in background (non-blocking)
    (async () => {
      try {
        console.log('🔄 Creating Supabase session for survey sync in background...');
        
        // Ensure SupabaseService is initialized (fixes deviceId being null)
        await SupabaseService.initialize();
        console.log('🔧 SupabaseService initialized for session creation');
        
        const deviceId = await SupabaseService.getDeviceId();
        console.log('📱 Using device ID for session:', deviceId);
        
        await SupabaseService.createSession({
          id: sessionId,
          startTime: Date.now(),
          deviceId: deviceId,
          sessionType: 'IHHT'
        });
        console.log('✅ Supabase session created in background, survey should sync now');
      } catch (error) {
        console.warn('⚠️ Failed to create Supabase session for survey sync:', error);
        // Continue anyway - survey will remain queued
      }
    })();
  };

  const handleSurveyCancel = () => {
    console.log('❌ Pre-session survey cancelled');
    setShowPreSessionSurvey(false);
    setSessionId(null);
  };

  const handleDirectStartTraining = () => {
    console.log('🚀 Starting training directly from Ready to Begin step with sessionId:', sessionId);
    navigation.navigate('AirSession', { sessionId: sessionId });
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
          <OptimizedConnectionManager />
        </View>
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

  // Picker Wheel Component with up/down arrows (memoized)
  const PickerWheel = React.memo(({ value, onValueChange, minimumValue = 0, maximumValue = 10, step = 1 }) => {
    const increment = useCallback(() => {
      const newValue = Math.min(maximumValue, value + step);
      onValueChange(newValue);
    }, [value, maximumValue, step, onValueChange]);

    const decrement = useCallback(() => {
      const newValue = Math.max(minimumValue, value - step);
      onValueChange(newValue);
    }, [value, minimumValue, step, onValueChange]);

    return (
      <View style={styles.pickerContainer}>
        <TouchableOpacity 
          style={[styles.pickerButton, value >= maximumValue && styles.pickerButtonDisabled]} 
          onPress={increment}
          disabled={value >= maximumValue}
        >
          <Text style={[styles.pickerButtonText, value >= maximumValue && styles.pickerButtonTextDisabled]}>▲</Text>
        </TouchableOpacity>
        
        <View style={styles.pickerValueContainer}>
          <Text style={styles.pickerValue}>{value}</Text>
        </View>
        
        <TouchableOpacity 
          style={[styles.pickerButton, value <= minimumValue && styles.pickerButtonDisabled]} 
          onPress={decrement}
          disabled={value <= minimumValue}
        >
          <Text style={[styles.pickerButtonText, value <= minimumValue && styles.pickerButtonTextDisabled]}>▼</Text>
        </TouchableOpacity>
        
        <View style={styles.pickerRange}>
          <Text style={styles.pickerRangeText}>{minimumValue}-{maximumValue}</Text>
        </View>
      </View>
    );
  });

  // Configuration Picker Component (memoized)
  const ConfigPicker = React.memo(({ label, value, onValueChange, min, max, suffix, step = 1 }) => (
    <View style={styles.configContainer}>
      <View style={styles.configHeader}>
        <Text style={styles.configLabel}>{label}</Text>
        <Text style={styles.configSuffix}>{suffix}</Text>
      </View>
      <PickerWheel
        value={value}
        onValueChange={onValueChange}
        minimumValue={min}
        maximumValue={max}
        step={step}
      />
    </View>
  ));

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <ScrollView 
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.stepHeader}>
          <Text style={styles.stepTitle}>Configure Your Session</Text>
        </View>

        <View style={styles.stepContent}>
          <View style={styles.configGrid}>
            <ConfigPicker
              label="Number of Rounds"
              value={protocolConfig.totalCycles}
              onValueChange={handleTotalCyclesChange}
              min={1}
              max={10}
              suffix="rounds"
            />

            <ConfigPicker
              label="Hypoxia Phase"
              value={protocolConfig.hypoxicDuration}
              onValueChange={handleHypoxicDurationChange}
              min={1}
              max={10}
              suffix="minutes"
            />

            <ConfigPicker
              label="Hyperoxia Phase"
              value={protocolConfig.hyperoxicDuration}
              onValueChange={handleHyperoxicDurationChange}
              min={1}
              max={10}
              suffix="minutes"
            />

            <View style={styles.totalDurationCard}>
              <Text style={styles.totalDurationLabel}>Total Session Duration</Text>
              <Text style={styles.totalDurationValue}>{calculateTotalDuration} minutes</Text>
              <Text style={styles.totalDurationBreakdown}>
                {protocolConfig.totalCycles} × ({protocolConfig.hypoxicDuration} + {protocolConfig.hyperoxicDuration}) minutes
              </Text>
            </View>

            {calculateTotalDuration > 60 && (
              <View style={styles.warningCard}>
                <Text style={styles.warningIcon}>⚠️</Text>
                <Text style={styles.warningText}>
                  Long session detected ({calculateTotalDuration} min). Consider shorter durations for your first sessions.
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
      title = "Dual Device Setup Complete";
      description = "Both heart rate monitor and pulse oximeter are connected. You have complete monitoring with enhanced HRV analysis and SpO2 tracking.";
    } else if (isHRConnected && !isPulseOxConnected) {
      title = "Heart Rate Monitor Connected";
      description = "Your heart rate monitor is connected and providing detailed HRV analysis. You're ready for HRV-focused IHHT training.";
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
            {/* Session Protocol Summary */}
            <View style={styles.sessionInfo}>
              <Text style={styles.sessionInfoTitle}>🎯 Your IHHT Training Session</Text>
              <Text style={styles.sessionInfoText}>
                • {protocolConfig.totalCycles} cycles of hypoxic-hyperoxic training{'\n'}
                • {protocolConfig.hypoxicDuration} min hypoxia + {protocolConfig.hyperoxicDuration} min hyperoxia per cycle{'\n'}
                • Total duration: {calculateTotalDuration} minutes{'\n'}
                • Real-time {isHRConnected ? 'HRV and ' : ''}safety monitoring{'\n'}
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
        steps={['Connect Device', 'Configure Protocol', 'Ready to Begin']}
      />
      
      {currentStep === 1 && renderStep1()}
      {currentStep === 2 && renderStep2()}
      {currentStep === 3 && renderStep3()}
      
      {/* Pre-Session Survey Modal */}
      {sessionId && (
        <PreSessionSurveyScreen
          visible={showPreSessionSurvey}
          sessionId={sessionId}
          onComplete={handleSurveyComplete}
          onCancel={handleSurveyCancel}
        />
      )}
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
  configGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
    paddingVertical: 10,
  },
  configContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    minWidth: 100,
    maxWidth: 120,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  configHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  configLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 4,
  },
  configSuffix: {
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
   
   // Picker Wheel Styles
   pickerContainer: {
     alignItems: 'center',
     justifyContent: 'center',
   },
   pickerButton: {
     backgroundColor: '#3B82F6',
     borderRadius: 8,
     width: 40,
     height: 32,
     justifyContent: 'center',
     alignItems: 'center',
     marginVertical: 4,
   },
   pickerButtonDisabled: {
     backgroundColor: '#E5E7EB',
   },
   pickerButtonText: {
     fontSize: 16,
     fontWeight: 'bold',
     color: '#FFFFFF',
   },
   pickerButtonTextDisabled: {
     color: '#9CA3AF',
   },
   pickerValueContainer: {
     backgroundColor: '#F3F4F6',
     borderRadius: 8,
     borderWidth: 2,
     borderColor: '#E5E7EB',
     paddingVertical: 12,
     paddingHorizontal: 16,
     marginVertical: 8,
     minWidth: 60,
   },
   pickerValue: {
     fontSize: 24,
     fontWeight: 'bold',
     color: '#1F2937',
     textAlign: 'center',
   },
   pickerRange: {
     marginTop: 8,
   },
   pickerRangeText: {
     fontSize: 10,
     color: '#6B7280',
     textAlign: 'center',
       },


});

export default SessionSetupScreen; 