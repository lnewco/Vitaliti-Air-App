import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Vibration,
  StatusBar,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useBluetooth } from '../context/BluetoothContext';
import EnhancedSessionManager from '../services/EnhancedSessionManager';
import DatabaseService from '../services/DatabaseService';
import SafetyIndicator from '../components/SafetyIndicator';

// Custom Slider Component for Expo Go compatibility
const CustomSlider = ({ value, onValueChange, minimumValue = 0, maximumValue = 10, step = 1 }) => {
  const handlePress = (event) => {
    const { locationX } = event.nativeEvent;
    const sliderWidth = 280; // Fixed width for calculations
    const percentage = Math.max(0, Math.min(1, locationX / sliderWidth));
    const range = maximumValue - minimumValue;
    const rawValue = minimumValue + (percentage * range);
    const steppedValue = Math.round(rawValue / step) * step;
    const clampedValue = Math.max(minimumValue, Math.min(maximumValue, steppedValue));
    onValueChange(clampedValue);
  };

  const getThumbPosition = () => {
    const range = maximumValue - minimumValue;
    const percentage = (value - minimumValue) / range;
    return percentage * 280; // Match slider width
  };

  return (
    <View style={styles.customSliderContainer}>
      <TouchableOpacity 
        style={styles.sliderTrack} 
        onPress={handlePress}
        activeOpacity={1}
      >
        {/* Track Background */}
        <View style={styles.sliderTrackBackground} />
        
        {/* Active Track */}
        <View style={[styles.sliderActiveTrack, { width: getThumbPosition() }]} />
        
        {/* Thumb */}
        <View style={[styles.sliderThumb, { left: getThumbPosition() - 12 }]} />
      </TouchableOpacity>
      
      {/* Value Labels */}
      <View style={styles.sliderLabels}>
        <Text style={styles.sliderLabelText}>{minimumValue}</Text>
        <Text style={styles.sliderCurrentValue}>{value}</Text>
        <Text style={styles.sliderLabelText}>{maximumValue}</Text>
      </View>
    </View>
  );
};

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
  const [sessionStarted, setSessionStarted] = useState(false);

  // Helper function to log current session status for debugging
  const logSessionStatus = (context) => {
    console.log(`📊 Session Status [${context}]:`, {
      managerActive: EnhancedSessionManager.isActive,
      managerSession: EnhancedSessionManager.currentSession?.id,
      componentActive: sessionInfo.isActive,
      componentSession: sessionInfo.sessionId,
      timestamp: new Date().toLocaleString()
    });
  };
  
  // Hypoxia level state
  const [hypoxiaLevel, setHypoxiaLevel] = useState(5);
  const [defaultHypoxiaLevel, setDefaultHypoxiaLevel] = useState(5);
  
  // Safety state
  const [warningActive, setWarningActive] = useState(false);

  // Load saved hypoxia level on mount
  useEffect(() => {
    loadHypoxiaLevel();
  }, []);

  // Save hypoxia level when it changes
  useEffect(() => {
    saveHypoxiaLevel();
  }, [defaultHypoxiaLevel]);

  // Reset hypoxia level to default when starting new hypoxic phase
  useEffect(() => {
    if (sessionInfo.currentPhase === 'HYPOXIC' && sessionInfo.phaseTimeRemaining === HYPOXIC_DURATION) {
      setHypoxiaLevel(defaultHypoxiaLevel);
      EnhancedSessionManager.setHypoxiaLevel(defaultHypoxiaLevel);
    } else if (sessionInfo.currentPhase === 'HYPEROXIC') {
      // During hyperoxic phase, set FiO2 to room air (level 0)
      EnhancedSessionManager.setHypoxiaLevel(0);
    }
  }, [sessionInfo.currentPhase, sessionInfo.phaseTimeRemaining, defaultHypoxiaLevel]);

  const loadHypoxiaLevel = async () => {
    try {
      const saved = await AsyncStorage.getItem('defaultHypoxiaLevel');
      if (saved !== null) {
        const level = parseInt(saved, 10);
        if (level >= 0 && level <= 10) { // Validate range
          setDefaultHypoxiaLevel(level);
          setHypoxiaLevel(level);
          // Set the initial hypoxia level in the session manager
          EnhancedSessionManager.setHypoxiaLevel(level);
        }
      }
    } catch (error) {
      console.error('Failed to load hypoxia level:', error);
    }
  };

  const saveHypoxiaLevel = async () => {
    try {
      await AsyncStorage.setItem('defaultHypoxiaLevel', defaultHypoxiaLevel.toString());
    } catch (error) {
      console.error('Failed to save hypoxia level:', error);
    }
  };

  const handleHypoxiaLevelChange = (value) => {
    const roundedValue = Math.round(value);
    setHypoxiaLevel(roundedValue);
    setDefaultHypoxiaLevel(roundedValue);
    
    // Update the session manager with the new hypoxia level
    EnhancedSessionManager.setHypoxiaLevel(roundedValue);
    console.log(`🌬️ Hypoxia level changed to: ${roundedValue}`);
  };

  // Set up session event listeners (session will start on first reading)
  useEffect(() => {
    // Check if there's already an active session (from recovery)
    const currentSessionInfo = EnhancedSessionManager.getSessionInfo();
    if (currentSessionInfo.isActive) {
      console.log('📱 Found existing active session, continuing...');
      setSessionStarted(true);
      setSessionInfo(currentSessionInfo);
    }
    
    // Set up session event listeners
    const removeListener = EnhancedSessionManager.addListener((event, data) => {
      console.log('📱 Session event:', event, data);
      
      switch (event) {
        case 'sessionStarted':
          console.log('📨 Session started event received');
          const newSessionInfo = EnhancedSessionManager.getSessionInfo();
          console.log('📊 Setting session info from event:', newSessionInfo);
          setSessionInfo(newSessionInfo);
          setSessionStarted(true);
          break;
        case 'phaseUpdate':
        case 'phaseAdvanced':
        case 'phaseSkipped':
        case 'sessionPaused':
        case 'sessionResumed':
        case 'sessionSynced':
          console.log(`📨 Session event: ${event}`);
          setSessionInfo(EnhancedSessionManager.getSessionInfo());
          break;
        case 'sessionEnded':
          handleSessionComplete(data);
          setSessionStarted(false);
          break;
      }
    });

    return () => {
      // Cleanup on unmount
      removeListener();
      if (sessionInfo.isActive) {
        console.log('🧹 Component unmounting, stopping active session');
        EnhancedSessionManager.stopSession().catch(console.error);
      }
      setSessionStarted(false);
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

  // Periodic session state sync to prevent "Loading..." issues
  useEffect(() => {
    const syncInterval = setInterval(() => {
      const managerInfo = EnhancedSessionManager.getSessionInfo();
      const managerActive = EnhancedSessionManager.isActive;
      
      // Only sync if there's a mismatch and we're not in the middle of ending a session
      if (managerActive === sessionInfo.isActive && 
          (!managerActive || managerInfo.sessionId === sessionInfo.sessionId)) {
        return;
      }
      
      console.log('🔄 Syncing session state (periodic check)', {
        from: { active: sessionInfo.isActive, id: sessionInfo.sessionId },
        to: { active: managerActive, id: managerInfo.sessionId }
      });
      setSessionInfo(managerInfo);
    }, 2000); // Check every 2 seconds

    return () => clearInterval(syncInterval);
  }, [sessionInfo.isActive, sessionInfo.sessionId]);

  // Session creation and safety monitoring effect
  useEffect(() => {
    if (!pulseOximeterData) {
      console.log('⚠️ IHHTTrainingScreen: No pulseOximeterData available yet');
      return;
    }

    console.log('📱 IHHTTrainingScreen: Got pulseOximeterData', {
      timestamp: new Date().toLocaleTimeString(),
      spo2: pulseOximeterData.spo2,
      heartRate: pulseOximeterData.heartRate,
      isFingerDetected: pulseOximeterData.isFingerDetected
    });
    
    // Only start session when we get VALID measurements (finger detected OR valid spo2/heart rate)
    const hasValidMeasurement = pulseOximeterData.isFingerDetected || 
                               (pulseOximeterData.spo2 !== null && pulseOximeterData.spo2 > 0) ||
                               (pulseOximeterData.heartRate !== null && pulseOximeterData.heartRate > 0);
    
    console.log('🔍 Session creation check:', {
      sessionStarted,
      sessionActive: sessionInfo.isActive,
      hasValidMeasurement,
      fingerDetected: pulseOximeterData.isFingerDetected,
      spo2: pulseOximeterData.spo2,
      heartRate: pulseOximeterData.heartRate
    });
    
    // Start session on first VALID reading (only once)
    if (!sessionStarted && !sessionInfo.isActive && hasValidMeasurement) {
      console.log('\n' + '🎉'.repeat(20));
      console.log('🎬 ✅ SESSION STARTED SUCCESSFULLY!');
      console.log('📊 First valid reading:', {
        isFingerDetected: pulseOximeterData.isFingerDetected,
        spo2: pulseOximeterData.spo2,
        heartRate: pulseOximeterData.heartRate,
        timestamp: new Date().toLocaleTimeString()
      });
      console.log('🎉'.repeat(20) + '\n');
      startSession();
      setSessionStarted(true);
      return; // Exit early, let the session start before processing readings
    }
    
    // Log why session is NOT being created
    if (!sessionStarted && !sessionInfo.isActive && !hasValidMeasurement) {
      console.log('📊 ❌ No session created - waiting for valid measurement', {
        reason: 'Need finger detected OR valid SpO2/HR values',
        isFingerDetected: pulseOximeterData.isFingerDetected,
        spo2: pulseOximeterData.spo2,
        heartRate: pulseOximeterData.heartRate
      });
      return;
    }
    
    // Only process readings if session is active
    if (!sessionInfo.isActive) return;

    const spo2 = pulseOximeterData.spo2;
    
    // Warning zone check (78-82%) for data card border styling
    if (spo2 >= 78 && spo2 < 82) {
      setWarningActive(true);
    } else {
      setWarningActive(false);
    }
    
    // Add reading to enhanced session
    EnhancedSessionManager.addReading(pulseOximeterData);
  }, [pulseOximeterData, sessionInfo.isActive, sessionStarted]);

  const startSession = async () => {
    try {
      console.log('🚀 Starting session...');
      await EnhancedSessionManager.startSession();
      
      // Force refresh session info
      const updatedSessionInfo = EnhancedSessionManager.getSessionInfo();
      console.log('📊 Updated session info after start:', updatedSessionInfo);
      setSessionInfo(updatedSessionInfo);
      
      console.log('✅ Session started successfully');
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
      console.log('🛑 User clicked End Session - starting termination...');
      Vibration.cancel();
      
      // Check session status from both sources
      const managerActive = EnhancedSessionManager.isActive;
      const componentActive = sessionInfo.isActive;
      
      console.log('🔍 Session termination check:', {
        managerActive,
        componentActive,
        managerSession: EnhancedSessionManager.currentSession ? EnhancedSessionManager.currentSession.id : 'NONE',
        componentSession: sessionInfo.sessionId || 'NONE'
      });
      
      // If manager has session but component doesn't, sync the state
      if (managerActive && !componentActive) {
        console.log('🔄 Syncing session state before termination...');
        const currentSessionInfo = EnhancedSessionManager.getSessionInfo();
        setSessionInfo(currentSessionInfo);
      }
      
      // Check if there's actually a session to end
      if (!managerActive) {
        console.log('\n' + '❌'.repeat(20));
        console.log('📋 SESSION TERMINATION SUMMARY');
        console.log('❌'.repeat(20));
        console.log('❌ NO SESSION WAS ACTIVE');
        console.log('📊 This means:');
        console.log('   - No session was created during this training');
        console.log('   - Pulse oximeter may not have detected your finger');
        console.log('   - Or session creation logic never triggered');
        console.log('🔍 To fix: Make sure finger is firmly in pulse oximeter');
        console.log('   and you see "Session Active" status in the UI');
        console.log('❌'.repeat(20) + '\n');
        
        Alert.alert('Session Ended', 'No active session found. This means no data was collected during this training session.', [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]);
        return;
      }
      
      // Show loading state to user
      Alert.alert('Ending Session', '⏳ Saving your session data...\n\nThis may take a few seconds.', []);
      
      console.log('🛑 Calling EnhancedSessionManager.stopSession()...');
      console.log('🔍 Session state before stopping:', {
        managerActive: EnhancedSessionManager.isActive,
        managerSession: EnhancedSessionManager.currentSession?.id,
        componentActive: sessionInfo.isActive,
        componentSession: sessionInfo.sessionId
      });
      
      const result = await EnhancedSessionManager.stopSession();
      console.log('✅ Session stopped successfully:', result);
      
      // Force update component state after successful stop
      setSessionInfo(EnhancedSessionManager.getSessionInfo());
      setSessionStarted(false);
      
      // Dismiss loading alert and show success
      Alert.alert(
        '✅ Session Completed!', 
        `Your training session has been saved successfully!\n\nDuration: ${Math.round((Date.now() - (result.startTime || Date.now())) / 1000)} seconds\nData: ${result.stats?.totalReadings || 0} readings collected`,
        [{ text: 'View History', onPress: () => navigation.navigate('History') }]
      );
      
    } catch (error) {
      // This should never happen now, but just in case...
      console.error('❌ Unexpected error in terminateSession wrapper:', error);
      
      // Force reset the session state
      try {
        await EnhancedSessionManager.resetSessionState();
        setSessionInfo(EnhancedSessionManager.getSessionInfo());
        setSessionStarted(false);
      } catch (resetError) {
        console.error('❌ Failed to reset session state:', resetError);
      }
      
      Alert.alert(
        '⚠️ Session Ended',
        'Your session has been ended. Some data may have been saved.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
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
          onPress: () => {
            console.log('🛑 User confirmed End Session in dialog');
            logSessionStatus('User confirmed End Session');
            terminateSession();
          }
        }
      ]
    );
  };

  const handleSkipToNext = async () => {
    const success = await EnhancedSessionManager.skipToNextPhase();
    if (success) {
      Vibration.vibrate(100); // Brief feedback
      console.log(`✅ Successfully skipped to next phase`);
    } else {
      console.log(`❌ Could not skip phase - session may be paused or inactive`);
    }
  };

  const getSkipButtonText = () => {
    if (sessionInfo.currentPhase === 'HYPOXIC') {
      return 'Skip to Recovery →';
    } else if (sessionInfo.currentPhase === 'HYPEROXIC') {
      if (sessionInfo.currentCycle >= sessionInfo.totalCycles) {
        return 'Complete Session →';
      } else {
        return 'Skip to Next Cycle →';
      }
    }
    return 'Skip →';
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

      {/* Scrollable Content */}
      <View style={styles.scrollContainer}>
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >


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
          <Text style={styles.phaseIcon}>{sessionInfo.currentPhase === 'HYPOXIC' ? '🫁' : '��'}</Text>
          <Text style={styles.phaseTitle}>
            {sessionInfo.currentPhase === 'HYPOXIC' ? 'HYPOXIC PHASE' : 'RECOVERY PHASE'}
          </Text>
          <Text style={styles.phaseMessage}>
            {sessionInfo.currentPhase === 'HYPOXIC' ? 'Put on your mask' : 'Remove mask - Breathing fresh air'}
          </Text>
          <Text style={styles.phaseTimer}>⏰ {formatTime(sessionInfo.phaseTimeRemaining)} remaining</Text>

                     {sessionInfo.currentPhase === 'HYPOXIC' && (
             <View style={styles.hypoxiaSliderContainer}>
               <Text style={styles.hypoxiaLabel}>Hypoxia Level: {hypoxiaLevel}</Text>
               <CustomSlider
                 value={hypoxiaLevel}
                 onValueChange={handleHypoxiaLevelChange}
                 minimumValue={0}
                 maximumValue={10}
                 step={1}
               />
             </View>
           )}
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

        {/* Bottom padding to ensure content doesn't get hidden behind fixed controls */}
        <View style={styles.bottomSpacer} />
        </ScrollView>
      </View>

      {/* Fixed Control Buttons */}
      <View style={styles.fixedControls}>
        {/* Primary Controls */}
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
        
        {/* Skip Button */}
        <TouchableOpacity 
          style={[styles.skipButton, sessionInfo.isPaused && styles.skipButtonDisabled]} 
          onPress={handleSkipToNext}
          disabled={sessionInfo.isPaused}
        >
          <Text style={[styles.skipButtonText, sessionInfo.isPaused && styles.skipButtonTextDisabled]}>
            {getSkipButtonText()}
          </Text>
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
    marginTop: 15,
    marginBottom: 5,
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
    marginTop: 15,
    marginBottom: 5,
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
     hypoxiaSliderContainer: {
     width: '100%',
     marginTop: 20,
     paddingHorizontal: 10,
     backgroundColor: '#F8F9FA',
     borderRadius: 12,
     padding: 15,
   },
   hypoxiaLabel: {
     fontSize: 18,
     fontWeight: 'bold',
     color: '#2196F3',
     marginBottom: 15,
     textAlign: 'center',
   },

   skipButton: {
     marginTop: 10,
     paddingVertical: 12,
     backgroundColor: '#E5E7EB',
     borderRadius: 8,
     alignItems: 'center',
   },
   skipButtonDisabled: {
     backgroundColor: '#E5E7EB',
   },
   skipButtonText: {
     color: '#374151',
     fontSize: 14,
     fontWeight: '600',
   },
   skipButtonTextDisabled: {
     color: '#9CA3AF',
   },
  dataContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 15,
    marginBottom: 5,
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
    marginTop: 15,
    marginBottom: 5,
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
    marginTop: 15,
    marginBottom: 10,
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
  scrollContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 10,
    paddingBottom: 70, // Reduced padding by half
  },
  bottomSpacer: {
    height: 40, // Additional space for better separation
  },
  fixedControls: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
     // Custom Slider Styles
   customSliderContainer: {
     width: '100%',
     alignItems: 'center',
     marginTop: 10,
   },
   sliderTrack: {
     width: 280, // Fixed width for the slider track
     height: 10,
     backgroundColor: '#E0E0E0',
     borderRadius: 5,
     position: 'relative',
     marginBottom: 10,
   },
   sliderTrackBackground: {
     position: 'absolute',
     top: 0,
     left: 0,
     right: 0,
     bottom: 0,
     backgroundColor: '#E0E0E0',
     borderRadius: 5,
   },
   sliderActiveTrack: {
     position: 'absolute',
     top: 0,
     left: 0,
     bottom: 0,
     backgroundColor: '#2196F3', // Example color for active track
     borderRadius: 5,
   },
   sliderThumb: {
     position: 'absolute',
     top: -5, // Adjust to center the thumb
     width: 24,
     height: 24,
     backgroundColor: '#2196F3',
     borderRadius: 12,
     borderWidth: 2,
     borderColor: '#FFFFFF',
   },
   sliderLabels: {
     flexDirection: 'row',
     justifyContent: 'space-between',
     width: '100%',
     marginTop: 10,
   },
   sliderLabelText: {
     fontSize: 14,
     color: '#666666',
   },
     sliderCurrentValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },

});

export default IHHTTrainingScreen; 