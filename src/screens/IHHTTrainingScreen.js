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
import EnhancedSessionManager from '../services/EnhancedSessionManager';
import SafetyIndicator from '../components/SafetyIndicator';

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
  
  // Enhanced session state - using the enhanced session manager
  const [sessionInfo, setSessionInfo] = useState(EnhancedSessionManager.getSessionInfo());
  const [totalTimeElapsed, setTotalTimeElapsed] = useState(0);
  
  // Safety state
  const [warningActive, setWarningActive] = useState(false);

  // Start session when component mounts (device is already connected from setup)
  useEffect(() => {
    startSession();
    
    // Set up session event listeners
    const removeListener = EnhancedSessionManager.addListener((event, data) => {
      console.log('📱 Session event:', event, data);
      
      switch (event) {
        case 'sessionStarted':
        case 'phaseUpdate':
        case 'phaseAdvanced':
        case 'sessionPaused':
        case 'sessionResumed':
        case 'sessionSynced':
          setSessionInfo(EnhancedSessionManager.getSessionInfo());
          break;
        case 'sessionEnded':
          handleSessionComplete(data);
          break;
      }
    });

    return () => {
      // Cleanup on unmount
      removeListener();
      if (sessionInfo.isActive) {
        EnhancedSessionManager.stopSession().catch(console.error);
      }
    };
  }, []);

  // Timer for total elapsed time
  useEffect(() => {
    if (!sessionInfo.isActive || sessionInfo.isPaused) return;

    const timer = setInterval(() => {
      setTotalTimeElapsed(prev => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [sessionInfo.isActive, sessionInfo.isPaused]);

  // Safety monitoring effect
  useEffect(() => {
    if (!pulseOximeterData || !sessionInfo.isActive) return;

    const spo2 = pulseOximeterData.spo2;
    
    // Warning zone check (78-82%) for data card border styling
    if (spo2 >= 78 && spo2 < 82) {
      setWarningActive(true);
    } else {
      setWarningActive(false);
    }
    
    // Add reading to enhanced session
    EnhancedSessionManager.addReading(pulseOximeterData);
  }, [pulseOximeterData, sessionInfo.isActive]);

  const startSession = async () => {
    try {
      await EnhancedSessionManager.startSession();
      setSessionInfo(EnhancedSessionManager.getSessionInfo());
    } catch (error) {
      console.error('Failed to start enhanced session:', error);
      Alert.alert('Error', 'Failed to start training session');
      navigation.goBack();
    }
  };

  const handleSessionComplete = (completedSessionData) => {
    Alert.alert(
      'Training Complete!',
      `Congratulations! You've completed all ${completedSessionData.currentCycle || TOTAL_CYCLES} cycles of IHHT training.`,
      [{ text: 'View Results', onPress: () => navigation.navigate('History') }]
    );
  };

  const pauseSession = async () => {
    try {
      await EnhancedSessionManager.pauseSession();
      setSessionInfo(EnhancedSessionManager.getSessionInfo());
    } catch (error) {
      console.error('Failed to pause session:', error);
    }
  };

  const resumeSession = async () => {
    try {
      await EnhancedSessionManager.resumeSession();
      setSessionInfo(EnhancedSessionManager.getSessionInfo());
    } catch (error) {
      console.error('Failed to resume session:', error);
    }
  };

  const terminateSession = async () => {
    try {
      Vibration.cancel();
      await EnhancedSessionManager.stopSession();
      navigation.goBack();
    } catch (error) {
      console.error('Failed to terminate session:', error);
      navigation.goBack();
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
    const totalDuration = (HYPOXIC_DURATION + HYPEROXIC_DURATION) * sessionInfo.totalCycles;
    const totalMins = Math.floor(totalDuration / 60);
    const currentMins = Math.floor(seconds / 60);
    const currentSecs = seconds % 60;
    return `${currentMins}:${currentSecs.toString().padStart(2, '0')} / ${totalMins}:00`;
  };

  const getPhaseProgress = () => {
    const totalPhases = sessionInfo.totalCycles * 2; // cycles × 2 phases each
    const completedPhases = (sessionInfo.currentCycle - 1) * 2 + (sessionInfo.currentPhase === 'HYPEROXIC' ? 1 : 0);
    return completedPhases / totalPhases;
  };

  const currentSpo2 = pulseOximeterData?.spo2 || 0;
  const currentHR = pulseOximeterData?.heartRate || 0;
  const spo2Status = getSpO2Status(currentSpo2);

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor={sessionInfo.currentPhase === 'HYPOXIC' ? '#2196F3' : '#4CAF50'} barStyle="light-content" />
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: sessionInfo.currentPhase === 'HYPOXIC' ? '#2196F3' : '#4CAF50' }]}>
        <TouchableOpacity style={styles.backButton} onPress={handleEndSession}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>IHHT Training Session</Text>
        <TouchableOpacity style={styles.pauseButton} onPress={sessionInfo.isPaused ? resumeSession : pauseSession}>
          <Text style={styles.pauseButtonText}>{sessionInfo.isPaused ? 'Resume' : 'Pause'}</Text>
        </TouchableOpacity>
      </View>

      {/* Safety Indicator */}
      <SafetyIndicator 
        spo2={currentSpo2}
        isConnected={isConnected}
        isFingerDetected={pulseOximeterData?.isFingerDetected}
      />

      {/* Main Timer */}
      <View style={styles.mainTimer}>
        <Text style={styles.timerText}>⏱️ {formatTotalTime(totalTimeElapsed)}</Text>
        <Text style={styles.cycleText}>🔄 Cycle {sessionInfo.currentCycle} of {sessionInfo.totalCycles}</Text>
      </View>

      {/* Phase Status Card */}
      <View style={[styles.phaseCard, { backgroundColor: sessionInfo.currentPhase === 'HYPOXIC' ? '#E3F2FD' : '#E8F5E8' }]}>
        <Text style={styles.phaseIcon}>{sessionInfo.currentPhase === 'HYPOXIC' ? '🫁' : '🌱'}</Text>
        <Text style={styles.phaseTitle}>
          {sessionInfo.currentPhase === 'HYPOXIC' ? 'HYPOXIC PHASE' : 'RECOVERY PHASE'}
        </Text>
        <Text style={styles.phaseMessage}>
          {sessionInfo.currentPhase === 'HYPOXIC' ? 'Put on your mask' : 'Remove mask - Breathing fresh air'}
        </Text>
        <Text style={styles.phaseTimer}>⏰ {formatTime(sessionInfo.phaseTimeRemaining)} remaining</Text>
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
          🎯 {sessionInfo.currentPhase === 'HYPOXIC' ? 'Target Range: 82-87% SpO2' : 'Recovering to 95%+ SpO2'}
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
          style={[styles.pauseControlButton, sessionInfo.isPaused ? styles.resumeButton : styles.pauseControlButtonActive]} 
          onPress={sessionInfo.isPaused ? resumeSession : pauseSession}
        >
          <Text style={styles.pauseControlButtonText}>{sessionInfo.isPaused ? '▶️ Resume' : '⏸️ Pause'}</Text>
        </TouchableOpacity>
      </View>

      {/* Pause Overlay */}
      {sessionInfo.isPaused && (
        <View style={styles.pauseOverlay}>
          <View style={styles.pauseCard}>
            <Text style={styles.pauseTitle}>⏸️ SESSION PAUSED</Text>
            <Text style={styles.pauseStats}>Cycle {sessionInfo.currentCycle} of {sessionInfo.totalCycles}</Text>
            <Text style={styles.pauseStats}>{formatTotalTime(totalTimeElapsed)} elapsed</Text>
            <TouchableOpacity style={styles.resumeButton} onPress={resumeSession}>
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