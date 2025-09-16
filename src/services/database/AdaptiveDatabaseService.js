/**
 * AdaptiveDatabaseService - Handles adaptive training system database operations
 *
 * Manages adaptive events, altitude levels, and training progression
 * with consistent error handling and retry logic.
 */

import BaseDatabaseService from './BaseDatabaseService';
import SupabaseService from '../SupabaseService';

class AdaptiveDatabaseService extends BaseDatabaseService {
  constructor() {
    super('AdaptiveDatabaseService');
  }

  /**
   * Save an adaptive event with retry logic
   * @param {Object} event - Adaptive event data
   * @returns {Promise<Object>}
   */
  async saveAdaptiveEvent(event) {
    this.ensureInitialized();
    this.validateRequiredFields(event, ['sessionId', 'eventType']);

    // Validate event type
    const validEventTypes = ['mask_lift', 'dial_adjustment', 'recovery_complete', 'altitude_phase_complete'];
    if (!validEventTypes.includes(event.eventType)) {
      throw new Error(`Invalid event type: ${event.eventType}. Must be one of: ${validEventTypes.join(', ')}`);
    }

    const operation = async () => {
      const id = this.generateId();
      let additionalData = event.additionalData;

      // Parse additional data if it's a string
      if (typeof additionalData === 'string') {
        try {
          additionalData = JSON.parse(additionalData);
        } catch (e) {
          this.log.warn('Failed to parse additional_data as JSON:', e);
        }
      }

      const query = `
        INSERT INTO session_adaptive_events (
          id, session_id, event_type, event_timestamp,
          altitude_phase_number, recovery_phase_number,
          current_altitude_level, spo2_value, heart_rate_value,
          adjustment_type, adjustment_value, additional_data,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const timestamp = event.timestamp || Date.now();
      await this.db.runAsync(query, [
        id,
        event.sessionId,
        event.eventType,
        timestamp,
        event.altitudePhaseNumber || null,
        event.recoveryPhaseNumber || null,
        event.currentAltitudeLevel || null,
        event.spo2Value || null,
        event.heartRateValue || null,
        event.adjustmentType || null,
        event.adjustmentValue || null,
        JSON.stringify(additionalData || {}),
        Date.now()
      ]);

      this.log.info(`✅ Saved adaptive event: ${event.eventType} for session ${event.sessionId}`);

      // Sync to Supabase
      try {
        if (SupabaseService?.saveAdaptiveEvent) {
          const result = await SupabaseService.saveAdaptiveEvent({
            ...event,
            id,
            timestamp,
            additional_data: additionalData
          });

          if (result?.success) {
            this.log.info('✅ Synced adaptive event to Supabase');
          }
        }
      } catch (syncError) {
        this.log.warn('⚠️ Failed to sync adaptive event:', syncError.message);
      }

      return this.formatSuccessResponse('saveAdaptiveEvent', { id, eventType: event.eventType });
    };

    return this.executeWithRetry(operation, 'saveAdaptiveEvent');
  }

  /**
   * Get adaptive events for a session
   * @param {string} sessionId - Session ID
   * @param {string} eventType - Optional filter by event type
   * @returns {Promise<Object>}
   */
  async getAdaptiveEvents(sessionId, eventType = null) {
    this.ensureInitialized();

    const operation = async () => {
      let query = `
        SELECT * FROM session_adaptive_events
        WHERE session_id = ?
      `;

      const params = [sessionId];

      if (eventType) {
        query += ' AND event_type = ?';
        params.push(eventType);
      }

      query += ' ORDER BY event_timestamp ASC';

      const events = await this.db.getAllAsync(query, params);

      // Parse additional_data JSON
      const parsedEvents = events.map(event => {
        if (event.additional_data) {
          try {
            event.additional_data = JSON.parse(event.additional_data);
          } catch (e) {
            this.log.warn('Failed to parse additional_data:', e);
            event.additional_data = {};
          }
        }
        return event;
      });

      this.logOperation('getAdaptiveEvents', { sessionId, eventType }, parsedEvents);

      return this.formatSuccessResponse('getAdaptiveEvents', parsedEvents);
    };

    return this.executeWithRetry(operation, 'getAdaptiveEvents', 1);
  }

  /**
   * Update session altitude level with retry logic
   * @param {string} sessionId - Session ID
   * @param {number} newAltitudeLevel - New altitude level
   * @returns {Promise<Object>}
   */
  async updateSessionAltitudeLevel(sessionId, newAltitudeLevel) {
    this.ensureInitialized();

    if (newAltitudeLevel < 1 || newAltitudeLevel > 15) {
      throw new Error('Invalid altitude level. Must be between 1 and 15.');
    }

    const operation = async () => {
      const query = `
        UPDATE sessions
        SET current_altitude_level = ?, updated_at = ?
        WHERE id = ?
      `;

      const result = await this.db.runAsync(query, [
        newAltitudeLevel,
        Date.now(),
        sessionId
      ]);

      if (result.changes === 0) {
        throw new Error(`Session ${sessionId} not found`);
      }

      this.log.info(`✅ Updated altitude level to ${newAltitudeLevel} for session ${sessionId}`);

      // Sync to Supabase
      try {
        if (SupabaseService?.updateSessionAltitudeLevel) {
          await SupabaseService.updateSessionAltitudeLevel(sessionId, newAltitudeLevel);
          this.log.info('✅ Synced altitude level update to Supabase');
        }
      } catch (syncError) {
        this.log.warn('⚠️ Failed to sync altitude level update:', syncError.message);
      }

      return this.formatSuccessResponse('updateSessionAltitudeLevel', {
        sessionId,
        newAltitudeLevel
      });
    };

    return this.executeWithRetry(operation, 'updateSessionAltitudeLevel');
  }

  /**
   * Get altitude level information
   * @param {number} level - Altitude level (1-15)
   * @returns {Promise<Object>}
   */
  async getAltitudeLevel(level) {
    this.ensureInitialized();

    const operation = async () => {
      const query = `
        SELECT * FROM altitude_levels
        WHERE level = ?
        LIMIT 1
      `;

      const altitudeData = await this.db.getFirstAsync(query, [level]);

      if (!altitudeData) {
        // Return default values if not in database
        return this.formatSuccessResponse('getAltitudeLevel', {
          level,
          targetSpo2: 90 - (level - 1),
          recoveryThreshold: 95,
          description: `Altitude Level ${level}`
        });
      }

      return this.formatSuccessResponse('getAltitudeLevel', altitudeData);
    };

    return this.executeWithRetry(operation, 'getAltitudeLevel', 1);
  }

  /**
   * Get completed adaptive sessions for progression analysis
   * @param {number} limit - Maximum number of sessions to return
   * @returns {Promise<Object>}
   */
  async getCompletedAdaptiveSessions(limit = 10) {
    this.ensureInitialized();

    const operation = async () => {
      const query = `
        SELECT
          id,
          session_subtype,
          start_time,
          end_time,
          starting_altitude_level,
          current_altitude_level,
          total_mask_lifts,
          total_altitude_adjustments,
          adaptive_system_enabled
        FROM sessions
        WHERE status = 'completed'
          AND adaptive_system_enabled = 1
        ORDER BY start_time DESC
        LIMIT ?
      `;

      const sessions = await this.db.getAllAsync(query, [limit]);

      this.logOperation('getCompletedAdaptiveSessions', { limit }, sessions);

      return this.formatSuccessResponse('getCompletedAdaptiveSessions', sessions);
    };

    return this.executeWithRetry(operation, 'getCompletedAdaptiveSessions', 1);
  }

  /**
   * Get user progression data for altitude level recommendations
   * @param {string} userId - User ID
   * @param {number} limit - Number of sessions to analyze
   * @returns {Promise<Object>}
   */
  async getUserProgressionData(userId, limit = 10) {
    this.ensureInitialized();

    const operation = async () => {
      // Get recent sessions with adaptation metrics
      const sessionsQuery = `
        SELECT
          s.id,
          s.start_time,
          s.end_time,
          s.starting_altitude_level,
          s.current_altitude_level,
          s.total_mask_lifts,
          sam.adaptation_score,
          sam.efficiency_score,
          sam.avg_recovery_time
        FROM sessions s
        LEFT JOIN session_adaptation_metrics sam ON s.id = sam.session_id
        WHERE s.status = 'completed'
          AND s.adaptive_system_enabled = 1
        ORDER BY s.start_time DESC
        LIMIT ?
      `;

      const sessions = await this.db.getAllAsync(sessionsQuery, [limit]);

      if (!sessions || sessions.length === 0) {
        return this.formatSuccessResponse('getUserProgressionData', {
          sessions: [],
          recommendation: {
            currentLevel: 6,
            suggestedLevel: 6,
            confidence: 'low',
            reason: 'No training history'
          }
        });
      }

      // Calculate progression metrics
      const avgAdaptationScore = sessions
        .filter(s => s.adaptation_score)
        .reduce((sum, s) => sum + s.adaptation_score, 0) / sessions.length;

      const avgEfficiencyScore = sessions
        .filter(s => s.efficiency_score)
        .reduce((sum, s) => sum + s.efficiency_score, 0) / sessions.length;

      const latestLevel = sessions[0].current_altitude_level || 6;
      const maskLiftTrend = sessions.slice(0, 3)
        .reduce((sum, s) => sum + (s.total_mask_lifts || 0), 0) / 3;

      // Generate recommendation
      let suggestedLevel = latestLevel;
      let confidence = 'medium';
      let reason = 'Maintaining current level';

      if (sessions.length >= 6) {
        if (avgAdaptationScore > 80 && avgEfficiencyScore > 75 && maskLiftTrend < 2) {
          suggestedLevel = Math.min(latestLevel + 1, 15);
          confidence = 'high';
          reason = 'Strong adaptation and low mask lifts';
        } else if (avgAdaptationScore < 50 || maskLiftTrend > 5) {
          suggestedLevel = Math.max(latestLevel - 1, 1);
          confidence = 'high';
          reason = 'Consider reducing intensity for better adaptation';
        }
      }

      const result = {
        sessions,
        metrics: {
          avgAdaptationScore,
          avgEfficiencyScore,
          avgMaskLifts: maskLiftTrend,
          totalSessions: sessions.length
        },
        recommendation: {
          currentLevel: latestLevel,
          suggestedLevel,
          confidence,
          reason
        }
      };

      return this.formatSuccessResponse('getUserProgressionData', result);
    };

    return this.executeWithRetry(operation, 'getUserProgressionData', 1);
  }

  /**
   * Count events by type for a session
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object>}
   */
  async getEventCounts(sessionId) {
    this.ensureInitialized();

    const operation = async () => {
      const query = `
        SELECT
          event_type,
          COUNT(*) as count
        FROM session_adaptive_events
        WHERE session_id = ?
        GROUP BY event_type
      `;

      const counts = await this.db.getAllAsync(query, [sessionId]);

      const result = {
        mask_lift: 0,
        dial_adjustment: 0,
        recovery_complete: 0,
        altitude_phase_complete: 0
      };

      counts.forEach(row => {
        result[row.event_type] = row.count;
      });

      return this.formatSuccessResponse('getEventCounts', result);
    };

    return this.executeWithRetry(operation, 'getEventCounts', 1);
  }
}

export default new AdaptiveDatabaseService();