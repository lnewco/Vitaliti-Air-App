/**
 * AdaptiveDatabaseService - Handles all adaptive training related database operations
 * Extracted from DatabaseService for better modularity
 */

import log from '../../utils/logger';

class AdaptiveDatabaseService {
  constructor(db) {
    this.db = db;
  }

  /**
   * Ensure adaptive columns exist in sessions table
   */
  async ensureAdaptiveColumnsExist() {
    try {
      // Test if adaptive columns exist by running a simple query
      await this.db.getAllAsync('SELECT session_subtype, adaptive_system_enabled FROM sessions LIMIT 1', []);
      log.info('✅ [AdaptiveDatabaseService] Adaptive columns verified');
    } catch (error) {
      log.info('🔧 [AdaptiveDatabaseService] Adaptive columns missing, forcing migration...');
      
      // Force add the missing columns
      const adaptiveColumns = [
        'session_subtype TEXT DEFAULT \'calibration\'',
        'starting_altitude_level INTEGER DEFAULT 6',
        'current_altitude_level INTEGER DEFAULT 6',
        'adaptive_system_enabled INTEGER DEFAULT 1',
        'total_mask_lifts INTEGER DEFAULT 0',
        'total_altitude_adjustments INTEGER DEFAULT 0'
      ];
      
      for (const column of adaptiveColumns) {
        try {
          await this.db.execAsync(`ALTER TABLE sessions ADD COLUMN ${column}`);
          log.info(`✅ [AdaptiveDatabaseService] Added column: ${column.split(' ')[0]}`);
        } catch (e) {
          // Column might already exist
          log.info(`⚠️ [AdaptiveDatabaseService] Column might already exist: ${column.split(' ')[0]}`);
        }
      }
      
      // Test again to make sure it worked
      await this.db.getAllAsync('SELECT session_subtype, adaptive_system_enabled FROM sessions LIMIT 1', []);
      log.info('✅ [AdaptiveDatabaseService] Adaptive columns migration completed');
      
      // Also ensure adaptive tables exist
      await this.ensureAdaptiveTablesExist();
    }
  }

  /**
   * Ensure adaptive tables exist
   */
  async ensureAdaptiveTablesExist() {
    try {
      // Test if adaptive tables exist
      await this.db.getAllAsync('SELECT COUNT(*) FROM session_adaptive_events LIMIT 1', []);
      await this.db.getAllAsync('SELECT COUNT(*) FROM session_phase_stats LIMIT 1', []);
      await this.db.getAllAsync('SELECT COUNT(*) FROM altitude_levels LIMIT 1', []);
      log.info('✅ [AdaptiveDatabaseService] Adaptive tables verified');
    } catch (error) {
      log.info('🔧 [AdaptiveDatabaseService] Creating missing adaptive tables...');
      
      // Create adaptive tables
      const createAdaptiveEventsTable = `
        CREATE TABLE IF NOT EXISTS session_adaptive_events (
          id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
          session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
          event_type TEXT NOT NULL CHECK (event_type IN ('mask_lift', 'dial_adjustment', 'recovery_complete', 'altitude_phase_complete')),
          event_timestamp INTEGER NOT NULL,
          altitude_phase_number INTEGER,
          recovery_phase_number INTEGER,
          current_altitude_level INTEGER,
          spo2_value INTEGER,
          additional_data TEXT DEFAULT '{}',
          created_at INTEGER DEFAULT (strftime('%s', 'now'))
        );
      `;

      const createPhaseStatsTable = `
        CREATE TABLE IF NOT EXISTS session_phase_stats (
          id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
          session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
          phase_type TEXT NOT NULL CHECK (phase_type IN ('altitude', 'recovery')),
          phase_number INTEGER NOT NULL,
          altitude_level INTEGER NOT NULL,
          start_time INTEGER NOT NULL,
          end_time INTEGER,
          duration_seconds INTEGER,
          min_spo2 INTEGER,
          max_spo2 INTEGER,
          avg_spo2 REAL,
          spo2_readings_count INTEGER DEFAULT 0,
          mask_lift_count INTEGER DEFAULT 0,
          target_min_spo2 INTEGER NOT NULL,
          target_max_spo2 INTEGER NOT NULL,
          recovery_trigger TEXT CHECK (recovery_trigger IN ('spo2_stabilized', 'time_limit', 'manual')),
          time_to_95_percent_seconds INTEGER,
          time_above_95_percent_seconds INTEGER,
          created_at INTEGER DEFAULT (strftime('%s', 'now'))
        );
      `;

      const createAltitudeLevelsTable = `
        CREATE TABLE IF NOT EXISTS altitude_levels (
          level INTEGER PRIMARY KEY CHECK (level >= 0 AND level <= 10),
          oxygen_percentage REAL NOT NULL,
          equivalent_altitude_feet INTEGER NOT NULL,
          equivalent_altitude_meters INTEGER NOT NULL,
          description TEXT
        );
      `;

      const insertAltitudeLevels = `
        INSERT OR IGNORE INTO altitude_levels (level, oxygen_percentage, equivalent_altitude_feet, equivalent_altitude_meters, description) VALUES
        (0, 20.9, 0, 0, 'Sea Level'),
        (1, 18.1, 6500, 1981, 'Low Altitude'),
        (2, 17.3, 8000, 2438, 'Moderate Altitude'),
        (3, 16.5, 9500, 2896, 'High Altitude'),
        (4, 15.7, 11000, 3353, 'Very High Altitude'),
        (5, 14.9, 12500, 3810, 'Extreme Altitude'),
        (6, 14.1, 14000, 4267, 'Peak Training'),
        (7, 13.3, 15500, 4724, 'Advanced Training'),
        (8, 12.5, 17000, 5182, 'Expert Level'),
        (9, 11.7, 18500, 5639, 'Elite Training'),
        (10, 10.9, 20000, 6096, 'Maximum Level');
      `;

      await this.db.execAsync(createAdaptiveEventsTable);
      await this.db.execAsync(createPhaseStatsTable);
      await this.db.execAsync(createAltitudeLevelsTable);
      await this.db.execAsync(insertAltitudeLevels);

      log.info('✅ [AdaptiveDatabaseService] Adaptive tables created successfully');
    }
  }

  /**
   * Get completed adaptive sessions for user (local SQLite version)
   */
  async getCompletedAdaptiveSessions() {
    const query = `
      SELECT id, session_subtype, start_time, end_time 
      FROM sessions 
      WHERE status = 'completed' AND adaptive_system_enabled = 1
      ORDER BY start_time DESC
    `;
    
    try {
      const result = await this.db.getAllAsync(query, []);
      return result || [];
    } catch (error) {
      log.error('Error getting completed adaptive sessions:', error);
      return [];
    }
  }

  /**
   * Get altitude level information
   */
  async getAltitudeLevel(level) {
    const query = `
      SELECT * FROM altitude_levels WHERE level = ?
    `;
    
    try {
      const result = await this.db.getFirstAsync(query, [level]);
      return result;
    } catch (error) {
      log.error('Error getting altitude level:', error);
      return null;
    }
  }

  /**
   * Save phase statistics
   */
  async savePhaseStats(phaseStats) {
    const query = `
      INSERT INTO session_phase_stats (
        id, session_id, phase_type, phase_number, altitude_level,
        start_time, end_time, duration_seconds,
        min_spo2, max_spo2, avg_spo2, spo2_readings_count,
        mask_lift_count, target_min_spo2, target_max_spo2,
        recovery_trigger, time_to_95_percent_seconds, time_above_95_percent_seconds,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const id = this.generateId();
    const values = [
      id,
      phaseStats.sessionId,
      phaseStats.phaseType,
      phaseStats.phaseNumber,
      phaseStats.altitudeLevel,
      phaseStats.startTime,
      phaseStats.endTime || null,
      phaseStats.durationSeconds || null,
      phaseStats.minSpO2 || null,
      phaseStats.maxSpO2 || null,
      phaseStats.avgSpO2 || null,
      phaseStats.spo2ReadingsCount || 0,
      phaseStats.maskLiftCount || 0,
      phaseStats.targetMinSpO2,
      phaseStats.targetMaxSpO2,
      phaseStats.recoveryTrigger || null,
      phaseStats.timeTo95PercentSeconds || null,
      phaseStats.timeAbove95PercentSeconds || null,
      Date.now()
    ];
    
    await this.db.runAsync(query, values);
    log.info(`Saved ${phaseStats.phaseType} phase stats for session ${phaseStats.sessionId}`);
    return id;
  }

  /**
   * Save adaptive event
   */
  async saveAdaptiveEvent(event) {
    const query = `
      INSERT INTO session_adaptive_events (
        id, session_id, event_type, event_timestamp,
        altitude_phase_number, recovery_phase_number, current_altitude_level,
        spo2_value, additional_data, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const id = this.generateId();
    const values = [
      id,
      event.session_id || event.sessionId, // Support both naming conventions
      event.event_type || event.eventType,
      new Date(event.event_timestamp || event.eventTimestamp).getTime(), // Convert to timestamp
      event.altitude_phase_number || event.altitudePhaseNumber || null,
      event.recovery_phase_number || event.recoveryPhaseNumber || null,
      event.current_altitude_level || event.currentAltitudeLevel || null,
      event.spo2_value || event.additionalData?.spo2Value || null,
      event.additional_data || JSON.stringify(event.additionalData || {}),
      Date.now()
    ];
    
    await this.db.runAsync(query, values);
    log.info(`Saved adaptive event: ${event.event_type || event.eventType} for session ${event.session_id || event.sessionId}`);
    return id;
  }

  /**
   * Update session with adaptive data
   */
  async updateSessionAdaptive(sessionId, adaptiveData) {
    const query = `
      UPDATE sessions 
      SET session_subtype = ?,
          starting_altitude_level = ?,
          current_altitude_level = ?,
          adaptive_system_enabled = ?,
          total_mask_lifts = ?,
          total_altitude_adjustments = ?,
          updated_at = ?
      WHERE id = ?
    `;
    
    await this.db.runAsync(query, [
      adaptiveData.sessionSubtype || 'calibration',
      adaptiveData.startingAltitudeLevel || 6,
      adaptiveData.currentAltitudeLevel || 6,
      adaptiveData.adaptiveSystemEnabled ? 1 : 0,
      adaptiveData.totalMaskLifts || 0,
      adaptiveData.totalAltitudeAdjustments || 0,
      Date.now(),
      sessionId
    ]);
    
    log.info(`Updated adaptive data for session ${sessionId}`);
  }

  /**
   * Helper method to generate UUID-like ID for SQLite
   */
  generateId() {
    return 'xxxx-xxxx-4xxx-yxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}

export default AdaptiveDatabaseService;