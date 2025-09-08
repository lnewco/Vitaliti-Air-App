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
    // Simplified mask lift state machine
    this.maskLiftState = {
      hasTriggeredFirst: false,    // Triggered first mask lift at 83%
      firstTriggerTime: null,      // When first was triggered
      hasTriggeredSecond: false,   // Triggered second mask lift at <80%
      secondTriggerTime: null,     // When second was triggered
      lastInstructionTime: 0,      // Prevents rapid-fire instructions
      currentCycle: 0              // Track which cycle we're in
    };
    
    // Always use 15 second cooldown as specified
    this.MASK_LIFT_COOLDOWN = 15000; // 15 seconds always
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
    
    // Fallback if database lookup fails - updated to match AltitudeLevelSelector values
    const altitudeLevels = [
      { level: 0, oxygenPercentage: 18.0, altitudeFeet: 4500, altitudeMeters: 1372, displayName: '~4,500 ft / 1,372 m' },
      { level: 1, oxygenPercentage: 17.0, altitudeFeet: 6500, altitudeMeters: 1981, displayName: '~6,500 ft / 1,981 m' },
      { level: 2, oxygenPercentage: 16.0, altitudeFeet: 8500, altitudeMeters: 2591, displayName: '~8,500 ft / 2,591 m' },
      { level: 3, oxygenPercentage: 15.4, altitudeFeet: 10000, altitudeMeters: 3048, displayName: '~10,000 ft / 3,048 m' },
      { level: 4, oxygenPercentage: 14.3, altitudeFeet: 12000, altitudeMeters: 3658, displayName: '~12,000 ft / 3,658 m' },
      { level: 5, oxygenPercentage: 13.4, altitudeFeet: 14000, altitudeMeters: 4267, displayName: '~14,000 ft / 4,267 m' },
      { level: 6, oxygenPercentage: 12.5, altitudeFeet: 16000, altitudeMeters: 4877, displayName: '~16,000 ft / 4,877 m' },
      { level: 7, oxygenPercentage: 11.6, altitudeFeet: 18500, altitudeMeters: 5639, displayName: '~18,500 ft / 5,639 m' },
      { level: 8, oxygenPercentage: 10.7, altitudeFeet: 21000, altitudeMeters: 6401, displayName: '~21,000 ft / 6,401 m' },
      { level: 9, oxygenPercentage: 9.8, altitudeFeet: 23500, altitudeMeters: 7163, displayName: '~23,500 ft / 7,163 m' },
      { level: 10, oxygenPercentage: 9.0, altitudeFeet: 26000, altitudeMeters: 7925, displayName: '~26,000 ft / 7,925 m' },
      { level: 11, oxygenPercentage: 8.1, altitudeFeet: 28500, altitudeMeters: 8687, displayName: '~28,500 ft / 8,687 m' }
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
    
    // Always reset mask lift state when starting a new altitude phase
    // This ensures we get fresh mask lift triggers for each altitude phase
    console.log(`🔄 Starting altitude phase ${phaseNumber}, resetting mask lift state`);
    this.maskLiftState = {
      hasTriggeredFirst: false,
      firstTriggerTime: null,
      hasTriggeredSecond: false,
      secondTriggerTime: null,
      lastInstructionTime: 0,
      currentCycle: phaseNumber
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
    
    // EMERGENCY: Remove mask completely if SpO2 < 75
    if (currentSpO2 < 75) {
      console.log('🚨 EMERGENCY: SpO2 < 75% - Remove mask immediately');
      return {
        instruction: 'mask_remove',
        type: 'mask_remove',
        title: 'Remove Mask Immediately',
        message: 'EMERGENCY: Take off your mask completely',
        spo2Value: currentSpO2,
        isEmergency: true
      };
    }
    
    // STATE 1: No mask lift triggered yet
    if (!this.maskLiftState.hasTriggeredFirst) {
      if (currentSpO2 <= maskLiftThreshold) {
        // First mask lift trigger at 83%
        this.maskLiftState.hasTriggeredFirst = true;
        this.maskLiftState.firstTriggerTime = timestamp;
        this.maskLiftState.lastInstructionTime = timestamp;
        
        console.log('\n🎭 FIRST MASK LIFT (83% threshold)');
        console.log(`📊 SpO2: ${currentSpO2}%`);
        console.log(`⏱️ Starting 15-second cooldown`);
        
        // Record mask lift event
        this.recordAdaptiveEvent('mask_lift', {
          spo2Value: currentSpO2,
          threshold: maskLiftThreshold,
          breaths: 1,
          phaseNumber: this.currentPhaseStats.phaseNumber
        });
        
        return {
          instruction: 'mask_lift',
          type: 'mask_lift',
          title: 'Mask Lift',
          message: 'Lift mask 1mm, small breath',
          spo2Value: currentSpO2,
          threshold: maskLiftThreshold,
          breaths: 1
        };
      }
      return null;
    }
    
    // STATE 2: First mask lift triggered, waiting for cooldown or <80%
    if (this.maskLiftState.hasTriggeredFirst && !this.maskLiftState.hasTriggeredSecond) {
      const timeSinceFirst = timestamp - this.maskLiftState.firstTriggerTime;
      
      // Check if we're still in the 15-second cooldown window
      if (timeSinceFirst < this.MASK_LIFT_COOLDOWN) {
        // During cooldown, only trigger if SpO2 <= 80%
        if (currentSpO2 <= 80) {
          // Second mask lift trigger at 80% or below
          this.maskLiftState.hasTriggeredSecond = true;
          this.maskLiftState.secondTriggerTime = timestamp;
          this.maskLiftState.lastInstructionTime = timestamp;
          
          console.log('\n🎭 SECOND MASK LIFT (<=80% during cooldown)');
          console.log(`📊 SpO2: ${currentSpO2}%`);
          console.log(`⏱️ Time since first: ${Math.floor(timeSinceFirst/1000)}s`);
          
          // Record mask lift event
          this.recordAdaptiveEvent('mask_lift_escalated', {
            spo2Value: currentSpO2,
            breaths: 2,
            phaseNumber: this.currentPhaseStats.phaseNumber
          });
          
          return {
            instruction: 'mask_lift',
            type: 'mask_lift',
            title: 'Mask Lift Required',
            message: 'Lift mask and take two deep breaths',
            spo2Value: currentSpO2,
            breaths: 2,
            isEscalated: true
          };
        }
      } else {
        // Cooldown expired - reset state to allow new cycle
        console.log(`⏱️ First cooldown expired after ${Math.floor(timeSinceFirst/1000)}s - resetting for new cycle`);
        this.maskLiftState.hasTriggeredFirst = false;
        this.maskLiftState.firstTriggerTime = null;
        // Check if we need to trigger again immediately
        if (currentSpO2 <= maskLiftThreshold) {
          // Trigger new first mask lift
          this.maskLiftState.hasTriggeredFirst = true;
          this.maskLiftState.firstTriggerTime = timestamp;
          this.maskLiftState.lastInstructionTime = timestamp;
          
          console.log('\n🎭 NEW FIRST MASK LIFT (after cooldown expired)');
          console.log(`📊 SpO2: ${currentSpO2}%`);
          
          return {
            instruction: 'mask_lift',
            type: 'mask_lift',
            title: 'Mask Lift',
            message: 'Lift mask 1mm, small breath',
            spo2Value: currentSpO2,
            threshold: maskLiftThreshold,
            breaths: 1
          };
        }
      }
      return null;
    }
    
    // STATE 3: Both mask lifts triggered - wait for second cooldown then reset
    if (this.maskLiftState.hasTriggeredSecond) {
      const timeSinceSecond = timestamp - this.maskLiftState.secondTriggerTime;
      
      // After 15 seconds from second trigger, reset to allow new cycle
      if (timeSinceSecond >= this.MASK_LIFT_COOLDOWN) {
        console.log(`✅ Second cooldown complete after ${Math.floor(timeSinceSecond/1000)}s - resetting for new cycle`);
        this.maskLiftState.hasTriggeredFirst = false;
        this.maskLiftState.firstTriggerTime = null;
        this.maskLiftState.hasTriggeredSecond = false;
        this.maskLiftState.secondTriggerTime = null;
        
        // Check if we need to trigger again immediately
        if (currentSpO2 <= maskLiftThreshold) {
          // Start new cycle with first trigger
          this.maskLiftState.hasTriggeredFirst = true;
          this.maskLiftState.firstTriggerTime = timestamp;
          this.maskLiftState.lastInstructionTime = timestamp;
          
          console.log('\n🎭 NEW CYCLE FIRST MASK LIFT (after full cycle complete)');
          console.log(`📊 SpO2: ${currentSpO2}%`);
          
          return {
            instruction: 'mask_lift',
            type: 'mask_lift',
            title: 'Mask Lift',
            message: 'Lift mask 1mm, small breath',
            spo2Value: currentSpO2,
            threshold: maskLiftThreshold,
            breaths: 1
          };
        }
      }
      // Still in second cooldown period
      return null;
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
      maskLiftCount: this.maskLiftState.hasTriggeredSecond ? 2 : (this.maskLiftState.hasTriggeredFirst ? 1 : 0)
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
      avgSpO2: phaseStats.avgSpO2,
      completedMaskLiftCycles: this.maskLiftState.completedCycles,
      altitudeAdjustment
    });
    
    // Log dial adjustment decision for debugging
    console.log('\n📊 DIAL ADJUSTMENT EVALUATION:');
    console.log(`  Average SpO2: ${phaseStats.avgSpO2 ? phaseStats.avgSpO2 + '%' : 'N/A'}`);
    console.log(`  Mask lift cycles: ${this.maskLiftState.completedCycles}`);
    console.log(`  Decision: ${altitudeAdjustment.adjustment !== 0 ? altitudeAdjustment.reason : 'No adjustment needed'}`);

    this.currentPhaseStats = null;
    return { phaseStats, altitudeAdjustment };
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
    console.log('\n🎯 AdaptiveInstructionEngine: Confirming dial adjustment');
    console.log('📊 Previous level:', this.currentAltitudeLevel || this.currentPhaseStats?.altitudeLevel);
    console.log('📊 New level:', newLevel);
    
    this.currentAltitudeLevel = newLevel;
    
    // Update the phase stats to reflect the new level
    if (this.currentPhaseStats) {
      this.currentPhaseStats.altitudeLevel = newLevel;
      console.log('✅ Updated phase stats altitude level to:', newLevel);
    }
    
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
    const { minSpO2, avgSpO2, altitudeLevel, targetMinSpO2, targetMaxSpO2 } = phaseStats;
    // Check if we had multiple mask lifts (both triggers fired)
    const hadMultipleMaskLifts = this.maskLiftState.hasTriggeredSecond;
    
    let altitudeAdjustment = 0;
    let adjustmentReason = '';
    
    // Priority 1: Check for multiple mask lift triggers (dial down takes precedence)
    if (hadMultipleMaskLifts) {
      altitudeAdjustment = -1;
      adjustmentReason = `Multiple mask lift instructions triggered (SpO2 dropped below 80%)`;
    }
    // Priority 2: Check average SpO2 for dial adjustment
    else if (avgSpO2 && avgSpO2 < 85) {
      altitudeAdjustment = -1;
      adjustmentReason = `Average SpO2 (${avgSpO2 ? avgSpO2.toFixed(1) : avgSpO2}%) below target range (<85%)`;
    }
    else if (avgSpO2 && avgSpO2 > 90) {
      altitudeAdjustment = +1;
      adjustmentReason = `Average SpO2 (${avgSpO2 ? avgSpO2.toFixed(1) : avgSpO2}%) above target range (>90%)`;
    }
    // Priority 3: Check if min SpO2 was too high (fallback)
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
      log.warn('Cannot record adaptive event - sessionId is missing');
      return;
    }

    const event = {
      session_id: this.currentPhaseStats.sessionId,
      event_type: eventType,
      event_timestamp: new Date().toISOString(),
      altitude_phase_number: this.currentPhaseStats.phaseType === 'altitude' ? this.currentPhaseStats.phaseNumber : null,
      recovery_phase_number: this.currentPhaseStats.phaseType === 'recovery' ? this.currentPhaseStats.phaseNumber : null,
      current_altitude_level: this.currentPhaseStats.altitudeLevel || null,
      additional_data: additionalData // Pass as object, not stringified
    };

    try {
      await DatabaseService.saveAdaptiveEvent(event);
      
      // Try to save to Supabase if the method exists
      if (SupabaseService.saveAdaptiveEvent) {
        try {
          await SupabaseService.saveAdaptiveEvent(event);
        } catch (supabaseError) {
          // Silently handle Supabase errors - they're expected for anonymous users
          log.info('⚠️ Adaptive event queued for later sync');
        }
      }
      
      log.info(`Adaptive event recorded: ${eventType}`);
    } catch (error) {
      // Don't log errors that will cause popups, just silently handle
      log.warn('Failed to record adaptive event, will retry later');
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
    // Use the confirmed altitude level if it was updated, otherwise use original
    const currentLevel = this.currentAltitudeLevel !== undefined ? 
      this.currentAltitudeLevel : this.currentPhaseStats.altitudeLevel;
    
    console.log('🎯 Calculating next altitude level from current level:', currentLevel);

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

    // Rule: If both mask lifts triggered in current cycle, consider decreasing altitude
    if (this.maskLiftState.hasTriggeredSecond) {
      const newLevel = Math.max(0, currentLevel - 1); // Floor at level 0
      return {
        adjustment: -1,
        newLevel,
        reason: `Both mask lift instructions triggered in cycle - decrease altitude`,
        maskLiftsTriggered: 2
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
