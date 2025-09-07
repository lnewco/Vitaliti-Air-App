/**
 * AltitudeProgressionService
 * 
 * Manages progressive overload for IHHT altitude levels across sessions.
 * Implements smart progression, detraining detection, and safety bounds.
 */

import DatabaseService from './DatabaseService';

// Progression configuration constants
const PROGRESSION_CONFIG = {
  // Time-based detraining thresholds (days)
  DETRAINING_THRESHOLDS: {
    NO_CHANGE: 3,      // 0-3 days: No detraining
    MILD: 7,           // 4-7 days: -1 level
    MODERATE: 14,      // 8-14 days: -2 levels
    SIGNIFICANT: 30,   // 15-30 days: -3 levels
    RESET: 60          // 60+ days: Reset to baseline (level 6)
  },
  
  // Performance-based progression adjustments
  PERFORMANCE_SCORES: {
    EXCELLENT: 2,      // Can increase by 2 levels
    GOOD: 1,          // Can increase by 1 level
    MAINTAIN: 0,      // Stay at current level
    STRUGGLE: -1,     // Decrease by 1 level
    UNSAFE: -2        // Decrease by 2 levels (safety priority)
  },
  
  // Safety bounds
  BOUNDS: {
    MAX_INCREASE: 2,      // Maximum increase per session
    MAX_DECREASE: 3,      // Maximum decrease per session
    MIN_LEVEL: 0,         // Absolute minimum (sea level)
    MAX_LEVEL: 10,        // Absolute maximum
    DEFAULT_LEVEL: 6,     // Default starting level
    PLATEAU_THRESHOLD: 5  // Sessions at same level before forcing change
  },
  
  // Session type specific rules
  SESSION_TYPES: {
    CALIBRATION: {
      maxIncrease: 1,
      minSpO2Target: 88,
      maxSpO2Target: 93
    },
    TRAINING: {
      maxIncrease: 2,
      minSpO2Target: 85,
      maxSpO2Target: 90
    }
  }
};

class AltitudeProgressionService {
  constructor() {
    this.log = this.createLogger();
  }

  createLogger() {
    const prefix = '[AltitudeProgression]';
    return {
      info: (...args) => console.log(prefix, ...args),
      warn: (...args) => console.warn(prefix, ...args),
      error: (...args) => console.error(prefix, ...args)
    };
  }

  /**
   * Calculate optimal starting altitude for a new session
   * @param {string} userId - User identifier
   * @returns {Promise<Object>} Recommended altitude level with reasoning
   */
  async calculateOptimalStartingAltitude(userId) {
    try {
      this.log.info('🎯 Calculating optimal starting altitude for user:', userId);
      
      // Get user's progression data
      const progressionData = await DatabaseService.getUserProgressionData(userId, 10);
      
      // If no previous sessions, return default
      if (!progressionData.lastSession) {
        this.log.info('📝 New user detected, using default altitude level');
        return {
          recommendedLevel: PROGRESSION_CONFIG.BOUNDS.DEFAULT_LEVEL,
          reasoning: 'First session - starting at standard altitude',
          confidence: 'high',
          progressionData
        };
      }

      // Start with last session's ending altitude
      let recommendedLevel = progressionData.lastSession.current_altitude_level || 
                             progressionData.lastSession.starting_altitude_level;
      
      // Apply detraining adjustment
      const detrainingAdjustment = this.calculateDetrainingAdjustment(
        progressionData.daysSinceLastSession,
        recommendedLevel
      );
      
      if (detrainingAdjustment !== 0) {
        recommendedLevel += detrainingAdjustment;
        this.log.info(`⏱️ Applied detraining adjustment: ${detrainingAdjustment} levels`);
      }

      // Apply performance trend adjustment
      if (progressionData.totalSessions >= 3) {
        const trendAdjustment = this.calculateTrendAdjustment(progressionData);
        recommendedLevel += trendAdjustment;
        this.log.info(`📈 Applied trend adjustment: ${trendAdjustment} levels`);
      }

      // Apply safety bounds
      recommendedLevel = this.applySafetyBounds(
        recommendedLevel,
        progressionData.lastSession.current_altitude_level,
        progressionData.totalSessions
      );

      // Generate reasoning message
      const reasoning = this.generateProgressionReasoning(
        progressionData,
        detrainingAdjustment,
        recommendedLevel
      );

      this.log.info(`✅ Recommended altitude level: ${recommendedLevel}`);
      
      return {
        recommendedLevel,
        reasoning,
        confidence: this.calculateConfidence(progressionData),
        progressionData,
        adjustments: {
          detraining: detrainingAdjustment,
          lastLevel: progressionData.lastSession.current_altitude_level,
          daysSince: progressionData.daysSinceLastSession
        }
      };
      
    } catch (error) {
      this.log.error('❌ Error calculating optimal altitude:', error);
      return {
        recommendedLevel: PROGRESSION_CONFIG.BOUNDS.DEFAULT_LEVEL,
        reasoning: 'Error in calculation - using default level',
        confidence: 'low',
        error: error.message
      };
    }
  }

  /**
   * Calculate detraining adjustment based on days since last session
   */
  calculateDetrainingAdjustment(daysSinceLastSession, currentLevel) {
    if (daysSinceLastSession === null || daysSinceLastSession === undefined) {
      return 0;
    }

    const { DETRAINING_THRESHOLDS } = PROGRESSION_CONFIG;
    
    if (daysSinceLastSession <= DETRAINING_THRESHOLDS.NO_CHANGE) {
      return 0; // No detraining within 3 days
    } else if (daysSinceLastSession <= DETRAINING_THRESHOLDS.MILD) {
      return -1; // Mild detraining: 4-7 days
    } else if (daysSinceLastSession <= DETRAINING_THRESHOLDS.MODERATE) {
      return -2; // Moderate detraining: 8-14 days
    } else if (daysSinceLastSession <= DETRAINING_THRESHOLDS.SIGNIFICANT) {
      return -3; // Significant detraining: 15-30 days
    } else if (daysSinceLastSession >= DETRAINING_THRESHOLDS.RESET) {
      // Reset to baseline if more than 60 days
      return PROGRESSION_CONFIG.BOUNDS.DEFAULT_LEVEL - currentLevel;
    } else {
      // 31-59 days: halfway between current and default
      const halfwayLevel = Math.round((currentLevel + PROGRESSION_CONFIG.BOUNDS.DEFAULT_LEVEL) / 2);
      return halfwayLevel - currentLevel;
    }
  }

  /**
   * Calculate trend-based adjustment
   */
  calculateTrendAdjustment(progressionData) {
    // Check for plateau (same level for multiple sessions)
    const recentSessions = progressionData.sessions.slice(0, PROGRESSION_CONFIG.BOUNDS.PLATEAU_THRESHOLD);
    const levels = recentSessions.map(s => s.current_altitude_level);
    const allSame = levels.every(level => level === levels[0]);
    
    if (allSame && recentSessions.length >= PROGRESSION_CONFIG.BOUNDS.PLATEAU_THRESHOLD) {
      this.log.info('🔄 Plateau detected - suggesting progression');
      return 1; // Force progression to break plateau
    }

    // Use overall trend
    switch (progressionData.trend) {
      case 'improving':
        return 0; // Already progressing well
      case 'declining':
        return -1; // Additional safety reduction
      default:
        return 0;
    }
  }

  /**
   * Apply safety bounds to recommended level
   */
  applySafetyBounds(recommendedLevel, lastLevel, totalSessions) {
    const { BOUNDS } = PROGRESSION_CONFIG;
    
    // Absolute bounds
    recommendedLevel = Math.max(BOUNDS.MIN_LEVEL, Math.min(BOUNDS.MAX_LEVEL, recommendedLevel));
    
    // Limit change from last session
    if (lastLevel !== undefined && lastLevel !== null) {
      const maxIncrease = lastLevel + BOUNDS.MAX_INCREASE;
      const maxDecrease = lastLevel - BOUNDS.MAX_DECREASE;
      recommendedLevel = Math.max(maxDecrease, Math.min(maxIncrease, recommendedLevel));
    }
    
    return recommendedLevel;
  }

  /**
   * Score session performance based on metrics
   */
  scoreSessionPerformance(sessionStats) {
    const { minSpO2, avgSpO2, maskLiftCount, sessionType, completionRate } = sessionStats;
    const targets = PROGRESSION_CONFIG.SESSION_TYPES[sessionType] || 
                   PROGRESSION_CONFIG.SESSION_TYPES.TRAINING;
    
    let score = 0;
    let factors = [];
    
    // Mask lift frequency (40% weight)
    if (maskLiftCount === 0) {
      score += 40;
      factors.push('No mask lifts');
    } else if (maskLiftCount === 1) {
      score += 30;
      factors.push('One mask lift');
    } else if (maskLiftCount === 2) {
      score += 20;
      factors.push('Two mask lifts');
    } else if (maskLiftCount >= 3) {
      score += 0;
      factors.push('Multiple mask lifts');
    }
    
    // SpO2 stability (30% weight)
    if (minSpO2 >= targets.minSpO2Target && avgSpO2 <= targets.maxSpO2Target) {
      score += 30;
      factors.push('SpO2 in optimal range');
    } else if (minSpO2 >= targets.minSpO2Target - 2) {
      score += 20;
      factors.push('SpO2 acceptable');
    } else if (minSpO2 < targets.minSpO2Target - 5) {
      score -= 10; // Safety concern
      factors.push('SpO2 too low');
    }
    
    // Target achievement (20% weight)
    if (avgSpO2 >= targets.maxSpO2Target) {
      score += 20;
      factors.push('Could handle more altitude');
    } else if (avgSpO2 >= targets.maxSpO2Target - 2) {
      score += 10;
      factors.push('Near target ceiling');
    }
    
    // Session completion (10% weight)
    if (completionRate >= 1.0) {
      score += 10;
      factors.push('Full session completed');
    } else if (completionRate >= 0.8) {
      score += 5;
      factors.push('Most of session completed');
    }
    
    // Map score to performance level
    let performanceLevel;
    if (score >= 80) performanceLevel = 'EXCELLENT';
    else if (score >= 60) performanceLevel = 'GOOD';
    else if (score >= 40) performanceLevel = 'MAINTAIN';
    else if (score >= 20) performanceLevel = 'STRUGGLE';
    else performanceLevel = 'UNSAFE';
    
    this.log.info(`📊 Session performance: ${performanceLevel} (score: ${score})`);
    
    return {
      performanceLevel,
      score,
      factors,
      recommendation: PROGRESSION_CONFIG.PERFORMANCE_SCORES[performanceLevel]
    };
  }

  /**
   * Generate human-readable reasoning for progression decision
   */
  generateProgressionReasoning(progressionData, detrainingAdjustment, recommendedLevel) {
    const parts = [];
    
    // Base level from last session
    if (progressionData.lastSession) {
      parts.push(`Based on last session ending at level ${progressionData.lastSession.current_altitude_level}`);
    } else {
      parts.push('Starting at standard altitude for first session');
    }
    
    // Detraining adjustment
    if (detrainingAdjustment !== 0) {
      const days = progressionData.daysSinceLastSession;
      if (detrainingAdjustment < 0) {
        parts.push(`Reduced ${Math.abs(detrainingAdjustment)} levels due to ${days} day break`);
      }
    }
    
    // Trend information
    if (progressionData.trend === 'improving') {
      parts.push('Recent performance shows improvement');
    } else if (progressionData.trend === 'declining') {
      parts.push('Recent performance suggests more conservative approach');
    }
    
    // Final recommendation
    parts.push(`Starting at level ${recommendedLevel} for optimal challenge`);
    
    return parts.join('. ');
  }

  /**
   * Calculate confidence in the recommendation
   */
  calculateConfidence(progressionData) {
    if (progressionData.totalSessions >= 10) return 'high';
    if (progressionData.totalSessions >= 5) return 'medium';
    if (progressionData.totalSessions >= 1) return 'low';
    return 'baseline';
  }

  /**
   * Check if user should do calibration session
   */
  shouldDoCalibrationSession(progressionData) {
    // First session ever
    if (progressionData.totalSessions === 0) return true;
    
    // Long break (> 30 days)
    if (progressionData.daysSinceLastSession > 30) return true;
    
    // Every 20 sessions for recalibration
    if (progressionData.totalSessions % 20 === 0) return true;
    
    // Poor recent performance
    if (progressionData.trend === 'declining' && progressionData.totalSessions >= 3) {
      const recentSessions = progressionData.sessions.slice(0, 3);
      const highMaskLifts = recentSessions.filter(s => s.total_mask_lifts > 3).length;
      if (highMaskLifts >= 2) return true;
    }
    
    return false;
  }
}

// Export singleton instance
export default new AltitudeProgressionService();