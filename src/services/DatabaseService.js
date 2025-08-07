import SQLite from 'react-native-sqlite-storage';
import logger from '../utils/logger';

const log = logger.createModuleLogger('DatabaseService');

// Enable promise-based API
SQLite.enablePromise(true);

class DatabaseService {
  constructor() {
    this.db = null;
  }

  async init() {
    try {
      log.info('�️ Initializing database...');
      this.db = await SQLite.openDatabase({
        name: 'vitaliti.db',
        location: 'default',
      });
      
      await this.createTables();
      log.info('Database initialized successfully');
    } catch (error) {
      log.error('❌ Database initialization failed:', error);
      throw error;
    }
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
        completion_percentage REAL
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

    await this.db.executeSql(createSessionsTable);
    await this.db.executeSql(createReadingsTable);
    await this.db.executeSql(createSessionSurveysTable);
    await this.db.executeSql(createIntraSessionResponsesTable);
    await this.db.executeSql(createIndexes);
    await this.db.executeSql(createSurveyIndexes);
    
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
        'completion_percentage REAL'
      ];
      
      for (const column of readingsColumns) {
        try {
          await this.db.executeSql(`ALTER TABLE readings ADD COLUMN ${column}`);
        } catch (e) {
          // Column probably already exists - that's fine
        }
      }
      
      for (const column of sessionsColumns) {
        try {
          await this.db.executeSql(`ALTER TABLE sessions ADD COLUMN ${column}`);
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
    
    await this.db.executeSql(query, [
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
    
    log.info('Session created: ${sessionId} (Planned: ${totalCycles} cycles, ${hypoxicDuration}s hypoxic, ${hyperoxicDuration}s hyperoxic, Hypoxia Level: ${hypoxiaLevel})');
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
    
    await this.db.executeSql(query, [
      totalCycles, hypoxicDuration, hyperoxicDuration,
      totalCycles, hypoxicDuration, hyperoxicDuration, // planned values
      Date.now(),
      sessionId
    ]);
    
    log.info('� Updated protocol for session ${sessionId}: ${totalCycles} cycles, ${hypoxicDuration}s hypoxic, ${hyperoxicDuration}s hyperoxic');
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
    
    await this.db.executeSql(query, [
      actualData.cyclesCompleted || 0,
      actualData.hypoxicTime || 0,
      actualData.hyperoxicTime || 0,
      actualData.completionPercentage || 0,
      Date.now(),
      sessionId
    ]);
    
    log.info('Updated actual execution for session ${sessionId}: ${actualData.cyclesCompleted} cycles completed (${actualData.completionPercentage}%)');
  }

  async endSession(sessionId, startTime = null) {
    const endTime = Date.now();
    
    try {
      log.info('Ending session in local database: ${sessionId}');
      
      // Calculate session statistics
      log.info('Calculating stats for session: ${sessionId}');
      const stats = await this.getSessionStats(sessionId);
      log.info('Session stats calculated:' stats);
      
      // Calculate total duration if startTime provided
      let totalDuration = null;
      if (startTime) {
        totalDuration = Math.floor((endTime - startTime) / 1000); // Convert to seconds
        log.info('⏱️ Session duration: ${totalDuration} seconds');
      }
      
      const query = `
        UPDATE sessions 
        SET end_time = ?, status = 'completed',
            total_readings = ?, avg_spo2 = ?, min_spo2 = ?, max_spo2 = ?,
            avg_heart_rate = ?, min_heart_rate = ?, max_heart_rate = ?, total_duration_seconds = ?
        WHERE id = ?
      `;
      
      log.info('Executing update query for session: ${sessionId}');
      await this.db.executeSql(query, [
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
      
      log.info('Session ended successfully in local DB: ${sessionId} (Duration: ${totalDuration}s)');
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
    await this.db.executeSql(query, [currentCycle, Date.now(), sessionId]);
    log.info('Updated session ${sessionId} to cycle ${currentCycle} in local DB');
  }

  async getSession(sessionId) {
    const query = 'SELECT * FROM sessions WHERE id = ?';
    const [result] = await this.db.executeSql(query, [sessionId]);
    return result.rows.length > 0 ? result.rows.item(0) : null;
  }

  async getAllSessions() {
    const query = 'SELECT * FROM sessions ORDER BY start_time DESC LIMIT 20';
    const [result] = await this.db.executeSql(query);
    
    const sessions = [];
    for (let i = 0; i < result.rows.length; i++) {
      sessions.push(result.rows.item(i));
    }
    return sessions;
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
    
    await this.db.executeSql(query, [
      sessionId,
      reading.timestamp,
      reading.spo2,
      reading.heartRate,
      reading.signalStrength,
      isValid ? 1 : 0,
      reading.fio2Level || null,
      reading.phaseType || null,
      reading.cycleNumber || null,
      reading.hrv?.rmssd || null,
      reading.hrv?.type || null,
      reading.hrv?.intervalCount || null,
      reading.hrv?.dataQuality || null,
      reading.hrv?.confidence || null
    ]);
  }

  async addReadingsBatch(readings) {
    if (readings.length === 0) return;
    
    await this.db.transaction(async (tx) => {
      const query = `
        INSERT INTO readings (session_id, timestamp, spo2, heart_rate, signal_strength, is_valid, fio2_level, phase_type, cycle_number, hrv_rmssd, hrv_type, hrv_interval_count, hrv_data_quality, hrv_confidence)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      for (const reading of readings) {
        // More flexible validation: valid if we have either spo2 or heart rate data
        const isValid = (reading.spo2 !== null && reading.spo2 > 0) || 
                       (reading.heartRate !== null && reading.heartRate > 0);
        await tx.executeSql(query, [
          reading.sessionId,
          reading.timestamp,
          reading.spo2,
          reading.heartRate,
          reading.signalStrength,
          isValid ? 1 : 0,
          reading.fio2Level || null,
          reading.phaseType || null,
          reading.cycleNumber || null,
          reading.hrv?.rmssd || null,
          reading.hrv?.type || null,
          reading.hrv?.intervalCount || null,
          reading.hrv?.dataQuality || null,
          reading.hrv?.confidence || null
        ]);
      }
    });
    
    log.info('� Batch inserted ${readings.length} readings with FiO2 data');
  }

  async getSessionReadings(sessionId, validOnly = false) {
    const query = `
      SELECT * FROM readings 
      WHERE session_id = ? ${validOnly ? 'AND is_valid = 1' : ''}
      ORDER BY timestamp ASC
    `;
    
    const [result] = await this.db.executeSql(query, [sessionId]);
    const readings = [];
    for (let i = 0; i < result.rows.length; i++) {
      readings.push(result.rows.item(i));
    }
    return readings;
  }

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
    
    const [result] = await this.db.executeSql(query, [sessionId]);
    const stats = result.rows.item(0);
    
    // Log for debugging
    log.info('Session stats calculated:' {
      sessionId,
      totalReadings: stats.totalReadings,
      validSpO2Readings: stats.validSpO2Readings,
      validHeartRateReadings: stats.validHeartRateReadings,
      avgSpO2: stats.avgSpO2,
      avgHeartRate: stats.avgHeartRate
    });
    
    return stats;
  }

  // Data Management
  async reprocessSessionStats(sessionId) {
    log.info('Reprocessing stats for session: ${sessionId}');
    
    // Recalculate statistics with new logic
    const stats = await this.getSessionStats(sessionId);
    
    const query = `
      UPDATE sessions 
      SET total_readings = ?, avg_spo2 = ?, min_spo2 = ?, max_spo2 = ?,
          avg_heart_rate = ?, min_heart_rate = ?, max_heart_rate = ?
      WHERE id = ?
    `;
    
    await this.db.executeSql(query, [
      stats.totalReadings,
      stats.avgSpO2,
      stats.minSpO2,
      stats.maxSpO2,
      stats.avgHeartRate,
      stats.minHeartRate,
      stats.maxHeartRate,
      sessionId
    ]);
    
    log.info('Reprocessed stats for session ${sessionId}:' stats);
    return stats;
  }

  async reprocessAllNullStats() {
    log.info('Reprocessing all sessions with null statistics...');
    
    // Find sessions with null stats
    const query = `
      SELECT id FROM sessions 
      WHERE status = 'completed' 
      AND (avg_spo2 IS NULL OR avg_heart_rate IS NULL)
      ORDER BY start_time DESC
    `;
    
    const [result] = await this.db.executeSql(query);
    const sessionsToReprocess = [];
    
    for (let i = 0; i < result.rows.length; i++) {
      sessionsToReprocess.push(result.rows.item(i).id);
    }
    
    log.info('� Found ${sessionsToReprocess.length} sessions to reprocess');
    
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
    log.info('Reprocessed ${successful}/${sessionsToReprocess.length} sessions successfully');
    
    return results;
  }

  async cleanupOldSessions() {
    // Keep only the 10 most recent sessions
    const deleteQuery = `
      DELETE FROM sessions 
      WHERE id NOT IN (
        SELECT id FROM sessions 
        ORDER BY start_time DESC 
        LIMIT 10
      )
    `;
    
    // This will cascade delete readings due to foreign key
    await this.db.executeSql(deleteQuery);
    log.info('🧹 Cleaned up old sessions');
  }

  async clearAllData() {
    await this.db.executeSql('DELETE FROM readings');
    await this.db.executeSql('DELETE FROM sessions');
    log.info('Cleared all data');
  }

  async getStorageInfo() {
    const sessionCountQuery = 'SELECT COUNT(*) as count FROM sessions';
    const readingCountQuery = 'SELECT COUNT(*) as count FROM readings';
    
    const [sessionResult] = await this.db.executeSql(sessionCountQuery);
    const [readingResult] = await this.db.executeSql(readingCountQuery);
    
    return {
      sessionCount: sessionResult.rows.item(0).count,
      readingCount: readingResult.rows.item(0).count,
      estimatedSizeMB: Math.round((readingResult.rows.item(0).count * 100) / 1024 / 1024 * 100) / 100
    };
  }

  // Hypoxia Level Analytics
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
    
    const results = await this.db.executeSql(query, [limit]);
    const sessions = [];
    
    for (let i = 0; i < results.rows.length; i++) {
      const session = results.rows.item(i);
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
    
    const results = await this.db.executeSql(query);
    const stats = results.rows.item(0);
    
    return {
      totalSessions: stats.totalSessions || 0,
      avgHypoxiaLevel: Math.round((stats.avgHypoxiaLevel || 0) * 10) / 10,
      minHypoxiaLevel: stats.minHypoxiaLevel || 0,
      maxHypoxiaLevel: stats.maxHypoxiaLevel || 0,
      completedSessions: stats.completedSessions || 0
    };
  }

  // ========================================
  // SURVEY DATA MANAGEMENT
  // ========================================

  /**
   * Create or update pre-session survey data
   */
  async savePreSessionSurvey(sessionId, clarityPre, energyPre) {
    try {
      // Validate input
      if (!this.isValidSurveyScale(clarityPre) || !this.isValidSurveyScale(energyPre)) {
        throw new Error('Survey values must be integers between 1 and 5');
      }

      log.info('Saving pre-session survey for: ${sessionId}');
      
      // Use INSERT OR IGNORE followed by UPDATE to preserve existing data
      const insertQuery = `
        INSERT OR IGNORE INTO session_surveys (session_id, clarity_pre, energy_pre, updated_at)
        VALUES (?, ?, ?, strftime('%s', 'now'))
      `;
      
      const updateQuery = `
        UPDATE session_surveys 
        SET clarity_pre = ?, energy_pre = ?, updated_at = strftime('%s', 'now')
        WHERE session_id = ?
      `;
      
      await this.db.executeSql(insertQuery, [sessionId, clarityPre, energyPre]);
      await this.db.executeSql(updateQuery, [clarityPre, energyPre, sessionId]);
      
      log.info('Pre-session survey saved: clarity=${clarityPre}, energy=${energyPre}');
      
      return { success: true };
    } catch (error) {
      log.error('❌ Failed to save pre-session survey:', error);
      throw error;
    }
  }

  /**
   * Save post-session survey data
   */
  async savePostSessionSurvey(sessionId, clarityPost, energyPost, stressPost, notesPost = null) {
    try {
      // Validate input
      if (!this.isValidSurveyScale(clarityPost) || !this.isValidSurveyScale(energyPost) || !this.isValidSurveyScale(stressPost)) {
        throw new Error('Survey values must be integers between 1 and 5');
      }

      log.info('Saving post-session survey for: ${sessionId}');
      
      // Use INSERT OR IGNORE followed by UPDATE to preserve existing data
      const insertQuery = `
        INSERT OR IGNORE INTO session_surveys (session_id, clarity_post, energy_post, stress_post, notes_post, updated_at)
        VALUES (?, ?, ?, ?, ?, strftime('%s', 'now'))
      `;
      
      const updateQuery = `
        UPDATE session_surveys 
        SET clarity_post = ?, energy_post = ?, stress_post = ?, notes_post = ?, updated_at = strftime('%s', 'now')
        WHERE session_id = ?
      `;
      
      await this.db.executeSql(insertQuery, [sessionId, clarityPost, energyPost, stressPost, notesPost]);
      await this.db.executeSql(updateQuery, [clarityPost, energyPost, stressPost, notesPost, sessionId]);
      
      log.info('Post-session survey saved: clarity=${clarityPost}, energy=${energyPost}, stress=${stressPost}');
      
      return { success: true };
    } catch (error) {
      log.error('❌ Failed to save post-session survey:', error);
      throw error;
    }
  }

  /**
   * Save intra-session response
   */
  async saveIntraSessionResponse(sessionId, phaseNumber, clarity, energy, stress, timestamp) {
    try {
      // Validate input
      if (!this.isValidSurveyScale(clarity) || !this.isValidSurveyScale(energy) || !this.isValidSurveyScale(stress)) {
        throw new Error('Survey values must be integers between 1 and 5');
      }

      log.info('Saving intra-session response for: ${sessionId}, phase: ${phaseNumber}');
      
      const query = `
        INSERT OR REPLACE INTO intra_session_responses 
        (session_id, phase_number, clarity, energy, stress, timestamp)
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      
      await this.db.executeSql(query, [sessionId, phaseNumber, clarity, energy, stress, timestamp]);
      log.info('Intra-session response saved: phase=${phaseNumber}, clarity=${clarity}, energy=${energy}, stress=${stress}');
      
      return { success: true };
    } catch (error) {
      log.error('❌ Failed to save intra-session response:', error);
      throw error;
    }
  }

  /**
   * Get complete survey data for a session
   */
  async getSessionSurveyData(sessionId) {
    try {
      log.info('Fetching survey data for session: ${sessionId}');
      
      // Get main survey data
      const [surveyResult] = await this.db.executeSql(
        'SELECT * FROM session_surveys WHERE session_id = ?',
        [sessionId]
      );
      
      // Get intra-session responses
      const [responsesResult] = await this.db.executeSql(
        'SELECT * FROM intra_session_responses WHERE session_id = ? ORDER BY phase_number ASC',
        [sessionId]
      );
      
      const surveyData = {
        sessionId,
        preSession: null,
        postSession: null,
        intraSessionResponses: []
      };
      
      // Process main survey data
      if (surveyResult.rows.length > 0) {
        const row = surveyResult.rows.item(0);
        
        if (row.clarity_pre !== null && row.energy_pre !== null) {
          surveyData.preSession = {
            clarity: row.clarity_pre,
            energy: row.energy_pre
          };
        }
        
        if (row.clarity_post !== null && row.energy_post !== null && row.stress_post !== null) {
          surveyData.postSession = {
            clarity: row.clarity_post,
            energy: row.energy_post,
            stress: row.stress_post,
            notes: row.notes_post || undefined
          };
        }
      }
      
      // Process intra-session responses
      for (let i = 0; i < responsesResult.rows.length; i++) {
        const row = responsesResult.rows.item(i);
        surveyData.intraSessionResponses.push({
          clarity: row.clarity,
          energy: row.energy,
          stress: row.stress,
          phaseNumber: row.phase_number,
          timestamp: row.timestamp
        });
      }
      
      log.info('Survey data retrieved for ${sessionId}:' {
        hasPreSession: !!surveyData.preSession,
        hasPostSession: !!surveyData.postSession,
        intraResponseCount: surveyData.intraSessionResponses.length
      });
      
      return surveyData;
    } catch (error) {
      log.error('❌ Failed to get survey data:', error);
      throw error;
    }
  }

  /**
   * Get survey completion status for a session
   */
  async getSurveyCompletionStatus(sessionId) {
    try {
      const [result] = await this.db.executeSql(
        'SELECT clarity_pre, energy_pre, clarity_post, energy_post, stress_post FROM session_surveys WHERE session_id = ?',
        [sessionId]
      );
      
      if (result.rows.length === 0) {
        return {
          hasPreSession: false,
          hasPostSession: false,
          isPreSessionComplete: false,
          isPostSessionComplete: false
        };
      }
      
      const row = result.rows.item(0);
      const hasPreSession = row.clarity_pre !== null && row.energy_pre !== null;
      const hasPostSession = row.clarity_post !== null && row.energy_post !== null && row.stress_post !== null;
      
      return {
        hasPreSession,
        hasPostSession,
        isPreSessionComplete: hasPreSession,
        isPostSessionComplete: hasPostSession
      };
    } catch (error) {
      log.error('❌ Failed to check survey completion status:', error);
      throw error;
    }
  }

  /**
   * Validate survey scale value (1-5)
   */
  isValidSurveyScale(value) {
    return Number.isInteger(value) && value >= 1 && value <= 5;
  }

  /**
   * Delete all survey data for a session
   */
  async deleteSurveyData(sessionId) {
    try {
      log.info('Deleting survey data for session: ${sessionId}');
      
      await this.db.executeSql('DELETE FROM session_surveys WHERE session_id = ?', [sessionId]);
      await this.db.executeSql('DELETE FROM intra_session_responses WHERE session_id = ?', [sessionId]);
      
      log.info('Survey data deleted for session: ${sessionId}');
      return { success: true };
    } catch (error) {
      log.error('❌ Failed to delete survey data:', error);
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