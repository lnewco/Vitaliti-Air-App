import { supabase } from './SupabaseService';

class PhaseMetricsTracker {
  constructor() {
    this.currentPhase = null;
    this.previousHypoxicPhase = null;
    this.phaseHistory = [];
    this.sessionId = null;
  }

  initialize(sessionId) {
    this.sessionId = sessionId;
    this.phaseHistory = [];
    this.previousHypoxicPhase = null;
  }

  startPhase(cycleNumber, phaseType, dialPosition) {
    // Save previous phase if it exists
    if (this.currentPhase) {
      this.endCurrentPhase();
    }

    this.currentPhase = {
      type: phaseType,
      cycleNumber,
      dialPosition,
      startTime: Date.now(),
      spo2Readings: [],
      heartRateReadings: [],
      maskLifts: [],
      minSpo2: 100,
      maxSpo2: 0,
      timeBelow83: 0,
      timeBelow80: 0,
      timeAbove90: 0,
      lastReadingTime: Date.now(),
    };
  }

  recordReading(spo2, heartRate) {
    if (!this.currentPhase) return;

    const now = Date.now();
    const timeSinceLastReading = (now - this.currentPhase.lastReadingTime) / 1000; // in seconds

    // Record the readings
    this.currentPhase.spo2Readings.push(spo2);
    this.currentPhase.heartRateReadings.push(heartRate);

    // Update min/max
    this.currentPhase.minSpo2 = Math.min(this.currentPhase.minSpo2, spo2);
    this.currentPhase.maxSpo2 = Math.max(this.currentPhase.maxSpo2, spo2);

    // Track time in different SpO2 zones
    if (spo2 < 80) {
      this.currentPhase.timeBelow80 += timeSinceLastReading;
      this.currentPhase.timeBelow83 += timeSinceLastReading;
    } else if (spo2 < 83) {
      this.currentPhase.timeBelow83 += timeSinceLastReading;
    } else if (spo2 > 90) {
      this.currentPhase.timeAbove90 += timeSinceLastReading;
    }

    this.currentPhase.lastReadingTime = now;
  }

  recordMaskLift(spo2, heartRate, liftType) {
    if (!this.currentPhase) return;

    this.currentPhase.maskLifts.push({
      timestamp: Date.now(),
      spo2AtLift: spo2,
      heartRateAtLift: heartRate,
      liftType,
    });
  }

  endCurrentPhase() {
    if (!this.currentPhase) return null;

    const phaseData = {
      ...this.currentPhase,
      endTime: Date.now(),
      duration: (Date.now() - this.currentPhase.startTime) / 1000, // in seconds
      avgSpo2: this.calculateAverage(this.currentPhase.spo2Readings),
      avgHeartRate: this.calculateAverage(this.currentPhase.heartRateReadings),
      maskLiftCount: this.currentPhase.maskLifts.length,
    };

    // If this was a hypoxic phase, store it for intrasession survey
    if (this.currentPhase.type === 'altitude') {
      this.previousHypoxicPhase = phaseData;
    }

    // Add to history
    this.phaseHistory.push(phaseData);

    // Save to database
    this.savePhaseMetrics(phaseData);

    return phaseData;
  }

  async savePhaseMetrics(phaseData) {
    try {
      const { error } = await supabase.from('phase_metrics').insert({
        session_id: this.sessionId,
        cycle_number: phaseData.cycleNumber,
        phase_type: phaseData.type,
        dial_position: phaseData.dialPosition,
        start_time: new Date(phaseData.startTime).toISOString(),
        end_time: new Date(phaseData.endTime).toISOString(),
        duration_seconds: Math.round(phaseData.duration),
        avg_spo2: phaseData.avgSpo2,
        min_spo2: phaseData.minSpo2,
        max_spo2: phaseData.maxSpo2,
        avg_heart_rate: phaseData.avgHeartRate,
        mask_lift_count: phaseData.maskLiftCount,
        time_below_83: Math.round(phaseData.timeBelow83),
        time_below_80: Math.round(phaseData.timeBelow80),
        time_above_90: Math.round(phaseData.timeAbove90),
      });

      if (error) throw error;
    } catch (error) {
      console.error('Error saving phase metrics:', error);
    }
  }

  getPreviousHypoxicData() {
    return this.previousHypoxicPhase;
  }

  getCurrentPhaseData() {
    if (!this.currentPhase) return null;

    return {
      type: this.currentPhase.type,
      cycleNumber: this.currentPhase.cycleNumber,
      dialPosition: this.currentPhase.dialPosition,
      currentSpO2: this.currentPhase.spo2Readings[this.currentPhase.spo2Readings.length - 1] || null,
      currentHeartRate: this.currentPhase.heartRateReadings[this.currentPhase.heartRateReadings.length - 1] || null,
      avgSpo2: this.calculateAverage(this.currentPhase.spo2Readings),
      avgHeartRate: this.calculateAverage(this.currentPhase.heartRateReadings),
      duration: (Date.now() - this.currentPhase.startTime) / 1000,
      maskLiftCount: this.currentPhase.maskLifts.length,
    };
  }

  calculateAverage(arr) {
    if (!arr || arr.length === 0) return null;
    return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
  }

  getSessionSummary() {
    const altitudePhases = this.phaseHistory.filter(p => p.type === 'altitude');
    const recoveryPhases = this.phaseHistory.filter(p => p.type === 'recovery');

    return {
      totalCycles: Math.max(...this.phaseHistory.map(p => p.cycleNumber), 0),
      avgAltitudeSpo2: this.calculateAverage(altitudePhases.map(p => p.avgSpo2)),
      avgRecoverySpo2: this.calculateAverage(recoveryPhases.map(p => p.avgSpo2)),
      totalMaskLifts: altitudePhases.reduce((sum, p) => sum + p.maskLiftCount, 0),
      minSpo2Overall: Math.min(...altitudePhases.map(p => p.minSpo2)),
      avgTimeBelow83: this.calculateAverage(altitudePhases.map(p => p.timeBelow83)),
      dialProgression: altitudePhases.map(p => p.dialPosition),
    };
  }

  async saveIntrasessionSurvey(cycleNumber, surveyData) {
    if (!this.previousHypoxicPhase || !this.sessionId) return;

    const currentRecoveryData = this.getCurrentPhaseData();

    try {
      const { error } = await supabase.from('intrasession_surveys').insert({
        session_id: this.sessionId,
        cycle_number: cycleNumber,
        survey_time: new Date().toISOString(),
        // Previous hypoxic phase data
        previous_hypoxic_dial: this.previousHypoxicPhase.dialPosition,
        previous_hypoxic_avg_spo2: this.previousHypoxicPhase.avgSpo2,
        previous_hypoxic_min_spo2: this.previousHypoxicPhase.minSpo2,
        previous_hypoxic_mask_lifts: this.previousHypoxicPhase.maskLiftCount,
        previous_hypoxic_duration: Math.round(this.previousHypoxicPhase.duration),
        previous_hypoxic_time_below_83: Math.round(this.previousHypoxicPhase.timeBelow83),
        // Current recovery phase data
        current_recovery_spo2: currentRecoveryData?.currentSpO2,
        current_recovery_heart_rate: currentRecoveryData?.currentHeartRate,
        recovery_rate: this.calculateRecoveryRate(),
        // Survey responses
        feeling_score: surveyData.feelingScore,
        breathlessness_score: surveyData.breathlessnessScore,
        clarity_score: surveyData.clarityScore,
        energy_score: surveyData.energyScore,
        notes: surveyData.notes,
      });

      if (error) throw error;
    } catch (error) {
      console.error('Error saving intrasession survey:', error);
    }
  }

  calculateRecoveryRate() {
    if (!this.currentPhase || this.currentPhase.type !== 'recovery') return null;
    if (this.currentPhase.spo2Readings.length < 2) return null;

    const duration = (Date.now() - this.currentPhase.startTime) / 60000; // in minutes
    const spo2Increase = this.currentPhase.spo2Readings[this.currentPhase.spo2Readings.length - 1] - 
                        this.currentPhase.spo2Readings[0];
    
    return duration > 0 ? (spo2Increase / duration).toFixed(2) : null;
  }

  reset() {
    this.currentPhase = null;
    this.previousHypoxicPhase = null;
    this.phaseHistory = [];
    this.sessionId = null;
  }
}

export default new PhaseMetricsTracker();