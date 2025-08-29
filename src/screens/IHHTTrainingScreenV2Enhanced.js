import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Modal,
  TouchableOpacity,
  Dimensions,
  AppState,
  Vibration,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import DiamondMetricsDisplay from '../components/ihht/DiamondMetricsDisplay';
import SessionProgressBar from '../components/ihht/SessionProgressBar';
import IntrasessionSurvey from '../components/ihht/IntrasessionSurvey';
import BluetoothService from '../services/BluetoothService';
import PhaseMetricsTracker from '../services/PhaseMetricsTracker';
import { supabase } from '../services/SupabaseService';

const { width, height } = Dimensions.get('window');

// Phase durations in seconds
const ALTITUDE_DURATION = 7 * 60; // 7 minutes
const RECOVERY_DURATION = 3 * 60; // 3 minutes
const TOTAL_CYCLES = 5;
const INTRASESSION_SURVEY_DELAY = 30; // 30 seconds into recovery

// Safety thresholds
const EMERGENCY_SPO2 = 75;
const CRITICAL_HEART_RATE_HIGH = 180;
const CRITICAL_HEART_RATE_LOW = 40;

export default function IHHTTrainingScreenV2Enhanced() {
  const navigation = useNavigation();
  const route = useRoute();
  const { dialPosition: initialDial, userId, isFirstSession } = route.params;

  // Session state
  const [sessionId, setSessionId] = useState(null);
  const [currentCycle, setCurrentCycle] = useState(1);
  const [currentPhase, setCurrentPhase] = useState('altitude'); // 'altitude' or 'recovery'
  const [currentDialPosition, setCurrentDialPosition] = useState(initialDial);
  const [phaseTimeElapsed, setPhaseTimeElapsed] = useState(0);
  const [totalSessionTime, setTotalSessionTime] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isEmergency, setIsEmergency] = useState(false);

  // Metrics state
  const [spo2, setSpo2] = useState(null);
  const [heartRate, setHeartRate] = useState(null);
  const [altitude, setAltitude] = useState(null);
  const [isStressing, setIsStressing] = useState(false);

  // Mask lift state
  const [showMaskLift, setShowMaskLift] = useState(false);
  const [maskLiftInstruction, setMaskLiftInstruction] = useState('');
  const [maskLiftCount, setMaskLiftCount] = useState(0);
  const [consecutiveLowReadings, setConsecutiveLowReadings] = useState(0);

  // Dial adjustment state
  const [showDialAdjustment, setShowDialAdjustment] = useState(false);
  const [dialAdjustmentInstruction, setDialAdjustmentInstruction] = useState('');

  // Intrasession survey state
  const [showIntrasessionSurvey, setShowIntrasessionSurvey] = useState(false);
  const [surveyScheduled, setSurveyScheduled] = useState(false);

  // Timer refs
  const phaseTimerRef = useRef(null);
  const sessionTimerRef = useRef(null);
  const metricsIntervalRef = useRef(null);
  const surveyTimerRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);

  // Initialize session
  useEffect(() => {
    initializeSession();
    loadAltitudeData();
    startMetricsMonitoring();

    // App state handling for background/foreground
    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      cleanup();
      appStateSubscription.remove();
    };
  }, []);

  // Phase timer
  useEffect(() => {
    if (!isPaused && !isEmergency) {
      phaseTimerRef.current = setInterval(() => {
        setPhaseTimeElapsed(prev => {
          const newTime = prev + 1;
          const phaseDuration = currentPhase === 'altitude' ? ALTITUDE_DURATION : RECOVERY_DURATION;
          
          // Check for intrasession survey trigger
          if (currentPhase === 'recovery' && 
              newTime === INTRASESSION_SURVEY_DELAY && 
              !surveyScheduled &&
              currentCycle <= TOTAL_CYCLES) {
            triggerIntrasessionSurvey();
          }
          
          if (newTime >= phaseDuration) {
            handlePhaseComplete();
            return 0;
          }
          return newTime;
        });
      }, 1000);
    } else {
      clearInterval(phaseTimerRef.current);
    }

    return () => clearInterval(phaseTimerRef.current);
  }, [currentPhase, isPaused, isEmergency, surveyScheduled]);

  // Total session timer
  useEffect(() => {
    if (!isPaused && !isEmergency) {
      sessionTimerRef.current = setInterval(() => {
        setTotalSessionTime(prev => prev + 1);
      }, 1000);
    } else {
      clearInterval(sessionTimerRef.current);
    }

    return () => clearInterval(sessionTimerRef.current);
  }, [isPaused, isEmergency]);

  // SpO2 monitoring for safety and mask lifts
  useEffect(() => {
    checkSpo2Thresholds();
    checkSafetyThresholds();
  }, [spo2, heartRate]);

  // Stress indicator
  useEffect(() => {
    setIsStressing(spo2 < 83);
  }, [spo2]);

  const handleAppStateChange = (nextAppState) => {
    if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
      // App came to foreground
      console.log('App returned to foreground');
    } else if (nextAppState === 'background') {
      // App went to background
      console.log('App went to background');
      // Consider pausing the session or showing notification
    }
    appStateRef.current = nextAppState;
  };

  const initializeSession = async () => {
    const sessionIdGenerated = `IHHT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setSessionId(sessionIdGenerated);
    
    // Initialize PhaseMetricsTracker
    PhaseMetricsTracker.initialize(sessionIdGenerated);
    PhaseMetricsTracker.startPhase(1, 'altitude', initialDial);

    try {
      const { error } = await supabase.from('sessions').insert({
        user_id: userId,
        session_id: sessionIdGenerated,
        session_type: 'IHHT',
        starting_dial_position: initialDial,
        created_at: new Date().toISOString(),
      });

      if (error) throw error;
    } catch (error) {
      console.error('Error creating session:', error);
      Alert.alert('Session Error', 'Failed to create session. Please try again.');
    }
  };

  const loadAltitudeData = async () => {
    try {
      const { data } = await supabase
        .from('altitude_levels')
        .select('*')
        .eq('dial_position', currentDialPosition)
        .single();

      if (data) {
        setAltitude(data.altitude_feet);
      }
    } catch (error) {
      console.error('Error loading altitude:', error);
    }
  };

  const startMetricsMonitoring = () => {
    metricsIntervalRef.current = setInterval(async () => {
      try {
        const metrics = await BluetoothService.getLatestMetrics();
        if (metrics) {
          setSpo2(metrics.spo2);
          setHeartRate(metrics.heartRate);
          
          // Track metrics with PhaseMetricsTracker
          PhaseMetricsTracker.recordReading(metrics.spo2, metrics.heartRate);
        }
      } catch (error) {
        // Demo mode - simulate data
        const demoSpo2 = Math.floor(Math.random() * 10) + 85;
        const demoHR = Math.floor(Math.random() * 20) + 70;
        setSpo2(demoSpo2);
        setHeartRate(demoHR);
        
        PhaseMetricsTracker.recordReading(demoSpo2, demoHR);
      }
    }, 1000);
  };

  const checkSafetyThresholds = () => {
    // Emergency SpO2 check
    if (spo2 && spo2 < EMERGENCY_SPO2 && !isEmergency) {
      triggerEmergency('Critical SpO2 Level');
      return;
    }

    // Heart rate checks
    if (heartRate) {
      if (heartRate > CRITICAL_HEART_RATE_HIGH && !isEmergency) {
        triggerEmergency('Heart Rate Too High');
        return;
      }
      if (heartRate < CRITICAL_HEART_RATE_LOW && !isEmergency) {
        triggerEmergency('Heart Rate Too Low');
        return;
      }
    }

    // Track consecutive low readings for safety
    if (spo2 && spo2 < 80) {
      setConsecutiveLowReadings(prev => prev + 1);
      if (consecutiveLowReadings > 10 && !isEmergency) {
        // More than 10 seconds below 80%
        triggerEmergency('Prolonged Low SpO2');
      }
    } else {
      setConsecutiveLowReadings(0);
    }
  };

  const triggerEmergency = (reason) => {
    setIsEmergency(true);
    setIsPaused(true);
    Vibration.vibrate([1000, 500, 1000, 500, 1000]); // Emergency vibration pattern
    
    Alert.alert(
      '🚨 EMERGENCY',
      `${reason}\n\nREMOVE MASK IMMEDIATELY!\n\nCurrent SpO2: ${spo2}%\nHeart Rate: ${heartRate} bpm`,
      [
        {
          text: 'I\'m OK - Continue',
          onPress: () => {
            setIsEmergency(false);
            setIsPaused(false);
          },
        },
        {
          text: 'End Session',
          style: 'destructive',
          onPress: () => emergencyEndSession(),
        },
      ],
      { cancelable: false }
    );

    // Log emergency event
    logEmergencyEvent(reason);
  };

  const logEmergencyEvent = async (reason) => {
    try {
      await supabase.from('session_instructions').insert({
        session_id: sessionId,
        cycle_number: currentCycle,
        instruction_type: 'emergency',
        instruction_text: reason,
        dial_position: currentDialPosition,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error logging emergency:', error);
    }
  };

  const checkSpo2Thresholds = () => {
    if (currentPhase !== 'altitude' || !spo2 || showMaskLift) return;

    if (spo2 < 80) {
      triggerMaskLift(2); // 2 breaths
    } else if (spo2 < 83) {
      triggerMaskLift(1); // 1 breath
    }
  };

  const triggerMaskLift = async (breathCount) => {
    setShowMaskLift(true);
    setMaskLiftInstruction(
      breathCount === 1 
        ? 'Lift mask - Take 1 breath' 
        : 'Lift mask - Take 2 breaths'
    );
    setMaskLiftCount(prev => prev + 1);
    
    // Vibration feedback
    Vibration.vibrate(500);
    
    // Track with PhaseMetricsTracker
    PhaseMetricsTracker.recordMaskLift(
      spo2, 
      heartRate, 
      breathCount === 1 ? '1_breath' : '2_breath'
    );

    // Record mask lift event
    try {
      await supabase.from('mask_lift_events').insert({
        session_id: sessionId,
        cycle_number: currentCycle,
        phase_type: currentPhase,
        timestamp: new Date().toISOString(),
        spo2_at_lift: spo2,
        heart_rate_at_lift: heartRate,
        lift_type: breathCount === 1 ? '1_breath' : '2_breath',
      });
    } catch (error) {
      console.error('Error recording mask lift:', error);
    }

    // Clear after 3 seconds
    setTimeout(() => {
      setShowMaskLift(false);
      setMaskLiftInstruction('');
    }, 3000);
  };

  const triggerIntrasessionSurvey = () => {
    setSurveyScheduled(true);
    setIsPaused(true);
    setShowIntrasessionSurvey(true);
  };

  const handleIntrasessionSurveyComplete = async (surveyData) => {
    setShowIntrasessionSurvey(false);
    setIsPaused(false);
    setSurveyScheduled(false);
    
    // Save survey with PhaseMetricsTracker
    await PhaseMetricsTracker.saveIntrasessionSurvey(currentCycle, surveyData);
  };

  const handlePhaseComplete = async () => {
    // End current phase in tracker
    const phaseData = PhaseMetricsTracker.endCurrentPhase();

    if (currentPhase === 'altitude') {
      // Calculate dial adjustment
      const adjustment = calculateDialAdjustment(
        phaseData?.avgSpo2 || 90, 
        phaseData?.maskLiftCount || 0
      );
      
      // Record dial adjustment if needed
      if (adjustment.instruction) {
        await recordDialAdjustment(adjustment);
        setDialAdjustmentInstruction(adjustment.instruction);
        setShowDialAdjustment(true);
        setCurrentDialPosition(adjustment.nextDial);
      }
      
      // Switch to recovery
      setCurrentPhase('recovery');
      PhaseMetricsTracker.startPhase(currentCycle, 'recovery', currentDialPosition);
      setSurveyScheduled(false); // Reset for new recovery phase
      Alert.alert('Phase Complete', 'Switch masks for recovery phase');
    } else {
      // Recovery complete
      if (currentCycle < TOTAL_CYCLES) {
        setCurrentCycle(prev => prev + 1);
        setCurrentPhase('altitude');
        PhaseMetricsTracker.startPhase(currentCycle + 1, 'altitude', currentDialPosition);
        Alert.alert('Cycle Complete', 'Switch back to altitude mask');
      } else {
        completeSession();
      }
    }

    setMaskLiftCount(0);
  };

  const calculateDialAdjustment = (avgSpo2, liftCount) => {
    if (avgSpo2 > 90) {
      return {
        nextDial: Math.min(currentDialPosition + 1, 11),
        reason: 'spo2_high',
        instruction: `Increase dial to ${currentDialPosition + 1}`,
      };
    } else if (liftCount >= 3) {
      return {
        nextDial: Math.max(currentDialPosition - 1, 0),
        reason: 'too_many_lifts',
        instruction: `Decrease dial to ${currentDialPosition - 1}`,
      };
    }
    return {
      nextDial: currentDialPosition,
      reason: 'optimal',
      instruction: null,
    };
  };

  const recordDialAdjustment = async (adjustment) => {
    try {
      await supabase.from('dial_adjustments').insert({
        session_id: sessionId,
        cycle_number: currentCycle,
        from_dial: currentDialPosition,
        to_dial: adjustment.nextDial,
        reason: adjustment.reason,
        avg_spo2: PhaseMetricsTracker.getCurrentPhaseData()?.avgSpo2,
        mask_lift_count: maskLiftCount,
      });
    } catch (error) {
      console.error('Error recording dial adjustment:', error);
    }
  };

  const completeSession = async () => {
    const summary = PhaseMetricsTracker.getSessionSummary();
    
    try {
      await supabase
        .from('sessions')
        .update({
          ended_at: new Date().toISOString(),
          ending_dial_position: currentDialPosition,
          total_mask_lifts: summary.totalMaskLifts,
          phase_metrics: summary,
        })
        .eq('session_id', sessionId);

      // Update user experience
      await updateUserExperience();

      navigation.navigate('PostSessionSurvey', { sessionId, sessionSummary: summary });
    } catch (error) {
      console.error('Error completing session:', error);
    }
  };

  const emergencyEndSession = async () => {
    await completeSession();
  };

  const updateUserExperience = async () => {
    try {
      const { data: currentExperience } = await supabase
        .from('user_hypoxia_experience')
        .select('sessions_completed')
        .eq('user_id', userId)
        .single();

      await supabase
        .from('user_hypoxia_experience')
        .update({
          sessions_completed: (currentExperience?.sessions_completed || 0) + 1,
          last_dial_position: currentDialPosition,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);
    } catch (error) {
      console.error('Error updating user experience:', error);
    }
  };

  const cleanup = () => {
    clearInterval(phaseTimerRef.current);
    clearInterval(sessionTimerRef.current);
    clearInterval(metricsIntervalRef.current);
    clearTimeout(surveyTimerRef.current);
    PhaseMetricsTracker.reset();
  };

  const handleSkipPhase = () => {
    Alert.alert(
      'Skip Phase',
      'Are you sure you want to skip this phase?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Skip', onPress: () => handlePhaseComplete() },
      ]
    );
  };

  const handleEndSession = () => {
    Alert.alert(
      'End Session',
      'Are you sure you want to end the session?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'End', onPress: () => completeSession() },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Emergency Overlay */}
      {isEmergency && (
        <View style={styles.emergencyOverlay}>
          <Text style={styles.emergencyText}>REMOVE MASK!</Text>
          <Text style={styles.emergencySubtext}>SpO2: {spo2}%</Text>
        </View>
      )}

      <SessionProgressBar
        currentCycle={currentCycle}
        totalCycles={TOTAL_CYCLES}
        currentPhase={currentPhase}
        phaseTimeElapsed={phaseTimeElapsed}
        phaseDuration={currentPhase === 'altitude' ? ALTITUDE_DURATION : RECOVERY_DURATION}
        totalSessionTime={totalSessionTime}
        onSkip={handleSkipPhase}
        onEnd={handleEndSession}
      />

      <DiamondMetricsDisplay
        spo2={spo2}
        heartRate={heartRate}
        altitude={altitude}
        dialPosition={currentDialPosition}
        isStressing={isStressing}
        showMaskLift={showMaskLift}
        maskLiftInstruction={maskLiftInstruction}
      />

      {/* Intrasession Survey */}
      <IntrasessionSurvey
        visible={showIntrasessionSurvey}
        onComplete={handleIntrasessionSurveyComplete}
        previousHypoxicData={PhaseMetricsTracker.getPreviousHypoxicData()}
        currentRecoveryData={PhaseMetricsTracker.getCurrentPhaseData()}
      />

      {/* Dial Adjustment Modal */}
      <Modal
        visible={showDialAdjustment}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Adjust Dial</Text>
            <Text style={styles.modalInstruction}>{dialAdjustmentInstruction}</Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => {
                setShowDialAdjustment(false);
                loadAltitudeData(); // Reload altitude for new dial
              }}
            >
              <Text style={styles.modalButtonText}>Done</Text>
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
    backgroundColor: '#0a0a0f',
  },
  emergencyOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  emergencyText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
  },
  emergencySubtext: {
    fontSize: 24,
    color: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    width: width * 0.8,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
  },
  modalInstruction: {
    fontSize: 18,
    color: '#0a84ff',
    textAlign: 'center',
    marginBottom: 30,
  },
  modalButton: {
    backgroundColor: '#0a84ff',
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 10,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
});