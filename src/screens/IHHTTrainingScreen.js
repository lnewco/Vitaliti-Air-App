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
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useBluetooth } from '../context/BluetoothContext';
import EnhancedSessionManager from '../services/EnhancedSessionManager';
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

const IHHTTrainingScreen = ({ navigation, route }) => {
  // Extract protocol configuration and baseline HRV from navigation params
  const protocolConfig = route?.params?.protocolConfig || {
    totalCycles: 5,
    hypoxicDuration: 5,     // in minutes
    hyperoxicDuration: 2    // in minutes
  };
  const baselineHRV = route?.params?.baselineHRV || null;
  
  // Log route params only once on mount
  React.useEffect(() => {
    console.log('🔍 IHHTTrainingScreen initialized with:', {
      sessionId: route?.params?.sessionId,
      totalCycles: protocolConfig.totalCycles,
      usingDefaultConfig: !route?.params?.protocolConfig,
      hasBaselineHRV: !!baselineHRV
    });
  }, []);

  const { 
    pulseOximeterData, 
    heartRateData, 
    isPulseOxConnected, 
    isHRConnected,
    isAnyDeviceConnected 
  } = useBluetooth();
  
  // Get sessionId from navigation params (from survey completion)
  const existingSessionId = route?.params?.sessionId;
  
  // Enhanced session state - using the enhanced session manager
  const [sessionInfo, setSessionInfo] = useState(EnhancedSessionManager.getSessionInfo());
  const [sessionStarted, setSessionStarted] = useState(false);
  const [sessionCompleted, setSessionCompleted] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false); // Prevent double skip
  
  // Hypoxia level state
  const [hypoxiaLevel, setHypoxiaLevel] = useState(5);
  const [defaultHypoxiaLevel, setDefaultHypoxiaLevel] = useState(5);
  
  // Safety state
  const [warningActive, setWarningActive] = useState(false);
  
  // HRV tracking state - for continuous baseline updates
  const [currentBaselineHRV, setCurrentBaselineHRV] = useState(baselineHRV?.rmssd || null);
  const [hrvReadings, setHrvReadings] = useState([]);

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
    if (sessionInfo.currentPhase === 'HYPOXIC' && sessionInfo.phaseTimeRemaining === sessionInfo.hypoxicDuration) {
      setHypoxiaLevel(defaultHypoxiaLevel);
    }
  }, [sessionInfo.currentPhase, sessionInfo.phaseTimeRemaining, sessionInfo.hypoxicDuration, defaultHypoxiaLevel]);

  const loadHypoxiaLevel = async () => {
    try {
      const saved = await AsyncStorage.getItem('defaultHypoxiaLevel');
      if (saved !== null) {
        const level = parseInt(saved, 10);
        if (level >= 0 && level <= 10) { // Validate range
          setDefaultHypoxiaLevel(level);
          setHypoxiaLevel(level);
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
  };

  // Set up session event listeners (session will start on first reading)
  useEffect(() => {
    // Activate screen wake lock immediately when component mounts
    activateKeepAwakeAsync()
      .then(() => console.log('📱 Screen wake lock activated on mount'))
      .catch(error => console.warn('⚠️ Failed to activate screen wake lock:', error));

    // Check if we have a new session ID from setup flow
    if (existingSessionId) {
      console.log('📱 New session from setup flow, terminating any existing session');
      // If there's an active session, terminate it to start the new one
      const currentSessionInfo = EnhancedSessionManager.getSessionInfo();
      if (currentSessionInfo.isActive) {
        console.log('📱 Terminating existing session to start new one');
        EnhancedSessionManager.terminateSession('new_session_requested');
      }
    } else {
      // Only continue existing session if no new session was requested
      const currentSessionInfo = EnhancedSessionManager.getSessionInfo();
      if (currentSessionInfo.isActive) {
        console.log('📱 Found existing active session, continuing...');
        setSessionStarted(true);
        setSessionInfo(currentSessionInfo);
      }
    }
    
    // Set up session event listeners
    const removeListener = EnhancedSessionManager.addListener((event, data) => {
      console.log('📱 Session event:', event, data);
      
      switch (event) {
        case 'sessionStarted':
          setSessionInfo(EnhancedSessionManager.getSessionInfo());
          setSessionStarted(true);
          // Ensure screen stays awake during session
          activateKeepAwakeAsync()
            .then(() => console.log('📱 Screen wake lock reinforced on session start'))
            .catch(error => console.warn('⚠️ Failed to reinforce screen wake lock:', error));
          break;
        case 'phaseUpdate':
        case 'phaseAdvanced':
        case 'phaseSkipped':
        case 'sessionPaused':
        case 'sessionResumed':
        case 'sessionSynced':
          const updatedInfo = EnhancedSessionManager.getSessionInfo();
          console.log(`📱 UI received ${event} event, phaseTimeRemaining: ${updatedInfo.phaseTimeRemaining}s`);
          setSessionInfo(updatedInfo);
          break;
        case 'sessionEnded':
        case 'sessionStopped':
          console.log('📱 Session ended/stopped event received');
          handleSessionComplete(data);
          setSessionStarted(false);
          setSessionCompleted(true); // Mark session as completed
          setIsSkipping(false); // Clear skipping flag
          // Update session info to reflect ended state
          setSessionInfo({
            ...sessionInfo,
            isActive: false,
            currentPhase: 'COMPLETED'
          });
          // Deactivate screen wake lock when session ends
          deactivateKeepAwake()
            .then(() => console.log('📱 Screen wake lock deactivated on session end'))
            .catch(error => console.warn('⚠️ Failed to deactivate screen wake lock:', error));
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
      
      // Always deactivate screen wake lock on cleanup
      deactivateKeepAwake()
        .then(() => console.log('📱 Screen wake lock deactivated on cleanup'))
        .catch(error => console.warn('⚠️ Failed to deactivate screen wake lock on cleanup:', error));
    };
  }, []);

  // Calculate total elapsed time from session start
  const getTotalTimeElapsed = () => {
    if (!sessionInfo.sessionStartTime) return 0;
    if (!sessionInfo.isActive) return 0;
    
    const elapsed = Math.floor((Date.now() - sessionInfo.sessionStartTime) / 1000);
    return elapsed;
  };
  
  // Update timer display every second
  const [, forceUpdate] = useState({});
  useEffect(() => {
    if (!sessionInfo.isActive || sessionInfo.isPaused) return;
    
    const timer = setInterval(() => {
      forceUpdate({}); // Force re-render to update time display
    }, 1000);
    
    return () => clearInterval(timer);
  }, [sessionInfo.isActive, sessionInfo.isPaused]);

  // Session creation and safety monitoring effect
  useEffect(() => {
    if (!pulseOximeterData) return;
    
    // Check if session was already completed (prevent restart)
    if (sessionCompleted || sessionInfo.currentPhase === 'COMPLETED' || EnhancedSessionManager.currentPhase === 'COMPLETED') {
      return; // Don't start a new session if one was just completed
    }
    
    // Only start session when we get VALID measurements (finger detected OR valid spo2/heart rate)
    const hasValidMeasurement = pulseOximeterData.isFingerDetected || 
                               (pulseOximeterData.spo2 !== null && pulseOximeterData.spo2 > 0) ||
                               (pulseOximeterData.heartRate !== null && pulseOximeterData.heartRate > 0);
    
    // Start session on first VALID reading (only once)
    if (!sessionStarted && !sessionInfo.isActive && hasValidMeasurement) {
      console.log('🎬 Starting session on first VALID reading received', {
        isFingerDetected: pulseOximeterData.isFingerDetected,
        spo2: pulseOximeterData.spo2,
        heartRate: pulseOximeterData.heartRate
      });
      startSession();
      setSessionStarted(true);
      return; // Exit early, let the session start before processing readings
    }
    
    // Log status data but don't create session
    if (!sessionStarted && !sessionInfo.isActive && !hasValidMeasurement) {
      console.log('📊 Status data received (no session creation needed)', {
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
    
    // Add reading to enhanced session with HRV data if available
    const readingWithHRV = {
      ...pulseOximeterData,
      hrv_rmssd: currentBaselineHRV // Include current HRV value
    };
    EnhancedSessionManager.addReading(readingWithHRV);
  }, [pulseOximeterData, sessionInfo.isActive, sessionStarted, sessionCompleted, currentBaselineHRV]);

  // Monitor HRV data and update baseline continuously
  useEffect(() => {
    if (!heartRateData || !sessionInfo.isActive) return;
    
    // Use the most reliable HRV available (prefer real over quick)
    const hrvData = heartRateData.realHRV || heartRateData.quickHRV;
    
    if (hrvData && hrvData.rmssd) {
      // Collect HRV readings for averaging
      setHrvReadings(prev => {
        const newReadings = [...prev, {
          rmssd: hrvData.rmssd,
          confidence: hrvData.confidence || 0.5,
          timestamp: Date.now()
        }];
        
        // Keep only last 30 readings for moving average
        return newReadings.slice(-30);
      });
    }
  }, [heartRateData, sessionInfo.isActive]);
  
  // Calculate baseline HRV from collected readings
  useEffect(() => {
    if (hrvReadings.length > 0) {
      // Calculate weighted average based on confidence
      const totalWeight = hrvReadings.reduce((sum, r) => sum + r.confidence, 0);
      const weightedSum = hrvReadings.reduce((sum, r) => sum + r.rmssd * r.confidence, 0);
      const avgRmssd = Math.round(weightedSum / totalWeight);
      
      setCurrentBaselineHRV(avgRmssd);
    }
  }, [hrvReadings]);

  const startSession = async () => {
    try {
      console.log('🔄 Starting IHHT session', existingSessionId ? `with existing sessionId: ${existingSessionId}` : 'with new sessionId');
      
      // If we have both sessionId and protocolConfig, we need to set the protocol first
      if (existingSessionId && protocolConfig) {
        console.log('🔧 Setting protocol config for existing session:', {
          sessionId: existingSessionId,
          protocolConfig: protocolConfig,
          totalCycles: protocolConfig.totalCycles,
          hasBaselineHRV: !!baselineHRV
        });
        
        // Convert minutes to seconds for EnhancedSessionManager
        const protocolInSeconds = {
          ...protocolConfig,
          hypoxicDuration: protocolConfig.hypoxicDuration * 60,    // Convert minutes to seconds
          hyperoxicDuration: protocolConfig.hyperoxicDuration * 60  // Convert minutes to seconds
        };
        
        console.log('🔧 Setting protocol configuration:', protocolInSeconds);
        EnhancedSessionManager.setProtocol(protocolInSeconds);
        // Note: baselineHRV is tracked in the component state for HRV card display
        console.log('✅ Protocol set. Actual cycles in manager:', EnhancedSessionManager.protocolConfig.totalCycles);
        await EnhancedSessionManager.startSession(existingSessionId);
      } else {
        // Support legacy single parameter (either sessionId or protocolConfig)
        console.log('⚠️ Using legacy session start with:', existingSessionId || protocolConfig);
        
        // If passing protocolConfig directly, convert to seconds
        let paramToPass = existingSessionId || protocolConfig;
        if (protocolConfig && !existingSessionId) {
          paramToPass = {
            ...protocolConfig,
            hypoxicDuration: protocolConfig.hypoxicDuration * 60,
            hyperoxicDuration: protocolConfig.hyperoxicDuration * 60
          };
          console.log('🔧 Converted legacy protocol to seconds:', paramToPass);
        }
        
        await EnhancedSessionManager.startSession(paramToPass);
      }
      
      setSessionInfo(EnhancedSessionManager.getSessionInfo());
    } catch (error) {
      console.error('Failed to start enhanced session:', error);
      Alert.alert('Error', 'Failed to start training session');
      navigation.goBack();
    }
  };

  const handleSessionComplete = (sessionData) => {
    console.log('🎯 Navigating to post-session survey for completed session');
    console.log('📊 Session completion data received:', JSON.stringify(sessionData, null, 2));
    
    const sessionIdForSurvey = sessionData?.id || sessionData?.sessionId || sessionInfo?.sessionId || sessionInfo?.currentSession?.id;
    
    if (!sessionIdForSurvey) {
      console.error('❌ No sessionId found in completion data! Available keys:', Object.keys(sessionData || {}));
      console.error('💡 Session info fallback:', { sessionId: sessionInfo?.sessionId, currentSessionId: sessionInfo?.currentSession?.id });
      // Still navigate but alert the user
      Alert.alert(
        'Session Completed',
        'Your session has ended successfully! However, there was an issue saving the survey data. Please check your session history.',
        [{ text: 'OK', onPress: () => navigation.navigate('MainTabs', { screen: 'History' }) }]
      );
      return;
    }
    
    console.log('✅ Using sessionId for survey:', sessionIdForSurvey);
    navigation.navigate('PostSessionSurvey', { sessionId: sessionIdForSurvey });
  };



  const pauseSession = async () => {
    try {
      await EnhancedSessionManager.pauseSession();
      setSessionInfo(EnhancedSessionManager.getSessionInfo());
      
      // Allow screen to sleep when paused
      deactivateKeepAwake()
        .then(() => console.log('📱 Screen wake lock deactivated on pause'))
        .catch(error => console.warn('⚠️ Failed to deactivate screen wake lock on pause:', error));
    } catch (error) {
      console.error('Failed to pause session:', error);
    }
  };

  const resumeSession = async () => {
    try {
      await EnhancedSessionManager.resumeSession();
      setSessionInfo(EnhancedSessionManager.getSessionInfo());
      
      // Reactivate screen wake lock when resumed
      activateKeepAwakeAsync()
        .then(() => console.log('📱 Screen wake lock reactivated on resume'))
        .catch(error => console.warn('⚠️ Failed to reactivate screen wake lock on resume:', error));
    } catch (error) {
      console.error('Failed to resume session:', error);
    }
  };

  const terminateSession = async () => {
    try {
      Vibration.cancel();
      
      // Deactivate screen wake lock when manually ending session
      deactivateKeepAwake()
        .then(() => console.log('📱 Screen wake lock deactivated on manual termination'))
        .catch(error => console.warn('⚠️ Failed to deactivate screen wake lock on termination:', error));
      
      // Mark the session as completed before stopping to prevent extra phase recordings
      EnhancedSessionManager.currentPhase = 'COMPLETED';
      
      const result = await EnhancedSessionManager.stopSession();
      
      // Navigate to post-session survey screen
      const sessionIdForSurvey = result?.id || result?.sessionId || sessionInfo?.sessionId || sessionInfo?.currentSession?.id;
      console.log('🎯 Navigating to post-session survey for manual session end');
      
      navigation.navigate('PostSessionSurvey', { sessionId: sessionIdForSurvey });
      
    } catch (error) {
      console.error('Failed to terminate session:', error);
      
      // Always deactivate screen wake lock on error
      deactivateKeepAwake()
        .then(() => console.log('📱 Screen wake lock deactivated on error'))
        .catch(err => console.warn('⚠️ Failed to deactivate screen wake lock on error:', err));
      
      // Check if session was already ended (common case)
      if (error.message.includes('No active session')) {
        console.log('⚠️ Session was already ended - checking if survey navigation is in progress');
        
        // If we have recent session info, navigate to survey anyway
        const recentSessionId = sessionInfo?.sessionId || sessionInfo?.currentSession?.id;
        if (recentSessionId) {
          console.log('✅ Found recent session ID, navigating to survey:', recentSessionId);
          navigation.navigate('PostSessionSurvey', { sessionId: recentSessionId });
          return;
        }
      }
      
      // Only navigate to history as last resort
      console.log('🔄 No session ID available, navigating to history as fallback');
      navigation.navigate('MainTabs', { screen: 'History' });
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

  const handleSkipToNext = async () => {
    // Prevent skip if already skipping (debounce)
    if (isSkipping) {
      console.log(`⏳ Skip already in progress`);
      return;
    }
    
    // Prevent skip if session is completed, not started, or paused
    if (!sessionInfo.isActive || sessionCompleted || sessionInfo.currentPhase === 'COMPLETED' || sessionInfo.isPaused) {
      console.log(`❌ Cannot skip - session not active, paused, or already completed`);
      return;
    }
    
    // Double-check session manager state directly
    const currentSessionInfo = EnhancedSessionManager.getSessionInfo();
    if (!currentSessionInfo.isActive || currentSessionInfo.currentPhase === 'COMPLETED') {
      console.log(`❌ Cannot skip - session manager reports inactive or completed`);
      return;
    }
    
    setIsSkipping(true); // Set skipping flag
    
    try {
      const success = await EnhancedSessionManager.skipToNextPhase();
      if (success) {
        Vibration.vibrate(100); // Brief feedback
        console.log(`✅ Successfully skipped to next phase`);
      } else {
        console.log(`❌ Could not skip phase - session may be paused or inactive`);
      }
    } finally {
      // Clear skipping flag after a delay to prevent rapid clicks
      setTimeout(() => setIsSkipping(false), 500);
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
    // Calculate original planned duration
    const originalDuration = (sessionInfo.hypoxicDuration + sessionInfo.hyperoxicDuration) * sessionInfo.totalCycles;
    
    // Adjust for skipped time
    const adjustedDuration = originalDuration - (sessionInfo.totalSkippedTime || 0);
    
    const totalMins = Math.floor(adjustedDuration / 60);
    const totalSecs = adjustedDuration % 60;
    const currentMins = Math.floor(seconds / 60);
    const currentSecs = seconds % 60;
    
    return `${currentMins}:${currentSecs.toString().padStart(2, '0')} / ${totalMins}:${totalSecs.toString().padStart(2, '0')}`;
  };

  const getPhaseProgress = () => {
    const totalPhases = sessionInfo.totalCycles * 2; // cycles × 2 phases each
    const completedPhases = (sessionInfo.currentCycle - 1) * 2 + (sessionInfo.currentPhase === 'HYPEROXIC' ? 1 : 0);
    return completedPhases / totalPhases;
  };

  const currentSpo2 = pulseOximeterData?.spo2 || 0;
  
  // Prioritize HR monitor data if available, fallback to pulse oximeter
  const currentHR = (isHRConnected && heartRateData?.heartRate) 
    ? heartRateData.heartRate 
    : (pulseOximeterData?.heartRate || 0);
  
  const hrSource = (isHRConnected && heartRateData?.heartRate) ? 'Enhanced' : 'Basic';
  const spo2Status = getSpO2Status(currentSpo2);

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor={sessionInfo.currentPhase === 'HYPOXIC' ? '#2196F3' : '#4CAF50'} barStyle="light-content" />
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: sessionInfo.currentPhase === 'HYPOXIC' ? '#2196F3' : '#4CAF50' }]}>
        <TouchableOpacity 
          style={[styles.backButton, (!sessionStarted || !sessionInfo.isActive) && styles.backButtonDisabled]} 
          onPress={(!sessionStarted || !sessionInfo.isActive) ? null : handleEndSession}
          disabled={!sessionStarted || !sessionInfo.isActive}
        >
          <Text style={[styles.backButtonText, (!sessionStarted || !sessionInfo.isActive) && styles.backButtonTextDisabled]}>
            {(!sessionStarted || !sessionInfo.isActive) ? '← Session Ended' : '← Back'}
          </Text>
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
          isConnected={isPulseOxConnected}
          isFingerDetected={pulseOximeterData?.isFingerDetected}
        />

        {/* Main Timer */}
        <View style={styles.mainTimer}>
          <Text style={styles.timerText}>⏱️ {formatTotalTime(getTotalTimeElapsed())}</Text>
          <Text style={styles.cycleText}>🔄 Cycle {sessionInfo.currentCycle} of {sessionInfo.totalCycles}</Text>
        </View>

        {/* Phase Status Card */}
        <View style={[styles.phaseCard, { backgroundColor: sessionInfo.currentPhase === 'HYPOXIC' ? '#E3F2FD' : '#E8F5E8' }]}>
          <Text style={styles.phaseIcon}>{sessionInfo.currentPhase === 'HYPOXIC' ? '🫁' : '🧘'}</Text>
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

        {/* Live Data Display - Three Cards */}
        <View style={styles.dataContainer}>
          {/* SpO2 Card */}
          <View style={[styles.dataCard, warningActive && styles.warningBorder]}>
            <Text style={[styles.cardValue, { color: spo2Status.color }]}>{currentSpo2}%</Text>
            <Text style={styles.cardLabel}>SpO2</Text>
            <Text style={styles.cardSubtext}>
              {sessionInfo.currentPhase === 'HYPOXIC' ? '82-87%' : '95%+'}
            </Text>
          </View>

          {/* Heart Rate Card */}
          <View style={styles.dataCard}>
            <Text style={styles.cardValue}>{currentHR}</Text>
            <Text style={styles.cardLabel}>Heart Rate</Text>
            <Text style={styles.cardSubtext}>bpm</Text>
          </View>

          {/* HRV Card */}
          <View style={styles.dataCard}>
            <Text style={styles.cardValue}>
              {currentBaselineHRV || '--'}
            </Text>
            <Text style={styles.cardLabel}>Heart Rate</Text>
            <Text style={styles.cardLabel}>Variability</Text>
            <Text style={styles.cardSubtext}>ms</Text>
          </View>
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
          <TouchableOpacity 
            style={[styles.endButton, (!sessionStarted || !sessionInfo.isActive) && styles.endButtonDisabled]} 
            onPress={(!sessionStarted || !sessionInfo.isActive) ? null : handleEndSession}
            disabled={!sessionStarted || !sessionInfo.isActive}
          >
            <Text style={[styles.endButtonText, (!sessionStarted || !sessionInfo.isActive) && styles.endButtonTextDisabled]}>
              {(!sessionStarted || !sessionInfo.isActive) ? 'Session Ended' : 'End Session'}
            </Text>
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
          style={[styles.skipButton, (sessionInfo.isPaused || !sessionInfo.isActive || sessionCompleted || isSkipping) && styles.skipButtonDisabled]} 
          onPress={handleSkipToNext}
          disabled={sessionInfo.isPaused || !sessionInfo.isActive || sessionCompleted || isSkipping}
        >
          <Text style={[styles.skipButtonText, (sessionInfo.isPaused || !sessionInfo.isActive || sessionCompleted || isSkipping) && styles.skipButtonTextDisabled]}>
            {isSkipping ? 'Skipping...' : getSkipButtonText()}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Pause Overlay */}
      {sessionInfo.isPaused && (
        <View style={styles.pauseOverlay}>
          <View style={styles.pauseCard}>
            <Text style={styles.pauseTitle}>⏸️ SESSION PAUSED</Text>
            <Text style={styles.pauseStats}>Cycle {sessionInfo.currentCycle} of {sessionInfo.totalCycles}</Text>
            <Text style={styles.pauseStats}>{formatTotalTime(getTotalTimeElapsed())} elapsed</Text>
            <TouchableOpacity style={styles.resumeButton} onPress={resumeSession}>
              <Text style={styles.resumeButtonText}>Resume Training</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.endSessionButton, (!sessionStarted || !sessionInfo.isActive) && styles.endSessionButtonDisabled]} 
              onPress={(!sessionStarted || !sessionInfo.isActive) ? null : handleEndSession}
              disabled={!sessionStarted || !sessionInfo.isActive}
            >
              <Text style={[styles.endSessionButtonText, (!sessionStarted || !sessionInfo.isActive) && styles.endSessionButtonTextDisabled]}>
                {(!sessionStarted || !sessionInfo.isActive) ? 'Session Ended' : 'End Session'}
              </Text>
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
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 110,
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
  cardValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 4,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666666',
    textAlign: 'center',
    lineHeight: 14,
  },
  cardSubtext: {
    fontSize: 10,
    color: '#999999',
    marginTop: 2,
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
  // Disabled button styles
  backButtonDisabled: {
    opacity: 0.5,
  },
  backButtonTextDisabled: {
    color: '#999999',
  },
  endButtonDisabled: {
    backgroundColor: '#F5F5F5',
    opacity: 0.6,
  },
  endButtonTextDisabled: {
    color: '#999999',
  },
  endSessionButtonDisabled: {
    opacity: 0.5,
  },
  endSessionButtonTextDisabled: {
    color: '#999999',
  },
});

export default IHHTTrainingScreen; 