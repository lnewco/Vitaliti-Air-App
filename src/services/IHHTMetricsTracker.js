import logger from '../utils/logger';

const log = logger.createModuleLogger('IHHTMetricsTracker');

/**
 * IHHTMetricsTracker - Tracks and calculates IHHT adaptation metrics
 * during session execution
 */
class IHHTMetricsTracker {
  constructor() {
    this.resetSession();
  }

  resetSession() {
    this.sessionId = null;
    this.sessionStartTime = null;
    this.currentCycle = 0;
    this.currentPhase = null;
    this.currentPhaseId = null;
    
    // Current phase tracking
    this.phaseStartTime = null;
    this.phaseSpO2Readings = [];
    this.phaseHRReadings = [];
    this.timeInZone = 0; // seconds in 85-90%
    this.timeBelow83 = 0; // seconds below 83%
    this.timeToTherapeuticZone = null; // seconds to reach <90%
    this.hasReachedTherapeuticZone = false;
    this.peakHeartRate = 0;
    
    // Recovery tracking
    this.recoveryStartTime = null;
    this.recoveryStartSpO2 = null;
    this.recoveryStartHR = null;
    this.hasReached95 = false;
    this.timeToReach95 = null;
    
    // Cycle metrics storage
    this.cycleMetrics = [];
    
    // Session-wide tracking
    this.totalTimeInZone = 0;
    this.totalMaskLifts = 0;
    this.lastSpO2 = null;
    this.lastHR = null;
    this.lastReadingTime = null;
    
    // Mask lift recovery tracking
    this.maskLiftEvents = [];
    this.currentMaskLiftEvent = null;
  }

  startSession(sessionId) {
    this.resetSession();
    this.sessionId = sessionId;
    this.sessionStartTime = Date.now();
    log.info(`Started metrics tracking for session ${sessionId}`);
  }

  startPhase(phaseType, phaseNumber, phaseId, altitudeLevel) {
    // Save previous phase metrics if exists
    if (this.currentPhase && this.phaseStartTime) {
      this.calculatePhaseMetrics();
    }
    
    this.currentPhase = phaseType;
    this.currentPhaseId = phaseId;
    this.phaseStartTime = Date.now();
    this.phaseSpO2Readings = [];
    this.phaseHRReadings = [];
    this.timeInZone = 0;
    this.timeBelow83 = 0;
    this.peakHeartRate = 0;
    
    if (phaseType === 'ALTITUDE') {
      this.currentCycle = phaseNumber;
      this.currentAltitudeLevel = altitudeLevel; // Store altitude level
      this.timeToTherapeuticZone = null;
      this.hasReachedTherapeuticZone = false;
      log.info(`Started altitude phase ${phaseNumber} at level ${altitudeLevel}`);
    } else if (phaseType === 'RECOVERY') {
      this.recoveryStartTime = Date.now();
      this.recoveryStartSpO2 = this.lastSpO2;
      this.recoveryStartHR = this.lastHR;
      this.hasReached95 = false;
      this.timeToReach95 = null;
      log.info(`Started recovery phase ${phaseNumber}`);
    }
  }

  processReading(spo2, heartRate) {
    const now = Date.now();
    
    // Update last values
    this.lastSpO2 = spo2;
    this.lastHR = heartRate;
    this.lastReadingTime = now;
    
    // Track mask lift recovery if active
    if (this.currentMaskLiftEvent && spo2 && spo2 > 0) {
      this.processMaskLiftRecovery(spo2, now);
    }
    
    // Store readings for volatility calculation
    if (spo2 && spo2 > 0) {
      this.phaseSpO2Readings.push(spo2);
    }
    if (heartRate && heartRate > 0) {
      this.phaseHRReadings.push(heartRate);
      this.peakHeartRate = Math.max(this.peakHeartRate, heartRate);
    }
    
    if (this.currentPhase === 'ALTITUDE' && spo2 && spo2 > 0) {
      this.processAltitudeReading(spo2, now);
    } else if (this.currentPhase === 'RECOVERY' && spo2 && spo2 > 0) {
      this.processRecoveryReading(spo2, now);
    }
  }

  processAltitudeReading(spo2, timestamp) {
    // Track time to therapeutic zone (first time < 90%)
    if (!this.hasReachedTherapeuticZone && spo2 < 90) {
      this.hasReachedTherapeuticZone = true;
      this.timeToTherapeuticZone = Math.round((timestamp - this.phaseStartTime) / 1000);
      log.info(`Reached therapeutic zone after ${this.timeToTherapeuticZone} seconds`);
    }
    
    // Track time in therapeutic zone (85-90%)
    if (spo2 >= 85 && spo2 <= 90) {
      this.timeInZone++;
      this.totalTimeInZone++;
    }
    
    // Track time below safety threshold
    if (spo2 < 83) {
      this.timeBelow83++;
    }
  }

  processRecoveryReading(spo2, timestamp) {
    // Track time to reach 95%
    if (!this.hasReached95 && spo2 >= 95) {
      this.hasReached95 = true;
      this.timeToReach95 = Math.round((timestamp - this.recoveryStartTime) / 1000);
      log.info(`SpO2 recovered to 95% after ${this.timeToReach95} seconds`);
    }
  }

  processMaskLiftRecovery(spo2, timestamp) {
    if (!this.currentMaskLiftEvent) return;
    
    const elapsedSeconds = (timestamp - this.currentMaskLiftEvent.timestamp) / 1000;
    
    // Store reading for analysis
    this.currentMaskLiftEvent.readings.push({ time: elapsedSeconds, spo2 });
    
    // Capture 10-second recovery
    if (!this.currentMaskLiftEvent.spo2Recovery10s && elapsedSeconds >= 10 && elapsedSeconds <= 11) {
      this.currentMaskLiftEvent.spo2Recovery10s = spo2 - this.currentMaskLiftEvent.spo2AtLift;
      log.info(`Mask lift 10s recovery: ${this.currentMaskLiftEvent.spo2Recovery10s} (${this.currentMaskLiftEvent.spo2AtLift} → ${spo2})`);
    }
    
    // Capture 15-second recovery
    if (!this.currentMaskLiftEvent.spo2Recovery15s && elapsedSeconds >= 15 && elapsedSeconds <= 16) {
      this.currentMaskLiftEvent.spo2Recovery15s = spo2 - this.currentMaskLiftEvent.spo2AtLift;
      log.info(`Mask lift 15s recovery: ${this.currentMaskLiftEvent.spo2Recovery15s} (${this.currentMaskLiftEvent.spo2AtLift} → ${spo2})`);
      
      // Complete the mask lift event and store it
      this.maskLiftEvents.push(this.currentMaskLiftEvent);
      this.currentMaskLiftEvent = null;
    }
    
    // Timeout after 20 seconds if we haven't captured all data
    if (elapsedSeconds > 20) {
      this.maskLiftEvents.push(this.currentMaskLiftEvent);
      this.currentMaskLiftEvent = null;
    }
  }

  recordMaskLift() {
    this.totalMaskLifts++;
    
    // Start tracking mask lift recovery
    this.currentMaskLiftEvent = {
      timestamp: Date.now(),
      spo2AtLift: this.lastSpO2,
      hrAtLift: this.lastHR,
      spo2Recovery10s: null,
      spo2Recovery15s: null,
      readings: []
    };
    
    log.info(`Mask lift recorded. Total: ${this.totalMaskLifts}, SpO2 at lift: ${this.lastSpO2}`);
  }

  calculateVolatility(readings, inZoneOnly = false, outOfZoneOnly = false) {
    if (!readings || readings.length < 2) return null;
    
    let filteredReadings = readings;
    if (inZoneOnly) {
      filteredReadings = readings.filter(r => r >= 85 && r <= 90);
    } else if (outOfZoneOnly) {
      filteredReadings = readings.filter(r => r < 85 || r > 90);
    }
    
    if (filteredReadings.length < 2) return null;
    
    const mean = filteredReadings.reduce((a, b) => a + b, 0) / filteredReadings.length;
    const variance = filteredReadings.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / filteredReadings.length;
    return Math.sqrt(variance);
  }

  calculatePhaseMetrics() {
    if (!this.phaseSpO2Readings.length) return null;
    
    const metrics = {
      phaseType: this.currentPhase,
      phaseId: this.currentPhaseId,
      duration: Math.round((Date.now() - this.phaseStartTime) / 1000),
      
      // SpO2 statistics
      minSpO2: Math.min(...this.phaseSpO2Readings),
      maxSpO2: Math.max(...this.phaseSpO2Readings),
      avgSpO2: this.phaseSpO2Readings.reduce((a, b) => a + b, 0) / this.phaseSpO2Readings.length,
      
      // Volatility (3 types)
      spo2VolatilityTotal: this.calculateVolatility(this.phaseSpO2Readings),
      spo2VolatilityInZone: this.calculateVolatility(this.phaseSpO2Readings, true, false),
      spo2VolatilityOutOfZone: this.calculateVolatility(this.phaseSpO2Readings, false, true),
      
      // Heart rate
      peakHeartRate: this.peakHeartRate,
      avgHeartRate: this.phaseHRReadings.length > 0 
        ? this.phaseHRReadings.reduce((a, b) => a + b, 0) / this.phaseHRReadings.length 
        : null
    };
    
    if (this.currentPhase === 'ALTITUDE') {
      metrics.timeInTherapeuticZone = this.timeInZone;
      metrics.timeToTherapeuticZone = this.timeToTherapeuticZone;
      metrics.timeBelow83 = this.timeBelow83;
      metrics.therapeuticEfficiency = this.timeInZone / metrics.duration;
    } else if (this.currentPhase === 'RECOVERY') {
      metrics.timeToReach95 = this.timeToReach95;
      metrics.hrRecovery60s = this.calculateHRRecovery60s();
      metrics.spo2RecoverySlope = this.calculateRecoverySlope();
    }
    
    return metrics;
  }

  calculateHRRecovery60s() {
    if (!this.recoveryStartHR || !this.phaseHRReadings.length) return null;
    
    // Get HR at ~60 seconds into recovery (assuming 1 reading per second)
    const hrAt60s = this.phaseHRReadings[Math.min(60, this.phaseHRReadings.length - 1)];
    return this.recoveryStartHR - hrAt60s;
  }

  calculateRecoverySlope() {
    if (this.phaseSpO2Readings.length < 2) return null;
    
    // Simple linear regression for recovery slope
    const n = Math.min(30, this.phaseSpO2Readings.length); // First 30 seconds
    const readings = this.phaseSpO2Readings.slice(0, n);
    
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let i = 0; i < readings.length; i++) {
      sumX += i;
      sumY += readings[i];
      sumXY += i * readings[i];
      sumX2 += i * i;
    }
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return slope; // Positive slope = SpO2 increasing
  }

  async saveCycleMetrics(cycleNumber, hypoxicPhaseId, recoveryPhaseId) {
    const hypoxicMetrics = this.cycleMetrics.find(m => m.phaseId === hypoxicPhaseId);
    const recoveryMetrics = this.cycleMetrics.find(m => m.phaseId === recoveryPhaseId);
    
    if (!hypoxicMetrics) {
      log.warn(`No hypoxic metrics found for cycle ${cycleNumber}`);
      return;
    }
    
    const cycleData = {
      sessionId: this.sessionId,
      cycleNumber: cycleNumber,
      
      // Hypoxic phase metrics
      hypoxicPhaseId: hypoxicPhaseId,
      desaturationRate: hypoxicMetrics.timeToTherapeuticZone,
      timeInZone: hypoxicMetrics.timeInTherapeuticZone,
      timeBelow83: hypoxicMetrics.timeBelow83,
      spo2VolatilityInZone: hypoxicMetrics.spo2VolatilityInZone,
      spo2VolatilityOutOfZone: hypoxicMetrics.spo2VolatilityOutOfZone,
      spo2VolatilityTotal: hypoxicMetrics.spo2VolatilityTotal,
      minSpO2: hypoxicMetrics.minSpO2,
      hypoxicDuration: hypoxicMetrics.duration,
      
      // Recovery phase metrics (if available)
      recoveryPhaseId: recoveryPhaseId,
      spo2RecoveryTime: recoveryMetrics?.timeToReach95,
      hrRecovery60s: recoveryMetrics?.hrRecovery60s,
      peakHrHypoxic: hypoxicMetrics.peakHeartRate,
      hrAtRecoveryStart: recoveryMetrics?.avgHeartRate,
      recoveryDuration: recoveryMetrics?.duration,
      
      // Calculate cycle score (simple example)
      cycleAdaptationScore: this.calculateCycleScore(hypoxicMetrics, recoveryMetrics)
    };
    
    // Save to database
    const { default: DatabaseService } = await import('./DatabaseService.js');
    await DatabaseService.saveCycleMetrics(cycleData);
    
    log.info(`Saved metrics for cycle ${cycleNumber}`);
  }

  calculateCycleScore(hypoxicMetrics, recoveryMetrics) {
    let score = 100;
    
    // Penalize for low time in zone
    if (hypoxicMetrics.timeInTherapeuticZone < 180) { // Less than 3 minutes
      score -= 20;
    }
    
    // Penalize for high time below safety threshold
    if (hypoxicMetrics.timeBelow83 > 30) { // More than 30 seconds
      score -= 15;
    }
    
    // Reward for quick recovery
    if (recoveryMetrics?.timeToReach95 && recoveryMetrics.timeToReach95 < 60) {
      score += 10;
    }
    
    // Penalize for high volatility
    if (hypoxicMetrics.spo2VolatilityTotal > 3) {
      score -= 10;
    }
    
    return Math.max(0, Math.min(100, score));
  }

  async calculateSessionMetrics() {
    if (this.cycleMetrics.length === 0) return null;
    
    // Calculate aggregates from cycle metrics
    const desaturationRates = this.cycleMetrics
      .filter(m => m.timeToTherapeuticZone)
      .map(m => m.timeToTherapeuticZone);
    
    const recoveryTimes = this.cycleMetrics
      .filter(m => m.timeToReach95)
      .map(m => m.timeToReach95);
    
    const cycleScores = this.cycleMetrics
      .map((m, i) => this.calculateCycleScore(m, this.cycleMetrics[i + 1]))
      .filter(s => s !== null);
    
    const sessionMetrics = {
      sessionId: this.sessionId,
      
      // Hypoxic efficiency
      totalTimeInZone: this.totalTimeInZone,
      avgDesaturationRate: desaturationRates.length ? 
        desaturationRates.reduce((a, b) => a + b, 0) / desaturationRates.length : null,
      minDesaturationRate: desaturationRates.length ? Math.min(...desaturationRates) : null,
      maxDesaturationRate: desaturationRates.length ? Math.max(...desaturationRates) : null,
      desaturationConsistency: this.calculateStdDev(desaturationRates),
      
      // Recovery dynamics
      avgSpo2RecoveryTime: recoveryTimes.length ?
        recoveryTimes.reduce((a, b) => a + b, 0) / recoveryTimes.length : null,
      minSpo2RecoveryTime: recoveryTimes.length ? Math.min(...recoveryTimes) : null,
      maxSpo2RecoveryTime: recoveryTimes.length ? Math.max(...recoveryTimes) : null,
      recoveryConsistency: this.calculateStdDev(recoveryTimes),
      
      // Stability
      hypoxicStabilityScore: Math.max(0, 100 - (this.totalMaskLifts * 10)),
      totalMaskLifts: this.totalMaskLifts,
      
      // Mask lift recovery metrics
      avgMaskLiftRecovery10s: this.calculateAvgMaskLiftRecovery(10),
      avgMaskLiftRecovery15s: this.calculateAvgMaskLiftRecovery(15),
      
      // Progression
      firstCycleScore: cycleScores[0] || null,
      lastCycleScore: cycleScores[cycleScores.length - 1] || null,
      intraSessionImprovement: cycleScores.length >= 2 ? 
        cycleScores[cycleScores.length - 1] - cycleScores[0] : null,
      
      // Overall score
      sessionAdaptationIndex: cycleScores.length ?
        cycleScores.reduce((a, b) => a + b, 0) / cycleScores.length : null
    };
    
    // Save to database
    const { default: DatabaseService } = await import('./DatabaseService.js');
    await DatabaseService.saveAdaptationMetrics(sessionMetrics);
    
    log.info('Saved session adaptation metrics');
    return sessionMetrics;
  }

  calculateStdDev(values) {
    if (!values || values.length < 2) return null;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  calculateAvgMaskLiftRecovery(seconds) {
    if (this.maskLiftEvents.length === 0) return null;
    
    const recoveries = this.maskLiftEvents
      .map(event => seconds === 10 ? event.spo2Recovery10s : event.spo2Recovery15s)
      .filter(recovery => recovery !== null && recovery !== undefined);
    
    if (recoveries.length === 0) return null;
    
    return recoveries.reduce((a, b) => a + b, 0) / recoveries.length;
  }

  async endPhase() {
    if (this.currentPhase && this.phaseStartTime) {
      const metrics = this.calculatePhaseMetrics();
      if (metrics) {
        this.cycleMetrics.push(metrics);
        
        // Save phase stats to database
        const phaseStats = {
          sessionId: this.sessionId,
          phaseType: this.currentPhase.toLowerCase(),
          phaseNumber: this.currentCycle,
          altitudeLevel: this.currentPhase === 'ALTITUDE' ? this.currentAltitudeLevel : null,
          startTime: new Date(this.phaseStartTime).toISOString(),
          endTime: new Date().toISOString(),
          durationSeconds: metrics.duration,
          minSpO2: metrics.minSpO2,
          maxSpO2: metrics.maxSpO2,
          avgSpO2: metrics.avgSpO2,
          spo2ReadingsCount: this.phaseSpO2Readings.length,
          maskLiftCount: this.totalMaskLifts,
          timeInTherapeuticZone: metrics.timeInTherapeuticZone || 0,
          timeToTherapeuticZone: metrics.timeToTherapeuticZone || null,
          spo2VolatilityInZone: metrics.spo2VolatilityInZone,
          spo2VolatilityOutOfZone: metrics.spo2VolatilityOutOfZone,
          spo2VolatilityTotal: metrics.spo2VolatilityTotal,
          timeBelow83: metrics.timeBelow83 || 0,
          peakHeartRate: metrics.peakHeartRate,
          hrAtPhaseEnd: this.lastHR,
          hrRecovery60s: metrics.hrRecovery60s,
          spo2RecoverySlope: metrics.spo2RecoverySlope
        };
        
        // Save phase stats
        const { default: DatabaseService } = await import('./DatabaseService.js');
        await DatabaseService.savePhaseStats(phaseStats);
        log.info(`Saved ${this.currentPhase} phase stats to database`);
        
        // If we just completed a RECOVERY phase, save the cycle metrics
        // A cycle consists of ALTITUDE + RECOVERY phases
        if (this.currentPhase === 'RECOVERY' && this.currentCycle) {
          // Find the altitude and recovery phases for this cycle
          const altitudePhase = this.cycleMetrics[this.cycleMetrics.length - 2]; // Second to last
          const recoveryPhase = this.cycleMetrics[this.cycleMetrics.length - 1]; // Last
          
          if (altitudePhase && recoveryPhase) {
            await this.saveCycleMetrics(
              this.currentCycle,
              altitudePhase.phaseId,
              recoveryPhase.phaseId
            );
            log.info(`Saved cycle ${this.currentCycle} metrics to database`);
          }
        }
      }
    }
  }

  endSession() {
    this.endPhase(); // Save last phase
    this.calculateSessionMetrics();
    log.info(`Ended metrics tracking for session ${this.sessionId}`);
  }
}

export default new IHHTMetricsTracker();