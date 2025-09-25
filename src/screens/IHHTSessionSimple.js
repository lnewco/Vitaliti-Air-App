/**
 * @fileoverview IHHT training session screen with real-time monitoring
 */

import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Animated,
  Dimensions,
  Vibration,
  AppState,
  Modal,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import { useBluetooth } from '../context/BluetoothContext';
import EnhancedSessionManager from '../services/EnhancedSessionManager';
import { formatTime } from '../utils/formatters';
import AdaptiveInstructionEngine from '../services/AdaptiveInstructionEngine';
import SessionIdGenerator from '../utils/sessionIdGenerator';
import DatabaseService from '../services/DatabaseService';
import SupabaseService from '../services/SupabaseService';
import IntraSessionFeedback from '../components/feedback/IntraSessionFeedback';
import AltitudeSlotMachine from '../components/AltitudeSlotMachine';
import { ALTITUDE_CONVERSION } from '../constants/altitude';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');


// EKG Animation Component with Trail Effect
const EKGWave = ({ heartRate, color = '#FF6B9D' }) => {
  const [trailPoints, setTrailPoints] = useState([]);
  const trailIndex = useRef(0);
  
  useEffect(() => {
    const beatDuration = 60000 / heartRate; // ms per beat
    const totalPoints = 50; // More points for smoother trail
    
    // Initialize trail points
    const initialTrail = Array.from({ length: totalPoints }, (_, i) => ({
      x: (i / totalPoints) * 100,
      y: 0,
      opacity: 0.3 + (i / totalPoints) * 0.7 // More visible trail
    }));
    setTrailPoints(initialTrail);
    
    // Waveform pattern for one heartbeat
    const wavePattern = [
      0, 0, 0, 0, 0,           // Baseline
      -2, -3, -2, 0,           // Small P wave
      0, 0, 0,                 // PR interval
      2, -8, 25, -10, 3,       // QRS complex (spike)
      0, 0, 0, 0,              // ST segment
      -3, -5, -3, 0,           // T wave
      0, 0, 0, 0, 0, 0, 0, 0   // Rest
    ];
    
    // Update trail animation
    const updateInterval = setInterval(() => {
      trailIndex.current = (trailIndex.current + 1) % wavePattern.length;
      const currentY = wavePattern[trailIndex.current];
      
      setTrailPoints(prev => {
        const newTrail = [...prev];
        // Shift all points left
        for (let i = 0; i < newTrail.length - 1; i++) {
          newTrail[i].y = newTrail[i + 1].y;
        }
        // Add new point at the end
        newTrail[newTrail.length - 1].y = currentY;
        return newTrail;
      });
    }, beatDuration / wavePattern.length);
    
    return () => clearInterval(updateInterval);
  }, [heartRate]);
  
  return (
    <View style={styles.ekgContainer}>
      <View style={styles.ekgBaseline} />
      {/* Trail as continuous line segments */}
      {trailPoints.map((point, index) => {
        if (index === 0) return null;
        const prevPoint = trailPoints[index - 1];
        const distance = Math.sqrt(
          Math.pow(point.x - prevPoint.x, 2) + 
          Math.pow(point.y - prevPoint.y, 2)
        );
        const angle = Math.atan2(point.y - prevPoint.y, point.x - prevPoint.x);
        
        return (
          <View
            key={index}
            style={[
              styles.ekgLine,
              {
                position: 'absolute',
                left: prevPoint.x,
                top: 25 + prevPoint.y,
                width: distance || 2,
                height: 2,
                opacity: point.opacity,
                backgroundColor: '#FF6B9D',
                transform: [{ rotate: `${angle}rad` }],
                transformOrigin: 'left center',
              }
            ]}
          />
        );
      })}
    </View>
  );
};

export default function IHHTSessionSimple() {
  const navigation = useNavigation();
  const route = useRoute();
  const { pulseOximeterData, isPulseOxConnected, startSession, endSession } = useBluetooth();
  
  // Get params from navigation
  const sessionId = route.params?.sessionId || SessionIdGenerator.generate('IHHT');
  const protocolConfig = route.params?.protocolConfig || {
    totalCycles: 5,
    hypoxicDuration: 7,
    hyperoxicDuration: 3,
    defaultAltitudeLevel: 6
  };
  const preSessionData = route.params?.preSessionData || null; // Get pre-session survey data
  
  // Session management state
  const [sessionInfo, setSessionInfo] = useState(null);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [totalElapsedTime, setTotalElapsedTime] = useState(0);
  const updateInterval = useRef(null);
  const adaptiveEngineRef = useRef(null);
  const hasShownTransitionInstruction = useRef(false);
  
  // UI state
  const [metrics, setMetrics] = useState({
    spo2: null,  // Start with null to show no data
    heartRate: null,  // Start with null to show no data
    dialLevel: protocolConfig.defaultAltitudeLevel || 6,
  });
  
  // Survey state
  const [showIntraSessionFeedback, setShowIntraSessionFeedback] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionFromLevel, setTransitionFromLevel] = useState(0);
  const [transitionToLevel, setTransitionToLevel] = useState(0);
  const [hasShownFeedbackForCycle, setHasShownFeedbackForCycle] = useState({});
  const [lastKnownCycle, setLastKnownCycle] = useState(0);

  // Session completion modal state
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [sessionCompletedData, setSessionCompletedData] = useState(null);

  // Pulse ox monitoring state
  const [isPulseOxStale, setIsPulseOxStale] = useState(false);
  const [showPulseOxWarning, setShowPulseOxWarning] = useState(false);
  const [showNoFingerWarning, setShowNoFingerWarning] = useState(false);
  const lastPulseOxUpdate = useRef(null);
  const pulseOxStaleTimer = useRef(null);
  const connectionCooldown = useRef(null); // Track when device first connected
  const hasReceivedValidData = useRef(false); // Track if we've ever received valid data
  const lastValidSpo2 = useRef(null); // Track last valid SpO2 to detect cached values
  const lastValidHeartRate = useRef(null); // Track last valid HR to detect cached values
  const sameValueCount = useRef(0); // Track how many times we get the same values

  // Adaptive instruction state
  const [adaptiveInstruction, setAdaptiveInstruction] = useState(null);
  const [showAdaptiveInstruction, setShowAdaptiveInstruction] = useState(false);
  const pendingInstructions = useRef([]); // Queue for pending instructions
  const pendingDialAdjustment = useRef(null); // Store dial adjustment to show after switch masks
  
  // Helper function to show notification with buzz and fade-in
  const showNotificationWithAnimation = (instruction) => {
    
    // Set the instruction first
    setAdaptiveInstruction(instruction);
    setShowAdaptiveInstruction(true);
    
    // Start with opacity 0 for fade-in effect
    notificationOpacity.setValue(0);
    
    // Trigger double buzz
    if (Haptics) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setTimeout(() => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }, 200);
    }
    
    // After buzzes complete, fade in the notification
    setTimeout(() => {
      Animated.timing(notificationOpacity, {
        toValue: 1,
        duration: 500, // Half second fade-in
        useNativeDriver: true,
      }).start();
    }, 400); // Wait for double buzz to complete
  };
  
  // Status animation
  const glowAnim = useRef(new Animated.Value(0.6)).current;
  
  // Notification fade-in animation
  const notificationOpacity = useRef(new Animated.Value(0)).current;
  
  // Get status based on SpO2 and phase
  const getStatus = () => {
    if (!sessionInfo) return 'ADAPTING';
    if (sessionInfo.currentPhase === 'RECOVERY') return 'RECOVERING';
    if (metrics.spo2 <= 83) return 'STRESSING';
    return 'ADAPTING';
  };
  
  const getStatusColor = () => {
    const status = getStatus();
    if (status === 'STRESSING') return '#FFA500'; // Orange for stressing
    if (status === 'RECOVERING') return '#4ADE80'; // Green for recovering
    return '#4ADE80'; // Green for adapting
  };
  
  // Initialize session on mount
  useEffect(() => {
    // CRITICAL: Prevent duplicate initialization in React StrictMode or double renders
    let isInitializing = false;
    let isCancelled = false;
    
    const initSession = async () => {
      if (isInitializing) {
        return;
      }
      
      isInitializing = true;
      
      try {
        console.log('Starting session initialization:', {
          sessionId,
          protocolConfig,
          timestamp: new Date().toISOString()
        });
        
        // Initialize database
        await DatabaseService.init();
        
        // Initialize adaptive engine
        adaptiveEngineRef.current = new AdaptiveInstructionEngine();
        
        // Set up adaptive instruction callback
        EnhancedSessionManager.setAdaptiveInstructionCallback(handleAdaptiveInstruction);
        
        // Check if there's already an active session and clean it up
        if (EnhancedSessionManager.isActive) {
          await EnhancedSessionManager.endSession();
          // Also end mock BLE session
          if (endSession) {
            endSession();
          }
          // Wait a moment for cleanup to complete
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // CRITICAL: Check if cancelled before starting session
        if (isCancelled) {
          return;
        }
        
        // Start session with EnhancedSessionManager
        // Ensure durations are correctly set in seconds
        // Handle both manualAltitudeLevel (from SimplifiedSessionSetup) and defaultAltitudeLevel (legacy)
        const altitudeLevel = protocolConfig.manualAltitudeLevel || protocolConfig.defaultAltitudeLevel || 6;
        console.log('Altitude levels:', {
          manual: protocolConfig.manualAltitudeLevel,
          default: protocolConfig.defaultAltitudeLevel
        });
        
        await EnhancedSessionManager.startSession(sessionId, {
          totalCycles: protocolConfig.totalCycles || 5,
          altitudeDuration: (protocolConfig.hypoxicDuration || 7) * 60,  // 7 minutes = 420 seconds
          recoveryDuration: (protocolConfig.hyperoxicDuration || 3) * 60, // 3 minutes = 180 seconds
          hypoxicDuration: (protocolConfig.hypoxicDuration || 7) * 60,   // Also set old naming for compatibility
          hyperoxicDuration: (protocolConfig.hyperoxicDuration || 3) * 60,
          defaultAltitudeLevel: altitudeLevel
        });
        
        if (!isCancelled) {
          setSessionStarted(true);
          setIsInitializing(false);
          
          // Save pre-session survey data if provided
          if (preSessionData) {
            try {
              // Save to local database
              await DatabaseService.savePreSessionSurvey(
                sessionId,
                preSessionData.clarity,
                preSessionData.energy,
                preSessionData.stress
              );
              
              // Sync to Supabase
              await SupabaseService.syncPreSessionSurvey(
                sessionId,
                preSessionData.clarity,
                preSessionData.energy,
                preSessionData.stress
              );
              
            } catch (error) {
              // Continue anyway - don't block session start
            }
          }
          
          // Start mock BLE session for data generation (only for mock environments)
          // Check if we're actually using mock service before calling these methods
          const isUsingMock = Constants.appOwnership === 'expo' || process.env.EXPO_PUBLIC_USE_MOCK_BLE === 'true';
          if (isUsingMock && startSession) {
            console.log('📱 Starting mock BLE session (Expo Go environment)');
            startSession();
          }
        }
        
        // Keep screen awake
        activateKeepAwakeAsync();
        
      } catch (error) {
        setIsInitializing(false);
        console.error('❌ Session initialization error:', error);

        // Ensure session manager is reset on error
        try {
          if (EnhancedSessionManager.isActive) {
            await EnhancedSessionManager.endSession();
            // Also end mock BLE session (only for mock environments)
            const isUsingMock = Constants.appOwnership === 'expo' || process.env.EXPO_PUBLIC_USE_MOCK_BLE === 'true';
            if (isUsingMock && endSession) {
              endSession();
            }
          }
        } catch (cleanupError) {
          console.error('⚠️ Cleanup error:', cleanupError);
        }

        // Provide specific error message based on the error
        let errorTitle = 'Session Start Failed';
        let errorMessage = 'Unable to start the session. ';

        if (error.message) {
          if (error.message.includes('Network connection')) {
            errorMessage = error.message;
          } else if (error.message.includes('Bluetooth')) {
            errorMessage = error.message;
          } else if (error.message.includes('initialize')) {
            errorMessage = error.message;
          } else {
            errorMessage += error.message;
          }
        } else {
          errorMessage += 'Please ensure your device is connected and try again.';
        }

        Alert.alert(
          errorTitle,
          errorMessage,
          [
            {
              text: 'Try Again',
              onPress: () => {
                // Reset and try to restart
                setIsInitializing(true);
                initSession();
              }
            },
            {
              text: 'Go Back',
              onPress: () => navigation.replace('MainTabs'),
              style: 'cancel'
            }
          ]
        );
      }
    };
    
    initSession();
    
    return () => {
      // Cleanup - mark as cancelled to prevent race conditions
      isCancelled = true;
      deactivateKeepAwake();
      if (updateInterval.current) {
        clearInterval(updateInterval.current);
      }
      
      // CRITICAL: Properly end session if component unmounts
      if (EnhancedSessionManager.isActive) {
        EnhancedSessionManager.endSession().catch(error => {
        });
        // Removed mock session code - we only use real device data
      }
    };
  }, []);
  
  // Listen to session updates
  useEffect(() => {
    if (sessionStarted) {
      // Poll for session info every second
      updateInterval.current = setInterval(() => {
        try {
          const info = EnhancedSessionManager.getSessionInfo();
          if (info) {
            setSessionInfo(info);
            
            // Sync total elapsed time with actual session time
            if (info.sessionStartTime) {
              const actualElapsed = Math.floor((Date.now() - new Date(info.sessionStartTime).getTime()) / 1000);
              setTotalElapsedTime(actualElapsed);
            }
            
            // Check for transition phase
            if (info.currentPhase === 'TRANSITION') {
              if (!isTransitioning && !hasShownTransitionInstruction.current) {
                // Starting transition - determine direction based on what's next
                // If we have a nextPhaseAfterTransition, use that to determine direction
                const isGoingToRecovery = info.nextPhaseAfterTransition === 'RECOVERY';
                
                // Check if we have a pending dial adjustment to apply to the altitude level
                let adjustedLevel = info.currentAltitudeLevel || metrics.dialLevel;
                if (pendingDialAdjustment.current && !isGoingToRecovery) {
                  // Apply the pending dial adjustment to the altitude level
                  adjustedLevel = pendingDialAdjustment.current.newLevel || adjustedLevel;
                }
                
                const fromLevel = isGoingToRecovery ? adjustedLevel : 0;
                const toLevel = isGoingToRecovery ? 0 : adjustedLevel;
                
                // Mark that we've shown the instruction for this transition
                hasShownTransitionInstruction.current = true;
                
                // Show Switch Masks instruction
                const instruction = {
                  type: 'SWITCH_MASKS',
                  title: isGoingToRecovery ? '🔵 Switch to Recovery' : '🔴 Switch to Altitude',
                  message: isGoingToRecovery ? 
                    'Remove mask and breathe normally' : 
                    'Put on mask and continue breathing',
                  priority: 'high',
                  countdown: 5
                };
                
                showNotificationWithAnimation(instruction);
                
                
                // Store transition details but don't start animation yet
                setTransitionFromLevel(fromLevel);
                setTransitionToLevel(toLevel);
                // Don't set isTransitioning yet - wait for user confirmation
              }
            } else if (info.currentPhase !== 'TRANSITION') {
              // Phase changed away from transition - reset the flag
              if (hasShownTransitionInstruction.current) {
                hasShownTransitionInstruction.current = false;
              }
              
              if (isTransitioning) {
                // Transition animation ended
                setIsTransitioning(false);
              }
            }
            
            // Check if session completed
            if (info.currentPhase === 'COMPLETED' || !info.isActive) {
              handleSessionComplete();
            }
          }
        } catch (error) {
        }
      }, 1000);
      
      return () => {
        if (updateInterval.current) {
          clearInterval(updateInterval.current);
          updateInterval.current = null;
        }
      };
    }
    
    // Cleanup on unmount
    return () => {
      if (updateInterval.current) {
        clearInterval(updateInterval.current);
        updateInterval.current = null;
      }
    };
  }, [sessionStarted]);
  
  // Update metrics with real or simulated data
  useEffect(() => {
    // CRITICAL: Only process data if session is actually started
    if (!sessionStarted || !sessionInfo?.isActive) {
      return;
    }

    const now = Date.now();

    // Use real data when available
    console.log('🔍 Debug - Pulse Ox Status:', {
      isPulseOxConnected,
      pulseOximeterData,
      hasData: !!pulseOximeterData,
      spo2: pulseOximeterData?.spo2,
      heartRate: pulseOximeterData?.heartRate,
      isFingerDetected: pulseOximeterData?.isFingerDetected,
      currentMetrics: metrics,
      lastUpdate: lastPulseOxUpdate.current,
      timeSinceLastUpdate: lastPulseOxUpdate.current ? now - lastPulseOxUpdate.current : null
    });

    if (isPulseOxConnected && pulseOximeterData) {
      // Initialize connection tracking if needed
      if (!connectionCooldown.current) {
        connectionCooldown.current = Date.now();

        // Only block if we detect the known cached values (99/72)
        const isCachedValue = pulseOximeterData.spo2 === 99 && pulseOximeterData.heartRate === 72;

        if (isCachedValue) {
          console.log('🔌 Detected cached values (99/72) - blocking for 1 second');

          // Store these as cached values to track
          lastValidSpo2.current = pulseOximeterData.spo2;
          lastValidHeartRate.current = pulseOximeterData.heartRate;

          // Clear metrics and exit
          setMetrics(prev => ({
            ...prev,
            spo2: null,
            heartRate: null,
            dialLevel: sessionInfo?.currentAltitudeLevel || prev.dialLevel
          }));

          return;
        } else if (pulseOximeterData.isFingerDetected) {
          // We have real data right away! Use it immediately
          console.log('✅ Real data detected immediately:', {
            spo2: pulseOximeterData.spo2,
            heartRate: pulseOximeterData.heartRate
          });

          // Mark that we have valid data
          hasReceivedValidData.current = true;
          lastValidSpo2.current = pulseOximeterData.spo2;
          lastValidHeartRate.current = pulseOximeterData.heartRate;
        }
      }

      const timeSinceConnection = Date.now() - connectionCooldown.current;

      // CRITICAL: Check if finger is actually detected by the device
      const isFingerOnDevice = pulseOximeterData.isFingerDetected === true;

      // Only check for cached 99/72 values specifically
      const isKnownCachedValue = pulseOximeterData.spo2 === 99 && pulseOximeterData.heartRate === 72;

      // Values haven't changed from 99/72 cached values
      const valuesUnchanged = isKnownCachedValue && !hasReceivedValidData.current && timeSinceConnection < 1000;

      // Very short cooldown - only for actual cached values
      const isInCooldownPeriod = isKnownCachedValue && timeSinceConnection < 1000;

      console.log('📊 Pulse ox validation:', {
        isFingerOnDevice,
        timeSinceConnection,
        isKnownCachedValue,
        valuesUnchanged,
        isInCooldownPeriod,
        currentValues: { spo2: pulseOximeterData.spo2, hr: pulseOximeterData.heartRate },
        hasReceivedValidData: hasReceivedValidData.current
      });

      // MINIMAL BLOCKING: Only block if no finger or known cached values
      const shouldBlockData =
        !isFingerOnDevice || // No finger on device
        valuesUnchanged; // Still showing 99/72 cached values

      // During cooldown, if no finger detected, or if we detect cached values, clear values
      if (shouldBlockData) {
        // Show appropriate warning - ONLY if session is still active
        if (!isFingerOnDevice && !isInCooldownPeriod && sessionStarted) {
          console.log('👆 No finger detected on pulse ox device');
          if (!showNoFingerWarning) {
            setShowNoFingerWarning(true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          }
        } else if (valuesUnchanged) {
          console.log('🚫 Detected cached values (99/72), waiting for real data');
        }

        // Clear metrics to show dashes
        setMetrics(prev => ({
          ...prev,
          spo2: null,
          heartRate: null,
          dialLevel: sessionInfo?.currentAltitudeLevel || prev.dialLevel
        }));

        // Clear any stale timer
        if (pulseOxStaleTimer.current) {
          clearTimeout(pulseOxStaleTimer.current);
        }

        return; // Exit early - no need to process further
      }

      // Finger IS detected - clear no-finger warning
      if (showNoFingerWarning) {
        setShowNoFingerWarning(false);
      }

      // Check if we have valid readings - ONLY if finger is detected
      const hasValidReadings = isFingerOnDevice &&  // Must have finger on device
                              pulseOximeterData.spo2 &&
                              pulseOximeterData.heartRate &&
                              pulseOximeterData.spo2 > 0 &&
                              pulseOximeterData.spo2 <= 100 &&
                              pulseOximeterData.heartRate > 0 &&
                              pulseOximeterData.heartRate <= 250 &&
                              // Only block 99/72 if we haven't seen other data yet
                              (hasReceivedValidData.current || !(pulseOximeterData.spo2 === 99 && pulseOximeterData.heartRate === 72));

      if (hasValidReadings) {
        // Always update when we have valid data to ensure real-time display
        const isNewData = !lastPulseOxUpdate.current ||
                         pulseOximeterData.timestamp !== lastPulseOxUpdate.current ||
                         Date.now() - lastPulseOxUpdate.current > 200; // Force update every 200ms

        if (isNewData) {
          // Fresh data received - update metrics
          lastPulseOxUpdate.current = now;
          setIsPulseOxStale(false);
          setShowPulseOxWarning(false);

          // Clear any existing stale timer
          if (pulseOxStaleTimer.current) {
            clearTimeout(pulseOxStaleTimer.current);
          }

          // Set new timer to detect stale data (5 seconds without update means pulse ox is likely off finger)
          pulseOxStaleTimer.current = setTimeout(() => {
            // Only show warning if session is still active
            if (sessionStarted) {
              console.log('⚠️ Pulse ox data is stale - likely removed from finger');
              setIsPulseOxStale(true);
              setShowPulseOxWarning(true);

              // Haptic feedback to alert user
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            }

            // Clear metrics to show dashes
            setMetrics(prev => ({
              ...prev,
              spo2: null,
              heartRate: null,
              dialLevel: sessionInfo?.currentAltitudeLevel || prev.dialLevel
            }));
          }, 5000);

          const newMetrics = {
            spo2: pulseOximeterData.spo2,
            heartRate: pulseOximeterData.heartRate,
            dialLevel: sessionInfo?.currentAltitudeLevel || metrics.dialLevel
          };

          console.log('📊 Updating metrics with fresh data:', newMetrics);
          console.log('🎯 Current device data:', {
            rawSpo2: pulseOximeterData.spo2,
            rawHR: pulseOximeterData.heartRate,
            fingerDetected: pulseOximeterData.isFingerDetected
          });
          // Mark that we've received valid data
          hasReceivedValidData.current = true;
          lastValidSpo2.current = pulseOximeterData.spo2;
          lastValidHeartRate.current = pulseOximeterData.heartRate;

          setMetrics(newMetrics);

          // CRITICAL: Only send to manager if session is truly active
          if (EnhancedSessionManager.isActive) {
            EnhancedSessionManager.addReading({
              spo2: pulseOximeterData.spo2,
              heartRate: pulseOximeterData.heartRate,
              timestamp: now
            });
          }
        }
      } else {
        // Finger detected but readings not valid yet (might be searching for pulse)
        console.log('⏳ Finger detected, waiting for valid readings...');
        setMetrics(prev => ({
          ...prev,
          spo2: null,
          heartRate: null,
          dialLevel: sessionInfo?.currentAltitudeLevel || prev.dialLevel
        }));
      }
    } else if (isPulseOxConnected && !pulseOximeterData) {
      // Connected but no data at all yet
      console.log('⏳ Pulse ox connected, waiting for initial data...');
      if (!showNoFingerWarning && sessionStarted) {
        setShowNoFingerWarning(true);
      }
      setMetrics(prev => ({
        ...prev,
        spo2: null,
        heartRate: null,
        dialLevel: sessionInfo?.currentAltitudeLevel || prev.dialLevel
      }));
    } else {
      // No pulse ox connected - show null values and reset connection tracking
      console.log('❌ No pulse ox connected - showing no data');

      // Reset connection tracking for next connection
      connectionCooldown.current = null;
      hasReceivedValidData.current = false;
      lastValidSpo2.current = null;
      lastValidHeartRate.current = null;
      sameValueCount.current = 0;

      setMetrics(prev => ({
        ...prev,
        spo2: null,
        heartRate: null,
        dialLevel: sessionInfo?.currentAltitudeLevel || prev.dialLevel
      }));
    }
  }, [pulseOximeterData, isPulseOxConnected, sessionStarted, sessionInfo, showNoFingerWarning, showPulseOxWarning]);

  // Cleanup stale timer on unmount
  useEffect(() => {
    return () => {
      if (pulseOxStaleTimer.current) {
        clearTimeout(pulseOxStaleTimer.current);
      }
    };
  }, []);
  
  // Removed simulateMetrics - real users should see null/dashes when no data is available
  
  // Check for intra-session survey triggers
  useEffect(() => {
    if (!sessionInfo || !sessionStarted) return;
    
    // Check for cycle transitions (altitude → recovery)
    if (sessionInfo.currentPhase === 'RECOVERY' && 
        sessionInfo.currentCycle !== lastKnownCycle) {
      
      const cycleKey = `cycle_${sessionInfo.currentCycle}`;
      
      if (!hasShownFeedbackForCycle[cycleKey] && !showIntraSessionFeedback) {
        // Delay showing feedback by 3 seconds into recovery
        setTimeout(() => {
          setShowIntraSessionFeedback(true);
          setHasShownFeedbackForCycle(prev => ({
            ...prev,
            [cycleKey]: true
          }));
        }, 3000);
      }
      
      setLastKnownCycle(sessionInfo.currentCycle);
    }
  }, [sessionInfo?.currentPhase, sessionInfo?.currentCycle]);
  
  // Process next instruction from queue
  const processNextInstruction = () => {
    if (pendingInstructions.current.length > 0 && !showAdaptiveInstruction) {
      const nextInstruction = pendingInstructions.current.shift();
      handleAdaptiveInstruction(nextInstruction, true); // true = from queue
    }
  };

  // Handle adaptive instructions
  const handleAdaptiveInstruction = (instruction, fromQueue = false) => {
    
    // Special handling for dial adjustments during transitions
    if ((instruction.type === 'dial_adjustment' || instruction.type === 'altitude_adjustment') && 
        instruction.showDuringTransition && !fromQueue) {
      pendingDialAdjustment.current = instruction;
      return; // Don't show it yet
    }
    
    // If we're already showing an instruction and this is a dial adjustment, queue it
    if (!fromQueue && showAdaptiveInstruction && 
        (instruction.type === 'dial_adjustment' || instruction.type === 'altitude_adjustment')) {
      pendingInstructions.current.push(instruction);
      return;
    }
    
    // Format instruction with title and message if not already formatted
    let formattedInstruction = { ...instruction };
    
    if (instruction.type === 'mask_lift') {
      formattedInstruction.title = instruction.title || 'Mask Lift Required';
      if (!formattedInstruction.message) {
        formattedInstruction.message = instruction.message || 'Lift mask 1mm, small breath';
      }
    } else if (instruction.type === 'mask_remove') {
      // Emergency mask removal
      formattedInstruction.title = instruction.title || 'Remove Mask Immediately';
      formattedInstruction.type = 'mask_remove';
      if (!formattedInstruction.message) {
        formattedInstruction.message = instruction.message || 'Take off your mask completely';
      }
    } else if (instruction.type === 'mask_switch') {
      // Mask switch instruction (for transitions)
      formattedInstruction.title = instruction.title || 'Switch Your Mask Now';
      if (!formattedInstruction.message) {
        formattedInstruction.message = instruction.message || 'Switch masks for next phase';
      }
    } else if (instruction.type === 'dial_adjustment' || instruction.type === 'altitude_adjustment') {
      formattedInstruction.title = 'Dial Adjustment';
      formattedInstruction.type = 'dial_adjustment'; // Standardize type
      if (!formattedInstruction.message) {
        if (instruction.adjustment > 0) {
          formattedInstruction.message = `Increase dial to level ${instruction.newLevel}`;
        } else if (instruction.adjustment < 0) {
          formattedInstruction.message = `Decrease dial to level ${instruction.newLevel}`;
        } else {
          formattedInstruction.message = instruction.message || 'Adjust dial as needed';
        }
      }
      
      // Actually update the dial level when adjustment is made
      if (instruction.newLevel !== undefined) {
        setMetrics(prev => ({
          ...prev,
          dialLevel: instruction.newLevel
        }));
      }
    }
    
    // Use the animation function for all notifications
    showNotificationWithAnimation(formattedInstruction);
    
    // Auto-dismiss after 10 seconds for mask lift, no auto-dismiss for dial adjustments
    if (instruction.type === 'mask_lift') {
      setTimeout(() => {
        setShowAdaptiveInstruction(false);
      }, 10000);
    }
  };
  
  // Handle device disconnection and app state changes
  useEffect(() => {
    if (sessionStarted && !isPulseOxConnected) {
      // Only show warning once
      if (!sessionInfo?.isPaused) {
        Alert.alert(
          'Device Disconnected',
          'Pulse oximeter connection lost. Continuing in demo mode.',
          [
            { text: 'OK' }
          ]
        );
      }
    }
  }, [isPulseOxConnected, sessionStarted]);
  
  // Handle app state changes to sync timers and clean up sessions
  useEffect(() => {
    const handleAppStateChange = async (nextAppState) => {
      
      if (nextAppState === 'active' && sessionStarted) {
        // App came to foreground - sync timers with background state
        const info = EnhancedSessionManager.getSessionInfo();
        if (info && info.sessionStartTime) {
          const actualElapsed = Math.floor((Date.now() - new Date(info.sessionStartTime).getTime()) / 1000);
          setTotalElapsedTime(actualElapsed);
        }
        
        // Force a session info update to refresh all timers
        const currentInfo = EnhancedSessionManager.getSessionInfo();
        if (currentInfo) {
          setSessionInfo(currentInfo);
        }
      }
      // DO NOT pause when going to background - let it keep running
    };
    
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [sessionStarted]);
  
  // Glow animation for status
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.5,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);
  
  // Survey handlers
  const handleIntraSessionSubmit = async (feedbackData) => {
    try {
      await DatabaseService.saveIntraSessionResponse(
        sessionId,
        sessionInfo.currentCycle,
        feedbackData.clarity,
        feedbackData.energy,
        feedbackData.stressPerception,
        Date.now(),
        feedbackData.sensations,
        metrics.spo2,
        metrics.heartRate
      );
      
    } catch (error) {
    }
    
    setShowIntraSessionFeedback(false);
  };
  
  const handleIntraSessionDismiss = () => {
    setShowIntraSessionFeedback(false);
  };
  
  // Session complete handler
  const handleSessionComplete = async () => {
    // Prevent multiple calls and stop data collection
    if (updateInterval.current) {
      clearInterval(updateInterval.current);
      updateInterval.current = null;
    }

    // Clear any pulse ox warnings immediately
    setShowPulseOxWarning(false);
    setShowNoFingerWarning(false);
    setIsPulseOxStale(false);

    // Clear pulse ox stale timer
    if (pulseOxStaleTimer.current) {
      clearTimeout(pulseOxStaleTimer.current);
      pulseOxStaleTimer.current = null;
    }

    // Mark session as ended to prevent further data processing
    setSessionStarted(false);
    
    try {
      console.log('📊 Session completed, starting cleanup...');

      // Give a moment for any pending operations to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // End session in manager
      console.log('📊 Ending session in EnhancedSessionManager...');
      const sessionInfo = await EnhancedSessionManager.endSession();
      console.log('📊 Session ended:', sessionInfo);

      // End mock BLE session (only for mock environments)
      const isUsingMock = Constants.appOwnership === 'expo' || process.env.EXPO_PUBLIC_USE_MOCK_BLE === 'true';
      if (isUsingMock && endSession) {
        console.log('📊 Ending mock BLE session...');
        endSession();
      }

      // Deactivate keep awake
      try {
        await deactivateKeepAwake();
        console.log('📊 Keep awake deactivated');
      } catch (keepAwakeError) {
        console.warn('⚠️ Failed to deactivate keep awake:', keepAwakeError);
      }

      // Store session data and show completion modal
      console.log('📊 Session info received from EnhancedSessionManager:', {
        sessionInfo,
        hasSessionInfo: !!sessionInfo,
        duration: sessionInfo?.duration,
        cycles: sessionInfo?.cycles,
        sessionId: sessionInfo?.sessionId
      });

      setSessionCompletedData(sessionInfo);
      setShowCompletionModal(true);
      console.log('📊 Showing session completion modal with data:', sessionInfo);
    } catch (error) {
    }
  };

  // Handle completion modal button press
  const handleCompletionModalContinue = () => {
    try {
      console.log('🔄 Attempting to navigate to PostSessionSurvey with:', {
        sessionId,
        sessionType: 'IHHT_TRAINING',
        navigationAvailable: !!navigation,
        navigationType: typeof navigation
      });

      setShowCompletionModal(false);

      // Navigate to post-session survey - use navigate instead of replace
      if (navigation && navigation.navigate) {
        navigation.navigate('PostSessionSurvey', {
          sessionId: sessionId || `session_${Date.now()}`,
          sessionType: 'IHHT_TRAINING'
        });
      } else {
        console.error('❌ Navigation object not available');
        Alert.alert('Error', 'Unable to navigate to survey. Please try again.');
      }
    } catch (error) {
      console.error('❌ Error navigating to PostSessionSurvey:', error);
      Alert.alert('Error', 'Failed to navigate to survey. Please try again.');
    }
  };

  // Control handlers
  const handlePauseResume = () => {
    if (sessionInfo?.isPaused) {
      EnhancedSessionManager.resumeSession();
    } else {
      EnhancedSessionManager.pauseSession();
    }
  };
  
  const handleStop = () => {
    // Ensure we have navigation before showing alert
    if (!navigation) {
      console.error('❌ Navigation object is not available');
      return;
    }

    Alert.alert(
      'End Session?',
      'Are you sure you want to end this session?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Session',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('📊 User confirmed ending session');

              // Stop data collection first
              if (updateInterval.current) {
                clearInterval(updateInterval.current);
                updateInterval.current = null;
              }

              // Mark session as ended
              setSessionStarted(false);

              // End the session with proper error handling
              console.log('📊 Calling EnhancedSessionManager.endSession()...');
              const sessionInfo = await EnhancedSessionManager.endSession();
              console.log('📊 Session ended successfully:', sessionInfo);

              // End mock BLE session (only for mock environments)
              const isUsingMock = Constants.appOwnership === 'expo' || process.env.EXPO_PUBLIC_USE_MOCK_BLE === 'true';
              if (isUsingMock && endSession) {
                console.log('📊 Ending mock BLE session...');
                try {
                  endSession();
                } catch (bleError) {
                  console.warn('⚠️ Failed to end BLE session:', bleError);
                }
              }

              // Deactivate keep awake
              try {
                await deactivateKeepAwake();
                console.log('📊 Keep awake deactivated');
              } catch (keepAwakeError) {
                console.warn('⚠️ Failed to deactivate keep awake:', keepAwakeError);
              }

              // Use setTimeout to ensure cleanup is complete before navigation
              setTimeout(() => {
                try {
                  console.log('📊 Navigating back to MainTabs');
                  // Check navigation is still valid
                  if (navigation && navigation.navigate) {
                    navigation.navigate('MainTabs');
                  } else {
                    console.error('❌ Navigation object is invalid');
                  }
                } catch (navError) {
                  console.error('❌ Navigation error:', navError);
                }
              }, 100);

            } catch (error) {
              console.error('❌ Error ending session:', error);
              console.error('Error stack:', error.stack);

              // Show error alert but still try to navigate away
              Alert.alert(
                'Error Ending Session',
                'There was an error ending the session. The app will return to the main screen.',
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      try {
                        // Still navigate away even if there was an error
                        if (navigation && navigation.navigate) {
                          navigation.navigate('MainTabs');
                        }
                      } catch (navError) {
                        console.error('❌ Error navigating after error:', navError);
                      }
                    }
                  }
                ]
              );
            }
          }
        }
      ]
    );
  };
  
  
  // Get altitude data - show 0 during recovery phase
  const displayAltitudeLevel = sessionInfo?.phaseType === 'RECOVERY' ? 0 : metrics.dialLevel;
  const altitudeData = ALTITUDE_CONVERSION[displayAltitudeLevel] || ALTITUDE_CONVERSION[6];
  
  // Loading state
  if (isInitializing || !sessionInfo) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={styles.loadingText}>Initializing Session...</Text>
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.cycleText}>
            CYCLE {sessionInfo?.currentCycle || 1}/{protocolConfig.totalCycles}
          </Text>
          <Text style={styles.totalTime}>
            {formatTime(totalElapsedTime)}
          </Text>
          {/* Testing Mode Badge - Only show in Expo Go */}
          {Constants.appOwnership === 'expo' && (
            <Text style={styles.testingBadgeText}>🧪 TESTING MODE</Text>
          )}
        </View>
        <TouchableOpacity onPress={handleStop} style={styles.closeButton}>
          <Icon name="close" size={24} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>
      </View>
      
      {/* Phase Section */}
      <View style={styles.phaseSection}>
        <Text style={styles.phaseLabel}>
          {sessionInfo?.currentPhase || 'ALTITUDE'}
        </Text>
        <Text style={styles.phaseTimer}>
          {formatTime(sessionInfo?.phaseTimeRemaining || 0)}
        </Text>
      </View>
      
      {/* Diamond Metrics Layout */}
      <View style={styles.diamondContainer}>
        {/* Top/Center - SpO2 */}
        <View style={styles.diamondTop}>
          <Text style={[
            styles.spo2Value,
            { color: !metrics.spo2 ? '#6B7280' : (metrics.spo2 > 90 ? '#4ADE80' : (metrics.spo2 > 85 ? '#FFA500' : '#FF6B6B')) }
          ]}>
            {metrics.spo2 !== null && metrics.spo2 !== undefined ? Math.round(metrics.spo2) : '--'}
          </Text>
          <Text style={styles.spo2Label}>SpO₂</Text>
        </View>
        
        {/* Left - Altitude */}
        {isTransitioning ? (
          <View style={styles.diamondLeft}>
            <AltitudeSlotMachine
              fromLevel={transitionFromLevel}
              toLevel={transitionToLevel}
              duration={3000}
              isActive={isTransitioning}
              onComplete={() => {
              }}
            />
          </View>
        ) : (
          <View style={styles.diamondLeft}>
            <Text style={styles.altitudeValue}>
              {altitudeData.altitude.toLocaleString()}
            </Text>
            <Text style={styles.altitudeUnit}>ft</Text>
            <Text style={styles.altitudeMeters}>
              {altitudeData.meters.toLocaleString()}m
            </Text>
          </View>
        )}
        
        {/* Right - Heart Rate */}
        <View style={styles.diamondRight}>
          <Text style={[styles.heartRateValue, { color: !metrics.heartRate ? '#6B7280' : '#EC4899' }]}>
            {metrics.heartRate !== null && metrics.heartRate !== undefined ? metrics.heartRate : '--'}
          </Text>
          <Text style={styles.heartRateUnit}>bpm</Text>
          {metrics.heartRate && <EKGWave heartRate={metrics.heartRate} />}
        </View>
        
        {/* Bottom - Status */}
        <Animated.View 
          style={[
            styles.diamondBottom,
            { opacity: glowAnim }
          ]}
        >
          <Text style={[styles.statusText, { color: getStatusColor() }]}>
            {getStatus()}
          </Text>
        </Animated.View>
      </View>
      
      {/* Connection Status */}
      {!isPulseOxConnected && (
        <View style={styles.connectionWarning}>
          <Icon name="bluetooth-off" size={16} color="#FFA500" />
          <Text style={styles.warningText}>Pulse Ox Not Connected</Text>
        </View>
      )}

      {/* Pulse Ox Warning - Combined for removed or no finger */}
      {isPulseOxConnected && (showPulseOxWarning || showNoFingerWarning) && (
        <Animated.View
          style={[
            styles.pulseOxWarning,
            { opacity: glowAnim }
          ]}
        >
          <Icon name="alert-circle" size={20} color="#FF6B6B" />
          <Text style={styles.pulseOxWarningText}>
            {showNoFingerWarning ? 'Please place pulse ox on finger' : 'Pulse ox removed - Please place on finger'}
          </Text>
        </Animated.View>
      )}
      
      {/* Bottom Controls */}
      <View style={styles.controls}>
        {/* Left side - Feedback button (replacing any cycle text) */}
        <TouchableOpacity 
          style={styles.feedbackButton}
          onPress={() => {
            setShowIntraSessionFeedback(true);
          }}
        >
          <Icon name="message" size={20} color="#FFF" />
          <Text style={styles.feedbackButtonText}>Feedback</Text>
        </TouchableOpacity>

        {/* Right side - Control buttons */}
        <View style={styles.buttons}>
          <TouchableOpacity 
            style={styles.button}
            onPress={handlePauseResume}
          >
            <Icon 
              name={sessionInfo?.isPaused ? 'play' : 'pause'} 
              size={24} 
              color="#FFF" 
            />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.button, styles.skipButton]}
            onPress={() => {
              // Skip to next phase
              if (EnhancedSessionManager.skipToNextPhase) {
                EnhancedSessionManager.skipToNextPhase();
              }
            }}
          >
            <Icon name="skip-forward" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Adaptive Instruction Overlay */}
      {showAdaptiveInstruction && adaptiveInstruction && (
        <Animated.View style={[styles.adaptiveInstructionOverlay, { opacity: notificationOpacity }]}>
          <View style={styles.instructionCard}>
            <Icon 
              name={
                adaptiveInstruction.type === 'mask_lift' ? 'air' : 
                adaptiveInstruction.type === 'mask_remove' ? 'warning' :
                adaptiveInstruction.type === 'mask_switch' ? 'swap-horiz' :
                'trending-up'
              } 
              size={24} 
              color={adaptiveInstruction.type === 'mask_remove' ? '#FF6B6B' : '#60A5FA'} 
            />
            <Text style={styles.instructionTitle}>
              {adaptiveInstruction.title}
            </Text>
            <Text style={styles.instructionMessage}>
              {adaptiveInstruction.message}
            </Text>
            <TouchableOpacity 
              onPress={() => {
                // If this is a dial adjustment, confirm it with the engine
                if (adaptiveInstruction.type === 'dial_adjustment' && adaptiveInstruction.newLevel !== undefined) {
                  EnhancedSessionManager.confirmDialAdjustment(adaptiveInstruction.newLevel);
                }
                
                // If this is a switch masks instruction, check for dial adjustment first
                if (adaptiveInstruction.type === 'SWITCH_MASKS') {
                  
                  // Check if there's a pending dial adjustment to show FIRST
                  if (pendingDialAdjustment.current) {
                    const dialInstruction = pendingDialAdjustment.current;
                    pendingDialAdjustment.current = null;
                    
                    // Show dial adjustment immediately
                    setTimeout(() => {
                      handleAdaptiveInstruction(dialInstruction, true); // Pass true to bypass the check
                    }, 500);
                  } else {
                    // No dial adjustment, start animation immediately
                    setTimeout(() => {
                      setIsTransitioning(true);
                    }, 500);
                  }
                }
                
                // If this is a dial adjustment confirmation, do NOT start animation yet
                // The animation should only start with the switch masks confirmation
                if (adaptiveInstruction.type === 'dial_adjustment') {
                  // Do NOT start the animation here - let the switch masks trigger it
                }
                
                setShowAdaptiveInstruction(false);
                
                // Process next instruction from queue after a short delay
                setTimeout(() => {
                  processNextInstruction();
                }, 500);
              }}
              style={styles.dismissButton}
            >
              <Text style={styles.dismissText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
      
      {/* Intra-Session Feedback */}
      <IntraSessionFeedback
        visible={showIntraSessionFeedback}
        onSubmit={handleIntraSessionSubmit}
        onDismiss={handleIntraSessionDismiss}
        cycleNumber={sessionInfo?.currentCycle}
        currentSpo2={metrics.spo2}
        currentHR={metrics.heartRate}
      />

      {/* Session Completion Modal */}
      <Modal
        visible={showCompletionModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => {}}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.completionModal}>
            <Icon name="check-circle" size={60} color="#10B981" style={styles.completionIcon} />

            <Text style={styles.completionTitle}>Session Complete!</Text>

            <Text style={styles.completionMessage}>
              Great work! You've completed your IHHT training session.
            </Text>

            {sessionCompletedData && (
              <View style={styles.sessionStats}>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>Duration</Text>
                  <Text style={styles.statValue}>
                    {formatTime(Math.floor((sessionCompletedData.duration || 0) / 1000))}
                  </Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>Cycles Completed</Text>
                  <Text style={styles.statValue}>{sessionCompletedData.cycles || 0}</Text>
                </View>
              </View>
            )}

            <TouchableOpacity
              style={styles.completionButton}
              onPress={handleCompletionModalContinue}
              activeOpacity={0.8}
            >
              <Text style={styles.completionButtonText}>Continue to Survey</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0C0E12',
  },
  
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  loadingText: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.7)',
  },
  
  // Header styles
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  cycleText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 2,
    color: 'rgba(255,255,255,0.5)',
  },
  totalTime: {
    fontSize: 18,
    fontWeight: '300',
    color: '#FFF',
    marginTop: 4,
  },
  testingBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFD700',
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginTop: 5,
    letterSpacing: 1,
  },
  closeButton: {
    position: 'absolute',
    right: 20,
    top: 60,
    padding: 8,
  },
  
  // Phase section
  phaseSection: {
    alignItems: 'center',
    marginTop: 30,
    marginBottom: 40,
  },
  phaseLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 2,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 8,
  },
  phaseTimer: {
    fontSize: 72,
    fontWeight: '200',
    color: '#FFF',
    letterSpacing: -2,
  },
  
  // Diamond layout - Better symmetry and spacing
  diamondContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  
  diamondTop: {
    position: 'absolute',
    top: '5%',  // Moved higher for better visibility
    alignItems: 'center',
    zIndex: 10,
  },
  spo2Value: {
    fontSize: 140,  // Larger for prominence
    fontWeight: '200',
    letterSpacing: -5,
    lineHeight: 140,
  },
  spo2Label: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.6)',
    marginTop: -15,
    fontWeight: '500',
    letterSpacing: 1,
  },
  
  diamondLeft: {
    position: 'absolute',
    left: 20,
    top: '42%',  // Centered vertically
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 150,  // Ensure consistent width for alignment
  },
  altitudeValue: {
    fontSize: 42,
    fontWeight: '300',
    color: '#FFF',
    lineHeight: 42,
    textAlign: 'center',  // Center the text within its container
    minWidth: 150,  // Match parent width to prevent shifting
  },
  altitudeUnit: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
    fontWeight: '400',
  },
  altitudeMeters: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 4,
  },
  
  diamondRight: {
    position: 'absolute',
    right: 20,
    top: '42%',  // Matched with left for symmetry
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartRateValue: {
    fontSize: 42,
    fontWeight: '300',
    color: '#FF6B9D',
    lineHeight: 42,
  },
  heartRateUnit: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
    fontWeight: '400',
  },
  
  // EKG styles
  ekgContainer: {
    width: 120,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  ekgBaseline: {
    position: 'absolute',
    width: 120,
    height: 0.5,
    backgroundColor: '#FF6B9D',
    opacity: 0.15,
    top: 25,
  },
  ekgTrailPoint: {
    position: 'absolute',
    borderRadius: 2,
    top: 25,
  },
  ekgLine: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#FF6B9D',
  },
  ekgPeak: {
    width: 2,
    height: 20,
    backgroundColor: '#FF6B9D',
  },
  
  diamondBottom: {
    position: 'absolute',
    bottom: '15%',  // More space from bottom, better diamond proportion
    alignItems: 'center',
    zIndex: 10,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
  },
  
  // Connection warning
  connectionWarning: {
    position: 'absolute',
    top: 100,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 165, 0, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  warningText: {
    fontSize: 12,
    color: '#FFA500',
  },
  pulseOxWarning: {
    position: 'absolute',
    top: 100,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.3)',
    gap: 8,
  },
  pulseOxWarningText: {
    fontSize: 14,
    color: '#FF6B6B',
    fontWeight: '600',
  },
  
  // Controls
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between', // Changed to space-between for left/right positioning
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 20,
  },
  buttons: {
    flexDirection: 'row',
    gap: 15,
  },
  button: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  skipButton: {
    backgroundColor: 'rgba(96,165,250,0.2)', // Blue tint for skip/forward action
  },
  feedbackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  feedbackButtonText: {
    fontSize: 14,
    color: '#FFF',
    fontWeight: '500',
  },
  
  // Adaptive instruction overlay
  adaptiveInstructionOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 9999,
    elevation: 9999, // For Android
  },
  instructionCard: {
    backgroundColor: '#1A1D23',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    maxWidth: '90%',
  },
  instructionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
    marginTop: 12,
    marginBottom: 8,
  },
  instructionMessage: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginBottom: 20,
  },
  dismissButton: {
    backgroundColor: '#60A5FA',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  dismissText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },

  // Completion modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  completionModal: {
    backgroundColor: '#1A1D23',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    width: '85%',
    maxWidth: 360,
  },
  completionIcon: {
    marginBottom: 20,
  },
  completionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 10,
  },
  completionMessage: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginBottom: 25,
    lineHeight: 22,
  },
  sessionStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '600',
    color: '#60A5FA',
  },
  completionButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 10,
    width: '100%',
  },
  completionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
    textAlign: 'center',
  },
});

// Add PropTypes
IHHTSessionSimple.propTypes = {
  navigation: PropTypes.shape({
    replace: PropTypes.func.isRequired,
    reset: PropTypes.func.isRequired,
  }).isRequired,
  route: PropTypes.shape({
    params: PropTypes.shape({
      sessionId: PropTypes.string.isRequired,
      protocolConfig: PropTypes.object.isRequired,
      preSessionData: PropTypes.object,
    }).isRequired,
  }).isRequired,
};

EKGWave.propTypes = {
  heartRate: PropTypes.number.isRequired,
  color: PropTypes.string,
};