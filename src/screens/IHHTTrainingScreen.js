import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Vibration,
  ScrollView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Slider } from '@miblanchard/react-native-slider';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useBluetooth } from '../context/BluetoothContext';
import EnhancedSessionManager from '../services/EnhancedSessionManager';
import AdaptiveInstructionEngine from '../services/AdaptiveInstructionEngine';
import SessionIdGenerator from '../utils/sessionIdGenerator';
import { colors } from '../design-system';
import IntraSessionFeedback from '../components/feedback/IntraSessionFeedback';
import DatabaseService from '../services/DatabaseService';
import SupabaseService from '../services/SupabaseService';

// No longer need custom slider - using native component

const PHASE_TYPES = {
  ALTITUDE: 'ALTITUDE',
  RECOVERY: 'RECOVERY', 
  TRANSITION: 'TRANSITION',
  COMPLETED: 'COMPLETED',
  // Legacy support
  HYPOXIC: 'ALTITUDE',
  HYPEROXIC: 'RECOVERY',
  PAUSED: 'PAUSED',
  TERMINATED: 'TERMINATED'
};

const IHHTTrainingScreen = ({ navigation, route }) => {
  const adaptiveEngineRef = useRef(null);
  
  // Extract protocol configuration from navigation params or use defaults
  const protocolConfig = route?.params?.protocolConfig || {
    totalCycles: 5,
    hypoxicDuration: 7,     // 7 minutes (default)
    hyperoxicDuration: 3,    // 3 minutes (default)
    defaultAltitudeLevel: 6  // Default altitude level
  };
  
  // Initialize adaptive engine on mount
  React.useEffect(() => {
    console.log('🔍 IHHTTrainingScreen initialized with:', {
      sessionId: route?.params?.sessionId,
      totalCycles: protocolConfig.totalCycles,
      usingDefaultConfig: !route?.params?.protocolConfig
    });
    
    // Initialize adaptive engine
    adaptiveEngineRef.current = new AdaptiveInstructionEngine();
  }, []);

  const { 
    pulseOximeterData, 
    isPulseOxConnected
  } = useBluetooth();

  const [sessionStarted, setSessionStarted] = useState(false);
  const [showPauseOverlay, setShowPauseOverlay] = useState(false);
  const [sessionInfo, setSessionInfo] = useState(EnhancedSessionManager.getSessionInfo());
  const [forceUpdate, setForceUpdate] = useState({});
  const [altitudeLevel, setAltitudeLevel] = useState(protocolConfig.defaultAltitudeLevel || 6); // Initialize from protocol config
  
  // Intra-session feedback states
  const [showIntraSessionFeedback, setShowIntraSessionFeedback] = useState(false);
  const [hasShownFeedbackForCycle, setHasShownFeedbackForCycle] = useState({});
  const [currentPhaseType, setCurrentPhaseType] = useState(null);
  const [lastKnownCycle, setLastKnownCycle] = useState(0);
  const feedbackTimerRef = useRef(null);
  
  // Adaptive instruction state
  const [adaptiveInstruction, setAdaptiveInstruction] = useState(null);
  const [showAdaptiveInstruction, setShowAdaptiveInstruction] = useState(false);
  
  // Adaptive instruction callback
  const handleAdaptiveInstruction = (instruction) => {
    console.log('🎯 Received adaptive instruction:', instruction);
    setAdaptiveInstruction(instruction);
    setShowAdaptiveInstruction(true);
    
    // Vibrate to get user attention
    Vibration.vibrate([0, 300, 100, 300]);
    
    // Auto-dismiss after 5 seconds for mask lift, 10 seconds for altitude adjustment
    const dismissTime = instruction.type === 'mask_lift' ? 5000 : 10000;
    setTimeout(() => {
      setShowAdaptiveInstruction(false);
    }, dismissTime);
  };
  
  // Monitor session info changes and update local state
  useEffect(() => {
    if (!sessionStarted) return;
    
    const interval = setInterval(() => {
      const info = EnhancedSessionManager.getSessionInfo();
      setSessionInfo(info);
      
      // Force re-render to update timers
      setForceUpdate({});
      
      // Auto-end session if completed
      if (info.currentPhase === 'COMPLETED' && sessionStarted) {
        console.log('🎉 Session completed - navigating to post-session survey');
        handleEndSession();
      }
    }, 1000); // Update every second to match the timer

    return () => {
      clearInterval(interval);
    };
  }, [sessionStarted]);

  // Separate effect to handle intra-session feedback timing
  useEffect(() => {
    if (!sessionStarted || !sessionInfo) return;
    
    const { currentPhase, currentCycle } = sessionInfo;
    const cycleKey = `cycle_${currentCycle}`;
    
    // Detect phase change to RECOVERY
    if (currentPhase === 'RECOVERY' && currentPhaseType !== 'RECOVERY') {
      console.log(`📊 Entered RECOVERY phase for cycle ${currentCycle}`);
      setCurrentPhaseType('RECOVERY');
      setLastKnownCycle(currentCycle);
      
      // Check if we haven't shown feedback for this cycle
      if (!hasShownFeedbackForCycle[cycleKey] && !showIntraSessionFeedback) {
        console.log(`⏱️ Starting 30-second timer for intra-session feedback (cycle ${currentCycle})`);
        console.log(`   Already shown for cycles:`, Object.keys(hasShownFeedbackForCycle));
        
        // Clear any existing timer
        if (feedbackTimerRef.current) {
          clearTimeout(feedbackTimerRef.current);
        }
        
        // Store current cycle in closure to avoid stale references
        const currentCycleCapture = currentCycle;
        const cycleKeyCapture = cycleKey;
        
        // Set new timer for 30 seconds
        feedbackTimerRef.current = setTimeout(() => {
          console.log(`✅ Showing intra-session feedback for cycle ${currentCycleCapture}`);
          
          // Get fresh session info at trigger time
          const freshSessionInfo = EnhancedSessionManager.getSessionInfo();
          console.log(`   Fresh session info at trigger time:`, {
            phase: freshSessionInfo?.currentPhase,
            cycle: freshSessionInfo?.currentCycle,
            isPaused: freshSessionInfo?.isPaused
          });
          
          // Only show if still in RECOVERY phase and not paused
          if (freshSessionInfo?.currentPhase === 'RECOVERY' && !freshSessionInfo?.isPaused) {
            setShowIntraSessionFeedback(true);
            setHasShownFeedbackForCycle(prev => ({ ...prev, [cycleKeyCapture]: true }));
          } else {
            console.log(`⚠️ Not showing feedback - phase changed or session paused`);
          }
        }, 30000); // 30 seconds
      } else {
        if (hasShownFeedbackForCycle[cycleKey]) {
          console.log(`⚠️ Feedback already shown for cycle ${currentCycle}`);
        }
        if (showIntraSessionFeedback) {
          console.log(`⚠️ Feedback is currently being shown`);
        }
      }
    } 
    // Update phase type when it changes
    else if (currentPhase !== 'RECOVERY' && currentPhaseType === 'RECOVERY') {
      console.log(`📊 Exited RECOVERY phase`);
      setCurrentPhaseType(currentPhase);
      
      // Clear timer if we leave recovery phase before 30 seconds
      if (feedbackTimerRef.current) {
        console.log('⏹️ Clearing feedback timer - left RECOVERY phase');
        clearTimeout(feedbackTimerRef.current);
        feedbackTimerRef.current = null;
      }
    }
    // Update phase type for other phases
    else if (currentPhase !== currentPhaseType) {
      setCurrentPhaseType(currentPhase);
    }
    
    // Cleanup on unmount
    return () => {
      if (feedbackTimerRef.current) {
        clearTimeout(feedbackTimerRef.current);
      }
    };
  }, [sessionStarted, sessionInfo?.currentPhase, sessionInfo?.currentCycle, hasShownFeedbackForCycle, showIntraSessionFeedback]);

  // Session control functions
  const startSession = async () => {
    console.log('🚀 Starting new IHHT training session...');
    console.log('🎯 Starting with altitude level:', altitudeLevel);
    
    try {
      // Generate a proper session ID
      const sessionId = SessionIdGenerator.generate('IHHT');
      console.log('📝 Generated session ID:', sessionId);
      
      // Set up adaptive instruction callback before starting session
      EnhancedSessionManager.setAdaptiveInstructionCallback(handleAdaptiveInstruction);
      
      // Start the session with proper protocol configuration
      const createdSession = await EnhancedSessionManager.startSession(sessionId, {
        totalCycles: protocolConfig.totalCycles,
        hypoxicDuration: protocolConfig.hypoxicDuration * 60,  // Convert minutes to seconds
        hyperoxicDuration: protocolConfig.hyperoxicDuration * 60,  // Convert minutes to seconds
        defaultAltitudeLevel: altitudeLevel || 6
      });
      
      console.log('✅ Session started successfully:', createdSession);
      setSessionStarted(true);
      setSessionInfo(EnhancedSessionManager.getSessionInfo());
      
      // Activate keep awake to prevent screen sleep during session
      activateKeepAwakeAsync()
        .then(() => console.log('🌟 Screen will stay awake during session'))
        .catch(error => console.warn('⚠️ Failed to activate screen wake lock:', error));
    } catch (error) {
      console.error('❌ Failed to start session:', error);
      Alert.alert('Error', 'Failed to start session. Please try again.');
    }
  };

  const pauseSession = () => {
    EnhancedSessionManager.pauseSession();
    setShowPauseOverlay(true);
  };

  const resumeSession = () => {
    EnhancedSessionManager.resumeSession();
    setShowPauseOverlay(false);
  };

  const handleIntraSessionSubmit = async (feedbackData) => {
    try {
      const sessionId = route?.params?.sessionId || EnhancedSessionManager.getSessionId();
      
      // Save to database
      await DatabaseService.saveIntraSessionResponse(
        sessionId,
        sessionInfo.currentCycle,
        feedbackData.clarity,
        feedbackData.energy,
        feedbackData.stressPerception,
        Date.now(),
        feedbackData.sensations,
        feedbackData.spo2,
        feedbackData.heartRate
      );
      
      console.log('✅ Intra-session feedback saved for cycle', sessionInfo.currentCycle);
    } catch (error) {
      console.error('Error saving intra-session feedback:', error);
    }
    
    setShowIntraSessionFeedback(false);
  };
  
  const handleIntraSessionDismiss = () => {
    console.log('❌ Intra-session feedback dismissed for cycle', sessionInfo.currentCycle);
    setShowIntraSessionFeedback(false);
  };

  const handleEndSession = async () => {
    console.log('🏁 Handling session end...');
    
    // Check if we already have a session ID from the manager
    const currentSession = EnhancedSessionManager.getSessionInfo();
    const sessionId = currentSession?.currentSession?.id || route?.params?.sessionId;
    
    if (!sessionId) {
      console.warn('⚠️ No session ID found when ending session');
    }
    
    // First, ensure session is marked as ended in the manager
    // This might return null if session was already ended (e.g., completed naturally)
    const endedSession = await EnhancedSessionManager.endSession();
    
    // Use the session ID from the ended session if available, otherwise use what we had
    const finalSessionId = endedSession?.sessionId || sessionId;
    
    console.log('📊 Navigating to post-session survey with session ID:', finalSessionId);
    
    // Reset local state
    setSessionStarted(false);
    setShowPauseOverlay(false);
    
    // Deactivate keep awake
    deactivateKeepAwake()
      .then(() => console.log('🌙 Screen wake lock deactivated'))
      .catch(error => console.warn('⚠️ Failed to deactivate screen wake lock:', error));
    
    // Navigate to post-session survey with session ID
    navigation.replace('PostSessionSurvey', { 
      sessionId: finalSessionId,
      sessionType: 'IHHT_TRAINING'
    });
  };

  const confirmEndSession = () => {
    Alert.alert(
      'End Session',
      'Are you sure you want to end this session?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'End Session', 
          style: 'destructive',
          onPress: handleEndSession
        }
      ]
    );
  };

  const skipToNextPhase = () => {
    console.log('🔄 User clicked Skip - current phase:', sessionInfo?.currentPhase, 'cycle:', sessionInfo?.currentCycle);
    EnhancedSessionManager.skipToNextPhase();
  };

  // Track previous connection state to detect changes
  const wasConnectedRef = useRef(isPulseOxConnected);

  // Monitor device connection status changes
  useEffect(() => {
    // Check if connection status changed
    if (wasConnectedRef.current !== isPulseOxConnected) {
      console.log('📡 Device connection status changed:', isPulseOxConnected ? 'connected' : 'disconnected');
      
      // Handle disconnection during active session
      if (!isPulseOxConnected && sessionStarted && sessionInfo.isActive && !sessionInfo.isPaused) {
        console.log('⚠️ Device disconnected during active session');
        pauseSession();
        Alert.alert(
          'Device Disconnected',
          'Pulse oximeter disconnected. Session has been paused.',
          [{ text: 'OK' }]
        );
      } else if (isPulseOxConnected && !wasConnectedRef.current) {
        console.log('✅ Device reconnected');
        // Could show a notification that device is back
      }
      
      // Update the ref for next comparison
      wasConnectedRef.current = isPulseOxConnected;
    }
  }, [isPulseOxConnected, sessionStarted, sessionInfo.isActive, sessionInfo.isPaused]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // End session and deactivate keep awake if component unmounts while session is active
      if (sessionStarted && sessionInfo.isActive) {
        console.log('🧹 Component unmounting with active session - cleaning up...');
        EnhancedSessionManager.endSession()
          .then(() => console.log('✅ Session ended on unmount'))
          .catch(error => console.error('❌ Failed to end session on unmount:', error));
        
        deactivateKeepAwake()
          .then(() => console.log('🌙 Screen wake lock deactivated on unmount'))
          .catch(error => console.warn('⚠️ Failed to deactivate screen wake lock:', error));
      }
    };
  }, [sessionStarted, sessionInfo.isActive]);

  // Helper functions
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

  const getTotalTimeElapsed = () => {
    if (!sessionInfo.sessionStartTime) return 0;
    return Math.floor((Date.now() - sessionInfo.sessionStartTime) / 1000);
  };

  // Timer updates are now handled in the main monitor effect above

  // Get current readings with fallbacks
  const currentSpo2 = pulseOximeterData?.spo2 || 0;  // Fixed: use lowercase spo2
  const currentPR = pulseOximeterData?.heartRate || 0;
  
  // Handle navigation back button
  const handleBackPress = () => {
    if (sessionStarted && sessionInfo.isActive) {
      Alert.alert(
        'Session in Progress',
        'You have an active session. What would you like to do?',
        [
          { text: 'Continue Session', style: 'cancel' },
          { 
            text: 'End Session', 
            style: 'destructive',
            onPress: handleEndSession
          }
        ]
      );
    } else {
      navigation.goBack();
    }
  };

  // Helper function to determine SpO2 status for color coding
  const getSpO2Status = (spo2) => {
    if (spo2 < 85) return 'danger';
    if (spo2 < 90) return 'warning';
    return 'normal';
  };

  // Add altitude slider handler
  const handleAltitudeLevelChange = (value) => {
    const level = Math.round(value[0]);
    setAltitudeLevel(level);
    
    // Update the session manager if session is active
    if (sessionStarted && sessionInfo.isActive) {
      EnhancedSessionManager.setAltitudeLevel(level);
    }
  };

  // Auto-start session if coming from SessionSetup with a session ID
  useEffect(() => {
    const sessionId = route?.params?.sessionId;
    if (sessionId && !sessionStarted) {
      console.log('🔄 Auto-starting session with ID:', sessionId);
      
      // Actually START the session, don't just mark as started
      const startSessionAsync = async () => {
        try {
          console.log('🚀 Starting IHHT session with config:', {
            sessionId: sessionId,
            cycles: protocolConfig.totalCycles,
            hypoxic: protocolConfig.hypoxicDuration,
            hyperoxic: protocolConfig.hyperoxicDuration,
            altitudeLevel: protocolConfig.defaultAltitudeLevel || 6
          });
          
          // Set up adaptive instruction callback before starting session
          EnhancedSessionManager.setAdaptiveInstructionCallback(handleAdaptiveInstruction);
          
          // Start the session with the passed session ID
          const createdSession = await EnhancedSessionManager.startSession(sessionId, {
            totalCycles: protocolConfig.totalCycles,
            hypoxicDuration: protocolConfig.hypoxicDuration * 60,  // Convert minutes to seconds
            hyperoxicDuration: protocolConfig.hyperoxicDuration * 60, // Convert minutes to seconds
            defaultAltitudeLevel: protocolConfig.defaultAltitudeLevel || 6
          });
          
          console.log('✅ Session started successfully:', createdSession);
          setSessionStarted(true);
          setSessionInfo(EnhancedSessionManager.getSessionInfo());
          setAltitudeLevel(protocolConfig.defaultAltitudeLevel || 6); // Set initial altitude level
          
          // Activate keep awake
          await activateKeepAwakeAsync();
          console.log('🌟 Screen will stay awake during session');
        } catch (error) {
          console.error('❌ Failed to start session:', error);
          Alert.alert(
            'Session Start Error',
            'Failed to start the training session. Please try again.',
            [{ text: 'OK', onPress: () => navigation.goBack() }]
          );
        }
      };
      
      startSessionAsync();
    }
  }, [route?.params?.sessionId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Deactivate keep awake when component unmounts
      deactivateKeepAwake()
        .then(() => console.log('🌙 Screen wake lock deactivated on unmount'))
        .catch(error => console.warn('⚠️ Failed to deactivate screen wake lock on unmount:', error));
    };
  }, []);

  // Prevent going back during active session
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (!sessionStarted || !sessionInfo.isActive) {
        // Not in a session, allow normal back
        return;
      }

      // Prevent default behavior
      e.preventDefault();

      // Show confirmation dialog
      Alert.alert(
        'Session in Progress',
        'You have an active session. What would you like to do?',
        [
          { text: 'Continue Session', style: 'cancel' },
          { 
            text: 'End Session', 
            style: 'destructive',
            onPress: () => {
              handleEndSession();
              navigation.dispatch(e.data.action);
            }
          }
        ]
      );
    });

    return unsubscribe;
  }, [navigation, sessionStarted, sessionInfo.isActive]);

  // Show loading state while auto-starting session
  if (!sessionStarted && route?.params?.sessionId) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background.primary }}>
        <Text style={{ fontSize: 18, color: colors.text.primary, marginBottom: 20 }}>Starting session...</Text>
        <Text style={{ fontSize: 14, color: colors.text.secondary }}>Initializing training protocol</Text>
      </View>
    );
  }
  
  // Only show start screen if no sessionId was provided (fallback for direct navigation)
  if (!sessionStarted && !route?.params?.sessionId) {
    const phaseColors = {
      backgroundColor: colors.background.tertiary,
      titleColor: colors.text.primary,
      messageColor: colors.text.secondary
    };
    
    const styles = StyleSheet.create({
      container: {
        flex: 1,
        backgroundColor: colors.background.primary,
      },
      mainTimer: {
        alignItems: 'center',
        paddingVertical: 20,
        backgroundColor: colors.background.tertiary,
        marginHorizontal: 20,
        marginTop: 15,
        marginBottom: 5,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 3,
      },
      phaseCard: {
        marginHorizontal: 20,
        marginTop: 15,
        marginBottom: 5,
        padding: 20,
        borderRadius: 12,
        alignItems: 'center',
        backgroundColor: phaseColors.backgroundColor,
      },
      phaseIcon: {
        fontSize: 48,
        marginBottom: 10,
      },
      phaseTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: phaseColors.titleColor,
        marginBottom: 5,
      },
      phaseMessage: {
        fontSize: 16,
        color: phaseColors.messageColor,
        textAlign: 'center',
        marginBottom: 10,
      },
      controls: {
        flexDirection: 'row',
        gap: 15,
        marginTop: 30,
      },
      startButton: {
        flex: 1,
        backgroundColor: colors.brand.accent,
        padding: 15,
        borderRadius: 8,
        alignItems: 'center',
      },
      backButton: {
        flex: 1,
        backgroundColor: colors.background.elevated,
        padding: 15,
        borderRadius: 8,
        alignItems: 'center',
      },
      startButtonText: {
        color: colors.text.primary,
        fontSize: 16,
        fontWeight: '600',
      },
      backButtonText: {
        color: colors.text.primary,
        fontSize: 16,
        fontWeight: '600',
      },
      deviceStatusContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 10,
        marginHorizontal: 20,
        marginTop: 20,
        backgroundColor: isPulseOxConnected ? colors.background.elevated : colors.background.elevated,
        borderRadius: 8,
      },
      deviceStatusText: {
        marginLeft: 8,
        fontSize: 14,
        fontWeight: '600',
        color: isPulseOxConnected ? colors.semantic.success : colors.semantic.error,
      },
      protocolInfo: {
        backgroundColor: colors.background.elevated,
        marginHorizontal: 20,
        marginTop: 10,
        padding: 15,
        borderRadius: 8,
      },
      protocolTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.text.primary,
        marginBottom: 10,
      },
      protocolRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginVertical: 5,
      },
      protocolLabel: {
        fontSize: 14,
        color: colors.text.secondary,
      },
      protocolValue: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text.primary,
      },
      warningBox: {
        backgroundColor: colors.background.elevated,
        marginHorizontal: 20,
        marginTop: 10,
        padding: 15,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.border.medium,
      },
      warningText: {
        fontSize: 14,
        color: colors.semantic.warning,
        textAlign: 'center',
      },
    });
    
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.phaseCard}>

          <Text style={styles.phaseTitle}>IHHT Training</Text>
          <Text style={styles.phaseMessage}>
            Ready to begin your hypoxic-hyperoxic training session
          </Text>
        </View>

        {/* Device Status */}
        <View style={styles.deviceStatusContainer}>
          <Text style={styles.deviceStatusText}>
            {isPulseOxConnected ? '✓ Pulse Oximeter Connected' : '✗ Pulse Oximeter Not Connected'}
          </Text>
        </View>

        {/* Protocol Information */}
        <View style={styles.protocolInfo}>
          <Text style={styles.protocolTitle}>Session Protocol</Text>
          <View style={styles.protocolRow}>
            <Text style={styles.protocolLabel}>Total Cycles:</Text>
            <Text style={styles.protocolValue}>{protocolConfig.totalCycles}</Text>
          </View>
          <View style={styles.protocolRow}>
            <Text style={styles.protocolLabel}>Altitude Phase:</Text>
            <Text style={styles.protocolValue}>{protocolConfig.hypoxicDuration} minutes</Text>
          </View>
          <View style={styles.protocolRow}>
            <Text style={styles.protocolLabel}>Recovery Phase:</Text>
            <Text style={styles.protocolValue}>{protocolConfig.hyperoxicDuration} minutes</Text>
          </View>
          <View style={styles.protocolRow}>
            <Text style={styles.protocolLabel}>Total Duration:</Text>
            <Text style={styles.protocolValue}>
              ~{protocolConfig.totalCycles * (protocolConfig.hypoxicDuration + protocolConfig.hyperoxicDuration)} minutes
            </Text>
          </View>
        </View>

        {!isPulseOxConnected && (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              ⚠️ Pulse oximeter not connected. Connect device for accurate monitoring.
            </Text>
          </View>
        )}

        <View style={styles.controls}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.startButton, { opacity: isPulseOxConnected ? 1 : 0.6 }]}
            onPress={startSession}
            disabled={!isPulseOxConnected}
          >
            <Text style={styles.startButtonText}>Start Session</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Determine phase colors
  const isAltitude = sessionInfo.currentPhase === 'ALTITUDE' || sessionInfo.currentPhase === 'HYPOXIC';
  const phaseColors = isAltitude 
    ? { 
        primary: colors.brand.accent, 
        light: colors.background.elevated 
      }
    : { 
        primary: colors.semantic.success, 
        light: colors.background.elevated 
      };

  // Get heart rate from pulse oximeter
  const currentHR = pulseOximeterData?.heartRate || 0;
  
  const spo2Status = getSpO2Status(currentSpo2);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background.primary,
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
      color: colors.white,
      fontSize: 16,
      fontWeight: '600',
    },
    headerTitle: {
      color: colors.white,
      fontSize: 18,
      fontWeight: 'bold',
      flex: 1,
      textAlign: 'center',
    },

    mainTimer: {
      alignItems: 'center',
      paddingVertical: 20,
      backgroundColor: colors.background.tertiary,
      marginHorizontal: 20,
      marginTop: 15,
      marginBottom: 5,
      borderRadius: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 3,
    },
    timerText: {
      fontSize: 28,
      fontWeight: 'bold',
      color: colors.text.primary,
    },
    cycleText: {
      fontSize: 16,
      color: colors.text.secondary,
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
      color: colors.text.primary,
      marginBottom: 5,
    },
    phaseMessage: {
      fontSize: 16,
      color: colors.text.secondary,
      textAlign: 'center',
      marginBottom: 10,
    },
    phaseTimer: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text.primary,
    },
    altitudeSliderContainer: {
      width: '100%',
      marginTop: 20,
      paddingHorizontal: 10,
      backgroundColor: colors.background.elevated,
      borderRadius: 12,
      padding: 15,
    },
    altitudeLabel: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.brand.accent,
      textAlign: 'center',
      marginBottom: 10,
    },
    slider: {
      width: '100%',
      height: 40,
    },
    sliderLabels: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 10,
      marginTop: 5,
    },
    sliderLabel: {
      fontSize: 12,
      color: colors.text.tertiary,
    },
    dataCard: {
      backgroundColor: colors.background.tertiary,
      marginHorizontal: 20,
      marginTop: 15,
      marginBottom: 5,
      padding: 20,
      borderRadius: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 3,
    },
    cardTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text.primary,
      marginBottom: 15,
    },
    metricsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
    },
    metricItem: {
      alignItems: 'center',
      flex: 1,
    },
    metricLabel: {
      fontSize: 12,
      color: colors.text.secondary,
      marginBottom: 5,
    },
    metricValue: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.text.primary,
    },
    metricUnit: {
      fontSize: 14,
      color: colors.text.secondary,
      marginTop: 2,
    },
    scrollContainer: {
      flex: 1,
      backgroundColor: colors.background.primary,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 20,
    },
    controls: {
      padding: 20,
      paddingBottom: 30,
      backgroundColor: colors.background.tertiary,
      borderTopWidth: 1,
      borderTopColor: colors.border.light,
      flexDirection: 'row',
      justifyContent: 'space-around',
    },
    controlButton: {
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 8,
      minWidth: 80,
      alignItems: 'center',
      justifyContent: 'center',
    },
    controlButtonText: {
      color: colors.white,
      fontSize: 16,
      fontWeight: '600',
    },
    pauseResumeButton: {
      backgroundColor: colors.primary[500],
      flex: 1,
      marginRight: 8,
    },
    skipPhaseButton: {
      backgroundColor: colors.semantic.warning,
      flex: 1,
      marginRight: 8,
    },
    endSessionButton: {
      backgroundColor: colors.semantic.error,
      flex: 1,
    },
    backButtonDisabled: {
      opacity: 0.5,
    },
    backButtonTextDisabled: {
      opacity: 0.5,
    },
    safetyBadge: {
      position: 'absolute',
      top: 10,
      right: 10,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 20,
      flexDirection: 'row',
      alignItems: 'center',
    },
    safetyBadgeText: {
      fontSize: 12,
      fontWeight: '600',
      marginLeft: 5,
    },
    dangerBadge: {
      backgroundColor: colors.background.elevated,
    },
    warningBadge: {
      backgroundColor: colors.warning[100],
    },
    normalBadge: {
      backgroundColor: colors.background.elevated,
    },
    dangerText: {
      color: colors.semantic.error,
    },
    warningText: {
      color: colors.semantic.warning,
    },
    normalText: {
      color: colors.semantic.success,
    },
    pausedOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
    },
    pausedCard: {
      backgroundColor: colors.background.tertiary,
      padding: 30,
      borderRadius: 20,
      alignItems: 'center',
      marginHorizontal: 40,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 5,
    },
    pausedIcon: {
      fontSize: 60,
      marginBottom: 15,
    },
    pausedTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.text.primary,
      marginBottom: 10,
    },
    pausedSubtitle: {
      fontSize: 16,
      color: colors.text.secondary,
      textAlign: 'center',
      marginBottom: 20,
    },
    resumeButton: {
      backgroundColor: colors.primary[500],
      paddingHorizontal: 30,
      paddingVertical: 12,
      borderRadius: 8,
      marginBottom: 10,
    },
    resumeButtonText: {
      color: colors.white,
      fontSize: 16,
      fontWeight: '600',
    },
    endButton: {
      paddingHorizontal: 30,
      paddingVertical: 12,
    },
    endButtonText: {
      color: colors.white,
      fontSize: 16,
      fontWeight: '600',
    },
    metricRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
    },
    metricValueSmall: {
      fontSize: 14,
      fontWeight: 'normal',
      color: colors.text.secondary,
      marginLeft: 8,
    },
    
    // Adaptive Instruction Styles
    adaptiveOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
    },
    adaptiveCard: {
      backgroundColor: colors.background.tertiary,
      borderRadius: 16,
      padding: 24,
      marginHorizontal: 20,
      maxWidth: 350,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 8,
      elevation: 6,
    },
    maskLiftCard: {
      borderLeftWidth: 4,
      borderLeftColor: colors.semantic.warning,
    },
    altitudeCard: {
      borderLeftWidth: 4,
      borderLeftColor: colors.brand.accent,
    },
    adaptiveTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text.primary,
      marginBottom: 12,
      textAlign: 'center',
    },
    adaptiveMessage: {
      fontSize: 16,
      color: colors.text.primary,
      textAlign: 'center',
      marginBottom: 16,
      lineHeight: 22,
    },
    altitudeDetails: {
      alignItems: 'center',
      marginBottom: 16,
    },
    altitudeDetailText: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text.primary,
      marginBottom: 8,
    },
    increaseText: {
      fontSize: 16,
      color: colors.semantic.warning,
      fontWeight: '500',
    },
    decreaseText: {
      fontSize: 16,
      color: colors.semantic.success,
      fontWeight: '500',
    },
    maskLiftDetails: {
      alignItems: 'center',
      marginBottom: 16,
    },
    spO2Text: {
      fontSize: 14,
      color: colors.text.secondary,
      textAlign: 'center',
    },
    dismissButton: {
      backgroundColor: colors.primary[500],
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 8,
      minWidth: 100,
    },
    dismissButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
      textAlign: 'center',
    },
  });

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* Header */}
      <View style={[styles.header, { 
        backgroundColor: sessionInfo.currentPhase === 'TRANSITION' 
          ? colors.background.secondary  // Subtle background for transition
          : (sessionInfo.currentPhase === 'ALTITUDE' || sessionInfo.currentPhase === 'HYPOXIC')
            ? colors.brand.accent  // Blue for altitude
            : colors.semantic.success  // Green for recovery
      }]}>
        <TouchableOpacity 
          style={[styles.backButton, (!sessionStarted || !sessionInfo.isActive) && styles.backButtonDisabled]} 
          onPress={handleBackPress}
          disabled={!sessionStarted || !sessionInfo.isActive}
        >
          <Text style={[styles.backButtonText, (!sessionStarted || !sessionInfo.isActive) && styles.backButtonTextDisabled]}>
            Back
          </Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>IHHT Training Session</Text>
        <View style={{ width: 60 }} />
      </View>
      
      {/* Scrollable Content */}
      <View style={styles.scrollContainer}>
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {!isPulseOxConnected && (
            <View style={[styles.dataCard, { backgroundColor: colors.background.elevated, marginTop: 10 }]}>
              <Text style={[styles.cardTitle, { color: colors.semantic.warning }]}>⚠️ Pulse Oximeter Disconnected</Text>
              <Text style={[styles.phaseMessage, { color: colors.semantic.warning }]}>
                Please reconnect your device for accurate monitoring
              </Text>
            </View>
          )}

          {/* Main Timer Display */}
          <View style={styles.mainTimer}>
            <Text style={styles.timerText}>{formatTotalTime(getTotalTimeElapsed())}</Text>
            <Text style={styles.cycleText}>Cycle {sessionInfo.currentCycle} of {sessionInfo.totalCycles}</Text>
          </View>

          {/* Phase Card */}
          {sessionInfo.currentPhase === 'TRANSITION' ? (
            // Transition phase card - mask switching instructions (calmer design)
            <View style={[styles.phaseCard, { 
              backgroundColor: colors.background.secondary
            }]}>

              <Text style={styles.phaseTitle}>Switching Phase</Text>
              <Text style={[styles.phaseMessage, { 
                fontSize: 16, 
                fontWeight: '500',
                color: colors.text.primary 
              }]}>
                {(sessionInfo.nextPhaseAfterTransition === 'ALTITUDE' || sessionInfo.nextPhaseAfterTransition === 'HYPOXIC')
                  ? 'Please put on your mask' 
                  : 'Please remove your mask'}
              </Text>
              <Text style={[styles.phaseTimer, { 
                fontSize: 20, 
                color: colors.brand.accent,
                fontWeight: '500'
              }]}>
                {formatTime(sessionInfo.phaseTimeRemaining)}
              </Text>
            </View>
          ) : (
            // Regular hypoxic/hyperoxic phase card
            <View style={[styles.phaseCard, {
              backgroundColor: isAltitude ? colors.background.secondary : colors.background.elevated
            }]}>
              <Text style={styles.phaseTitle}>
                {(sessionInfo.currentPhase === 'ALTITUDE' || sessionInfo.currentPhase === 'HYPOXIC') ? 'Altitude Phase' : 'Recovery Phase'}
              </Text>
              <Text style={styles.phaseMessage}>
                {(sessionInfo.currentPhase === 'ALTITUDE' || sessionInfo.currentPhase === 'HYPOXIC') ? 'Reduced oxygen exposure' : 'Recovery with normal oxygen'}
              </Text>
              <Text style={styles.phaseTimer}>{formatTime(sessionInfo.phaseTimeRemaining)} remaining</Text>
              
              {/* Altitude Level Slider - Show during all hypoxic phases */}
              {sessionInfo.currentPhase === 'HYPOXIC' && (
                <View style={styles.altitudeSliderContainer}>
                  <Text style={styles.altitudeLabel}>
                    Altitude Level: {altitudeLevel || 6}
                  </Text>
                  <Slider
                    value={[altitudeLevel || 6]}
                    onValueChange={handleAltitudeLevelChange}
                    minimumValue={1}
                    maximumValue={11}
                    step={1}
                    minimumTrackTintColor={colors.brand.accent}
                    maximumTrackTintColor={colors.border.light}
                    thumbStyle={{
                      width: 20,
                      height: 20,
                      backgroundColor: colors.brand.accent,
                    }}
                    trackStyle={{
                      height: 6,
                      borderRadius: 3,
                    }}
                  />
                  <View style={styles.sliderLabels}>
                    <Text style={styles.sliderLabel}>1 (Low)</Text>
                    <Text style={styles.sliderLabel}>6</Text>
                    <Text style={styles.sliderLabel}>11 (High)</Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Vital Signs */}
          <View style={styles.dataCard}>
            <Text style={styles.cardTitle}>Vital Signs</Text>
            <View style={styles.metricsContainer}>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>SpO2</Text>
                <Text style={[
                  styles.metricValue,
                  spo2Status === 'danger' && { color: colors.semantic.error },
                  spo2Status === 'warning' && { color: colors.semantic.warning }
                ]}>
                  {currentSpo2 || '--'}
                </Text>
                <Text style={styles.metricUnit}>{currentSpo2 ? '%' : ''}</Text>
              </View>
              
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Heart Rate</Text>
                <Text style={styles.metricValue}>{currentHR || '--'}</Text>
                <Text style={styles.metricUnit}>{currentHR ? 'bpm' : ''}</Text>
              </View>
            </View>
          </View>


        </ScrollView>
      </View>

      {/* Fixed Controls at Bottom */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.controlButton, styles.pauseResumeButton]}
          onPress={sessionInfo.isPaused ? resumeSession : pauseSession}
        >
          <Text style={styles.controlButtonText}>
            {sessionInfo.isPaused ? 'Resume' : 'Pause'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.controlButton, styles.skipPhaseButton]}
          onPress={skipToNextPhase}
        >
          <Text style={styles.controlButtonText}>
            Skip
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.controlButton, styles.endSessionButton]}
          onPress={confirmEndSession}
        >
          <Text style={styles.endButtonText}>
            End
          </Text>
        </TouchableOpacity>
        
        {/* Debug button - only show in development */}
        {__DEV__ && sessionInfo?.currentPhase === 'RECOVERY' && (
          <TouchableOpacity
            style={[styles.controlButton, { 
              backgroundColor: colors.semantic.info,
              marginLeft: 8
            }]}
            onPress={() => {
              console.log('🔧 DEBUG: Manually triggering intra-session feedback');
              console.log('   Current cycle:', sessionInfo?.currentCycle);
              setShowIntraSessionFeedback(true);
            }}
          >
            <Text style={styles.controlButtonText}>
              📊 Test
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Paused Overlay */}
      {sessionInfo.isPaused && (
        <View style={styles.pausedOverlay}>
          <View style={styles.pausedCard}>

            <Text style={styles.pausedTitle}>Session Paused</Text>
            <Text style={styles.pausedSubtitle}>
              Cycle {sessionInfo.currentCycle} of {sessionInfo.totalCycles}
            </Text>
            <Text style={styles.pausedSubtitle}>
              Time Elapsed: {formatTotalTime(getTotalTimeElapsed())}
            </Text>
            
            <TouchableOpacity 
              style={styles.resumeButton}
              onPress={resumeSession}
            >
              <Text style={styles.resumeButtonText}>Resume Session</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.endButton}
              onPress={confirmEndSession}
            >
              <Text style={styles.endButtonText}>End Session</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Adaptive Instruction Overlay */}
      {showAdaptiveInstruction && adaptiveInstruction && (
        <View style={styles.adaptiveOverlay}>
          <View style={[
            styles.adaptiveCard,
            adaptiveInstruction.type === 'mask_lift' ? styles.maskLiftCard : styles.altitudeCard
          ]}>
            <Text style={styles.adaptiveTitle}>
              {adaptiveInstruction.type === 'mask_lift' ? '🫁 Mask Lift' : '⛰️ Altitude Adjustment'}
            </Text>
            
            <Text style={styles.adaptiveMessage}>
              {adaptiveInstruction.message || adaptiveInstruction.reason}
            </Text>
            
            {adaptiveInstruction.type === 'altitude_adjustment' && (
              <View style={styles.altitudeDetails}>
                <Text style={styles.altitudeDetailText}>
                  Adjust dial to level: {adaptiveInstruction.newLevel}
                </Text>
                {adaptiveInstruction.adjustment > 0 ? (
                  <Text style={styles.increaseText}>↗️ Increase altitude</Text>
                ) : (
                  <Text style={styles.decreaseText}>↘️ Decrease altitude</Text>
                )}
              </View>
            )}
            
            {adaptiveInstruction.type === 'mask_lift' && (
              <View style={styles.maskLiftDetails}>
                <Text style={styles.spO2Text}>
                  SpO2: {adaptiveInstruction.spo2Value}% (Target: ≥{adaptiveInstruction.threshold + 2}%)
                </Text>
              </View>
            )}
            
            <TouchableOpacity
              style={styles.dismissButton}
              onPress={() => setShowAdaptiveInstruction(false)}
            >
              <Text style={styles.dismissButtonText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      
      {/* Intra-Session Feedback Overlay */}
      <IntraSessionFeedback
        visible={showIntraSessionFeedback}
        onSubmit={handleIntraSessionSubmit}
        onDismiss={handleIntraSessionDismiss}
        cycleNumber={sessionInfo.currentCycle}
        currentSpo2={sessionInfo.currentSpO2}
        currentHR={sessionInfo.heartRate}
      />
    </View>
  );
};

export default IHHTTrainingScreen;