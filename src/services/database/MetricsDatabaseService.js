/**
 * MetricsDatabaseService - Handles all metrics-related database operations
 *
 * Manages phase stats, cycle metrics, adaptation metrics, and readings
 * with consistent error handling and retry logic.
 */

import BaseDatabaseService from './BaseDatabaseService';
import SupabaseService from '../SupabaseService';

class MetricsDatabaseService extends BaseDatabaseService {
  constructor() {
    super('MetricsDatabaseService');
  }

  /**
   * Save phase statistics with retry logic
   * @param {Object} phaseStats - Phase statistics data
   * @returns {Promise<Object>}
   */
  async savePhaseStats(phaseStats) {
    this.ensureInitialized();
    this.validateRequiredFields(phaseStats, ['sessionId', 'phaseType', 'phaseNumber']);

    const operation = async () => {
      const id = this.generateId();
      const query = `
        INSERT INTO session_phase_stats (
          id, session_id, phase_type, phase_number,
          avg_spo2, min_spo2, max_spo2,
          avg_heart_rate, min_heart_rate, max_heart_rate,
          duration, start_time, end_time,
          mask_events_count, altitude_level
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await this.db.runAsync(query, [
        id,
        phaseStats.sessionId,
        phaseStats.phaseType,
        phaseStats.phaseNumber,
        phaseStats.avgSpo2 || null,
        phaseStats.minSpo2 || null,
        phaseStats.maxSpo2 || null,
        phaseStats.avgHeartRate || null,
        phaseStats.minHeartRate || null,
        phaseStats.maxHeartRate || null,
        phaseStats.duration || null,
        phaseStats.startTime || Date.now(),
        phaseStats.endTime || null,
        phaseStats.maskEventsCount || 0,
        phaseStats.altitudeLevel || null
      ]);

      this.log.info(`✅ Saved phase stats for session ${phaseStats.sessionId}, phase ${phaseStats.phaseNumber}`);

      // Sync to Supabase if available
      if (SupabaseService?.syncPhaseMetrics) {
        try {
          await SupabaseService.syncPhaseMetrics({
            ...phaseStats,
            id,
            timestamp: Date.now()
          });
          this.log.info('✅ Synced phase metrics to Supabase');
        } catch (syncError) {
          this.log.warn('⚠️ Failed to sync to Supabase, will retry later:', syncError.message);
        }
      }

      return this.formatSuccessResponse('savePhaseStats', { id });
    };

    return this.executeWithRetry(operation, 'savePhaseStats');
  }

  /**
   * Save cycle metrics with retry logic
   * @param {Object} metrics - Cycle metrics data
   * @returns {Promise<Object>}
   */
  async saveCycleMetrics(metrics) {
    this.ensureInitialized();
    this.validateRequiredFields(metrics, ['sessionId', 'cycleNumber']);

    const operation = async () => {
      const id = this.generateId();
      const query = `
        INSERT INTO cycle_metrics (
          id, session_id, cycle_number,
          hypoxic_duration, hyperoxic_duration,
          avg_spo2_hypoxic, min_spo2_hypoxic, max_spo2_hypoxic,
          avg_spo2_hyperoxic, min_spo2_hyperoxic, max_spo2_hyperoxic,
          avg_hr_hypoxic, avg_hr_hyperoxic,
          recovery_time, recovery_efficiency,
          mask_lift_count, dial_adjustments,
          altitude_level, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await this.db.runAsync(query, [
        id,
        metrics.sessionId,
        metrics.cycleNumber,
        metrics.hypoxicDuration || null,
        metrics.hyperoxicDuration || null,
        metrics.avgSpo2Hypoxic || null,
        metrics.minSpo2Hypoxic || null,
        metrics.maxSpo2Hypoxic || null,
        metrics.avgSpo2Hyperoxic || null,
        metrics.minSpo2Hyperoxic || null,
        metrics.maxSpo2Hyperoxic || null,
        metrics.avgHrHypoxic || null,
        metrics.avgHrHyperoxic || null,
        metrics.recoveryTime || null,
        metrics.recoveryEfficiency || null,
        metrics.maskLiftCount || 0,
        metrics.dialAdjustments || 0,
        metrics.altitudeLevel || null,
        Date.now()
      ]);

      this.log.info(`✅ Saved cycle metrics for session ${metrics.sessionId}, cycle ${metrics.cycleNumber}`);

      // Sync to Supabase
      if (SupabaseService?.syncCycleMetrics) {
        try {
          await SupabaseService.syncCycleMetrics({ ...metrics, id });
        } catch (syncError) {
          this.log.warn('⚠️ Failed to sync cycle metrics:', syncError.message);
        }
      }

      return this.formatSuccessResponse('saveCycleMetrics', { id });
    };

    return this.executeWithRetry(operation, 'saveCycleMetrics');
  }

  /**
   * Save adaptation metrics with retry logic
   * @param {Object} metrics - Adaptation metrics data
   * @returns {Promise<Object>}
   */
  async saveAdaptationMetrics(metrics) {
    this.ensureInitialized();
    this.validateRequiredFields(metrics, ['sessionId']);

    const operation = async () => {
      const id = this.generateId();
      const query = `
        INSERT INTO session_adaptation_metrics (
          id, session_id,
          initial_spo2_baseline, final_spo2_baseline,
          avg_recovery_time, best_recovery_time, worst_recovery_time,
          total_mask_lifts, successful_recoveries, failed_recoveries,
          altitude_progression, time_at_target,
          adaptation_score, efficiency_score,
          notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await this.db.runAsync(query, [
        id,
        metrics.sessionId,
        metrics.initialSpo2Baseline || null,
        metrics.finalSpo2Baseline || null,
        metrics.avgRecoveryTime || null,
        metrics.bestRecoveryTime || null,
        metrics.worstRecoveryTime || null,
        metrics.totalMaskLifts || 0,
        metrics.successfulRecoveries || 0,
        metrics.failedRecoveries || 0,
        JSON.stringify(metrics.altitudeProgression || []),
        metrics.timeAtTarget || 0,
        metrics.adaptationScore || null,
        metrics.efficiencyScore || null,
        metrics.notes || null,
        Date.now()
      ]);

      this.log.info(`✅ Saved adaptation metrics for session ${metrics.sessionId}`);

      // Sync to Supabase
      if (SupabaseService?.syncAdaptiveMetrics) {
        try {
          const result = await SupabaseService.syncAdaptiveMetrics({ ...metrics, id });
          if (result?.success) {
            this.log.info('✅ Synced adaptation metrics to Supabase');
          }
        } catch (syncError) {
          this.log.warn('⚠️ Failed to sync adaptation metrics:', syncError.message);
        }
      }

      return this.formatSuccessResponse('saveAdaptationMetrics', { id });
    };

    return this.executeWithRetry(operation, 'saveAdaptationMetrics');
  }

  /**
   * Get phase statistics for a session
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object>}
   */
  async getPhaseStats(sessionId) {
    this.ensureInitialized();

    const operation = async () => {
      const query = `
        SELECT * FROM session_phase_stats
        WHERE session_id = ?
        ORDER BY phase_number ASC
      `;

      const stats = await this.db.getAllAsync(query, [sessionId]);
      this.logOperation('getPhaseStats', { sessionId }, stats);

      return this.formatSuccessResponse('getPhaseStats', stats);
    };

    return this.executeWithRetry(operation, 'getPhaseStats', 1); // Single retry for reads
  }

  /**
   * Get cycle metrics for a session
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object>}
   */
  async getCycleMetrics(sessionId) {
    this.ensureInitialized();

    const operation = async () => {
      const query = `
        SELECT * FROM cycle_metrics
        WHERE session_id = ?
        ORDER BY cycle_number ASC
      `;

      const metrics = await this.db.getAllAsync(query, [sessionId]);
      this.logOperation('getCycleMetrics', { sessionId }, metrics);

      return this.formatSuccessResponse('getCycleMetrics', metrics);
    };

    return this.executeWithRetry(operation, 'getCycleMetrics', 1);
  }

  /**
   * Get adaptation metrics for a session
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object>}
   */
  async getAdaptationMetrics(sessionId) {
    this.ensureInitialized();

    const operation = async () => {
      const query = `
        SELECT * FROM session_adaptation_metrics
        WHERE session_id = ?
        LIMIT 1
      `;

      const metrics = await this.db.getFirstAsync(query, [sessionId]);

      if (metrics && metrics.altitude_progression) {
        try {
          metrics.altitude_progression = JSON.parse(metrics.altitude_progression);
        } catch (e) {
          this.log.warn('Failed to parse altitude progression:', e);
        }
      }

      this.logOperation('getAdaptationMetrics', { sessionId }, metrics);

      return this.formatSuccessResponse('getAdaptationMetrics', metrics);
    };

    return this.executeWithRetry(operation, 'getAdaptationMetrics', 1);
  }

  /**
   * Calculate and return session statistics
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object>}
   */
  async calculateSessionStats(sessionId) {
    this.ensureInitialized();

    const operation = async () => {
      // Get all readings for the session
      const query = `
        SELECT
          AVG(spo2) as avgSpo2,
          MIN(spo2) as minSpo2,
          MAX(spo2) as maxSpo2,
          AVG(heart_rate) as avgHeartRate,
          MIN(heart_rate) as minHeartRate,
          MAX(heart_rate) as maxHeartRate,
          COUNT(*) as totalReadings
        FROM readings
        WHERE session_id = ? AND is_valid = 1
      `;

      const stats = await this.db.getFirstAsync(query, [sessionId]);
      this.logOperation('calculateSessionStats', { sessionId }, stats);

      return this.formatSuccessResponse('calculateSessionStats', stats);
    };

    return this.executeWithRetry(operation, 'calculateSessionStats', 1);
  }
}

export default new MetricsDatabaseService();