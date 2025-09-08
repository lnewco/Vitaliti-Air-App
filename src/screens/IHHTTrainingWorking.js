import React, { useState, useEffect, useRef, useContext } from 'react';
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
import { BluetoothContext } from '../context/BluetoothContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Constants
const ALTITUDE_DURATION = 420; // 7 minutes in seconds
const RECOVERY_DURATION = 180; // 3 minutes in seconds  
const TOTAL_CYCLES = 5;

// Altitude mapping for dial positions
const ALTITUDE_MAP = {
  0: 0,
  1: 2000,
  2: 4000,
  3: 6000,
  4: 8000,
  5: 10000,
  6: 16000,
  7: 18000,
  8: 19000,
  9: 20000,
  10: 21000,
  11: 22000,
};

export default function IHHTTrainingWorking() {
  const navigation = useNavigation();
  const { connectedDevice, currentSpO2, currentHeartRate } = useContext(BluetoothContext);
  
  // Session state
  const [currentPhase, setCurrentPhase] = useState('altitude');
  const [currentCycle, setCurrentCycle] = useState(1);
  const [phaseTimeRemaining, setPhaseTimeRemaining] = useState(ALTITUDE_DURATION);
  const [totalSessionTime, setTotalSessionTime] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(true);
  const [dialPosition] = useState(6);
  
  // Use Bluetooth data if available, otherwise use mock data
  const [displaySpO2, setDisplaySpO2] = useState(99);
  const [displayHeartRate, setDisplayHeartRate] = useState(72);
  
  // Timer refs
  const phaseTimerRef = useRef(null);
  const totalTimerRef = useRef(null);
  
  // Update display metrics from Bluetooth or mock
  useEffect(() => {
    if (connectedDevice && currentSpO2) {
      setDisplaySpO2(currentSpO2);
    } else {
      // Mock data when not connected
      const mockInterval = setInterval(() => {
        if (!isPaused && isSessionActive) {
          setDisplaySpO2(prev => {
            if (currentPhase === 'altitude') {
              return Math.max(85, Math.round(prev - Math.random() * 0.5));
            } else {
              return Math.min(99, Math.round(prev + Math.random() * 0.5));
            }
          });
        }
      }, 3000);
      return () => clearInterval(mockInterval);
    }
  }, [connectedDevice, currentSpO2, currentPhase, isPaused, isSessionActive]);
  
  useEffect(() => {
    if (connectedDevice && currentHeartRate) {
      setDisplayHeartRate(currentHeartRate);
    } else {
      // Mock heart rate
      const mockInterval = setInterval(() => {
        if (!isPaused && isSessionActive) {
          setDisplayHeartRate(prev => {
            const variation = (Math.random() - 0.5) * 3;
            return Math.round(Math.max(60, Math.min(100, prev + variation)));
          });
        }
      }, 2000);
      return () => clearInterval(mockInterval);
    }
  }, [connectedDevice, currentHeartRate, isPaused, isSessionActive]);
  
  // Phase timer effect
  useEffect(() => {
    if (isSessionActive && !isPaused) {
      phaseTimerRef.current = setInterval(() => {
        setPhaseTimeRemaining(prev => {
          if (prev <= 1) {
            // Phase complete
            handlePhaseTransition();
            return currentPhase === 'altitude' ? RECOVERY_DURATION : ALTITUDE_DURATION;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (phaseTimerRef.current) {
        clearInterval(phaseTimerRef.current);
        phaseTimerRef.current = null;
      }
    }
    
    return () => {
      if (phaseTimerRef.current) {
        clearInterval(phaseTimerRef.current);
      }
    };
  }, [isSessionActive, isPaused, currentPhase, currentCycle]);
  
  // Total session timer effect
  useEffect(() => {
    if (isSessionActive && !isPaused) {
      totalTimerRef.current = setInterval(() => {
        setTotalSessionTime(prev => prev + 1);
      }, 1000);
    } else {
      if (totalTimerRef.current) {
        clearInterval(totalTimerRef.current);
        totalTimerRef.current = null;
      }
    }
    
    return () => {
      if (totalTimerRef.current) {
        clearInterval(totalTimerRef.current);
      }
    };
  }, [isSessionActive, isPaused]);
  
  const handlePhaseTransition = () => {
    if (currentPhase === 'altitude') {
      // Switch to recovery
      setCurrentPhase('recovery');
      setPhaseTimeRemaining(RECOVERY_DURATION);
    } else {
      // Recovery complete, check if more cycles
      if (currentCycle < TOTAL_CYCLES) {
        setCurrentCycle(prev => prev + 1);
        setCurrentPhase('altitude');
        setPhaseTimeRemaining(ALTITUDE_DURATION);
      } else {
        // Session complete
        completeSession();
      }
    }
  };
  
  const completeSession = () => {
    setIsSessionActive(false);
    const sessionId = `IHHT_${Date.now()}`;
    Alert.alert(
      'Session Complete',
      `Great job! You've completed all ${TOTAL_CYCLES} cycles.`,
      [
        {
          text: 'Continue',
          onPress: () => navigation.navigate('PostSessionSurvey', { sessionId })
        }
      ]
    );
  };
  
  const handlePauseResume = () => {
    setIsPaused(!isPaused);
  };
  
  const handleSkipPhase = () => {
    Alert.alert(
      'Skip Phase?',
      'Are you sure you want to skip the current phase?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Skip', 
          style: 'default',
          onPress: () => {
            // Reset phase timer and transition to next phase
            setPhaseTimeRemaining(1);
          }
        }
      ]
    );
  };
  
  const handleEndSession = () => {
    Alert.alert(
      'End Session?',
      'Are you sure you want to end this session early?',
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
  
  const handleStop = handleEndSession;
  
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  const formatTotalTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  return (
    <View style={styles.container}>
      {/* Header with close button and cycle info */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleStop} style={styles.closeButton}>
          <Icon name="close" size={20} color="rgba(255, 255, 255, 0.7)" />
        </TouchableOpacity>
        
        <View style={styles.cycleInfo}>
          <Text style={styles.cycleLabel}>CYCLE {currentCycle}/{TOTAL_CYCLES}</Text>
          <Text style={styles.totalTime}>{formatTotalTime(totalSessionTime)}</Text>
        </View>
        
        <View style={styles.closeButton} />
      </View>
      
      {/* Main phase display */}
      <View style={styles.phaseSection}>
        <Text style={styles.phaseLabel}>
          {currentPhase === 'altitude' ? 'ALTITUDE' : 'RECOVERY'}
        </Text>
        <Text style={styles.phaseTimer}>{formatTime(phaseTimeRemaining)}</Text>
      </View>
      
      {/* Altitude display */}
      <View style={styles.altitudeSection}>
        <Text style={styles.altitudeLabel}>ALTITUDE</Text>
        <Text style={styles.altitudeValue}>
          {ALTITUDE_MAP[dialPosition].toLocaleString()}
        </Text>
        <Text style={styles.altitudeUnit}>ft</Text>
        <Text style={styles.altitudeMeters}>
          {Math.round(ALTITUDE_MAP[dialPosition] * 0.3048).toLocaleString()}m
        </Text>
      </View>
      
      {/* Metrics row */}
      <View style={styles.metricsRow}>
        <View style={styles.metricItem}>
          <Text style={[styles.metricValue, styles.spo2Value]}>{displaySpO2}</Text>
          <Text style={styles.metricLabel}>SpO₂</Text>
        </View>
        
        <View style={styles.metricItem}>
          <Text style={[styles.metricValue, styles.heartRateValue]}>{displayHeartRate}</Text>
          <View style={styles.heartRateRow}>
            <Text style={styles.metricLabel}>BPM</Text>
            <Icon name="heart-pulse" size={14} color="#FF6B9D" style={styles.heartIcon} />
          </View>
        </View>
      </View>
      
      {/* Status indicator */}
      <View style={styles.statusSection}>
        <View style={styles.statusIndicator}>
          <View style={[
            styles.statusDot,
            { backgroundColor: currentPhase === 'altitude' ? '#60A5FA' : '#4ADE80' }
          ]} />
          <Text style={styles.statusText}>
            {currentPhase === 'altitude' ? 'ADAPTING' : 'RECOVERING'}
          </Text>
        </View>
      </View>
      
      {/* Control bar */}
      <View style={styles.controlBar}>
        <Text style={styles.controlBarText}>
          Cycle {currentCycle} of {TOTAL_CYCLES}
        </Text>
        
        <View style={styles.controlButtons}>
          <TouchableOpacity 
            style={styles.controlButton}
            onPress={handlePauseResume}
            activeOpacity={0.7}
          >
            <Icon 
              name={isPaused ? "play" : "pause"} 
              size={22} 
              color="#FFFFFF" 
            />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.controlButton, styles.stopButton]}
            onPress={handleStop}
            activeOpacity={0.7}
          >
            <Icon name="stop" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0C0E12',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cycleInfo: {
    alignItems: 'center',
  },
  cycleLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: 'rgba(255, 255, 255, 0.5)',
    marginBottom: 4,
  },
  totalTime: {
    fontSize: 14,
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  phaseSection: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  phaseLabel: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 2,
    color: 'rgba(255, 255, 255, 0.5)',
    marginBottom: 10,
  },
  phaseTimer: {
    fontSize: 64,
    fontWeight: '200',
    color: '#FFFFFF',
    letterSpacing: -2,
  },
  altitudeSection: {
    alignItems: 'center',
    marginVertical: 30,
  },
  altitudeLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.5,
    color: 'rgba(255, 255, 255, 0.4)',
    marginBottom: 8,
  },
  altitudeValue: {
    fontSize: 42,
    fontWeight: '300',
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  altitudeUnit: {
    fontSize: 16,
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: 2,
  },
  altitudeMeters: {
    fontSize: 12,
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.3)',
    marginTop: 4,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    paddingHorizontal: 40,
    marginVertical: 40,
  },
  metricItem: {
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 56,
    fontWeight: '300',
    letterSpacing: -2,
  },
  spo2Value: {
    color: '#4ADE80',
  },
  heartRateValue: {
    color: '#FF6B9D',
  },
  metricLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: 4,
  },
  heartRateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  heartIcon: {
    marginLeft: 4,
  },
  statusSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  controlBar: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  controlBarText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  controlButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  controlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stopButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
});