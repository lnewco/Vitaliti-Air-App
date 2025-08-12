import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Animated,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useBluetooth } from '../context/BluetoothContext';
import DatabaseService from '../services/DatabaseService';
import BluetoothService from '../services/BluetoothService';
import logger from '../utils/logger';

const log = logger.createModuleLogger('HRVCalibrationScreen');

// Animated circle component for progress
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const CircularProgress = ({ progress, size = 200, strokeWidth = 15 }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: progress,
      duration: 1000,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  const strokeDashoffset = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        {/* Background circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#E0E0E0"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress circle */}
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#4CAF50"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </Svg>
      {/* Timer text overlay removed - no percentage display */}
    </View>
  );
};

const HRVCalibrationScreen = ({ navigation, route }) => {
  const { heartRateData, isHRConnected, pulseOximeterData, isPulseOxConnected } = useBluetooth();
  const sessionId = route?.params?.sessionId;
  const protocolConfig = route?.params?.protocolConfig;
  
  // State
  const [calibrationStartTime] = useState(Date.now());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [currentHRV, setCurrentHRV] = useState(null);
  const [baselineHRV, setBaselineHRV] = useState(null);
  const [rrIntervalCount, setRrIntervalCount] = useState(0);
  const [isCalibrating, setIsCalibrating] = useState(true);
  const [hrvReadings, setHrvReadings] = useState([]);
  const [isStabilizing, setIsStabilizing] = useState(true);
  const [stabilizationTimeLeft, setStabilizationTimeLeft] = useState(30);
  
  // Constants
  const TARGET_DURATION = 180; // 3 minutes in seconds
  const MIN_INTERVALS_FOR_HRV = 60; // Need at least 60 intervals for reliable HRV
  const STABILIZATION_PERIOD = 30; // 30 seconds stabilization
  
  // Reset HRV session on mount
  useEffect(() => {
    // Note: HRV windows are automatically managed by BluetoothService
    // No need to manually reset as fresh data will be collected
    log.info('Started HRV calibration - 30s stabilization period active');
  }, []);
  
  // Timer effect
  useEffect(() => {
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - calibrationStartTime) / 1000);
      setElapsedSeconds(elapsed);
      
      // Update stabilization status
      if (elapsed < STABILIZATION_PERIOD) {
        setIsStabilizing(true);
        setStabilizationTimeLeft(STABILIZATION_PERIOD - elapsed);
      } else {
        setIsStabilizing(false);
        setStabilizationTimeLeft(0);
      }
      
      // Auto-complete after 3 minutes
      if (elapsed >= TARGET_DURATION && isCalibrating) {
        completeCalibration();
      }
    }, 1000);
    
    return () => clearInterval(timer);
  }, [calibrationStartTime, isCalibrating]);
  
  // Monitor RR intervals count - track actual intervals received
  useEffect(() => {
    if (!heartRateData) return;
    
    // Track RR intervals count from the heart rate data
    if (heartRateData.rrIntervals && heartRateData.rrIntervals.length > 0) {
      // Increment by the number of new intervals
      setRrIntervalCount(prev => prev + heartRateData.rrIntervals.length);
    }
    
    // Use the most reliable HRV available (prefer real over quick)
    const hrvData = heartRateData.realHRV || heartRateData.quickHRV;
    
    if (hrvData && hrvData.rmssd) {
      // Only update if HRV value actually changed
      if (!currentHRV || currentHRV.rmssd !== hrvData.rmssd) {
        setCurrentHRV(hrvData);
        
        // Collect HRV readings for averaging
        setHrvReadings(prev => [...prev, {
          rmssd: hrvData.rmssd,
          confidence: hrvData.confidence || 0,
          timestamp: Date.now()
        }]);
        
        log.info(`HRV Update: ${hrvData.rmssd}ms (${hrvData.type}, ${hrvData.intervalCount} intervals)`);
      }
    }
  }, [heartRateData, currentHRV]);
  
  // Calculate baseline HRV from collected readings
  useEffect(() => {
    if (hrvReadings.length > 0) {
      // Calculate weighted average based on confidence
      const totalWeight = hrvReadings.reduce((sum, r) => sum + (r.confidence || 0.5), 0);
      const weightedSum = hrvReadings.reduce((sum, r) => sum + r.rmssd * (r.confidence || 0.5), 0);
      const avgRmssd = Math.round(weightedSum / totalWeight);
      
      // Get the most recent reading with highest confidence
      const bestReading = hrvReadings.reduce((best, current) => {
        if (!best) return current;
        return current.confidence > best.confidence ? current : best;
      }, null);
      
      setBaselineHRV({
        rmssd: avgRmssd,
        confidence: bestReading?.confidence || 0,
        intervalCount: rrIntervalCount,
        readingCount: hrvReadings.length
      });
    }
  }, [hrvReadings, rrIntervalCount]);
  
  const completeCalibration = async () => {
    setIsCalibrating(false);
    
    if (baselineHRV && sessionId) {
      try {
        // Save baseline HRV to database
        await DatabaseService.updateSessionBaselineHRV(
          sessionId,
          baselineHRV.rmssd,
          baselineHRV.confidence,
          baselineHRV.intervalCount,
          elapsedSeconds
        );
        log.info('Baseline HRV saved:', baselineHRV);
      } catch (error) {
        log.error('Failed to save baseline HRV:', error);
      }
    }
    
    // Navigate to IHHT Training with baseline data
    navigation.replace('AirSession', {
      sessionId,
      protocolConfig,
      baselineHRV: baselineHRV || null
    });
  };
  
  const handleBack = () => {
    // Navigate back to SessionSetup step 4
    navigation.goBack();
  };
  
  const handleContinue = () => {
    // Skip calibration and continue to training
    completeCalibration();
  };
  
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  const getHeartRate = () => {
    if (isHRConnected && heartRateData?.heartRate) {
      return heartRateData.heartRate;
    } else if (isPulseOxConnected && pulseOximeterData?.heartRate) {
      return pulseOximeterData.heartRate;
    }
    return null;
  };
  
  const heartRate = getHeartRate();
  const progress = Math.min(elapsedSeconds / TARGET_DURATION, 1);
  
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>HRV Baseline Calibration</Text>
          <Text style={styles.subtitle}>
            Sit comfortably and breathe normally while we measure your baseline heart rate variability
          </Text>
        </View>
        
        {/* Progress Circle with Timer */}
        <View style={styles.progressContainer}>
          <CircularProgress progress={progress} size={200} strokeWidth={15} />
          <View style={styles.timerOverlay}>
            <Text style={styles.timerText}>{formatTime(elapsedSeconds)}</Text>
            <Text style={styles.targetText}>Target: {formatTime(TARGET_DURATION)}</Text>
          </View>
        </View>
        
        {/* HRV Display */}
        <View style={styles.dataContainer}>
          <View style={styles.dataCard}>
            <Text style={styles.dataLabel}>Current HRV</Text>
            <Text style={styles.dataValue}>
              {isStabilizing ? '--' : currentHRV ? `${currentHRV.rmssd}ms` : '--'}
            </Text>
            {isStabilizing ? (
              <Text style={styles.stabilizingText}>
                Stabilizing... ({stabilizationTimeLeft}s)
              </Text>
            ) : currentHRV ? (
              <Text style={styles.dataQuality}>
                {currentHRV.type === 'real' ? 'High Quality' : 'Building...'}
              </Text>
            ) : null}
          </View>
          
          <View style={styles.dataCard}>
            <Text style={styles.dataLabel}>Heart Rate</Text>
            <Text style={styles.dataValue}>
              {heartRate ? `${heartRate} bpm` : '--'}
            </Text>
            <Text style={styles.dataQuality}>
              {rrIntervalCount > 0 ? `${rrIntervalCount} intervals collected` : 'Waiting...'}
            </Text>
          </View>
        </View>
        
        {/* Status Message */}
        <View style={styles.statusContainer}>
          {!isHRConnected && !isPulseOxConnected ? (
            <Text style={styles.warningText}>
              ⚠️ No heart rate monitor connected
            </Text>
          ) : isStabilizing ? (
            <Text style={styles.statusText}>
              🔄 Sensor stabilization in progress... ({stabilizationTimeLeft}s)
            </Text>
          ) : rrIntervalCount < MIN_INTERVALS_FOR_HRV ? (
            <Text style={styles.statusText}>
              📊 Collecting data... ({rrIntervalCount}/{MIN_INTERVALS_FOR_HRV} intervals)
            </Text>
          ) : null}
        </View>
        
        {/* Baseline Summary */}
        {baselineHRV && (
          <View style={styles.baselineContainer}>
            <Text style={styles.baselineTitle}>Baseline HRV</Text>
            <Text style={styles.baselineValue}>{baselineHRV.rmssd}ms</Text>
          </View>
        )}
        
        {/* Action Buttons - Part of scrollable content */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={handleBack}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.continueButton} 
            onPress={handleContinue}
          >
            <Text style={styles.continueButtonText}>
              Continue to Training →
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 30,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  progressContainer: {
    alignItems: 'center',
    marginVertical: 30,
    position: 'relative',
  },
  timerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timerText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#333',
  },
  targetText: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  dataContainer: {
    flexDirection: 'row',
    gap: 15,
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  dataCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  dataLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
  },
  dataValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  dataQuality: {
    fontSize: 11,
    color: '#999',
    marginTop: 5,
    textAlign: 'center',
  },
  stabilizingText: {
    fontSize: 12,
    color: '#FF9800',
    marginTop: 5,
    textAlign: 'center',
    fontWeight: '500',
  },
  statusContainer: {
    alignItems: 'center',
    marginVertical: 20,
    paddingHorizontal: 20,
  },
  statusText: {
    fontSize: 14,
    color: '#666',
  },
  warningText: {
    fontSize: 14,
    color: '#FF9800',
    fontWeight: '600',
  },
  successText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
  },
  baselineContainer: {
    backgroundColor: '#E8F5E9',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
    marginHorizontal: 20,
  },
  baselineTitle: {
    fontSize: 14,
    color: '#2E7D32',
    marginBottom: 5,
  },
  baselineValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  baselineConfidence: {
    fontSize: 12,
    color: '#558B2F',
    marginTop: 5,
  },
  buttonContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 30,
    gap: 10,
  },
  backButton: {
    flex: 1,
    backgroundColor: '#E0E0E0',
    paddingVertical: 18,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  continueButton: {
    flex: 1,
    backgroundColor: '#4CAF50',
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  continueButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});

export default HRVCalibrationScreen;