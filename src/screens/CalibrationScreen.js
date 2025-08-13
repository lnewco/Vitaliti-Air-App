import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Vibration,
  ActivityIndicator,
  AppState,
  Dimensions,
  ScrollView,
  Platform
} from 'react-native';
import { useBluetooth } from '../context/BluetoothContext';
import { useAuth } from '../auth/AuthContext';
import CalibrationService from '../services/CalibrationService';
import DatabaseService from '../services/DatabaseService';
import SupabaseService from '../services/SupabaseService';
import logger from '../utils/logger';

const log = logger.createModuleLogger('CalibrationScreen');

// Responsive dimensions
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const baseWidth = 375; // iPhone 11 Pro width as base
const baseHeight = 812; // iPhone 11 Pro height as base

// Responsive scaling functions
const scale = (size) => (screenWidth / baseWidth) * size;
const verticalScale = (size) => (screenHeight / baseHeight) * size;
const moderateScale = (size, factor = 0.5) => size + (scale(size) - size) * factor;

// Check if device is small (like iPhone SE)
const isSmallDevice = screenHeight < 700;

const CalibrationScreen = ({ navigation }) => {
  const { 
    pulseOximeterData: currentReadings, 
    isPulseOxConnected: isConnected, 
    connectedPulseOxDevice: connectedDevice 
  } = useBluetooth();
  const { user } = useAuth();
  
  // State management
  const [currentIntensity, setCurrentIntensity] = useState(2);
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [isPaused, setIsPaused] = useState(true);
  const [waitingForConfirmation, setWaitingForConfirmation] = useState(true);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [minuteNumber, setMinuteNumber] = useState(0);
  
  // Refs for timer management
  const timerRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);
  
  // Keep screen awake during calibration
  useEffect(() => {
    // Would need expo-keep-awake or similar for production
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Start calibration session on mount
  useEffect(() => {
    startCalibrationSession();
    
    return () => {
      // Cleanup on unmount
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Monitor SpO2 readings
  useEffect(() => {
    if (isCalibrating && currentReadings?.spo2 && !isPaused) {
      checkSpo2Threshold(currentReadings.spo2, currentReadings.heartRate);
    }
  }, [currentReadings, isCalibrating, isPaused]);

  // Timer management
  useEffect(() => {
    if (!isPaused && isCalibrating) {
      timerRef.current = setInterval(() => {
        setSecondsElapsed(prev => {
          const newSeconds = prev + 1;
          
          // Check if minute is complete
          if (newSeconds >= 60) {
            handleMinuteComplete();
            return 0;
          }
          
          return newSeconds;
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isPaused, isCalibrating]);

  // Handle app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        log.info('App returned to foreground during calibration');
      }
      appStateRef.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const startCalibrationSession = async () => {
    try {
      log.info('Starting calibration session');
      
      // Initialize database first
      await DatabaseService.init();
      
      const newSessionId = await CalibrationService.startCalibrationSession(
        user?.id,
        connectedDevice?.id || 'unknown'
      );
      
      setSessionId(newSessionId);
      setIsCalibrating(true);
      setCurrentIntensity(2);
      setMinuteNumber(0);
      setWaitingForConfirmation(true);
      setIsPaused(true);
      
      log.info('Calibration session started:', newSessionId);
    } catch (error) {
      log.error('Failed to start calibration session:', error);
      Alert.alert(
        'Error',
        'Failed to start calibration session. Please try again.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    }
  };

  const checkSpo2Threshold = async (spo2, heartRate) => {
    try {
      const result = await CalibrationService.recordSpo2Reading(spo2, heartRate);
      
      if (result?.thresholdReached) {
        log.info('SpO2 threshold reached, ending calibration');
        handleCalibrationComplete(result.calibrationValue, 'spo2_threshold');
      }
    } catch (error) {
      log.error('Error checking SpO2 threshold:', error);
    }
  };

  const handleConfirmIntensity = async () => {
    try {
      log.info(`Confirming intensity level ${currentIntensity}`);
      
      // Vibrate to confirm
      Vibration.vibrate(100);
      
      // Confirm intensity and start monitoring
      await CalibrationService.confirmIntensityChange();
      
      setMinuteNumber(prev => prev + 1);
      setWaitingForConfirmation(false);
      setIsPaused(false);
      setSecondsElapsed(0);
      
      log.info(`Started monitoring at intensity ${currentIntensity}`);
    } catch (error) {
      log.error('Error confirming intensity:', error);
      Alert.alert('Error', 'Failed to confirm intensity change. Please try again.');
    }
  };

  const handleMinuteComplete = async () => {
    log.info(`Minute ${minuteNumber} complete at intensity ${currentIntensity}`);
    
    // Pause timer
    setIsPaused(true);
    
    // Check if max intensity reached
    if (currentIntensity >= 10) {
      log.info('Max intensity reached, ending calibration');
      handleCalibrationComplete(10, 'max_intensity');
      return;
    }
    
    // Increment intensity
    try {
      const result = await CalibrationService.incrementIntensity();
      
      if (result.maxReached) {
        handleCalibrationComplete(result.calibrationValue, 'max_intensity');
      } else {
        // Vibrate for level change
        Vibration.vibrate([0, 200, 100, 200]);
        
        setCurrentIntensity(result.newIntensity);
        setWaitingForConfirmation(true);
        setSecondsElapsed(0);
      }
    } catch (error) {
      log.error('Error incrementing intensity:', error);
    }
  };

  const handleCalibrationComplete = async (calibrationValue, reason) => {
    try {
      log.info(`Calibration complete: value=${calibrationValue}, reason=${reason}`);
      
      // Stop timer
      setIsPaused(true);
      setIsCalibrating(false);
      
      // End calibration session
      const result = await CalibrationService.endCalibrationSession(calibrationValue, reason);
      
      // Get calibration readings for sync
      const readings = await DatabaseService.getCalibrationReadings(sessionId);
      
      // Sync to Supabase
      SupabaseService.syncCalibrationData(
        {
          sessionId,
          startTime: result.startTime || Date.now() - (result.totalDuration * 1000),
          endTime: Date.now(),
          calibrationValue,
          finalSpo2: currentReadings?.spo2,
          finalHeartRate: currentReadings?.heartRate,
          status: 'completed',
          terminatedReason: reason,
          totalDuration: result.totalDuration,
          levelsCompleted: minuteNumber,
          ...result.stats
        },
        readings
      );
      
      // Navigate to completion screen
      navigation.replace('CalibrationComplete', {
        calibrationValue,
        sessionData: result,
        reason
      });
    } catch (error) {
      log.error('Error completing calibration:', error);
      Alert.alert(
        'Error',
        'Failed to save calibration results. Please try again.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    }
  };

  const handleEndCalibration = () => {
    Alert.alert(
      'End Calibration?',
      'Are you sure you want to end the calibration? Your results will not be saved.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Now',
          style: 'destructive',
          onPress: async () => {
            try {
              await CalibrationService.cancelCalibrationSession();
              navigation.goBack();
            } catch (error) {
              log.error('Error canceling calibration:', error);
              navigation.goBack();
            }
          }
        }
      ]
    );
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getProgressPercentage = () => {
    return (secondsElapsed / 60) * 100;
  };

  if (!isConnected) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.disconnectedContainer}>
          <Text style={styles.disconnectedIcon}>⚠️</Text>
          <Text style={styles.disconnectedTitle}>Device Disconnected</Text>
          <Text style={styles.disconnectedText}>
            Please reconnect your pulse oximeter to continue calibration.
          </Text>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Compact Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Calibration Session</Text>
        <TouchableOpacity style={styles.endButton} onPress={handleEndCalibration}>
          <Text style={styles.endButtonText}>End</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEnabled={isSmallDevice}
        bounces={false}
      >
        {/* Top Section - Intensity and Timer Side by Side */}
        <View style={styles.topSection}>
          {/* Left: Intensity */}
          <View style={styles.intensityContainer}>
            <Text style={styles.intensityLabel}>Intensity</Text>
            <View style={styles.intensityDisplay}>
              <Text style={styles.intensityValue}>{currentIntensity}</Text>
              <Text style={styles.intensityMax}>/10</Text>
            </View>
          </View>

          {/* Right: Timer and Progress */}
          <View style={styles.timerContainer}>
            <Text style={styles.timerLabel}>Level {currentIntensity} Time</Text>
            <Text style={styles.timerValue}>{formatTime(secondsElapsed)}</Text>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { width: `${getProgressPercentage()}%` }
                ]} 
              />
            </View>
            <Text style={styles.timerTarget}>Target: 1:00</Text>
          </View>
        </View>

        {/* Vitals Section - Horizontal Layout */}
        <View style={styles.vitalsContainer}>
          <View style={styles.vitalBox}>
            <Text style={styles.vitalLabel}>SpO2</Text>
            <Text style={[
              styles.vitalValue,
              currentReadings?.spo2 <= 85 && styles.vitalValueWarning
            ]}>
              {currentReadings?.spo2 || '--'}%
            </Text>
          </View>
          <View style={styles.vitalBox}>
            <Text style={styles.vitalLabel}>Heart Rate</Text>
            <Text style={styles.vitalValue}>
              {currentReadings?.heartRate || '--'}
            </Text>
            <Text style={styles.vitalUnit}>bpm</Text>
          </View>
        </View>

        {/* Instructions/Monitoring Section */}
        {waitingForConfirmation ? (
          <View style={styles.instructionSection}>
            <View style={styles.instructionBox}>
              <Text style={styles.instructionIcon}>⚙️</Text>
              <View style={styles.instructionContent}>
                <Text style={styles.instructionTitle}>Adjust Dial to Level {currentIntensity}</Text>
                <Text style={styles.instructionText}>
                  Change the altitude dial and confirm when ready
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.monitoringSection}>
            <View style={styles.monitoringBox}>
              <ActivityIndicator size="small" color="#F59E0B" />
              <Text style={styles.monitoringText}>
                Monitoring level {currentIntensity}...
              </Text>
            </View>
            <Text style={styles.monitoringSubtext}>
              Breathe normally through the mask
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Bottom Action Area - Always Visible */}
      <View style={styles.bottomSection}>
        {waitingForConfirmation && (
          <TouchableOpacity 
            style={styles.confirmButton}
            onPress={handleConfirmIntensity}
          >
            <Text style={styles.confirmButtonText}>
              Confirm Level {currentIntensity}
            </Text>
          </TouchableOpacity>
        )}
        <Text style={styles.statusText}>
          Level {minuteNumber} • SpO2 threshold: 85%
        </Text>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: moderateScale(16),
    paddingVertical: verticalScale(12),
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    minHeight: verticalScale(50),
  },
  headerTitle: {
    fontSize: moderateScale(16),
    fontWeight: '600',
    color: '#1F2937',
  },
  endButton: {
    paddingVertical: verticalScale(6),
    paddingHorizontal: scale(12),
    backgroundColor: '#FEE2E2',
    borderRadius: moderateScale(8),
  },
  endButtonText: {
    color: '#DC2626',
    fontSize: moderateScale(13),
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: moderateScale(12),
    paddingTop: verticalScale(8),
  },
  topSection: {
    flexDirection: 'row',
    gap: moderateScale(10),
    marginBottom: verticalScale(12),
  },
  intensityContainer: {
    flex: 0.4,
    backgroundColor: '#FFFFFF',
    borderRadius: moderateScale(12),
    padding: moderateScale(12),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#F59E0B',
    minHeight: verticalScale(100),
  },
  intensityLabel: {
    fontSize: moderateScale(12),
    color: '#6B7280',
    marginBottom: verticalScale(4),
  },
  intensityDisplay: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  intensityValue: {
    fontSize: moderateScale(isSmallDevice ? 36 : 42),
    fontWeight: 'bold',
    color: '#F59E0B',
  },
  intensityMax: {
    fontSize: moderateScale(isSmallDevice ? 18 : 20),
    color: '#9CA3AF',
    marginLeft: scale(4),
  },
  timerContainer: {
    flex: 0.6,
    backgroundColor: '#FFFFFF',
    borderRadius: moderateScale(12),
    padding: moderateScale(12),
    justifyContent: 'center',
    minHeight: verticalScale(100),
  },
  timerLabel: {
    fontSize: moderateScale(11),
    color: '#6B7280',
    marginBottom: verticalScale(2),
    textAlign: 'center',
  },
  timerValue: {
    fontSize: moderateScale(isSmallDevice ? 24 : 28),
    fontWeight: '600',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: verticalScale(8),
  },
  progressBar: {
    height: verticalScale(6),
    backgroundColor: '#E5E7EB',
    borderRadius: moderateScale(3),
    overflow: 'hidden',
    marginBottom: verticalScale(4),
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: moderateScale(3),
  },
  timerTarget: {
    fontSize: moderateScale(10),
    color: '#9CA3AF',
    textAlign: 'center',
  },
  vitalsContainer: {
    flexDirection: 'row',
    gap: moderateScale(10),
    marginBottom: verticalScale(12),
  },
  vitalBox: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: moderateScale(10),
    padding: moderateScale(10),
    alignItems: 'center',
    minHeight: verticalScale(60),
    justifyContent: 'center',
  },
  vitalLabel: {
    fontSize: moderateScale(11),
    color: '#6B7280',
    marginBottom: verticalScale(2),
  },
  vitalValue: {
    fontSize: moderateScale(isSmallDevice ? 18 : 20),
    fontWeight: '600',
    color: '#1F2937',
  },
  vitalUnit: {
    fontSize: moderateScale(10),
    color: '#6B7280',
  },
  vitalValueWarning: {
    color: '#DC2626',
  },
  instructionSection: {
    flex: 1,
    justifyContent: 'center',
    marginVertical: verticalScale(8),
  },
  instructionBox: {
    backgroundColor: '#FEF3C7',
    borderRadius: moderateScale(10),
    padding: moderateScale(12),
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  instructionIcon: {
    fontSize: moderateScale(24),
    marginRight: scale(10),
  },
  instructionContent: {
    flex: 1,
  },
  instructionTitle: {
    fontSize: moderateScale(14),
    fontWeight: '600',
    color: '#92400E',
    marginBottom: verticalScale(2),
  },
  instructionText: {
    fontSize: moderateScale(12),
    color: '#92400E',
    lineHeight: moderateScale(16),
  },
  monitoringSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: verticalScale(8),
  },
  monitoringBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: verticalScale(8),
  },
  monitoringText: {
    fontSize: moderateScale(14),
    color: '#1F2937',
    marginLeft: scale(8),
  },
  monitoringSubtext: {
    fontSize: moderateScale(12),
    color: '#6B7280',
    textAlign: 'center',
  },
  bottomSection: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingHorizontal: moderateScale(16),
    paddingVertical: verticalScale(12),
    paddingBottom: Platform.OS === 'ios' ? verticalScale(16) : verticalScale(12),
  },
  confirmButton: {
    backgroundColor: '#F59E0B',
    paddingVertical: verticalScale(14),
    borderRadius: moderateScale(10),
    alignItems: 'center',
    marginBottom: verticalScale(8),
    minHeight: moderateScale(44), // Minimum touch target
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: moderateScale(15),
    fontWeight: '600',
  },
  statusText: {
    fontSize: moderateScale(11),
    color: '#6B7280',
    textAlign: 'center',
  },
  disconnectedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  disconnectedIcon: {
    fontSize: 64,
    marginBottom: 24,
  },
  disconnectedTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  disconnectedText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 32,
  },
  backButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default CalibrationScreen;