import React, { useState, useEffect, useRef } from 'react';
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
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useBluetooth } from '../context/BluetoothContext';
import EnhancedSessionManager from '../services/EnhancedSessionManager';
import AdaptiveInstructionEngine from '../services/AdaptiveInstructionEngine';
import SessionIdGenerator from '../utils/sessionIdGenerator';
import DatabaseService from '../services/DatabaseService';
import SupabaseService from '../services/SupabaseService';
import IntraSessionFeedback from '../components/feedback/IntraSessionFeedback';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Altitude conversion table
const ALTITUDE_CONVERSION = {
  0: { fio2: 18.0, altitude: 4000, meters: 1219 },
  1: { fio2: 17.1, altitude: 5500, meters: 1676 },
  2: { fio2: 16.2, altitude: 7500, meters: 2286 },
  3: { fio2: 15.3, altitude: 9500, meters: 2896 },
  4: { fio2: 14.4, altitude: 11500, meters: 3505 },
  5: { fio2: 13.5, altitude: 13500, meters: 4115 },
  6: { fio2: 12.5, altitude: 16000, meters: 4877 },
  7: { fio2: 11.6, altitude: 18500, meters: 5639 },
  8: { fio2: 10.7, altitude: 21000, meters: 6401 },
  9: { fio2: 9.8, altitude: 23500, meters: 7163 },
  10: { fio2: 8.9, altitude: 26500, meters: 8077 },
  11: { fio2: 8.0, altitude: 27000, meters: 8230 }
};

// EKG Animation Component with Trail Effect
const EKGWave = ({ heartRate, color = '#FF6B9D' }) => {
  const [trailPoints, setTrailPoints] = useState([]);
  const animValue = useRef(new Animated.Value(0)).current;
  const moveAnim = useRef(new Animated.Value(0)).current;
  const trailIndex = useRef(0);
  
  useEffect(() => {
    const beatDuration = 60000 / heartRate; // ms per beat
    const totalPoints = 40; // Number of trail points
    
    // Initialize trail points
    const initialTrail = Array.from({ length: totalPoints }, (_, i) => ({
      x: (i / totalPoints) * 80,
      y: 0,
      opacity: 1 - (i / totalPoints) * 0.7
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
      {/* Trail points */}
      {trailPoints.map((point, index) => (
        <View
          key={index}
          style={[
            styles.ekgTrailPoint,
            {
              left: point.x,
              transform: [{ translateY: point.y }],
              opacity: point.opacity,
              backgroundColor: index === trailPoints.length - 1 ? '#FF6B9D' : '#FF6B9D',
              width: index === trailPoints.length - 1 ? 4 : 2,
              height: index === trailPoints.length - 1 ? 4 : 2,
            }
          ]}
        />
      ))}
    </View>
  );
};

export default function IHHTSessionSimple() {
  const navigation = useNavigation();
  const route = useRoute();
  const { pulseOximeterData, isPulseOxConnected } = useBluetooth();
  
  // Get params from navigation
  const sessionId = route.params?.sessionId || SessionIdGenerator.generate('IHHT');
  const protocolConfig = route.params?.protocolConfig || {
    totalCycles: 5,
    hypoxicDuration: 7,
    hyperoxicDuration: 3,
    defaultAltitudeLevel: 6
  };
  
  // Session management state
  const [sessionInfo, setSessionInfo] = useState(null);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [totalElapsedTime, setTotalElapsedTime] = useState(0);
  const updateInterval = useRef(null);
  const elapsedTimeInterval = useRef(null);
  const adaptiveEngineRef = useRef(null);
  
  // UI state
  const [metrics, setMetrics] = useState({
    spo2: 99,
    heartRate: 72,
    dialLevel: protocolConfig.defaultAltitudeLevel || 6,
  });
  
  // Survey state
  const [showIntraSessionFeedback, setShowIntraSessionFeedback] = useState(false);
  const [hasShownFeedbackForCycle, setHasShownFeedbackForCycle] = useState({});
  const [lastKnownCycle, setLastKnownCycle] = useState(0);
  
  // Adaptive instruction state
  const [adaptiveInstruction, setAdaptiveInstruction] = useState(null);
  const [showAdaptiveInstruction, setShowAdaptiveInstruction] = useState(false);
  
  // Status animation
  const glowAnim = useRef(new Animated.Value(0.5)).current;
  
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
    const initSession = async () => {
      try {
        console.log('🚀 Initializing IHHT Session Simple with:', {
          sessionId,
          protocolConfig
        });
        
        // Initialize database
        await DatabaseService.init();
        
        // Initialize adaptive engine
        adaptiveEngineRef.current = new AdaptiveInstructionEngine();
        
        // Set up adaptive instruction callback
        EnhancedSessionManager.setAdaptiveInstructionCallback(handleAdaptiveInstruction);
        
        // Start session with EnhancedSessionManager
        // Ensure durations are correctly set in seconds
        await EnhancedSessionManager.startSession(sessionId, {
          totalCycles: protocolConfig.totalCycles || 5,
          altitudeDuration: (protocolConfig.hypoxicDuration || 7) * 60,  // 7 minutes = 420 seconds
          recoveryDuration: (protocolConfig.hyperoxicDuration || 3) * 60, // 3 minutes = 180 seconds
          hypoxicDuration: (protocolConfig.hypoxicDuration || 7) * 60,   // Also set old naming for compatibility
          hyperoxicDuration: (protocolConfig.hyperoxicDuration || 3) * 60,
          defaultAltitudeLevel: protocolConfig.defaultAltitudeLevel || 6
        });
        
        setSessionStarted(true);
        setIsInitializing(false);
        
        // Keep screen awake
        activateKeepAwakeAsync();
        
        console.log('✅ Session initialized successfully');
      } catch (error) {
        console.error('❌ Failed to initialize session:', error);
        console.error('Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name
        });
        setIsInitializing(false);
        
        // Create detailed error message
        const errorDetails = `
ERROR DETAILS:
Message: ${error.message || 'Unknown error'}

Stack Trace (first 300 chars):
${error.stack?.substring(0, 300) || 'No stack trace'}

Please screenshot this error and share it.
        `.trim();
        
        Alert.alert(
          'Session Start Failed - Debug Info',
          errorDetails,
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      }
    };
    
    initSession();
    
    return () => {
      // Cleanup
      deactivateKeepAwake();
      if (updateInterval.current) {
        clearInterval(updateInterval.current);
      }
      if (elapsedTimeInterval.current) {
        clearInterval(elapsedTimeInterval.current);
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
            
            // Check if session completed
            if (info.currentPhase === 'COMPLETED' || !info.isActive) {
              handleSessionComplete();
            }
          }
        } catch (error) {
          console.error('Error getting session info:', error);
        }
      }, 1000);
      
      // Separate timer for total elapsed time
      elapsedTimeInterval.current = setInterval(() => {
        setTotalElapsedTime(prev => prev + 1);
      }, 1000);
      
      return () => {
        if (updateInterval.current) {
          clearInterval(updateInterval.current);
          updateInterval.current = null;
        }
        if (elapsedTimeInterval.current) {
          clearInterval(elapsedTimeInterval.current);
          elapsedTimeInterval.current = null;
        }
      };
    }
    
    // Cleanup on unmount
    return () => {
      if (updateInterval.current) {
        clearInterval(updateInterval.current);
        updateInterval.current = null;
      }
      if (elapsedTimeInterval.current) {
        clearInterval(elapsedTimeInterval.current);
        elapsedTimeInterval.current = null;
      }
    };
  }, [sessionStarted]);
  
  // Update metrics with real or simulated data
  useEffect(() => {
    if (sessionStarted && sessionInfo?.isActive) {
      // Use real data when available
      if (isPulseOxConnected && pulseOximeterData) {
        const newMetrics = {
          spo2: pulseOximeterData.spo2 || metrics.spo2,
          heartRate: pulseOximeterData.heartRate || metrics.heartRate,
          dialLevel: sessionInfo?.currentAltitudeLevel || metrics.dialLevel
        };
        
        setMetrics(newMetrics);
        
        // Send reading to session manager
        if (pulseOximeterData.spo2 && pulseOximeterData.heartRate) {
          EnhancedSessionManager.addReading({
            spo2: pulseOximeterData.spo2,
            heartRate: pulseOximeterData.heartRate,
            timestamp: Date.now()
          });
        }
      } else {
        // Demo mode - simulate metrics
        simulateMetrics();
      }
    }
  }, [pulseOximeterData, isPulseOxConnected, sessionStarted, sessionInfo]);
  
  // Simulate metrics for demo mode
  const simulateMetrics = () => {
    setMetrics(prev => {
      const newMetrics = { ...prev };
      
      if (sessionInfo?.currentPhase === 'ALTITUDE') {
        // During altitude phase, SpO2 gradually decreases
        newMetrics.spo2 = Math.max(85, prev.spo2 - Math.random() * 0.5);
        newMetrics.heartRate = Math.min(100, prev.heartRate + Math.random() * 0.5);
      } else if (sessionInfo?.currentPhase === 'RECOVERY') {
        // During recovery phase, SpO2 increases
        newMetrics.spo2 = Math.min(99, prev.spo2 + Math.random() * 0.5);
        newMetrics.heartRate = Math.max(60, prev.heartRate - Math.random() * 0.5);
      }
      
      newMetrics.heartRate = Math.round(newMetrics.heartRate);
      newMetrics.dialLevel = sessionInfo?.currentAltitudeLevel || prev.dialLevel;
      
      return newMetrics;
    });
  };
  
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
  
  // Handle adaptive instructions
  const handleAdaptiveInstruction = (instruction) => {
    console.log('🎯 Received adaptive instruction:', instruction);
    setAdaptiveInstruction(instruction);
    setShowAdaptiveInstruction(true);
    
    // Vibrate to get user attention
    Vibration.vibrate([0, 300, 100, 300]);
    
    // Auto-dismiss after 10 seconds
    setTimeout(() => {
      setShowAdaptiveInstruction(false);
    }, 10000);
  };
  
  // Handle device disconnection
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
  
  // Glow animation for status
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.3,
          duration: 1500,
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
  
  // Session complete handler
  const handleSessionComplete = async () => {
    // Prevent multiple calls
    if (updateInterval.current) {
      clearInterval(updateInterval.current);
      updateInterval.current = null;
    }
    if (elapsedTimeInterval.current) {
      clearInterval(elapsedTimeInterval.current);
      elapsedTimeInterval.current = null;
    }
    
    try {
      // End session in manager
      await EnhancedSessionManager.endSession();
      
      // Deactivate keep awake
      deactivateKeepAwake();
      
      // Navigate to post-session survey
      setTimeout(() => {
        if (navigation && navigation.replace) {
          navigation.replace('PostSessionSurvey', {
            sessionId,
            sessionType: 'IHHT_TRAINING'
          });
        }
      }, 500);
    } catch (error) {
      console.error('Error completing session:', error);
    }
  };
  
  // Control handlers
  const handlePauseResume = () => {
    if (sessionInfo?.isPaused) {
      EnhancedSessionManager.resumeSession();
      // Resume elapsed time counter
      elapsedTimeInterval.current = setInterval(() => {
        setTotalElapsedTime(prev => prev + 1);
      }, 1000);
    } else {
      EnhancedSessionManager.pauseSession();
      // Pause elapsed time counter
      if (elapsedTimeInterval.current) {
        clearInterval(elapsedTimeInterval.current);
      }
    }
  };
  
  const handleStop = () => {
    Alert.alert(
      'End Session?',
      'Are you sure you want to end this session?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'End Session', 
          style: 'destructive',
          onPress: async () => {
            await EnhancedSessionManager.endSession();
            deactivateKeepAwake();
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
  
  // Get altitude data
  const altitudeData = ALTITUDE_CONVERSION[metrics.dialLevel] || ALTITUDE_CONVERSION[6];
  
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
            { color: metrics.spo2 > 90 ? '#4ADE80' : (metrics.spo2 > 85 ? '#FFA500' : '#FF6B6B') }
          ]}>
            {Math.round(metrics.spo2)}
          </Text>
          <Text style={styles.spo2Label}>SpO₂</Text>
        </View>
        
        {/* Left - Altitude */}
        <View style={styles.diamondLeft}>
          <Text style={styles.altitudeValue}>
            {altitudeData.altitude.toLocaleString()}
          </Text>
          <Text style={styles.altitudeUnit}>ft</Text>
          <Text style={styles.altitudeMeters}>
            {altitudeData.meters.toLocaleString()}m
          </Text>
        </View>
        
        {/* Right - Heart Rate */}
        <View style={styles.diamondRight}>
          <Text style={styles.heartRateValue}>{metrics.heartRate}</Text>
          <Text style={styles.heartRateUnit}>BPM</Text>
          <EKGWave heartRate={metrics.heartRate} />
        </View>
        
        {/* Bottom - Status */}
        <Animated.View 
          style={[
            styles.diamondBottom,
            { opacity: glowAnim }
          ]}
        >
          <View style={styles.statusRow}>
            <Text style={[styles.statusText, { color: getStatusColor() }]}>
              {getStatus()}
            </Text>
            <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
          </View>
        </Animated.View>
      </View>
      
      {/* Connection Status */}
      {!isPulseOxConnected && (
        <View style={styles.connectionWarning}>
          <Icon name="bluetooth-off" size={16} color="#FFA500" />
          <Text style={styles.warningText}>Demo Mode</Text>
        </View>
      )}
      
      {/* Bottom Controls */}
      <View style={styles.controls}>
        <Text style={styles.controlsText}>
          Cycle {sessionInfo?.currentCycle || 1} of {protocolConfig.totalCycles}
        </Text>
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
            style={[styles.button, styles.stopButton]}
            onPress={handleStop}
          >
            <Icon name="stop" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Adaptive Instruction Overlay */}
      {showAdaptiveInstruction && adaptiveInstruction && (
        <View style={styles.adaptiveInstructionOverlay}>
          <View style={styles.instructionCard}>
            <Icon 
              name={adaptiveInstruction.type === 'mask_lift' ? 'air' : 'trending-up'} 
              size={24} 
              color="#60A5FA" 
            />
            <Text style={styles.instructionTitle}>
              {adaptiveInstruction.title}
            </Text>
            <Text style={styles.instructionMessage}>
              {adaptiveInstruction.message}
            </Text>
            <TouchableOpacity 
              onPress={() => setShowAdaptiveInstruction(false)}
              style={styles.dismissButton}
            >
              <Text style={styles.dismissText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
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
    top: '8%',  // Moved higher for better diamond shape
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
  },
  altitudeValue: {
    fontSize: 42,
    fontWeight: '300',
    color: '#FFF',
    lineHeight: 42,
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
  },
  heartRateValue: {
    fontSize: 42,
    fontWeight: '300',
    color: '#FF6B9D',
    lineHeight: 42,
  },
  heartRateUnit: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
    fontWeight: '400',
  },
  
  // EKG styles
  ekgContainer: {
    width: 100,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    position: 'relative',
  },
  ekgBaseline: {
    position: 'absolute',
    width: 100,
    height: 0.5,
    backgroundColor: '#FF6B9D',
    opacity: 0.2,
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
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 4,
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
  
  // Controls
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 20,
  },
  controlsText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
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
  stopButton: {
    backgroundColor: 'rgba(239,68,68,0.2)',
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
});