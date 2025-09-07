/**
 * Adaptive Instruction Engine for IHHT Sessions
 * Handles SpO2-based altitude adjustments and mask lift instructions
 */

import logger from '../utils/logger';
import DatabaseService from './DatabaseService';
import SupabaseService from './SupabaseService';

const log = logger.createModuleLogger('AdaptiveInstructionEngine');

class AdaptiveInstructionEngine {
  constructor() {
    // Improved mask lift system with cooldown and escalation
    this.maskLiftState = {
      isInCooldown: false,
      cooldownStartTime: null,
      lastInstructionTime: 0,
      pendingEvaluation: false,
      spo2AtInstruction: null,
      completedCycles: 0  // Only count after 15-second evaluation
    };
    
    this.MASK_LIFT_COOLDOWN = 15000; // 15 seconds cooldown
    this.CRITICAL_SPO2 = 75; // Critical threshold for immediate action
    
    // Current phase tracking
    this.currentPhaseStats = null;
    this.currentPhaseMaskLifts = 0; // This will track completed cycles
    this.currentPhaseMinSpO2 = null;
    this.currentPhaseMaxSpO2 = null;
    this.currentPhaseSpO2Readings = [];
    
    // Recovery phase tracking
    this.recoveryPhaseTimer = {
      isTimerRunning: false,
      timerStartTime: null,
      accumulatedTimeAbove95: 0,
      spo2History: []
    };
    
    // Altitude dial adjustment tracking
    this.currentAltitudeLevel = 6; // Default starting level
    this.pendingDialAdjustment = null; // Store adjustment for display during recovery
    this.currentSessionId = null;
    this.lastTenSecondsStats = null; // Track last 10 seconds of hypoxic phase
  }

  /**
   * Determine if user should have calibration or training session
   */
  static async determineSessionType(userId) {
    try {
      // Check if user has any completed sessions with adaptive system enabled
      const completedAdaptiveSessions = await DatabaseService.getCompletedAdaptiveSessions(userId);
      
      if (completedAdaptiveSessions.length === 0) {
        log.info('No completed adaptive sessions found - setting as calibration session');
        return 'calibration';
      } else {
        log.info(`Found ${completedAdaptiveSessions.length} completed adaptive sessions - setting as training session`);
        return 'training';
      }
    } catch (error) {
      log.error('Error determining session type, defaulting to calibration:', error);
      return 'calibration'; // Safe default
    }
  }

  /**
   * Get SpO2 target ranges based on session type
   */
  static getTargetRanges(sessionType) {
    return sessionType === 'calibration' 
      ? { min: 88, max: 93 }  // Calibration: [88,93]
      : { min: 85, max: 90 }; // Training: [85,90]
  }

  /**
   * Get altitude level display information
   */
  static async getAltitudeLevelInfo(level) {
    try {
      const altitudeInfo = await DatabaseService.getAltitudeLevel(level);
      if (altitudeInfo) {
        return {
          level: altitudeInfo.level,
          oxygenPercentage: altitudeInfo.oxygen_percentage,
          altitudeFeet: altitudeInfo.equivalent_altitude_feet,
          altitudeMeters: altitudeInfo.equivalent_altitude_meters,
          displayName: altitudeInfo.display_name
        };
      }
    } catch (error) {
      log.error('Error getting altitude level info:', error);
    }
    
    // Fallback if database lookup fails
    const altitudeLevels = [
      { level: 0, oxygenPercentage: 18.0, altitudeFeet: 4000, altitudeMeters: 1219, displayName: '~4,000 ft / 1,219 m' },
      { level: 1, oxygenPercentage: 17.1, altitudeFeet: 5500, altitudeMeters: 1676, displayName: '~5,500 ft / 1,676 m' },
      { level: 2, oxygenPercentage: 16.2, altitudeFeet: 7500, altitudeMeters: 2286, displayName: '~7,500 ft / 2,286 m' },
      { level: 3, oxygenPercentage: 15.3, altitudeFeet: 9500, altitudeMeters: 2896, displayName: '~9,500 ft / 2,896 m' },
      { level: 4, oxygenPercentage: 14.4, altitudeFeet: 11500, altitudeMeters: 3505, displayName: '~11,500 ft / 3,505 m' },
      { level: 5, oxygenPercentage: 13.5, altitudeFeet: 13500, altitudeMeters: 4115, displayName: '~13,500 ft / 4,115 m' },
      { level: 6, oxygenPercentage: 12.6, altitudeFeet: 15500, altitudeMeters: 4724, displayName: '~15,500 ft / 4,724 m' },
      { level: 7, oxygenPercentage: 11.7, altitudeFeet: 18000, altitudeMeters: 5486, displayName: '~18,000 ft / 5,486 m' },
      { level: 8, oxygenPercentage: 10.8, altitudeFeet: 20500, altitudeMeters: 6248, displayName: '~20,500 ft / 6,248 m' },
      { level: 9, oxygenPercentage: 9.9, altitudeFeet: 23000, altitudeMeters: 7010, displayName: '~23,000 ft / 7,010 m' },
      { level: 10, oxygenPercentage: 9.0, altitudeFeet: 26500, altitudeMeters: 8077, displayName: '~26,500 ft / 8,077 m' }
    ];
    
    return altitudeLevels.find(a => a.level === level) || altitudeLevels[6]; // Default to level 6
  }

  /**
   * Start tracking a new altitude phase
   */
  startAltitudePhase(sessionId, phaseNumber, altitudeLevel, sessionType) {
    this.sessionType = sessionType; // Store session type
    const targets = AdaptiveInstructionEngine.getTargetRanges(sessionType);
    
    this.currentPhaseStats = {
      sessionId,
      phaseType: 'altitude',
      phaseNumber,
      altitudeLevel,
      startTime: Date.now(),
      targetMinSpO2: targets.min,
      targetMaxSpO2: targets.max
    };
    
    // Reset phase counters
    this.currentPhaseMaskLifts = 0;
    this.currentPhaseMinSpO2 = null;
    this.currentPhaseMaxSpO2 = null;
    this.currentPhaseSpO2Readings = [];
    
    // Reset mask lift state for new phase
    this.maskLiftState = {
      isInCooldown: false,
      cooldownStartTime: null,
      lastInstructionTime: 0,
      pendingEvaluation: false,
      spo2AtInstruction: null,
      completedCycles: 0
    };
    
    log.info(`Started altitude phase ${phaseNumber} at level ${altitudeLevel}`, {
      targets,
      sessionId
    });
  }

  /**
   * Process SpO2 reading during altitude phase with improved mask lift system
   */
  processAltitudeSpO2Reading(currentSpO2, sessionType, timestamp = Date.now()) {
    if (!this.currentPhaseStats || this.currentPhaseStats.phaseType !== 'altitude') {
      return null;
    }

    // Update SpO2 statistics
    this.currentPhaseSpO2Readings.push({ spo2: currentSpO2, timestamp });
    
    if (this.currentPhaseMinSpO2 === null || currentSpO2 < this.currentPhaseMinSpO2) {
      this.currentPhaseMinSpO2 = currentSpO2;
    }
    if (this.currentPhaseMaxSpO2 === null || currentSpO2 > this.currentPhaseMaxSpO2) {
      this.currentPhaseMaxSpO2 = currentSpO2;
    }

    // Fixed thresholds regardless of session type
    const maskLiftThreshold = 83; // Single breath threshold
    
    // Check if we're in cooldown period
    if (this.maskLiftState.isInCooldown) {
      const cooldownElapsed = timestamp - this.maskLiftState.cooldownStartTime;
      
      // Critical SpO2 check during cooldown
      if (currentSpO2 < this.CRITICAL_SPO2) {
        // Emergency: End cooldown immediately and issue critical instruction
        this.maskLiftState.isInCooldown = false;
        this.maskLiftState.pendingEvaluation = false;
        
        log.warn(`CRITICAL SpO2 during cooldown: ${currentSpO2}%`);
        
        return {
          instruction: 'mask_lift_critical',
          message: 'CRITICAL: Lift mask and take 3 deep breaths immediately',
          spo2Value: currentSpO2,
          isCritical: true
        };
      }
      
      // Check if cooldown period is complete (15 seconds)
      if (cooldownElapsed >= this.MASK_LIFT_COOLDOWN) {
        // Cooldown complete - evaluate if another instruction is needed
        this.maskLiftState.isInCooldown = false;
        
        // Determine if escalation is needed based on current SpO2
        let breaths = 1;
        let message = 'Lift mask and take one breath';
        
        if (currentSpO2 < 80) {
          // SpO2 below 80% - escalate to 2 breaths
          breaths = 2;
          message = 'Lift mask and take two deep breaths';
          
          log.info(`Escalating mask lift instruction after cooldown`, {
            spo2: currentSpO2,
            originalSpO2: this.maskLiftState.spo2AtInstruction,
            breaths
          });
        } else if (currentSpO2 <= maskLiftThreshold) {
          // Still below threshold but not critical - 1 breath
          log.info(`Additional mask lift needed after cooldown`, {
            spo2: currentSpO2,
            originalSpO2: this.maskLiftState.spo2AtInstruction
          });
        } else {
          // SpO2 recovered during cooldown - mark cycle as complete
          this.maskLiftState.completedCycles++;
          this.currentPhaseMaskLifts = this.maskLiftState.completedCycles;
          
          log.info(`SpO2 recovered during cooldown`, {
            spo2: currentSpO2,
            completedCycles: this.maskLiftState.completedCycles
          });
          
          return null; // No additional instruction needed
        }
        
        // Issue follow-up instruction and start new cooldown
        this.maskLiftState.cooldownStartTime = timestamp;
        this.maskLiftState.isInCooldown = true;
        this.maskLiftState.spo2AtInstruction = currentSpO2;
        
        // Record mask lift event
        this.recordAdaptiveEvent('mask_lift_escalated', {
          spo2Value: currentSpO2,
          breaths,
          phaseNumber: this.currentPhaseStats.phaseNumber,
          previousSpO2: this.maskLiftState.spo2AtInstruction
        });
        
        return {
          instruction: 'mask_lift',
          message,
          spo2Value: currentSpO2,
          threshold: maskLiftThreshold,
          breaths,
          isEscalated: true
        };
      }
      
      // Still in cooldown - no new instructions
      return null;
    }
    
    // Not in cooldown - check if mask lift instruction is needed
    if (currentSpO2 <= maskLiftThreshold) {
      // Determine number of breaths based on SpO2 level
      let breaths = 1;
      let message = 'Lift mask 1mm, small breath';
      
      if (currentSpO2 < 80) {
        breaths = 2;
        message = 'Lift mask and take two deep breaths';
      }
      
      // Start cooldown period
      this.maskLiftState.isInCooldown = true;
      this.maskLiftState.cooldownStartTime = timestamp;
      this.maskLiftState.lastInstructionTime = timestamp;
      this.maskLiftState.spo2AtInstruction = currentSpO2;
      this.maskLiftState.pendingEvaluation = true;
      
      log.info(`Mask lift instruction triggered with cooldown`, {
        spo2: currentSpO2,
        threshold: maskLiftThreshold,
        breaths,
        cooldownDuration: this.MASK_LIFT_COOLDOWN
      });
      
      // Record mask lift event
      this.recordAdaptiveEvent('mask_lift', {
        spo2Value: currentSpO2,
        threshold: maskLiftThreshold,
        breaths,
        phaseNumber: this.currentPhaseStats.phaseNumber
      });
      
      return {
        instruction: 'mask_lift',
        message,
        spo2Value: currentSpO2,
        threshold: maskLiftThreshold,
        breaths,
        cooldownActive: true
      };
    }
    
    return null;
  }

  /**
   * End altitude phase and calculate adjustments
   */
  async endAltitudePhase() {
    if (!this.currentPhaseStats || this.currentPhaseStats.phaseType !== 'altitude') {
      log.error('Cannot end altitude phase - no active altitude phase');
      return null;
    }

    const endTime = Date.now();
    const duration = Math.floor((endTime - this.currentPhaseStats.startTime) / 1000);
    
    // Calculate average SpO2
    const avgSpO2 = this.currentPhaseSpO2Readings.length > 0 
      ? this.currentPhaseSpO2Readings.reduce((sum, reading) => sum + reading.spo2, 0) / this.currentPhaseSpO2Readings.length
      : null;

    // Complete phase stats - use completed cycles for mask lift count
    const phaseStats = {
      ...this.currentPhaseStats,
      endTime,
      durationSeconds: duration,
      minSpO2: this.currentPhaseMinSpO2,
      maxSpO2: this.currentPhaseMaxSpO2,
      avgSpO2: Math.round(avgSpO2 * 10) / 10, // Round to 1 decimal
      spo2ReadingsCount: this.currentPhaseSpO2Readings.length,
      maskLiftCount: this.maskLiftState.completedCycles // Use completed cycles only
    };

    // Calculate altitude adjustment for next phase
    const altitudeAdjustment = this.calculateAltitudeAdjustment(phaseStats);

    // Save phase stats immediately
    try {
      await DatabaseService.savePhaseStats(phaseStats);
      await SupabaseService.savePhaseStats(phaseStats);
      log.info('Phase stats saved successfully');
    } catch (error) {
      log.error('Error saving phase stats:', error);
    }

    // Record altitude phase complete event
    await this.recordAdaptiveEvent('altitude_phase_complete', {
      phaseNumber: phaseStats.phaseNumber,
      durationSeconds: duration,
      minSpO2: this.currentPhaseMinSpO2,
      maxSpO2: this.currentPhaseMaxSpO2,
      maskLiftCount: this.currentPhaseMaskLifts
    });

    log.info(`Altitude phase ${phaseStats.phaseNumber} completed`, {
      duration,
      minSpO2: this.currentPhaseMinSpO2,
      maxSpO2: this.currentPhaseMaxSpO2,
      completedMaskLiftCycles: this.maskLiftState.completedCycles,
      altitudeAdjustment
    });

    this.currentPhaseStats = null;
    return { phaseStats, altitudeAdjustment };
  }

  /**
   * Calculate altitude adjustment based on phase performance
   * Called during last 10 seconds of hypoxic phase
   */
  calculateDialAdjustment(phaseStats, currentLevel) {
    const { avgSpO2, maskLifts } = phaseStats;
    
    // Check for increase condition - simplified logic
    if (avgSpO2 > 90) {
      const newLevel = Math.min(11, currentLevel + 1);
      return { 
        action: 'increase', 
        newLevel,
        reason: `SpO2 too high (${avgSpO2.toFixed(1)}%), can handle more altitude`
      };
    }
    
    // Check for decrease condition - simplified logic
    if (avgSpO2 < 85) {
      const newLevel = Math.max(0, currentLevel - 1);
      return { 
        action: 'decrease', 
        newLevel,
        reason: `SpO2 too low (${avgSpO2.toFixed(1)}%)`
      };
    }
    
    return { action: 'none', reason: 'Performance optimal' };
  }

  /**
   * Process end of hypoxic phase and calculate dial adjustment
   * Called in last 10 seconds of hypoxic phase
   */
  processHypoxicPhaseEnd(sessionId, cycleNumber, stats) {
    const adjustment = this.calculateDialAdjustment(stats, this.currentAltitudeLevel);
    
    if (adjustment.action !== 'none') {
      // Store for display during recovery
      this.pendingDialAdjustment = adjustment;
      
      // Log the recommendation
      log.info(`📊 Dial adjustment recommended: ${adjustment.action} to level ${adjustment.newLevel}`);
      log.info(`   Reason: ${adjustment.reason}`);
      log.info(`   Based on: avgSpO2=${stats.avgSpO2}%, maskLifts=${stats.maskLifts}`);
      
      // Save as adaptive event
      DatabaseService.saveAdaptiveEvent({
        session_id: sessionId,
        event_type: 'dial_adjustment_recommended',
        event_timestamp: Date.now(),
        current_altitude_level: this.currentAltitudeLevel,
        additionalData: {
          cycleNumber,
          currentLevel: this.currentAltitudeLevel,
          newLevel: adjustment.newLevel,
          action: adjustment.action,
          reason: adjustment.reason,
          avgSpO2: stats.avgSpO2,
          maskLifts: stats.maskLifts
        }
      });
    }
    
    return adjustment;
  }

  /**
   * Get pending adjustment for UI display
   */
  getPendingDialAdjustment() {
    const adjustment = this.pendingDialAdjustment;
    this.pendingDialAdjustment = null; // Clear after retrieval
    return adjustment;
  }

  /**
   * Confirm user adjusted the dial
   */
  confirmDialAdjustment(newLevel) {
    this.currentAltitudeLevel = newLevel;
    
    // Save as adaptive event
    if (this.currentSessionId) {
      DatabaseService.saveAdaptiveEvent({
        session_id: this.currentSessionId,
        event_type: 'dial_adjustment_confirmed',
        event_timestamp: Date.now(),
        current_altitude_level: newLevel,
        additionalData: {
          newLevel,
          timestamp: Date.now()
        }
      });
    }
    
    log.info(`✅ Dial adjustment confirmed: level ${newLevel}`);
  }

  /**
   * Original method for compatibility - enhanced version
   */
  calculateAltitudeAdjustment(phaseStats) {
    const { minSpO2, altitudeLevel, targetMinSpO2, targetMaxSpO2 } = phaseStats;
    // Use completed cycles from mask lift state instead of raw count
    const completedMaskLiftCycles = this.maskLiftState.completedCycles;
    
    let altitudeAdjustment = 0;
    let adjustmentReason = '';
    
    // Priority 1: Check for completed mask lift cycles (dial down takes precedence)
    if (completedMaskLiftCycles >= 2) {
      altitudeAdjustment = -1;
      adjustmentReason = `Completed ${completedMaskLiftCycles} mask lift cycles (SpO2 dropped below ${targetMinSpO2 - 2}%)`;
    }
    // Priority 2: Check if min SpO2 was too high (only if no dial down needed)
    else if (minSpO2 >= targetMaxSpO2) {
      altitudeAdjustment = +1;
      adjustmentReason = `Minimum SpO2 (${minSpO2}%) was above target maximum (${targetMaxSpO2}%)`;
    }
    
    // Apply bounds checking (0-11 range)
    const newAltitudeLevel = Math.max(0, Math.min(11, altitudeLevel + altitudeAdjustment));
    const actualAdjustment = newAltitudeLevel - altitudeLevel;
    const hitBounds = actualAdjustment !== altitudeAdjustment;
    
    if (hitBounds) {
      adjustmentReason += ` (limited by altitude bounds)`;
    }
    
    // Store for display if there's an adjustment
    if (actualAdjustment !== 0) {
      this.pendingDialAdjustment = {
        action: actualAdjustment > 0 ? 'increase' : 'decrease',
        newLevel: newAltitudeLevel,
        reason: adjustmentReason
      };
    }
    
    return {
      newAltitudeLevel,
      adjustment: actualAdjustment,
      requestedAdjustment: altitudeAdjustment,
      hitBounds,
      reason: adjustmentReason,
      completedMaskLiftCycles,
      instruction: actualAdjustment !== 0 
        ? `Adjust altitude dial to level ${newAltitudeLevel}` 
        : 'Keep altitude dial at current level'
    };
  }

  /**
   * Start tracking recovery phase
   */
  startRecoveryPhase(sessionId, phaseNumber) {
    this.currentPhaseStats = {
      sessionId,
      phaseType: 'recovery',
      phaseNumber,
      startTime: Date.now(),
      targetMinSpO2: 95, // Recovery target
      targetMaxSpO2: 100
    };
    
    // Reset recovery timer
    this.recoveryPhaseTimer = {
      isTimerRunning: false,
      timerStartTime: null,
      accumulatedTimeAbove95: 0,
      spo2History: []
    };
    
    log.info(`Started recovery phase ${phaseNumber}`);
  }

  /**
   * Process SpO2 reading during recovery phase
   */
  processRecoverySpO2Reading(currentSpO2, timestamp = Date.now()) {
    if (!this.currentPhaseStats || this.currentPhaseStats.phaseType !== 'recovery') {
      return null;
    }

    // Add to SpO2 history (keep last 3 minutes)
    this.recoveryPhaseTimer.spo2History.push({ spo2: currentSpO2, timestamp });
    const threeMinutesAgo = timestamp - 180000;
    this.recoveryPhaseTimer.spo2History = this.recoveryPhaseTimer.spo2History
      .filter(reading => reading.timestamp >= threeMinutesAgo);

    // Manage recovery timer
    const timerState = this.manageRecoveryTimer(currentSpO2, timestamp);
    
    // Check if recovery phase should end
    const phaseElapsedSeconds = (timestamp - this.currentPhaseStats.startTime) / 1000;
    const maxRecoverySeconds = 180; // 3 minutes maximum
    
    // Check 3-minute time limit first
    if (phaseElapsedSeconds >= maxRecoverySeconds) {
      return {
        shouldEndPhase: true,
        reason: 'time_limit',
        actualDuration: maxRecoverySeconds
      };
    }
    
    // Check if accumulated time above 95% reaches 60 seconds
    if (timerState.totalTimeAbove95 >= 60) {
      return {
        shouldEndPhase: true,
        reason: 'spo2_stabilized',
        actualDuration: phaseElapsedSeconds,
        timeAbove95: timerState.totalTimeAbove95
      };
    }
    
    return { 
      shouldEndPhase: false,
      timeAbove95: timerState.totalTimeAbove95,
      remainingTime: Math.max(0, maxRecoverySeconds - phaseElapsedSeconds)
    };
  }

  /**
   * Manage recovery timer (Option B - don't reset, accumulate time)
   */
  manageRecoveryTimer(currentSpO2, timestamp) {
    const timer = this.recoveryPhaseTimer;
    
    if (currentSpO2 >= 95) {
      if (!timer.isTimerRunning) {
        // Start timer
        timer.isTimerRunning = true;
        timer.timerStartTime = timestamp;
      }
      // Timer continues running - calculate total accumulated time
      const currentSessionTime = timestamp - timer.timerStartTime;
      const totalTimeAbove95 = timer.accumulatedTimeAbove95 + currentSessionTime;
      
      return { totalTimeAbove95: Math.floor(totalTimeAbove95 / 1000) }; // Convert to seconds
    } else {
      if (timer.isTimerRunning) {
        // Pause timer, accumulate time
        const sessionTime = timestamp - timer.timerStartTime;
        timer.accumulatedTimeAbove95 += sessionTime;
        timer.isTimerRunning = false;
        timer.timerStartTime = null;
      }
      return { totalTimeAbove95: Math.floor(timer.accumulatedTimeAbove95 / 1000) };
    }
  }

  /**
   * End recovery phase
   */
  async endRecoveryPhase(endReason = 'manual') {
    if (!this.currentPhaseStats || this.currentPhaseStats.phaseType !== 'recovery') {
      log.error('Cannot end recovery phase - no active recovery phase');
      return null;
    }

    const endTime = Date.now();
    const duration = Math.floor((endTime - this.currentPhaseStats.startTime) / 1000);
    
    // Calculate time to reach 95% and time above 95%
    const spo2History = this.recoveryPhaseTimer.spo2History;
    let timeTo95Seconds = null;
    let timeAbove95Seconds = Math.floor(this.recoveryPhaseTimer.accumulatedTimeAbove95 / 1000);
    
    const firstAbove95 = spo2History.find(reading => reading.spo2 >= 95);
    if (firstAbove95) {
      timeTo95Seconds = Math.floor((firstAbove95.timestamp - this.currentPhaseStats.startTime) / 1000);
    }

    const phaseStats = {
      ...this.currentPhaseStats,
      endTime,
      durationSeconds: duration,
      recoveryTrigger: endReason,
      timeTo95PercentSeconds: timeTo95Seconds,
      timeAbove95PercentSeconds: timeAbove95Seconds,
      maskLiftCount: 0, // No mask lifts in recovery phase
      minSpO2: spo2History.length > 0 ? Math.min(...spo2History.map(r => r.spo2)) : null,
      maxSpO2: spo2History.length > 0 ? Math.max(...spo2History.map(r => r.spo2)) : null,
      avgSpO2: spo2History.length > 0 
        ? Math.round((spo2History.reduce((sum, r) => sum + r.spo2, 0) / spo2History.length) * 10) / 10
        : null,
      spo2ReadingsCount: spo2History.length
    };

    // Save phase stats immediately
    try {
      await DatabaseService.savePhaseStats(phaseStats);
      await SupabaseService.savePhaseStats(phaseStats);
      log.info('Recovery phase stats saved successfully');
    } catch (error) {
      log.error('Error saving recovery phase stats:', error);
    }

    // Record recovery complete event
    await this.recordAdaptiveEvent('recovery_complete', {
      phaseNumber: phaseStats.phaseNumber,
      durationSeconds: duration,
      endReason,
      timeTo95Seconds,
      timeAbove95Seconds
    });

    log.info(`Recovery phase ${phaseStats.phaseNumber} completed`, {
      duration,
      endReason,
      timeTo95Seconds,
      timeAbove95Seconds
    });

    this.currentPhaseStats = null;
    return phaseStats;
  }

  /**
   * Record adaptive event in database
   */
  async recordAdaptiveEvent(eventType, additionalData = {}) {
    if (!this.currentPhaseStats) {
      log.warn('Cannot record adaptive event - no active phase stats');
      return;
    }

    if (!this.currentPhaseStats.sessionId) {
      log.error('Cannot record adaptive event - sessionId is missing:', this.currentPhaseStats);
      return;
    }

    const event = {
      session_id: this.currentPhaseStats.sessionId, // Fixed: use session_id not sessionId
      event_type: eventType,
      event_timestamp: new Date().toISOString(),
      altitude_phase_number: this.currentPhaseStats.phaseType === 'altitude' ? this.currentPhaseStats.phaseNumber : null,
      recovery_phase_number: this.currentPhaseStats.phaseType === 'recovery' ? this.currentPhaseStats.phaseNumber : null,
      current_altitude_level: this.currentPhaseStats.altitudeLevel || null,
      additional_data: JSON.stringify(additionalData)
    };

    try {
      await DatabaseService.saveAdaptiveEvent(event);
      
      // Try to save to Supabase if the method exists
      if (SupabaseService.saveAdaptiveEvent) {
        try {
          await SupabaseService.saveAdaptiveEvent(event);
        } catch (supabaseError) {
          console.log('⚠️ Failed to save adaptive event to Supabase:', supabaseError.message);
        }
      }
      
      log.info(`Adaptive event recorded: ${eventType} for session ${event.session_id}`);
    } catch (error) {
      log.error('Error recording adaptive event:', error);
    }
  }

  /**
   * Evaluate altitude phase end - called when phase naturally ends after 7 minutes
   * Returns altitude adjustment recommendation for NEXT altitude phase
   */
  evaluateAltitudePhaseEnd(currentSpO2, sessionType, phaseElapsedSeconds) {
    if (!this.currentPhaseStats || this.currentPhaseStats.phaseType !== 'altitude') {
      return { shouldAdvance: false };
    }

    // Altitude phases should NEVER end early based on SpO2
    // They always run for full 7 minutes unless user manually skips
    return { shouldAdvance: false };
  }

  /**
   * Calculate altitude adjustment for NEXT altitude phase (called when current altitude phase ends)
   */
  calculateNextAltitudeLevel() {
    if (!this.currentPhaseStats || this.currentPhaseStats.phaseType !== 'altitude') {
      return { adjustment: 0, reason: 'No active altitude phase' };
    }

    const targets = AdaptiveInstructionEngine.getTargetRanges(this.sessionType);
    const minSpO2 = this.currentPhaseMinSpO2;
    const currentLevel = this.currentPhaseStats.altitudeLevel;

    // Rule: If min SpO2 >= target max, increase altitude (+1)
    if (minSpO2 !== null && minSpO2 >= targets.max) {
      const newLevel = Math.min(10, currentLevel + 1); // Cap at level 10
      return {
        adjustment: +1,
        newLevel,
        reason: `Minimum SpO2 (${minSpO2}%) ≥ target maximum (${targets.max}%) - increase altitude`,
        minSpO2,
        targetMax: targets.max
      };
    }

    // Rule: If multiple completed mask lift cycles (≥2), decrease altitude (-1)  
    if (this.maskLiftState.completedCycles >= 2) {
      const newLevel = Math.max(0, currentLevel - 1); // Floor at level 0
      return {
        adjustment: -1,
        newLevel,
        reason: `Multiple completed mask lift cycles (${this.maskLiftState.completedCycles}) - decrease altitude`,
        completedMaskLiftCycles: this.maskLiftState.completedCycles
      };
    }

    // No adjustment needed
    return {
      adjustment: 0,
      newLevel: currentLevel,
      reason: `No adjustment needed - min SpO2: ${minSpO2}%, completed mask lift cycles: ${this.maskLiftState.completedCycles}`
    };
  }
}

export default AdaptiveInstructionEngine;
