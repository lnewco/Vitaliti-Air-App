import * as SQLite from 'expo-sqlite';
import logger from '../utils/logger';
import SurveyDatabaseService from './database/SurveyDatabaseService';
import AdaptiveDatabaseService from './database/AdaptiveDatabaseService';
import MetricsDatabaseService from './database/MetricsDatabaseService';

const log = logger.createModuleLogger('DatabaseService');

class DatabaseService {
  constructor() {
    this.db = null;
    this.surveyService = null;
    this.adaptiveService = null;
    this.metricsService = null;
  }

  async init() {
    try {
      log.info('🗄️ Initializing database...');
      
      this.db = await SQLite.openDatabaseAsync('vitaliti.db');
      
      await this.createTables();
      
      // Initialize specialized services
      this.adaptiveService = new AdaptiveDatabaseService(this.db);
      this.surveyService = new SurveyDatabaseService(this.db);
      this.metricsService = new MetricsDatabaseService(this.db);
      
      // Check if adaptive columns exist and force migration if needed
      await this.adaptiveService.ensureAdaptiveColumnsExist();
      
      log.info('✅ [DatabaseService] Database initialized successfully');
    } catch (error) {
      log.error('❌ Database initialization failed:', error);
      throw error;
    }
  }

  async ensureAdaptiveColumnsExist() {
    return this.adaptiveService.ensureAdaptiveColumnsExist();
  }

  async ensureAdaptiveTablesExist() {
    return this.adaptiveService.ensureAdaptiveTablesExist();
  }

  async createTables() {
    const createSessionsTable = `
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        start_time INTEGER NOT NULL,
        end_time INTEGER,
        status TEXT NOT NULL DEFAULT 'active',
        total_readings INTEGER DEFAULT 0,
        avg_spo2 REAL,
        min_spo2 INTEGER,
        max_spo2 INTEGER,
        avg_heart_rate REAL,
        min_heart_rate INTEGER,
        max_heart_rate INTEGER,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        session_type TEXT DEFAULT 'IHHT',
        current_phase TEXT,
        current_cycle INTEGER DEFAULT 1,
        total_cycles INTEGER DEFAULT 3,
        hypoxic_duration INTEGER DEFAULT 420,
        hyperoxic_duration INTEGER DEFAULT 180,
        default_hypoxia_level INTEGER,
        total_duration_seconds INTEGER,
        avg_hrv_rmssd REAL,
        min_hrv_rmssd REAL,
        max_hrv_rmssd REAL,
        hrv_reading_count INTEGER DEFAULT 0,
        best_hrv_quality TEXT,
        planned_total_cycles INTEGER,
        planned_hypoxic_duration INTEGER, 
        planned_hyperoxic_duration INTEGER,
        actual_cycles_completed INTEGER DEFAULT 0,
        actual_hypoxic_time INTEGER DEFAULT 0,
        actual_hyperoxic_time INTEGER DEFAULT 0,
        completion_percentage REAL,
        baseline_hrv_rmssd REAL,
        baseline_hrv_confidence REAL,
        baseline_hrv_interval_count INTEGER,
        baseline_hrv_duration_seconds INTEGER
      );
    `;

    const createReadingsTable = `
      CREATE TABLE IF NOT EXISTS readings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        spo2 INTEGER,
        heart_rate INTEGER,
        signal_strength INTEGER,
        is_valid BOOLEAN DEFAULT 1,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        user_id TEXT,
        fio2_level INTEGER,
        phase_type TEXT,
        cycle_number INTEGER,
        hrv_rmssd REAL,
        hrv_type TEXT,
        hrv_interval_count INTEGER,
        hrv_data_quality TEXT,
        hrv_confidence REAL,
        FOREIGN KEY (session_id) REFERENCES sessions (id)
      );
    `;

    const createIndexes = `
      CREATE INDEX IF NOT EXISTS idx_readings_session_time ON readings(session_id, timestamp);
      CREATE INDEX IF NOT EXISTS idx_readings_valid ON readings(is_valid) WHERE is_valid = 1;
      CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
    `;

    const createSessionSurveysTable = `
      CREATE TABLE IF NOT EXISTS session_surveys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL UNIQUE,
        clarity_pre INTEGER CHECK (clarity_pre >= 1 AND clarity_pre <= 5),
        energy_pre INTEGER CHECK (energy_pre >= 1 AND energy_pre <= 5),
        clarity_post INTEGER CHECK (clarity_post >= 1 AND clarity_post <= 5),
        energy_post INTEGER CHECK (energy_post >= 1 AND energy_post <= 5),
        stress_post INTEGER CHECK (stress_post >= 1 AND stress_post <= 5),
        notes_post TEXT,
        post_symptoms TEXT,
        overall_rating INTEGER CHECK (overall_rating >= 1 AND overall_rating <= 5),
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (session_id) REFERENCES sessions (id) ON DELETE CASCADE
      );
    `;

    const createIntraSessionResponsesTable = `
      CREATE TABLE IF NOT EXISTS intra_session_responses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        phase_number INTEGER NOT NULL,
        clarity INTEGER NOT NULL CHECK (clarity >= 1 AND clarity <= 5),
        energy INTEGER NOT NULL CHECK (energy >= 1 AND energy <= 5),
        stress INTEGER NOT NULL CHECK (stress >= 1 AND stress <= 5),
        timestamp INTEGER NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (session_id) REFERENCES sessions (id) ON DELETE CASCADE,
        UNIQUE(session_id, phase_number)
      );
    `;

    const createSurveyIndexes = `
      CREATE INDEX IF NOT EXISTS idx_session_surveys_session_id ON session_surveys(session_id);
      CREATE INDEX IF NOT EXISTS idx_intra_responses_session_id ON intra_session_responses(session_id);
      CREATE INDEX IF NOT EXISTS idx_intra_responses_phase ON intra_session_responses(session_id, phase_number);
    `;

    // Adaptive Instructions System Tables
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
        display_name TEXT NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      );
    `;

    const createAdaptiveIndexes = `
      CREATE INDEX IF NOT EXISTS idx_session_adaptive_events_session_id ON session_adaptive_events(session_id);
      CREATE INDEX IF NOT EXISTS idx_session_adaptive_events_type ON session_adaptive_events(event_type);
      CREATE INDEX IF NOT EXISTS idx_session_adaptive_events_timestamp ON session_adaptive_events(event_timestamp);
      CREATE INDEX IF NOT EXISTS idx_session_phase_stats_session_id ON session_phase_stats(session_id);
      CREATE INDEX IF NOT EXISTS idx_session_phase_stats_phase_type ON session_phase_stats(phase_type);
      CREATE INDEX IF NOT EXISTS idx_session_phase_stats_phase_number ON session_phase_stats(phase_number);
    `;

    const insertAltitudeLevels = `
      INSERT OR REPLACE INTO altitude_levels (level, oxygen_percentage, equivalent_altitude_feet, equivalent_altitude_meters, display_name) VALUES
        (0, 18.0, 4000, 1219, '~4,000 ft / 1,219 m'),
        (1, 17.1, 5500, 1676, '~5,500 ft / 1,676 m'),
        (2, 16.2, 7500, 2286, '~7,500 ft / 2,286 m'),
        (3, 15.3, 9500, 2896, '~9,500 ft / 2,896 m'),
        (4, 14.4, 11500, 3505, '~11,500 ft / 3,505 m'),
        (5, 13.5, 13500, 4115, '~13,500 ft / 4,115 m'),
        (6, 12.6, 15500, 4724, '~15,500 ft / 4,724 m'),
        (7, 11.7, 18000, 5486, '~18,000 ft / 5,486 m'),
        (8, 10.8, 20500, 6248, '~20,500 ft / 6,248 m'),
        (9, 9.9, 23000, 7010, '~23,000 ft / 7,010 m'),
        (10, 9.0, 26500, 8077, '~26,500 ft / 8,077 m');
    `;

    // Combine all table creation and index queries for better performance
    const allTableQueries = `
      ${createSessionsTable}
      ${createReadingsTable}
      ${createSessionSurveysTable}
      ${createIntraSessionResponsesTable}
      ${createAdaptiveEventsTable}
      ${createPhaseStatsTable}
      ${createAltitudeLevelsTable}
      ${createIndexes}
      ${createSurveyIndexes}
      ${createAdaptiveIndexes}
      ${insertAltitudeLevels}
    `;
    
    await this.db.execAsync(allTableQueries);
    
    // Add new columns one by one (will silently fail if columns already exist, which is fine)
    try {
      // Check if columns exist by trying to add them individually
      const readingsColumns = [
        'fio2_level INTEGER', 
        'phase_type TEXT', 
        'cycle_number INTEGER',
        'user_id TEXT',
        'hrv_rmssd REAL',
        'hrv_type TEXT',
        'hrv_interval_count INTEGER',
        'hrv_data_quality TEXT',
        'hrv_confidence REAL'
      ];
      const sessionsColumns = [
        'session_type TEXT DEFAULT \'IHHT\'', 
        'current_phase TEXT', 
        'current_cycle INTEGER DEFAULT 1', 
        'total_cycles INTEGER DEFAULT 3',
        'hypoxic_duration INTEGER DEFAULT 420',
        'hyperoxic_duration INTEGER DEFAULT 180',
        'default_hypoxia_level INTEGER',
        'updated_at INTEGER NOT NULL DEFAULT (strftime(\'%s\', \'now\'))',
        'total_duration_seconds INTEGER',
        'avg_hrv_rmssd REAL',
        'min_hrv_rmssd REAL',
        'max_hrv_rmssd REAL',
        'hrv_reading_count INTEGER DEFAULT 0',
        'best_hrv_quality TEXT',
        'planned_total_cycles INTEGER',
        'planned_hypoxic_duration INTEGER', 
        'planned_hyperoxic_duration INTEGER',
        'actual_cycles_completed INTEGER DEFAULT 0',
        'actual_hypoxic_time INTEGER DEFAULT 0',
        'actual_hyperoxic_time INTEGER DEFAULT 0',
        'completion_percentage REAL',
        'baseline_hrv_rmssd REAL',
        'baseline_hrv_confidence REAL',
        'baseline_hrv_interval_count INTEGER',
        'baseline_hrv_duration_seconds INTEGER',
        'session_subtype TEXT DEFAULT \'calibration\'',
        'starting_altitude_level INTEGER DEFAULT 6',
        'current_altitude_level INTEGER DEFAULT 6',
        'adaptive_system_enabled INTEGER DEFAULT 1',
        'total_mask_lifts INTEGER DEFAULT 0',
        'total_altitude_adjustments INTEGER DEFAULT 0'
      ];
      
      for (const column of readingsColumns) {
        try {
          await this.db.execAsync(`ALTER TABLE readings ADD COLUMN ${column}`);
        } catch (e) {
          // Column probably already exists - that's fine
        }
      }
      
      for (const column of sessionsColumns) {
        try {
          await this.db.execAsync(`ALTER TABLE sessions ADD COLUMN ${column}`);
        } catch (e) {
          // Column probably already exists - that's fine
        }
      }
      
      // Add missing columns to session_surveys table
      const surveysColumns = [
        'post_symptoms TEXT',
        'overall_rating INTEGER CHECK (overall_rating >= 1 AND overall_rating <= 5)',
        'stress_pre INTEGER CHECK (stress_pre >= 1 AND stress_pre <= 5)' // Also add stress_pre for consistency
      ];
      
      for (const column of surveysColumns) {
        try {
          await this.db.execAsync(`ALTER TABLE session_surveys ADD COLUMN ${column}`);
          log.info(`✅ Added column to session_surveys: ${column.split(' ')[0]}`);
        } catch (e) {
          // Column probably already exists - that's fine
        }
      }
      
      log.info('HRV, protocol, and FiO2 columns verified/added to local database');
    } catch (error) {
      log.info('Database column setup completed with expected warnings');
    }
  }

  // Session Management
  async createSession(sessionId, hypoxiaLevel = null, protocolConfig = null) {
    const query = `
      INSERT INTO sessions (
        id, start_time, status, session_type, default_hypoxia_level,
        total_cycles, hypoxic_duration, hyperoxic_duration,
        planned_total_cycles, planned_hypoxic_duration, planned_hyperoxic_duration
      )
      VALUES (?, ?, 'active', 'IHHT', ?, ?, ?, ?, ?, ?, ?)
    `;
    const startTime = Date.now();
    
    // Use protocol config or defaults
    const totalCycles = protocolConfig?.totalCycles || 3;
    const hypoxicDuration = protocolConfig?.hypoxicDuration || 420; // 7 minutes
    const hyperoxicDuration = protocolConfig?.hyperoxicDuration || 180; // 3 minutes
    
    await this.db.runAsync(query, [
      sessionId, 
      startTime, 
      hypoxiaLevel, 
      totalCycles, 
      hypoxicDuration, 
      hyperoxicDuration,
      totalCycles,      // planned_total_cycles (same as total_cycles initially)
      hypoxicDuration,  // planned_hypoxic_duration
      hyperoxicDuration // planned_hyperoxic_duration
    ]);
    
    log.info(`Session created: ${sessionId} (Planned: ${totalCycles} cycles, ${hypoxicDuration}s hypoxic, ${hyperoxicDuration}s hyperoxic, Hypoxia Level: ${hypoxiaLevel})`);
    return sessionId;
  }

  // New method to update protocol configuration for existing sessions
  async updateSessionProtocol(sessionId, protocolConfig) {
    const query = `
      UPDATE sessions 
      SET total_cycles = ?, hypoxic_duration = ?, hyperoxic_duration = ?,
          planned_total_cycles = ?, planned_hypoxic_duration = ?, planned_hyperoxic_duration = ?,
          updated_at = ?
      WHERE id = ?
    `;
    
    const totalCycles = protocolConfig.totalCycles;
    const hypoxicDuration = protocolConfig.hypoxicDuration;
    const hyperoxicDuration = protocolConfig.hyperoxicDuration;
    
    await this.db.runAsync(query, [
      totalCycles, hypoxicDuration, hyperoxicDuration,
      totalCycles, hypoxicDuration, hyperoxicDuration, // planned values
      Date.now(),
      sessionId
    ]);
    
    log.info(`� Updated protocol for session ${sessionId}: ${totalCycles} cycles, ${hypoxicDuration}s hypoxic, ${hyperoxicDuration}s hyperoxic`);
  }

  // Update actual execution stats during the session
  async updateActualExecution(sessionId, actualData) {
    const query = `
      UPDATE sessions 
      SET actual_cycles_completed = ?, 
          actual_hypoxic_time = ?, 
          actual_hyperoxic_time = ?,
          completion_percentage = ?,
          updated_at = ?
      WHERE id = ?
    `;
    
    await this.db.runAsync(query, [
      actualData.cyclesCompleted || 0,
      actualData.hypoxicTime || 0,
      actualData.hyperoxicTime || 0,
      actualData.completionPercentage || 0,
      Date.now(),
      sessionId
    ]);
    
    log.info(`Updated actual execution for session ${sessionId}: ${actualData.cyclesCompleted} cycles completed (${actualData.completionPercentage}%)`);
  }

  // Adaptive Instructions System Methods

  // Get completed adaptive sessions for user (local SQLite version)
  async getCompletedAdaptiveSessions() {
    return this.adaptiveService.getCompletedAdaptiveSessions();
  }

  // Get altitude level information
  async getAltitudeLevel(level) {
    return this.adaptiveService.getAltitudeLevel(level);
  }

  // Save phase statistics
  async savePhaseStats(phaseStats) {
    return this.adaptiveService.savePhaseStats(phaseStats);
  }

  // Save adaptive event
  async saveAdaptiveEvent(event) {
    return this.adaptiveService.saveAdaptiveEvent(event);
  }

  // Update session with adaptive data
  async updateSessionAdaptive(sessionId, adaptiveData) {
    return this.adaptiveService.updateSessionAdaptive(sessionId, adaptiveData);
  }

  // Helper method to generate UUID-like ID for SQLite
  generateId() {
    return 'xxxx-xxxx-4xxx-yxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  async endSession(sessionId, providedStats = null, startTime = null) {
    const endTime = Date.now();
    
    try {
      log.info(`Ending session in local database: ${sessionId}`);
      
      // Use provided stats or calculate them
      let stats;
      if (providedStats) {
        log.info('Using provided session stats:', providedStats);
        stats = providedStats;
      } else {
        // Calculate session statistics
        log.info(`Calculating stats for session: ${sessionId}`);
        stats = await this.getSessionStats(sessionId);
        log.info('Session stats calculated:', stats);
      }
      
      // Calculate total duration if startTime provided
      let totalDuration = null;
      if (startTime) {
        totalDuration = Math.floor((endTime - startTime) / 1000); // Convert to seconds
        log.info(`⏱️ Session duration: ${totalDuration} seconds`);
      }
      
      const query = `
        UPDATE sessions 
        SET end_time = ?, status = 'completed',
            total_readings = ?, avg_spo2 = ?, min_spo2 = ?, max_spo2 = ?,
            avg_heart_rate = ?, min_heart_rate = ?, max_heart_rate = ?, total_duration_seconds = ?
        WHERE id = ?
      `;
      
      log.info(`Executing update query for session: ${sessionId}`);
      await this.db.runAsync(query, [
        endTime,
        stats.totalReadings,
        stats.avgSpO2,
        stats.minSpO2,
        stats.maxSpO2,
        stats.avgHeartRate,
        stats.minHeartRate,
        stats.maxHeartRate,
        totalDuration,
        sessionId
      ]);
      
      log.info(`Session ended successfully in local DB: ${sessionId} (Duration: ${totalDuration}s)`);
      return stats;
    } catch (error) {
      log.error(`❌ Failed to end session ${sessionId} in local DB:`, error);
      log.error(`❌ Error details:`, error.message, error.stack);
      throw error;
    }
  }

  async updateSessionCycle(sessionId, currentCycle) {
    const query = `
      UPDATE sessions 
      SET current_cycle = ?, updated_at = ?
      WHERE id = ?
    `;
    await this.db.runAsync(query, [currentCycle, Date.now(), sessionId]);
    log.info(`Updated session ${sessionId} to cycle ${currentCycle} in local DB`);
  }

  async getSession(sessionId) {
    const query = 'SELECT * FROM sessions WHERE id = ?';
    const result = await this.db.getFirstAsync(query, [sessionId]);
    return result;
  }

  async getAllSessions() {
    try {
      // Ensure database is initialized
      if (!this.db) {
        await this.init();
      }
      
      // First check if the sessions table exists
      const tableCheck = await this.db.getFirstAsync(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'"
      );
      
      if (!tableCheck) {
        console.log('⚠️ Sessions table does not exist, creating it...');
        await this.createTables();
      }
      
      // Select all columns and alias total_duration_seconds as duration for compatibility
      const query = `
        SELECT *, 
               total_duration_seconds as duration,
               CASE 
                 WHEN avg_spo2 IS NULL THEN 95
                 ELSE avg_spo2
               END as average_spo2,
               CASE
                 WHEN avg_heart_rate IS NULL THEN 72
                 ELSE avg_heart_rate
               END as average_heart_rate
        FROM sessions 
        ORDER BY created_at DESC, start_time DESC 
        LIMIT 50
      `;
      const sessions = await this.db.getAllAsync(query);
      console.log('🔍 DatabaseService.getAllSessions: Found', sessions?.length || 0, 'sessions');
      
      if (sessions && sessions.length > 0) {
        console.log('📝 First session:', sessions[0]);
      }
      
      return sessions || [];
    } catch (error) {
      console.error('❌ Error fetching all sessions:', error);
      console.error('Error details:', error.message, error.stack);
      return [];
    }
  }
  
  // Test function to create a sample session
  async createTestSession() {
    try {
      await this.init();
      const testSessionId = `TEST_${Date.now()}`;
      await this.createSession(testSessionId, 6, {
        totalCycles: 3,
        hypoxicDuration: 420,
        hyperoxicDuration: 180
      });
      
      // End it immediately to mark as completed
      await this.endSession(testSessionId, {
        avgSpO2: 95,
        avgHeartRate: 72,
        minSpO2: 92,
        maxSpO2: 98,
        totalReadings: 100
      });
      
      console.log('✅ Test session created:', testSessionId);
      return testSessionId;
    } catch (error) {
      console.error('❌ Error creating test session:', error);
      return null;
    }
  }

  // Reading Management
  async addReading(sessionId, reading) {
    const query = `
      INSERT INTO readings (session_id, timestamp, spo2, heart_rate, signal_strength, is_valid, fio2_level, phase_type, cycle_number, hrv_rmssd, hrv_type, hrv_interval_count, hrv_data_quality, hrv_confidence)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    // More flexible validation: valid if we have either spo2 or heart rate data
    const isValid = (reading.spo2 !== null && reading.spo2 > 0) || 
                   (reading.heartRate !== null && reading.heartRate > 0);
    
    await this.db.runAsync(query, [
      sessionId,
      reading.timestamp,
      reading.spo2,
      reading.heartRate,
      reading.signalStrength,
      isValid ? 1 : 0,
      reading.fio2Level || null,
      reading.phaseType || null,
      reading.cycleNumber || null,
      reading.hrv?.rmssd || reading.hrv_rmssd || null,
      reading.hrv?.type || null,
      reading.hrv?.intervalCount || null,
      reading.hrv?.dataQuality || null,
      reading.hrv?.confidence || null
    ]);
  }

  async addReadingsBatch(readings) {
    if (readings.length === 0) return;
    
    await this.db.withTransactionAsync(async () => {
      const query = `
        INSERT INTO readings (session_id, timestamp, spo2, heart_rate, signal_strength, is_valid, fio2_level, phase_type, cycle_number, hrv_rmssd, hrv_type, hrv_interval_count, hrv_data_quality, hrv_confidence)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      for (const reading of readings) {
        // More flexible validation: valid if we have either spo2 or heart rate data
        const isValid = (reading.spo2 !== null && reading.spo2 > 0) || 
                       (reading.heartRate !== null && reading.heartRate > 0);
        await this.db.runAsync(query, [
          reading.sessionId,
          reading.timestamp,
          reading.spo2,
          reading.heartRate,
          reading.signalStrength,
          isValid ? 1 : 0,
          reading.fio2Level || null,
          reading.phaseType || null,
          reading.cycleNumber || null,
          reading.hrv?.rmssd || reading.hrv_rmssd || null,
          reading.hrv?.type || null,
          reading.hrv?.intervalCount || null,
          reading.hrv?.dataQuality || null,
          reading.hrv?.confidence || null
        ]);
      }
    });
    
    log.info(`� Batch inserted ${readings.length} readings with FiO2 data`);
  }

  async getSessionReadings(sessionId, validOnly = false) {
    const query = `
      SELECT * FROM readings 
      WHERE session_id = ? ${validOnly ? 'AND is_valid = 1' : ''}
      ORDER BY timestamp ASC
    `;
    
    const readings = await this.db.getAllAsync(query, [sessionId]);
    return readings;
  }

  async updateSessionBaselineHRV(sessionId, rmssd, confidence, intervalCount, durationSeconds) {
    return this.metricsService.updateSessionBaselineHRV(sessionId, rmssd, confidence, intervalCount, durationSeconds);
  }

  async getSessionBaselineHRV(sessionId) {
    return this.metricsService.getSessionBaselineHRV(sessionId);
  }

  async getSessionHRVStats(sessionId) {
    return this.metricsService.getSessionHRVStats(sessionId);
  }

  async getSessionStats(sessionId) {
    return this.metricsService.getSessionStats(sessionId);
  }

  // Data Management
  async reprocessSessionStats(sessionId) {
    return this.metricsService.reprocessSessionStats(sessionId);
  }

  async reprocessAllNullStats() {
    return this.metricsService.reprocessAllNullStats();
  }

  async cleanupOldSessions() {
    return this.metricsService.cleanupOldSessions();
  }

  async clearAllData() {
    await this.db.runAsync('DELETE FROM readings');
    await this.db.runAsync('DELETE FROM sessions');
    log.info('Cleared all data');
  }

  async getStorageInfo() {
    return this.metricsService.getStorageInfo();
  }

  // ========================================
  // CALIBRATION SESSION MANAGEMENT
  // ========================================


  // Hypoxia Level Analytics
  async getHypoxiaProgression(limit = 30) {
    return this.metricsService.getHypoxiaProgression(limit);
  }

  async getHypoxiaStats() {
    return this.metricsService.getHypoxiaStats();
  }

  // ========================================
  // SURVEY DATA MANAGEMENT
  // ========================================

  /**
   * Save pre-session survey data (reactivated for AI feedback engine)
   */
  async savePreSessionSurvey(sessionId, clarityPre, energyPre, stressPre) {
    return this.surveyService.savePreSessionSurvey(sessionId, clarityPre, energyPre, stressPre);
  }

  /**
   * Save post-session survey data (enhanced with symptoms and rating)
   */
  async savePostSessionSurvey(sessionId, clarityPost, energyPost, stressPost, notesPost = null, symptoms = [], overallRating = null) {
    return this.surveyService.savePostSessionSurvey(sessionId, clarityPost, energyPost, stressPost, notesPost, symptoms, overallRating);
  }

  /**
   * Save intra-session response (enhanced with sensations and physiological data)
   */
  async saveIntraSessionResponse(sessionId, phaseNumber, clarity, energy, stressPerception, timestamp, sensations = [], spo2 = null, heartRate = null) {
    return this.surveyService.saveIntraSessionResponse(sessionId, phaseNumber, clarity, energy, stressPerception, timestamp, sensations, spo2, heartRate);
  }

  /**
   * Get complete survey data for a session
   */
  async getSessionSurveyData(sessionId) {
    return this.surveyService.getSessionSurveyData(sessionId);
  }

  /**
   * Get survey completion status for a session
   */
  async getSurveyCompletionStatus(sessionId) {
    return this.surveyService.getSurveyCompletionStatus(sessionId);
  }

  /**
   * Validate survey scale value (1-5)
   */
  isValidSurveyScale(value) {
    return this.surveyService.isValidSurveyScale(value);
  }

  /**
   * Delete all survey data for a session
   */
  async deleteSurveyData(sessionId) {
    return this.surveyService.deleteSurveyData(sessionId);
  }

  /**
   * Get complete session data including readings, stats, and survey
   * This method combines multiple queries to provide all session data in one call
   */
  async getSessionWithData(sessionId) {
    try {
      log.info(`Fetching complete data for session: ${sessionId}`);
      
      // Get base session data
      const session = await this.getSession(sessionId);
      if (!session) {
        log.warn(`Session not found: ${sessionId}`);
        return null;
      }
      
      // Get session readings
      const readings = await this.getSessionReadings(sessionId);
      
      // Get session statistics
      const stats = await this.getSessionStats(sessionId);
      
      // Get survey data if available
      let surveyData = null;
      try {
        surveyData = await this.getSessionSurveyData(sessionId);
      } catch (error) {
        log.warn('Survey data not available for session:', sessionId);
      }
      
      // Get baseline HRV if available
      let baselineHRV = null;
      try {
        baselineHRV = await this.getSessionBaselineHRV(sessionId);
      } catch (error) {
        log.warn('Baseline HRV not available for session:', sessionId);
      }
      
      // Get HRV stats if available
      let hrvStats = null;
      try {
        hrvStats = await this.getSessionHRVStats(sessionId);
      } catch (error) {
        log.warn('HRV stats not available for session:', sessionId);
      }
      
      // Combine all data
      return {
        ...session,
        readings: readings || [],
        stats: stats || {},
        survey: surveyData,
        baselineHRV: baselineHRV,
        hrvStats: hrvStats,
        total_readings: readings ? readings.length : 0
      };
    } catch (error) {
      log.error('Failed to get session with data:', error);
      throw error;
    }
  }

  async close() {
    if (this.db) {
      await this.db.close();
      this.db = null;
      log.info('Database closed');
    }
  }
}

export default new DatabaseService(); 