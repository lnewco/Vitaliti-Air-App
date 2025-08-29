import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Modal,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import DiamondMetricsDisplay from '../components/ihht/DiamondMetricsDisplay';
import SessionProgressBar from '../components/ihht/SessionProgressBar';
import BluetoothService from '../services/BluetoothService';
import { supabase } from '../services/SupabaseService';

const { width, height } = Dimensions.get('window');

// Phase durations in seconds
const ALTITUDE_DURATION = 7 * 60; // 7 minutes
const RECOVERY_DURATION = 3 * 60; // 3 minutes
const TOTAL_CYCLES = 5;

export default function IHHTTrainingScreenV2() {
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

  // Metrics state
  const [spo2, setSpo2] = useState(null);
  const [heartRate, setHeartRate] = useState(null);
  const [altitude, setAltitude] = useState(null);
  const [isStressing, setIsStressing] = useState(false);

  // Mask lift state
  const [showMaskLift, setShowMaskLift] = useState(false);
  const [maskLiftInstruction, setMaskLiftInstruction] = useState('');
  const [maskLiftCount, setMaskLiftCount] = useState(0);

  // Phase metrics tracking
  const [phaseMetrics, setPhaseMetrics] = useState({
    spo2Readings: [],
    heartRateReadings: [],
    maskLifts: [],
    minSpo2: 100,
    timeBelow83: 0,
    timeBelow80: 0,
  });

  // Dial adjustment state
  const [showDialAdjustment, setShowDialAdjustment] = useState(false);
  const [dialAdjustmentInstruction, setDialAdjustmentInstruction] = useState('');

  // Timer refs
  const phaseTimerRef = useRef(null);
  const sessionTimerRef = useRef(null);
  const metricsIntervalRef = useRef(null);

  // Initialize session
  useEffect(() => {
    initializeSession();
    loadAltitudeData();
    startMetricsMonitoring();

    return () => {
      cleanup();
    };
  }, []);

  // Phase timer
  useEffect(() => {
    if (!isPaused) {
      phaseTimerRef.current = setInterval(() => {
        setPhaseTimeElapsed(prev => {
          const newTime = prev + 1;
          const phaseDuration = currentPhase === 'altitude' ? ALTITUDE_DURATION : RECOVERY_DURATION;
          
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
  }, [currentPhase, isPaused]);

  // Total session timer
  useEffect(() => {
    if (!isPaused) {
      sessionTimerRef.current = setInterval(() => {
        setTotalSessionTime(prev => prev + 1);
      }, 1000);
    } else {
      clearInterval(sessionTimerRef.current);
    }

    return () => clearInterval(sessionTimerRef.current);
  }, [isPaused]);

  // SpO2 monitoring for mask lifts
  useEffect(() => {
    checkSpo2Thresholds();
  }, [spo2]);

  // Stress indicator
  useEffect(() => {
    setIsStressing(spo2 < 83);
  }, [spo2]);

  const initializeSession = async () => {
    const sessionIdGenerated = `IHHT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setSessionId(sessionIdGenerated);

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
    // For demo mode or real device
    metricsIntervalRef.current = setInterval(async () => {
      try {
        const metrics = await BluetoothService.getLatestMetrics();
        if (metrics) {
          setSpo2(metrics.spo2);
          setHeartRate(metrics.heartRate);
          
          // Track metrics
          setPhaseMetrics(prev => ({
            ...prev,
            spo2Readings: [...prev.spo2Readings, metrics.spo2],
            heartRateReadings: [...prev.heartRateReadings, metrics.heartRate],
            minSpo2: Math.min(prev.minSpo2, metrics.spo2),
          }));
        }
      } catch (error) {
        // Demo mode - simulate data
        const demoSpo2 = Math.floor(Math.random() * 10) + 85;
        const demoHR = Math.floor(Math.random() * 20) + 70;
        setSpo2(demoSpo2);
        setHeartRate(demoHR);
      }
    }, 1000);
  };

  const checkSpo2Thresholds = () => {
    if (currentPhase !== 'altitude' || !spo2) return;

    if (spo2 < 80 && !showMaskLift) {
      triggerMaskLift(2); // 2 breaths
    } else if (spo2 < 83 && !showMaskLift) {
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

  const handlePhaseComplete = async () => {
    if (currentPhase === 'altitude') {
      // Calculate dial adjustment
      const avgSpo2 = calculateAverage(phaseMetrics.spo2Readings);
      const adjustment = calculateDialAdjustment(avgSpo2, maskLiftCount);
      
      // Save phase metrics
      await savePhaseMetrics();
      
      // Show dial adjustment if needed
      if (adjustment.instruction) {
        setDialAdjustmentInstruction(adjustment.instruction);
        setShowDialAdjustment(true);
        setCurrentDialPosition(adjustment.nextDial);
      }
      
      // Switch to recovery
      setCurrentPhase('recovery');
      Alert.alert('Phase Complete', 'Switch masks for recovery phase');
    } else {
      // Recovery complete
      if (currentCycle < TOTAL_CYCLES) {
        setCurrentCycle(prev => prev + 1);
        setCurrentPhase('altitude');
        Alert.alert('Cycle Complete', 'Switch back to altitude mask');
      } else {
        completeSession();
      }
    }

    // Reset phase metrics
    setPhaseMetrics({
      spo2Readings: [],
      heartRateReadings: [],
      maskLifts: [],
      minSpo2: 100,
      timeBelow83: 0,
      timeBelow80: 0,
    });
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

  const savePhaseMetrics = async () => {
    try {
      await supabase.from('phase_metrics').insert({
        session_id: sessionId,
        cycle_number: currentCycle,
        phase_type: currentPhase,
        dial_position: currentDialPosition,
        start_time: new Date(Date.now() - phaseTimeElapsed * 1000).toISOString(),
        end_time: new Date().toISOString(),
        duration_seconds: phaseTimeElapsed,
        avg_spo2: calculateAverage(phaseMetrics.spo2Readings),
        min_spo2: phaseMetrics.minSpo2,
        avg_heart_rate: calculateAverage(phaseMetrics.heartRateReadings),
        mask_lift_count: maskLiftCount,
        time_below_83: phaseMetrics.timeBelow83,
        time_below_80: phaseMetrics.timeBelow80,
      });
    } catch (error) {
      console.error('Error saving phase metrics:', error);
    }
  };

  const calculateAverage = (arr) => {
    if (!arr || arr.length === 0) return null;
    return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
  };

  const completeSession = async () => {
    try {
      await supabase
        .from('sessions')
        .update({
          ended_at: new Date().toISOString(),
          ending_dial_position: currentDialPosition,
          total_mask_lifts: maskLiftCount,
        })
        .eq('session_id', sessionId);

      navigation.navigate('PostSessionSurvey', { sessionId });
    } catch (error) {
      console.error('Error completing session:', error);
    }
  };

  const cleanup = () => {
    clearInterval(phaseTimerRef.current);
    clearInterval(sessionTimerRef.current);
    clearInterval(metricsIntervalRef.current);
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