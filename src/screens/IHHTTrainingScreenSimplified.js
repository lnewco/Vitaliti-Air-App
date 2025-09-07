import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing } from '../design-system';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Constants
const ALTITUDE_DURATION = 420; // 7 minutes in seconds
const RECOVERY_DURATION = 180; // 3 minutes in seconds
const TOTAL_CYCLES = 5;

export default function IHHTTrainingScreenSimplified() {
  const navigation = useNavigation();
  
  // Session state
  const [currentPhase, setCurrentPhase] = useState('altitude'); // 'altitude' or 'recovery'
  const [currentCycle, setCurrentCycle] = useState(1);
  const [phaseTimeRemaining, setPhaseTimeRemaining] = useState(ALTITUDE_DURATION);
  const [isPaused, setIsPaused] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(true);
  
  // Metrics (using mock data for now)
  const [currentSpO2, setCurrentSpO2] = useState(99);
  const [currentHeartRate, setCurrentHeartRate] = useState(72);
  const [currentAltitude, setCurrentAltitude] = useState(16000);
  
  // Timer ref
  const timerRef = useRef(null);
  
  // Start/restart timer
  useEffect(() => {
    if (isSessionActive && !isPaused) {
      timerRef.current = setInterval(() => {
        setPhaseTimeRemaining(prev => {
          if (prev <= 1) {
            handlePhaseComplete();
            return currentPhase === 'altitude' ? RECOVERY_DURATION : ALTITUDE_DURATION;
          }
          return prev - 1;
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
  }, [isSessionActive, isPaused, currentPhase, currentCycle]);
  
  // Mock metrics updates
  useEffect(() => {
    const metricsInterval = setInterval(() => {
      if (!isPaused && isSessionActive) {
        // Simulate SpO2 changes based on phase
        setCurrentSpO2(prev => {
          if (currentPhase === 'altitude') {
            // Decrease during altitude
            return Math.max(85, prev - Math.random() * 2);
          } else {
            // Increase during recovery
            return Math.min(99, prev + Math.random() * 2);
          }
        });
        
        // Simulate heart rate variations
        setCurrentHeartRate(prev => {
          const variation = (Math.random() - 0.5) * 4;
          return Math.round(Math.max(60, Math.min(100, prev + variation)));
        });
        
        // Simulate altitude changes
        setCurrentAltitude(prev => {
          if (currentPhase === 'altitude') {
            return Math.min(18000, prev + Math.random() * 100);
          } else {
            return Math.max(14000, prev - Math.random() * 100);
          }
        });
      }
    }, 2000);
    
    return () => clearInterval(metricsInterval);
  }, [currentPhase, isPaused, isSessionActive]);
  
  const handlePhaseComplete = () => {
    if (currentPhase === 'altitude') {
      setCurrentPhase('recovery');
    } else {
      if (currentCycle < TOTAL_CYCLES) {
        setCurrentCycle(prev => prev + 1);
        setCurrentPhase('altitude');
      } else {
        completeSession();
      }
    }
  };
  
  const completeSession = () => {
    setIsSessionActive(false);
    Alert.alert(
      'Session Complete',
      `Great job! You've completed ${TOTAL_CYCLES} cycles.`,
      [
        {
          text: 'Continue',
          onPress: () => navigation.navigate('PostSessionSurvey')
        }
      ]
    );
  };
  
  const handlePauseResume = () => {
    setIsPaused(!isPaused);
  };
  
  const handleEndSession = () => {
    Alert.alert(
      'End Session?',
      'Are you sure you want to end this session?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'End Session', 
          style: 'destructive',
          onPress: () => {
            setIsSessionActive(false);
            navigation.goBack();
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
  
  const getPhaseColor = () => {
    return currentPhase === 'altitude' ? '#60A5FA' : '#4ADE80';
  };
  
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleEndSession} style={styles.closeButton}>
          <Icon name="close" size={24} color="rgba(255, 255, 255, 0.7)" />
        </TouchableOpacity>
        <Text style={styles.cycleText}>CYCLE {currentCycle}/{TOTAL_CYCLES}</Text>
        <View style={styles.placeholder} />
      </View>
      
      {/* Phase Timer Section */}
      <View style={styles.phaseSection}>
        <Text style={styles.phaseTimer}>{formatTime(phaseTimeRemaining)}</Text>
        <Text style={[styles.phaseLabel, { color: getPhaseColor() }]}>
          {currentPhase.toUpperCase()}
        </Text>
      </View>
      
      {/* Metrics Display */}
      <View style={styles.metricsContainer}>
        {/* Altitude Card */}
        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>
            {currentAltitude.toLocaleString()}
          </Text>
          <Text style={styles.metricUnit}>ft</Text>
          <Text style={styles.metricLabel}>ALTITUDE</Text>
        </View>
        
        {/* Central Metrics */}
        <View style={styles.centralMetrics}>
          {/* SpO2 */}
          <View style={styles.primaryMetric}>
            <Text style={[styles.bigMetricValue, { color: '#4ADE80' }]}>
              {Math.round(currentSpO2)}
            </Text>
            <Text style={styles.bigMetricLabel}>SpO₂</Text>
          </View>
          
          {/* Heart Rate */}
          <View style={styles.primaryMetric}>
            <Text style={[styles.bigMetricValue, { color: '#FF6B9D' }]}>
              {currentHeartRate}
            </Text>
            <View style={styles.heartRateLabel}>
              <Text style={styles.bigMetricLabel}>BPM</Text>
              <Icon name="heart-pulse" size={16} color="#FF6B9D" />
            </View>
          </View>
        </View>
      </View>
      
      {/* Status Indicator */}
      <View style={styles.statusContainer}>
        <View style={styles.statusIndicator}>
          <View style={[styles.statusDot, { backgroundColor: getPhaseColor() }]} />
          <Text style={styles.statusText}>
            {currentPhase === 'altitude' ? 'ADAPTING' : 'RECOVERING'}
          </Text>
        </View>
      </View>
      
      {/* Control Bar */}
      <View style={styles.controlBar}>
        <View style={styles.controlInfo}>
          <Text style={styles.controlInfoText}>
            Cycle {currentCycle} of {TOTAL_CYCLES}
          </Text>
        </View>
        
        <View style={styles.controlButtons}>
          <TouchableOpacity 
            style={styles.controlButton} 
            onPress={handlePauseResume}
          >
            <Icon 
              name={isPaused ? "play" : "pause"} 
              size={24} 
              color="#FFFFFF" 
            />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.controlButton, styles.stopButton]} 
            onPress={handleEndSession}
          >
            <Icon name="stop" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cycleText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.5,
  },
  placeholder: {
    width: 40,
  },
  phaseSection: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  phaseTimer: {
    fontSize: 72,
    fontWeight: '200',
    color: '#FFFFFF',
    letterSpacing: -2,
  },
  phaseLabel: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 2,
    marginTop: 5,
  },
  metricsContainer: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  metricCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    marginBottom: 30,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  metricValue: {
    fontSize: 36,
    fontWeight: '300',
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  metricUnit: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: 2,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.4)',
    letterSpacing: 1.5,
    marginTop: 8,
  },
  centralMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  primaryMetric: {
    alignItems: 'center',
  },
  bigMetricValue: {
    fontSize: 64,
    fontWeight: '300',
    letterSpacing: -2,
  },
  bigMetricLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 5,
  },
  heartRateLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
  },
  statusText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
  },
  controlBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginHorizontal: 20,
    marginBottom: 40,
    padding: 15,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  controlInfo: {
    flex: 1,
  },
  controlInfoText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    fontWeight: '500',
  },
  controlButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  controlButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stopButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
});