import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, Alert, PanResponder, Dimensions } from 'react-native';
import { useBluetoothConnection } from '../context/BluetoothContext';
import StepIndicator from '../components/StepIndicator';
import OptimizedConnectionManager from '../components/OptimizedConnectionManager';
import SurveyScaleInput from '../components/SurveyScaleInput';
import SupabaseService from '../services/SupabaseService';
import DatabaseService from '../services/DatabaseService';
import HRV_CONFIG from '../config/hrvConfig';
import { useAuth } from '../auth/AuthContext';
import BluetoothService from '../services/BluetoothService';
import { 
  CLARITY_LABELS, 
  ENERGY_LABELS 
} from '../types/surveyTypes';
import { 
  validatePreSessionSurvey, 
  isPreSessionSurveyComplete,
  createDefaultPreSessionSurvey 
} from '../utils/surveyValidation';

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
    totalCycles: 5,
    hypoxicDuration: 5, // minutes
    hyperoxicDuration: 2 // minutes
  });
  const [sessionId, setSessionId] = useState(null);
  const [surveyData, setSurveyData] = useState(createDefaultPreSessionSurvey());
  const [isSubmittingSurvey, setIsSubmittingSurvey] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);

  // Only use connection state - no high-frequency data to prevent re-renders
  const { 
    isPulseOxConnected, 
    isHRConnected, 
    isAnyDeviceConnected 
  } = useBluetoothConnection();

  // Auto-regress to step 1 if no devices are connected
  useEffect(() => {
    if (!isAnyDeviceConnected && (currentStep === 2 || currentStep === 3 || currentStep === 4)) {
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

    // Move to step 2 for protocol configuration
    setCurrentStep(2);
  };

  const handleProtocolContinue = () => {
    // Generate session ID and move to step 3 (pre-session check-in)
    const newSessionId = generateSessionId();
    setSessionId(newSessionId);
    setCurrentStep(3);
  };

  const handleSurveySubmit = async () => {
    // Validate survey data
    const validation = validatePreSessionSurvey(surveyData);
    
    if (!validation.isValid) {
      setValidationErrors(validation.errors);
      return;
    }

    setIsSubmittingSurvey(true);
    setValidationErrors([]);

    try {
      console.log('💾 Saving pre-session survey data:', { sessionId, ...surveyData });

      // Initialize database first
      await DatabaseService.init();

      // Save to local database first
      const localResult = await DatabaseService.savePreSessionSurvey(
        sessionId,
        surveyData.clarity,
        surveyData.energy
      );

      if (!localResult.success) {
        throw new Error(localResult.error || 'Failed to save to local database');
      }

      console.log('✅ Pre-session survey saved locally');

      // Move to step 4 (Ready to Begin)
      setCurrentStep(4);

      // Sync to Supabase in background (non-blocking)
      SupabaseService.syncPreSessionSurvey(
        sessionId,
        surveyData.clarity,
        surveyData.energy
      ).then(supabaseResult => {
        if (supabaseResult.queued) {
          console.log('📥 Pre-session survey queued for sync (offline)');
        } else if (!supabaseResult.success) {
          console.warn('⚠️ Failed to sync to Supabase immediately, but saved locally');
        } else {
          console.log('☁️ Pre-session survey synced to Supabase');
        }
      }).catch(error => {
        console.warn('⚠️ Background Supabase sync failed:', error.message);
      });

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

    } catch (error) {
      console.error('❌ Error saving pre-session survey:', error);
      Alert.alert(
        'Save Error',
        'Failed to save your survey responses. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsSubmittingSurvey(false);
    }
  };

  const handleDirectStartTraining = () => {
    console.log('📊 Moving to HRV calibration from Ready to Begin step with sessionId:', sessionId);
    navigation.navigate('HRVCalibration', { 
      sessionId: sessionId,
      protocolConfig: protocolConfig 
    });
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

  // Survey handlers
  const handleClarityChange = (value) => {
    setSurveyData(prev => ({ ...prev, clarity: value }));
    setValidationErrors([]); // Clear errors when user makes changes
  };

  const handleEnergyChange = (value) => {
    setSurveyData(prev => ({ ...prev, energy: value }));
    setValidationErrors([]); // Clear errors when user makes changes
  };

  // Slider component
  const CustomSlider = ({ value, onValueChange, minimumValue, maximumValue, step = 1 }) => {
    const [sliderWidth, setSliderWidth] = useState(200);
    
    const panResponder = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const locationX = evt.nativeEvent.locationX;
        const percentage = Math.max(0, Math.min(1, locationX / sliderWidth));
        const newValue = minimumValue + Math.round(percentage * (maximumValue - minimumValue) / step) * step;
        onValueChange(Math.max(minimumValue, Math.min(maximumValue, newValue)));
      },
      onPanResponderMove: (evt) => {
        const locationX = evt.nativeEvent.locationX;
        const percentage = Math.max(0, Math.min(1, locationX / sliderWidth));
        const newValue = minimumValue + Math.round(percentage * (maximumValue - minimumValue) / step) * step;
        onValueChange(Math.max(minimumValue, Math.min(maximumValue, newValue)));
      },
    });

    const fillPercentage = ((value - minimumValue) / (maximumValue - minimumValue)) * 100;

    return (
      <View style={styles.sliderContainer}>
        <Text style={styles.sliderMin}>{minimumValue}</Text>
        <View 
          style={styles.slider} 
          {...panResponder.panHandlers}
          onLayout={(event) => {
            const { width } = event.nativeEvent.layout;
            setSliderWidth(width);
          }}
        >
          <View style={styles.sliderTrack} />
          <View style={[styles.sliderFill, { width: `${fillPercentage}%` }]} />
          <View style={[styles.sliderThumb, { left: `${fillPercentage}%` }]} />
        </View>
        <Text style={styles.sliderMax}>{maximumValue}</Text>
      </View>
    );
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
              {isAnyDeviceConnected ? 'Configure Protocol →' : 'Connect a Device First'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderStep2 = () => {
    const totalSessionTime = (protocolConfig.totalCycles * (protocolConfig.hypoxicDuration + protocolConfig.hyperoxicDuration));
    
    return (
      <View style={styles.stepContainer}>
        <View style={styles.stepHeader}>
          <Text style={styles.stepTitle}>Configure Training Protocol</Text>
          <Text style={styles.stepSubtitle}>
            Customize your IHHT session parameters
          </Text>
        </View>

        <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
          {/* Total Cycles */}
          <View style={styles.protocolCard}>
            <Text style={styles.protocolLabel}>Total Cycles: {protocolConfig.totalCycles}</Text>
            <Text style={styles.protocolDescription}>Number of hypoxic-hyperoxic cycles</Text>
            <CustomSlider
              value={protocolConfig.totalCycles}
              onValueChange={(value) => handleProtocolChange('totalCycles', value)}
              minimumValue={1}
              maximumValue={10}
              step={1}
            />
          </View>

          {/* Hypoxic Duration */}
          <View style={styles.protocolCard}>
            <Text style={styles.protocolLabel}>Hypoxic Duration: {protocolConfig.hypoxicDuration} min</Text>
            <Text style={styles.protocolDescription}>Duration of each hypoxic phase</Text>
            <CustomSlider
              value={protocolConfig.hypoxicDuration}
              onValueChange={(value) => handleProtocolChange('hypoxicDuration', value)}
              minimumValue={1}
              maximumValue={10}
              step={1}
            />
          </View>

          {/* Hyperoxic Duration */}
          <View style={styles.protocolCard}>
            <Text style={styles.protocolLabel}>Hyperoxic Duration: {protocolConfig.hyperoxicDuration} min</Text>
            <Text style={styles.protocolDescription}>Duration of each recovery phase</Text>
            <CustomSlider
              value={protocolConfig.hyperoxicDuration}
              onValueChange={(value) => handleProtocolChange('hyperoxicDuration', value)}
              minimumValue={1}
              maximumValue={5}
              step={1}
            />
          </View>

          {/* Session Preview */}
          <View style={styles.sessionPreview}>
            <Text style={styles.previewTitle}>Session Preview</Text>
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>Total Duration:</Text>
              <Text style={styles.previewValue}>{Math.floor(totalSessionTime / 60)}h {totalSessionTime % 60}m</Text>
            </View>
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>Hypoxic Time:</Text>
              <Text style={styles.previewValue}>{protocolConfig.totalCycles * protocolConfig.hypoxicDuration} min</Text>
            </View>
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>Recovery Time:</Text>
              <Text style={styles.previewValue}>{protocolConfig.totalCycles * protocolConfig.hyperoxicDuration} min</Text>
            </View>
          </View>
        </ScrollView>

        <View style={styles.stepActions}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.continueButton} onPress={handleProtocolContinue}>
            <Text style={styles.continueButtonText}>Continue to Check-in →</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderStep3 = () => {
    const canSubmit = isPreSessionSurveyComplete(surveyData) && !isSubmittingSurvey;

    return (
      <View style={styles.stepContainer}>
        <View style={styles.stepHeader}>
          <Text style={styles.stepTitle}>Pre-Session Check-in</Text>
          <Text style={styles.stepSubtitle}>
            Please rate how you're feeling right now. This takes just a moment and helps us understand how IHHT training affects you over time.
          </Text>
        </View>

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <View style={styles.errorContainer}>
            {validationErrors.map((error, index) => (
              <Text key={index} style={styles.errorText}>
                • {error}
              </Text>
            ))}
          </View>
        )}

        <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
          <View style={styles.surveyContent}>
            {/* Mental Clarity Scale */}
            <SurveyScaleInput
              label="Mental Clarity"
              value={surveyData.clarity}
              onValueChange={handleClarityChange}
              scaleLabels={CLARITY_LABELS}
              isRequired={true}
              disabled={isSubmittingSurvey}
            />

            {/* Energy Level Scale */}
            <SurveyScaleInput
              label="Energy Level"
              value={surveyData.energy}
              onValueChange={handleEnergyChange}
              scaleLabels={ENERGY_LABELS}
              isRequired={true}
              disabled={isSubmittingSurvey}
            />

            {!canSubmit && !isSubmittingSurvey && (
              <View style={styles.requirementNote}>
                <Text style={styles.requirementText}>
                  ⚠️ Please complete both ratings to continue
                </Text>
              </View>
            )}

            {isSubmittingSurvey && (
              <View style={styles.savingNote}>
                <Text style={styles.savingText}>
                  💾 Saving your responses...
                </Text>
              </View>
            )}
          </View>
        </ScrollView>

        <View style={styles.stepActions}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.continueButton, !canSubmit && styles.continueButtonDisabled]}
            onPress={handleSurveySubmit}
            disabled={!canSubmit}
          >
            <Text style={[styles.continueButtonText, !canSubmit && styles.continueButtonTextDisabled]}>
              {isSubmittingSurvey ? 'Saving...' : 'Continue to Ready →'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderStep4 = () => {
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
                • {protocolConfig.totalCycles} {protocolConfig.totalCycles === 1 ? 'cycle' : 'cycles'} of hypoxic-hyperoxic training{'\n'}
                • {protocolConfig.hypoxicDuration} minute{protocolConfig.hypoxicDuration === 1 ? '' : 's'} per hypoxic phase{'\n'}
                • {protocolConfig.hyperoxicDuration} minute{protocolConfig.hyperoxicDuration === 1 ? '' : 's'} per recovery interval{'\n'}
                • Total duration: {protocolConfig.totalCycles * (protocolConfig.hypoxicDuration + protocolConfig.hyperoxicDuration)} minutes
              </Text>
            </View>
          </View>
        </ScrollView>

        <View style={styles.stepActions}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.startSessionButton} onPress={handleDirectStartTraining}>
            <Text style={styles.startSessionButtonText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StepIndicator 
        currentStep={currentStep} 
        totalSteps={4}
        steps={['Connect Device', 'Protocol Setup', 'Pre-session Check-in', 'Ready to Begin']}
      />
      
      {currentStep === 1 && renderStep1()}
      {currentStep === 2 && renderStep2()}
      {currentStep === 3 && renderStep3()}
      {currentStep === 4 && renderStep4()}
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
  // Protocol Configuration Styles
  protocolCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  protocolLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  protocolDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    paddingHorizontal: 8,
  },
  sliderMin: {
    fontSize: 14,
    color: '#6B7280',
    width: 20,
    fontWeight: '500',
  },
  sliderMax: {
    fontSize: 14,
    color: '#6B7280',
    width: 20,
    textAlign: 'right',
    fontWeight: '500',
  },
  slider: {
    flex: 1,
    height: 40,
    marginHorizontal: 15,
    position: 'relative',
    justifyContent: 'center',
  },
  sliderTrack: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
  },
  sliderFill: {
    position: 'absolute',
    height: 8,
    backgroundColor: '#3B82F6',
    borderRadius: 4,
  },
  sliderThumb: {
    position: 'absolute',
    width: 24,
    height: 24,
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    top: 8,
    marginLeft: -12,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  sessionPreview: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  previewLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  previewValue: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '600',
  },
  // Survey styles
  surveyContent: {
    paddingHorizontal: 16,
  },
  errorContainer: {
    backgroundColor: '#f8d7da',
    borderColor: '#f5c6cb',
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 16,
  },
  errorText: {
    color: '#721c24',
    fontSize: 14,
    marginBottom: 4,
  },
  requirementNote: {
    backgroundColor: '#fff3cd',
    borderColor: '#ffeaa7',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
  },
  requirementText: {
    color: '#856404',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
  savingNote: {
    backgroundColor: '#d1ecf1',
    borderColor: '#bee5eb',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
  },
  savingText: {
    color: '#0c5460',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
});

export default SessionSetupScreen; 