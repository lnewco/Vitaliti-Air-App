import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Vibration,
  StatusBar,
} from 'react-native';
import { useBluetooth } from '../context/BluetoothContext';
import SessionManager from '../services/SessionManager';

const PHASE_TYPES = {
  HYPOXIC: 'HYPOXIC',
  HYPEROXIC: 'HYPEROXIC',
  COMPLETED: 'COMPLETED',
  PAUSED: 'PAUSED',
  TERMINATED: 'TERMINATED'
};

const HYPOXIC_DURATION = 5 * 60; // 5 minutes in seconds
const HYPEROXIC_DURATION = 2 * 60; // 2 minutes in seconds
const TOTAL_CYCLES = 5;
const TOTAL_DURATION = (HYPOXIC_DURATION + HYPEROXIC_DURATION) * TOTAL_CYCLES; // 35 minutes

const IHHTTrainingScreen = ({ navigation }) => {
  const { pulseOximeterData, isConnected } = useBluetooth();
  
  // Session state
  const [currentPhase, setCurrentPhase] = useState(PHASE_TYPES.HYPOXIC);
  const [currentCycle, setCurrentCycle] = useState(1);
  const [phaseTimeRemaining, setPhaseTimeRemaining] = useState(HYPOXIC_DURATION);
  const [totalTimeElapsed, setTotalTimeElapsed] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);
  
  // Safety state
  const [showCriticalAlert, setShowCriticalAlert] = useState(false);
  const [warningActive, setWarningActive] = useState(false);

  // Start session when component mounts
  useEffect(() => {
    startSession();
    return () => {
      // Cleanup on unmount
      if (sessionStarted) {
        SessionManager.stopSession().catch(console.error);
      }
    };
  }, []);

  // Main timer effect
  useEffect(() => {
    if (!sessionStarted || isPaused || showCriticalAlert) return;

    const timer = setInterval(() => {
      setTotalTimeElapsed(prev => prev + 1);
      setPhaseTimeRemaining(prev => {
        if (prev <= 1) {
          // Phase completed, advance to next
          advancePhase();
          return getNextPhaseDuration();
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [sessionStarted, isPaused, showCriticalAlert, currentPhase, currentCycle]);

  // Safety monitoring effect
  useEffect(() => {
    if (!pulseOximeterData || !sessionStarted) return;

    const spo2 = pulseOximeterData.spo2;
    
    // Critical safety check (< 78%)
    if (spo2 < 78) {
      triggerCriticalAlert();
      return;
    }
    
    // Warning zone check (78-82%)
    if (spo2 >= 78 && spo2 < 82) {
      setWarningActive(true);
    } else {
      setWarningActive(false);
    }
    
    // Add reading to session
    SessionManager.addReading(pulseOximeterData);
  }, [pulseOximeterData, sessionStarted]);

  const startSession = async () => {
    try {
      await SessionManager.startSession();
      setSessionStarted(true);
    } catch (error) {
      console.error('Failed to start session:', error);
      Alert.alert('Error', 'Failed to start training session');
      navigation.goBack();
    }
  };

  const advancePhase = () => {
    if (currentPhase === PHASE_TYPES.HYPOXIC) {
      // Move to hyperoxic phase
      setCurrentPhase(PHASE_TYPES.HYPEROXIC);
    } else if (currentPhase === PHASE_TYPES.HYPEROXIC) {
      // Complete cycle, check if more cycles needed
      if (currentCycle >= TOTAL_CYCLES) {
        // All cycles completed
        setCurrentPhase(PHASE_TYPES.COMPLETED);
        completeSession();
      } else {
        // Move to next cycle
        setCurrentCycle(prev => prev + 1);
        setCurrentPhase(PHASE_TYPES.HYPOXIC);
      }
    }
  };

  const getNextPhaseDuration = () => {
    if (currentPhase === PHASE_TYPES.HYPOXIC) {
      return HYPEROXIC_DURATION;
    } else {
      return HYPOXIC_DURATION;
    }
  };

  const triggerCriticalAlert = () => {
    setShowCriticalAlert(true);
    setIsPaused(true);
    Vibration.vibrate([500, 500, 500], true); // Continuous vibration
    
    // Auto-terminate session
    setTimeout(() => {
      terminateSession();
    }, 100);
  };

  const completeSession = async () => {
    try {
      await SessionManager.stopSession();
      Alert.alert(
        'Training Complete!',
        `Congratulations! You've completed all ${TOTAL_CYCLES} cycles of IHHT training.`,
        [{ text: 'View Results', onPress: () => navigation.navigate('History') }]
      );
    } catch (error) {
      console.error('Failed to complete session:', error);
    }
  };

  const terminateSession = async () => {
    try {
      Vibration.cancel();
      await SessionManager.stopSession();
      navigation.goBack();
    } catch (error) {
      console.error('Failed to terminate session:', error);
      navigation.goBack();
    }
  };

  const handlePause = () => {
    if (isPaused) {
      setIsPaused(false);
      SessionManager.resumeSession();
    } else {
      setIsPaused(true);
      SessionManager.pauseSession();
    }
  };

  const handleEndSession = () => {
    Alert.alert(
      'End Training Session',
      'Are you sure you want to end this training session?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Session',
          style: 'destructive',
          onPress: terminateSession
        }
      ]
    );
  };

  const getSpO2Status = (spo2) => {
    if (spo2 >= 95) {
      return { color: '#2196F3', icon: '📘', label: 'Normal', message: '' };
    } else if (spo2 >= 82) {
      return { color: '#4CAF50', icon: '🎯', label: 'Adaptation Zone', message: 'Perfect for training!' };
    } else if (spo2 >= 78) {
      return { color: '#FF9800', icon: '⚠️', label: 'Caution Zone', message: 'Monitor closely' };
    } else {
      return { color: '#F44336', icon: '🚨', label: 'Critical', message: 'Training terminated' };
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTotalTime = (seconds) => {
    const totalMins = Math.floor(TOTAL_DURATION / 60);
    const currentMins = Math.floor(seconds / 60);
    const currentSecs = seconds % 60;
    return `${currentMins}:${currentSecs.toString().padStart(2, '0')} / ${totalMins}:00`;
  };

  const getPhaseProgress = () => {
    const totalPhases = TOTAL_CYCLES * 2; // 5 cycles × 2 phases each
    const completedPhases = (currentCycle - 1) * 2 + (currentPhase === PHASE_TYPES.HYPEROXIC ? 1 : 0);
    return completedPhases / totalPhases;
  };

  const currentSpo2 = pulseOximeterData?.spo2 || 0;
  const currentHR = pulseOximeterData?.heartRate || 0;
  const spo2Status = getSpO2Status(currentSpo2);

  if (showCriticalAlert) {
    return (
      <View style={styles.criticalAlertContainer}>
        <StatusBar backgroundColor="#F44336" barStyle="light-content" />
        <View style={styles.criticalAlert}>
          <Text style={styles.criticalIcon}>🚨</Text>
          <Text style={styles.criticalTitle}>CRITICAL SpO2</Text>
          <Text style={styles.criticalMessage}>SpO2 below 78% - Training terminated</Text>
          <Text style={styles.criticalSubMessage}>Please remove mask immediately</Text>
          <TouchableOpacity
            style={styles.criticalButton}
            onPress={terminateSession}
          >
            <Text style={styles.criticalButtonText}>Acknowledge & Exit</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor={currentPhase === PHASE_TYPES.HYPOXIC ? '#2196F3' : '#4CAF50'} barStyle="light-content" />
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: currentPhase === PHASE_TYPES.HYPOXIC ? '#2196F3' : '#4CAF50' }]}>
        <TouchableOpacity style={styles.backButton} onPress={handleEndSession}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>IHHT Training Session</Text>
        <TouchableOpacity style={styles.pauseButton} onPress={handlePause}>
          <Text style={styles.pauseButtonText}>{isPaused ? 'Resume' : 'Pause'}</Text>
        </TouchableOpacity>
      </View>

      {/* Main Timer */}
      <View style={styles.mainTimer}>
        <Text style={styles.timerText}>⏱️ {formatTotalTime(totalTimeElapsed)}</Text>
        <Text style={styles.cycleText}>🔄 Cycle {currentCycle} of {TOTAL_CYCLES}</Text>
      </View>

      {/* Phase Status Card */}
      <View style={[styles.phaseCard, { backgroundColor: currentPhase === PHASE_TYPES.HYPOXIC ? '#E3F2FD' : '#E8F5E8' }]}>
        <Text style={styles.phaseIcon}>{currentPhase === PHASE_TYPES.HYPOXIC ? '🫁' : '🌱'}</Text>
        <Text style={styles.phaseTitle}>
          {currentPhase === PHASE_TYPES.HYPOXIC ? 'HYPOXIC PHASE' : 'RECOVERY PHASE'}
        </Text>
        <Text style={styles.phaseMessage}>
          {currentPhase === PHASE_TYPES.HYPOXIC ? 'Put on your mask' : 'Remove mask - Breathing fresh air'}
        </Text>
        <Text style={styles.phaseTimer}>⏰ {formatTime(phaseTimeRemaining)} remaining</Text>
      </View>

      {/* Live Data Display */}
      <View style={styles.dataContainer}>
        <View style={[styles.dataCard, warningActive && styles.warningBorder]}>
          <View style={styles.spo2Container}>
            <Text style={[styles.spo2Value, { color: spo2Status.color }]}>{currentSpo2}%</Text>
            <Text style={styles.spo2Icon}>{spo2Status.icon}</Text>
          </View>
          <Text style={[styles.spo2Label, { color: spo2Status.color }]}>{spo2Status.label}</Text>
          {spo2Status.message ? <Text style={styles.spo2Message}>{spo2Status.message}</Text> : null}
        </View>

        <View style={styles.dataCard}>
          <Text style={styles.hrValue}>{currentHR} bpm</Text>
          <Text style={styles.hrLabel}>❤️ Heart Rate</Text>
        </View>
      </View>

      {/* Phase Target */}
      <View style={styles.targetContainer}>
        <Text style={styles.targetText}>
          🎯 {currentPhase === PHASE_TYPES.HYPOXIC ? 'Target Range: 82-87% SpO2' : 'Recovering to 95%+ SpO2'}
        </Text>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <Text style={styles.progressLabel}>Session Progress</Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${getPhaseProgress() * 100}%` }]} />
        </View>
      </View>

      {/* Control Buttons */}
      <View style={styles.controls}>
        <TouchableOpacity style={styles.endButton} onPress={handleEndSession}>
          <Text style={styles.endButtonText}>End Session</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.pauseControlButton, isPaused ? styles.resumeButton : styles.pauseControlButtonActive]} 
          onPress={handlePause}
        >
          <Text style={styles.pauseControlButtonText}>{isPaused ? '▶️ Resume' : '⏸️ Pause'}</Text>
        </TouchableOpacity>
      </View>

      {/* Pause Overlay */}
      {isPaused && !showCriticalAlert && (
        <View style={styles.pauseOverlay}>
          <View style={styles.pauseCard}>
            <Text style={styles.pauseTitle}>⏸️ SESSION PAUSED</Text>
            <Text style={styles.pauseStats}>Cycle {currentCycle} of {TOTAL_CYCLES}</Text>
            <Text style={styles.pauseStats}>{formatTotalTime(totalTimeElapsed)} elapsed</Text>
            <TouchableOpacity style={styles.resumeButton} onPress={handlePause}>
              <Text style={styles.resumeButtonText}>Resume Training</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.endSessionButton} onPress={handleEndSession}>
              <Text style={styles.endSessionButtonText}>End Session</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    paddingHorizontal: 20,
    paddingTop: 50, // Account for status bar
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  pauseButton: {
    padding: 8,
  },
  pauseButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  mainTimer: {
    alignItems: 'center',
    paddingVertical: 20,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  timerText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333333',
  },
  cycleText: {
    fontSize: 16,
    color: '#666666',
    marginTop: 5,
  },
  phaseCard: {
    marginHorizontal: 20,
    marginTop: 20,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  phaseIcon: {
    fontSize: 48,
    marginBottom: 10,
  },
  phaseTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 5,
  },
  phaseMessage: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 10,
  },
  phaseTimer: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
  },
  dataContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 20,
    gap: 10,
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
  warningBorder: {
    borderWidth: 2,
    borderColor: '#FF9800',
  },
  spo2Container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  spo2Value: {
    fontSize: 32,
    fontWeight: 'bold',
    marginRight: 10,
  },
  spo2Icon: {
    fontSize: 24,
  },
  spo2Label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  spo2Message: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
  },
  hrValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 5,
  },
  hrLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
  },
  targetContainer: {
    marginHorizontal: 20,
    marginTop: 20,
    padding: 15,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    alignItems: 'center',
  },
  targetText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
  },
  progressContainer: {
    marginHorizontal: 20,
    marginTop: 20,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
    marginBottom: 10,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 4,
  },
  controls: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 30,
    gap: 15,
  },
  endButton: {
    flex: 1,
    backgroundColor: '#F44336',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  endButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  pauseControlButton: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  pauseControlButtonActive: {
    backgroundColor: '#FF9800',
  },
  resumeButton: {
    backgroundColor: '#4CAF50',
  },
  pauseControlButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  // Critical Alert Styles
  criticalAlertContainer: {
    flex: 1,
    backgroundColor: '#F44336',
    justifyContent: 'center',
    alignItems: 'center',
  },
  criticalAlert: {
    backgroundColor: '#FFFFFF',
    margin: 20,
    padding: 30,
    borderRadius: 12,
    alignItems: 'center',
  },
  criticalIcon: {
    fontSize: 80,
    marginBottom: 20,
  },
  criticalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#F44336',
    marginBottom: 10,
  },
  criticalMessage: {
    fontSize: 18,
    color: '#333333',
    textAlign: 'center',
    marginBottom: 5,
  },
  criticalSubMessage: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 30,
  },
  criticalButton: {
    backgroundColor: '#F44336',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 8,
  },
  criticalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Pause Overlay Styles
  pauseOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pauseCard: {
    backgroundColor: '#FFFFFF',
    margin: 20,
    padding: 30,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 300,
  },
  pauseTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 20,
  },
  pauseStats: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 5,
  },
  endSessionButton: {
    marginTop: 15,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  endSessionButtonText: {
    color: '#F44336',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default IHHTTrainingScreen; 