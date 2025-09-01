/**
 * MetricsDatabaseService - Handles all metrics and analytics related database operations
 * Extracted from DatabaseService for better modularity
 */

import log from '../../utils/logger';

class MetricsDatabaseService {
  constructor(db) {
    this.db = db;
  }

  /**
   * Update session baseline HRV metrics
   */
  async updateSessionBaselineHRV(sessionId, rmssd, confidence, intervalCount, durationSeconds) {
    try {
      const query = `
        UPDATE sessions 
        SET baseline_hrv_rmssd = ?, 
            baseline_hrv_confidence = ?, 
            baseline_hrv_interval_count = ?,
            baseline_hrv_duration_seconds = ?,
            updated_at = strftime('%s', 'now')
        WHERE id = ?
      `;
      
      await this.db.runAsync(query, [
        rmssd,
        confidence,
        intervalCount,
        durationSeconds,
        sessionId
      ]);
      
      log.info(`✅ Updated baseline HRV for session ${sessionId}: ${rmssd}ms (${Math.round(confidence * 100)}% confidence)`);
      return { success: true };
    } catch (error) {
      log.error('❌ Failed to update baseline HRV:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get session baseline HRV metrics
   */
  async getSessionBaselineHRV(sessionId) {
    try {
      const query = `
        SELECT baseline_hrv_rmssd, baseline_hrv_confidence, 
               baseline_hrv_interval_count, baseline_hrv_duration_seconds
        FROM sessions 
        WHERE id = ?
      `;
      
      const row = await this.db.getFirstAsync(query, [sessionId]);
      
      if (row) {
        return {
          rmssd: row.baseline_hrv_rmssd,
          confidence: row.baseline_hrv_confidence,
          intervalCount: row.baseline_hrv_interval_count,
          durationSeconds: row.baseline_hrv_duration_seconds
        };
      }
      
      return null;
    } catch (error) {
      log.error('❌ Failed to get baseline HRV:', error);
      return null;
    }
  }

  /**
   * Get HRV statistics for a session
   */
  async getSessionHRVStats(sessionId) {
    try {
      const query = `
        SELECT 
          AVG(hrv_rmssd) as avgHRV,
          MIN(hrv_rmssd) as minHRV,
          MAX(hrv_rmssd) as maxHRV,
          COUNT(CASE WHEN hrv_rmssd IS NOT NULL THEN 1 END) as hrvReadingCount
        FROM readings 
        WHERE session_id = ? AND hrv_rmssd IS NOT NULL AND hrv_rmssd > 0
      `;
      
      const row = await this.db.getFirstAsync(query, [sessionId]);
      
      if (row && row.hrvReadingCount > 0) {
        return {
          avgHRV: row.avgHRV,
          minHRV: row.minHRV,
          maxHRV: row.maxHRV,
          readingCount: row.hrvReadingCount
        };
      }
      
      return null;
    } catch (error) {
      log.error('❌ Failed to get session HRV stats:', error);
      return null;
    }
  }

  /**
   * Get comprehensive session statistics
   */
  async getSessionStats(sessionId) {
    const query = `
      SELECT 
        COUNT(*) as totalReadings,
        COUNT(CASE WHEN spo2 IS NOT NULL AND spo2 > 0 THEN 1 END) as validSpO2Readings,
        COUNT(CASE WHEN heart_rate IS NOT NULL AND heart_rate > 0 THEN 1 END) as validHeartRateReadings,
        AVG(CASE WHEN spo2 IS NOT NULL AND spo2 > 0 THEN spo2 END) as avgSpO2,
        MIN(CASE WHEN spo2 IS NOT NULL AND spo2 > 0 THEN spo2 END) as minSpO2,
        MAX(CASE WHEN spo2 IS NOT NULL AND spo2 > 0 THEN spo2 END) as maxSpO2,
        AVG(CASE WHEN heart_rate IS NOT NULL AND heart_rate > 0 THEN heart_rate END) as avgHeartRate,
        MIN(CASE WHEN heart_rate IS NOT NULL AND heart_rate > 0 THEN heart_rate END) as minHeartRate,
        MAX(CASE WHEN heart_rate IS NOT NULL AND heart_rate > 0 THEN heart_rate END) as maxHeartRate
      FROM readings 
      WHERE session_id = ?
    `;
    
    const stats = await this.db.getFirstAsync(query, [sessionId]);
    
    // Log for debugging
    log.info('Session stats calculated:', {
      sessionId,
      totalReadings: stats.totalReadings,
      validSpO2Readings: stats.validSpO2Readings,
      validHeartRateReadings: stats.validHeartRateReadings,
      avgSpO2: stats.avgSpO2,
      avgHeartRate: stats.avgHeartRate
    });
    
    return stats;
  }

  /**
   * Reprocess statistics for a single session
   */
  async reprocessSessionStats(sessionId) {
    log.info(`Reprocessing stats for session: ${sessionId}`);
    
    // Recalculate statistics with new logic
    const stats = await this.getSessionStats(sessionId);
    
    const query = `
      UPDATE sessions 
      SET total_readings = ?, avg_spo2 = ?, min_spo2 = ?, max_spo2 = ?,
          avg_heart_rate = ?, min_heart_rate = ?, max_heart_rate = ?
      WHERE id = ?
    `;
    
    await this.db.runAsync(query, [
      stats.totalReadings,
      stats.avgSpO2,
      stats.minSpO2,
      stats.maxSpO2,
      stats.avgHeartRate,
      stats.minHeartRate,
      stats.maxHeartRate,
      sessionId
    ]);
    
    log.info(`Reprocessed stats for session ${sessionId}:`, stats);
    return stats;
  }

  /**
   * Reprocess all sessions with null statistics
   */
  async reprocessAllNullStats() {
    log.info('Reprocessing all sessions with null statistics...');
    
    // Find sessions with null stats
    const query = `
      SELECT id FROM sessions 
      WHERE status = 'completed' 
      AND (avg_spo2 IS NULL OR avg_heart_rate IS NULL)
      ORDER BY start_time DESC
    `;
    
    const result = await this.db.getAllAsync(query);
    const sessionsToReprocess = result.map(row => row.id);
    
    log.info(`🔄 Found ${sessionsToReprocess.length} sessions to reprocess`);
    
    const results = [];
    for (const sessionId of sessionsToReprocess) {
      try {
        const stats = await this.reprocessSessionStats(sessionId);
        results.push({ sessionId, success: true, stats });
      } catch (error) {
        log.error(`❌ Failed to reprocess session ${sessionId}:`, error);
        results.push({ sessionId, success: false, error: error.message });
      }
    }
    
    const successful = results.filter(r => r.success).length;
    log.info(`Reprocessed ${successful}/${sessionsToReprocess.length} sessions successfully`);
    
    return results;
  }

  /**
   * Get hypoxia progression over time
   */
  async getHypoxiaProgression(limit = 30) {
    const query = `
      SELECT 
        id,
        start_time,
        end_time,
        default_hypoxia_level,
        total_readings,
        avg_spo2,
        avg_heart_rate,
        status
      FROM sessions 
      WHERE default_hypoxia_level IS NOT NULL
      ORDER BY start_time DESC
      LIMIT ?
    `;
    
    const results = await this.db.getAllAsync(query, [limit]);
    const sessions = [];
    
    for (const session of results) {
      sessions.push({
        id: session.id,
        startTime: session.start_time,
        endTime: session.end_time,
        hypoxiaLevel: session.default_hypoxia_level,
        totalReadings: session.total_readings,
        avgSpO2: session.avg_spo2,
        avgHeartRate: session.avg_heart_rate,
        status: session.status,
        date: new Date(session.start_time).toLocaleDateString()
      });
    }
    
    return sessions.reverse(); // Return in chronological order
  }

  /**
   * Get hypoxia statistics summary
   */
  async getHypoxiaStats() {
    const query = `
      SELECT 
        COUNT(*) as totalSessions,
        AVG(default_hypoxia_level) as avgHypoxiaLevel,
        MIN(default_hypoxia_level) as minHypoxiaLevel,
        MAX(default_hypoxia_level) as maxHypoxiaLevel,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completedSessions
      FROM sessions 
      WHERE default_hypoxia_level IS NOT NULL
    `;
    
    const stats = await this.db.getFirstAsync(query);
    
    return {
      totalSessions: stats.totalSessions || 0,
      avgHypoxiaLevel: Math.round((stats.avgHypoxiaLevel || 0) * 10) / 10,
      minHypoxiaLevel: stats.minHypoxiaLevel || 0,
      maxHypoxiaLevel: stats.maxHypoxiaLevel || 0,
      completedSessions: stats.completedSessions || 0,
      completionRate: stats.totalSessions > 0 
        ? Math.round((stats.completedSessions / stats.totalSessions) * 100) 
        : 0
    };
  }

  /**
   * Get storage information
   */
  async getStorageInfo() {
    const sessionCountQuery = 'SELECT COUNT(*) as count FROM sessions';
    const readingCountQuery = 'SELECT COUNT(*) as count FROM readings';
    
    const sessionResult = await this.db.getFirstAsync(sessionCountQuery);
    const readingResult = await this.db.getFirstAsync(readingCountQuery);
    
    return {
      sessionCount: sessionResult.count,
      readingCount: readingResult.count,
      estimatedSizeMB: Math.round((readingResult.count * 100) / 1024 / 1024 * 100) / 100
    };
  }

  /**
   * Clean up old sessions (keep only the 10 most recent)
   */
  async cleanupOldSessions() {
    const deleteQuery = `
      DELETE FROM sessions 
      WHERE id NOT IN (
        SELECT id FROM sessions 
        ORDER BY start_time DESC 
        LIMIT 10
      )
    `;
    
    // This will cascade delete readings due to foreign key
    await this.db.runAsync(deleteQuery);
    log.info('🧹 Cleaned up old sessions');
  }
}

export default MetricsDatabaseService;