import * as SQLite from 'expo-sqlite';
import logger from '../utils/logger';

const log = logger.createModuleLogger('DatabaseService');

class DatabaseService {
  constructor() {
    this.db = null;
  }

  async init() {
    try {
      log.info('🗄️ Initializing database...');
      
      this.db = await SQLite.openDatabaseAsync('vitaliti.db');
      
      await this.createTables();
      
      // Check if adaptive columns exist and force migration if needed
      await this.ensureAdaptiveColumnsExist();
      
      // Ensure intra-session responses table has all required columns
      await this.ensureIntraSessionResponsesColumnsExist();
      
      log.info('✅ [DatabaseService] Database initialized successfully');
    } catch (error) {
      log.error('❌ Database initialization failed:', error);
      throw error;
    }
  }

  async ensureAdaptiveColumnsExist() {
    try {
      // Test if adaptive columns exist by running a simple query
      await this.db.getAllAsync('SELECT session_subtype, adaptive_system_enabled FROM sessions LIMIT 1', []);
      log.info('✅ [DatabaseService] Adaptive columns verified');
    } catch (error) {
      log.info('🔧 [DatabaseService] Adaptive columns missing, forcing migration...');
      
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
          log.info(`✅ [DatabaseService] Added column: ${column.split(' ')[0]}`);
        } catch (e) {
          // Column might already exist
          log.info(`⚠️ [DatabaseService] Column might already exist: ${column.split(' ')[0]}`);
        }
      }
      
      // Test again to make sure it worked
      await this.db.getAllAsync('SELECT session_subtype, adaptive_system_enabled FROM sessions LIMIT 1', []);
      log.info('✅ [DatabaseService] Adaptive columns migration completed');
      
      // Also ensure adaptive tables exist
      await this.ensureAdaptiveTablesExist();
    }
  }

  async ensureAdaptiveTablesExist() {
    try {
      // Test if adaptive tables exist
      await this.db.getAllAsync('SELECT COUNT(*) FROM session_adaptive_events LIMIT 1', []);
      await this.db.getAllAsync('SELECT COUNT(*) FROM session_phase_stats LIMIT 1', []);
      await this.db.getAllAsync('SELECT COUNT(*) FROM altitude_levels LIMIT 1', []);
      log.info('✅ [DatabaseService] Adaptive tables verified');
    } catch (error) {
      log.info('🔧 [DatabaseService] Creating missing adaptive tables...');
      
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

      log.info('✅ [DatabaseService] Adaptive tables created successfully');
    }
  }

  async ensureIntraSessionResponsesColumnsExist() {
    try {
      // Test if all required columns exist by running a simple query
      await this.db.getAllAsync('SELECT cycle_number, stress_perception, sensations, spo2_value, hr_value FROM intra_session_responses LIMIT 1', []);
      log.info('✅ [DatabaseService] Intra-session responses columns verified');
    } catch (error) {
      log.info('🔧 [DatabaseService] Intra-session responses columns missing, running migration...');
      
      // Add missing columns one by one
      const columnsToAdd = [
        'cycle_number INTEGER',
        'stress_perception INTEGER CHECK (stress_perception >= 1 AND stress_perception <= 5)',
        'sensations TEXT',
        'spo2_value INTEGER',
        'hr_value INTEGER'
      ];
      
      for (const column of columnsToAdd) {
        try {
          await this.db.execAsync(`ALTER TABLE intra_session_responses ADD COLUMN ${column}`);
          log.info(`✅ [DatabaseService] Added column to intra_session_responses: ${column.split(' ')[0]}`);
        } catch (e) {
          // Column might already exist, which is fine
          log.info(`⚠️ [DatabaseService] Column might already exist in intra_session_responses: ${column.split(' ')[0]}`);
        }
      }
      
      // Verify the migration worked
      try {
        await this.db.getAllAsync('SELECT cycle_number, stress_perception, sensations, spo2_value, hr_value FROM intra_session_responses LIMIT 1', []);
        log.info('✅ [DatabaseService] Intra-session responses migration completed successfully');
      } catch (verifyError) {
        log.error('❌ [DatabaseService] Failed to verify intra-session responses migration:', verifyError);
        throw verifyError;
      }
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
        cycle_number INTEGER,
        clarity INTEGER NOT NULL CHECK (clarity >= 1 AND clarity <= 5),
        energy INTEGER NOT NULL CHECK (energy >= 1 AND energy <= 5),
        stress INTEGER NOT NULL CHECK (stress >= 1 AND stress <= 5),
        stress_perception INTEGER CHECK (stress_perception >= 1 AND stress_perception <= 5),
        sensations TEXT,
        spo2_value INTEGER,
        hr_value INTEGER,
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
    // First check if session already exists
    const existing = await this.db.getAllAsync('SELECT id FROM sessions WHERE id = ?', [sessionId]);
    if (existing && existing.length > 0) {
      log.warn(`⚠️ Session ${sessionId} already exists, skipping creation`);
      return sessionId;
    }
    
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

  // Get altitude level information
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

  // Save phase statistics
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

  // ========================================
  // ALTITUDE PROGRESSION MANAGEMENT
  // ========================================

  /**
   * Get user's progression data for altitude level management
   * Fetches last 10 sessions to analyze progression trends
   */
  async getUserProgressionData(userId, limit = 10) {
    try {
      await this.init();
      
      const query = `
        SELECT 
          id,
          start_time,
          end_time,
          total_duration_seconds,
          starting_altitude_level,
          current_altitude_level,
          total_mask_lifts,
          total_altitude_adjustments,
          avg_spo2,
          min_spo2,
          max_spo2,
          session_subtype,
          created_at
        FROM sessions 
        WHERE end_time IS NOT NULL
        ORDER BY created_at DESC, start_time DESC
        LIMIT ?
      `;
      
      const sessions = await this.db.getAllAsync(query, [limit]);
      
      log.info(`📊 Retrieved ${sessions?.length || 0} sessions for progression analysis`);
      
      // Calculate progression metrics
      const progressionData = {
        sessions: sessions || [],
        lastSession: sessions?.[0] || null,
        averageEndingAltitude: 0,
        trend: 'stable', // 'improving', 'declining', 'stable'
        daysSinceLastSession: null,
        totalSessions: sessions?.length || 0
      };
      
      if (sessions && sessions.length > 0) {
        // Calculate average ending altitude
        const endingAltitudes = sessions.map(s => s.current_altitude_level || s.starting_altitude_level);
        progressionData.averageEndingAltitude = Math.round(
          endingAltitudes.reduce((a, b) => a + b, 0) / endingAltitudes.length
        );
        
        // Calculate days since last session
        const lastSessionTime = sessions[0].end_time || sessions[0].start_time;
        const daysSince = Math.floor((Date.now() - lastSessionTime) / (1000 * 60 * 60 * 24));
        progressionData.daysSinceLastSession = daysSince;
        
        // Determine trend (comparing first 3 sessions to last 3)
        if (sessions.length >= 6) {
          const recent = sessions.slice(0, 3).map(s => s.current_altitude_level);
          const older = sessions.slice(-3).map(s => s.current_altitude_level);
          const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
          const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
          
          if (recentAvg > olderAvg + 0.5) progressionData.trend = 'improving';
          else if (recentAvg < olderAvg - 0.5) progressionData.trend = 'declining';
        }
      }
      
      return progressionData;
    } catch (error) {
      log.error('❌ Failed to get user progression data:', error);
      return {
        sessions: [],
        lastSession: null,
        averageEndingAltitude: 6,
        trend: 'stable',
        daysSinceLastSession: null,
        totalSessions: 0
      };
    }
  }

  /**
   * Get the last completed session for a user
   */
  async getLastCompletedSession(userId) {
    try {
      await this.init();
      
      const query = `
        SELECT 
          id,
          start_time,
          end_time,
          starting_altitude_level,
          current_altitude_level,
          total_mask_lifts,
          avg_spo2,
          session_subtype
        FROM sessions 
        WHERE end_time IS NOT NULL
        ORDER BY created_at DESC, start_time DESC
        LIMIT 1
      `;
      
      const session = await this.db.getFirstAsync(query);
      
      if (session) {
        log.info(`📝 Last completed session: ${session.id}, ended at altitude ${session.current_altitude_level}`);
      } else {
        log.info('📝 No completed sessions found for user');
      }
      
      return session;
    } catch (error) {
      log.error('❌ Failed to get last completed session:', error);
      return null;
    }
  }

  /**
   * Update session altitude levels during progression
   */
  async updateSessionAltitudeLevel(sessionId, newAltitudeLevel) {
    try {
      const query = `
        UPDATE sessions 
        SET current_altitude_level = ?,
            total_altitude_adjustments = total_altitude_adjustments + 1,
            updated_at = strftime('%s', 'now')
        WHERE id = ?
      `;
      
      await this.db.runAsync(query, [newAltitudeLevel, sessionId]);
      log.info(`✅ Updated session ${sessionId} to altitude level ${newAltitudeLevel}`);
      
      return { success: true };
    } catch (error) {
      log.error('❌ Failed to update session altitude level:', error);
      return { success: false, error };
    }
  }

  // Save adaptive event
  async saveAdaptiveEvent(event) {
    try {
      const query = `
        INSERT INTO session_adaptive_events (
          id, session_id, event_type, event_timestamp,
          altitude_phase_number, recovery_phase_number, current_altitude_level,
          spo2_value, additional_data, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      const id = this.generateId();
      
      // Handle additional_data properly - it could be an object or a string
      let additionalDataStr;
      if (typeof event.additional_data === 'string') {
        additionalDataStr = event.additional_data;
      } else if (event.additional_data) {
        additionalDataStr = JSON.stringify(event.additional_data);
      } else {
        additionalDataStr = '{}';
      }
      
      const values = [
        id,
        event.session_id || event.sessionId,
        event.event_type || event.eventType,
        new Date(event.event_timestamp || event.eventTimestamp).getTime(),
        event.altitude_phase_number || event.altitudePhaseNumber || null,
        event.recovery_phase_number || event.recoveryPhaseNumber || null,
        event.current_altitude_level || event.currentAltitudeLevel || null,
        event.spo2_value || event.additional_data?.spo2Value || null,
        additionalDataStr,
        Date.now()
      ];
      
      await this.db.runAsync(query, values);
      log.info(`Saved adaptive event: ${event.event_type || event.eventType}`);
      return id;
    } catch (error) {
      // Don't throw, just log warning to prevent error popups
      log.warn('Failed to save adaptive event locally:', error.message);
      return null;
    }
  }

  // Get adaptive events for a session (for syncing)
  async getAdaptiveEvents(sessionId) {
    try {
      await this.init();
      const query = `
        SELECT * FROM session_adaptive_events 
        WHERE session_id = ? 
        ORDER BY event_timestamp ASC
      `;
      const events = await this.db.getAllAsync(query, [sessionId]);
      return events || [];
    } catch (error) {
      log.error('Error fetching adaptive events:', error);
      return [];
    }
  }

  // Update session with adaptive data
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

  // Data Management
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
    
    log.info(`� Found ${sessionsToReprocess.length} sessions to reprocess`);
    
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
    await this.db.runAsync(deleteQuery);
    log.info('🧹 Cleaned up old sessions');
  }

  async clearAllData() {
    await this.db.runAsync('DELETE FROM readings');
    await this.db.runAsync('DELETE FROM sessions');
    log.info('Cleared all data');
  }

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

  // ========================================
  // CALIBRATION SESSION MANAGEMENT
  // ========================================


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
      completedSessions: stats.completedSessions || 0
    };
  }

  // ========================================
  // SURVEY DATA MANAGEMENT
  // ========================================

  /**
   * Save pre-session survey data (reactivated for AI feedback engine)
   */
  async savePreSessionSurvey(sessionId, clarityPre, energyPre, stressPre) {
    try {
      // Validate input
      if (!this.isValidSurveyScale(clarityPre) || !this.isValidSurveyScale(energyPre) || !this.isValidSurveyScale(stressPre)) {
        throw new Error('Survey values must be integers between 1 and 5');
      }

      console.log('\n📝📝📝 PRE-SESSION SURVEY SAVING TO DATABASE 📝📝📝');
      console.log('🆔 Session ID:', sessionId);
      console.log('🧠 Clarity:', clarityPre);
      console.log('⚡ Energy:', energyPre);
      console.log('😰 Stress:', stressPre);
      log.info(`Saving pre-session survey for: ${sessionId}`);
      
      // Use INSERT OR IGNORE followed by UPDATE to preserve existing data
      const insertQuery = `
        INSERT OR IGNORE INTO session_surveys (session_id, clarity_pre, energy_pre, stress_pre, updated_at)
        VALUES (?, ?, ?, ?, strftime('%s', 'now'))
      `;
      
      const updateQuery = `
        UPDATE session_surveys 
        SET clarity_pre = ?, energy_pre = ?, stress_pre = ?, updated_at = strftime('%s', 'now')
        WHERE session_id = ?
      `;
      
      await this.db.runAsync(insertQuery, [sessionId, clarityPre, energyPre, stressPre]);
      await this.db.runAsync(updateQuery, [clarityPre, energyPre, stressPre, sessionId]);
      
      console.log('✅ PRE-SESSION SURVEY SAVED TO DATABASE');
      console.log('📝📝📝📝📝📝📝📝📝📝📝📝📝📝📝📝📝📝\n');
      log.info(`Pre-session survey saved: clarity=${clarityPre}, energy=${energyPre}, stress=${stressPre}`);
      
      return { success: true };
    } catch (error) {
      log.error('❌ Failed to save pre-session survey:', error);
      throw error;
    }
  }

  /**
   * Save post-session survey data (enhanced with symptoms and rating)
   */
  async savePostSessionSurvey(sessionId, clarityPost, energyPost, stressPost, notesPost = null, symptoms = [], overallRating = null) {
    try {
      // Validate input
      if (!this.isValidSurveyScale(clarityPost) || !this.isValidSurveyScale(energyPost) || !this.isValidSurveyScale(stressPost)) {
        throw new Error('Survey values must be integers between 1 and 5');
      }

      if (overallRating && !this.isValidSurveyScale(overallRating)) {
        throw new Error('Overall rating must be an integer between 1 and 5');
      }

      console.log('\n🎯🎯🎯 POST-SESSION SURVEY SAVING TO DATABASE 🎯🎯🎯');
      log.info(`Saving post-session survey for: ${sessionId}`);
      
      // Convert symptoms array to JSON string for SQLite
      const symptomsJson = JSON.stringify(symptoms || []);
      
      // Use INSERT OR IGNORE followed by UPDATE to preserve existing data
      const insertQuery = `
        INSERT OR IGNORE INTO session_surveys 
        (session_id, clarity_post, energy_post, stress_post, notes_post, post_symptoms, overall_rating, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, strftime('%s', 'now'))
      `;
      
      const updateQuery = `
        UPDATE session_surveys 
        SET clarity_post = ?, energy_post = ?, stress_post = ?, 
            notes_post = ?, post_symptoms = ?, overall_rating = ?, 
            updated_at = strftime('%s', 'now')
        WHERE session_id = ?
      `;
      
      await this.db.runAsync(insertQuery, [sessionId, clarityPost, energyPost, stressPost, notesPost, symptomsJson, overallRating]);
      await this.db.runAsync(updateQuery, [clarityPost, energyPost, stressPost, notesPost, symptomsJson, overallRating, sessionId]);
      
      console.log('\n🎯🎯🎯 POST-SESSION SURVEY SAVED TO DATABASE 🎯🎯🎯');
      console.log('🆔 Session ID:', sessionId);
      console.log('🧠 Clarity:', clarityPost);
      console.log('⚡ Energy:', energyPost);
      console.log('😰 Stress:', stressPost);
      console.log('⭐ Overall Rating:', overallRating);
      console.log('🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯\n');
      log.info(`Post-session survey saved: clarity=${clarityPost}, energy=${energyPost}, stress=${stressPost}, rating=${overallRating}`);
      
      return { success: true };
    } catch (error) {
      log.error('❌ Failed to save post-session survey:', error);
      throw error;
    }
  }

  /**
   * Save intra-session response (enhanced with sensations and physiological data)
   */
  async saveIntraSessionResponse(sessionId, phaseNumber, clarity, energy, stressPerception, timestamp, sensations = [], spo2 = null, heartRate = null) {
    try {
      // Validate input
      if (!this.isValidSurveyScale(clarity) || !this.isValidSurveyScale(energy) || !this.isValidSurveyScale(stressPerception)) {
        throw new Error('Survey values must be integers between 1 and 5');
      }

      console.log('\n📋📋📋 INTRA-SESSION RESPONSE SAVING TO DATABASE 📋📋📋');
      console.log('🆔 Session ID:', sessionId);
      console.log('🔄 Phase Number:', phaseNumber);
      console.log('🧠 Clarity:', clarity);
      console.log('⚡ Energy:', energy);
      console.log('😰 Stress:', stressPerception);
      console.log('📊 SpO2:', spo2, '| HR:', heartRate);
      log.info(`Saving intra-session response for: ${sessionId}, phase: ${phaseNumber}`);
      
      // Convert sensations array to JSON string for SQLite
      const sensationsJson = JSON.stringify(sensations || []);
      
      const query = `
        INSERT OR REPLACE INTO intra_session_responses 
        (session_id, phase_number, clarity, energy, stress, stress_perception, 
         sensations, spo2_value, hr_value, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      await this.db.runAsync(query, [
        sessionId, phaseNumber, clarity, energy, 
        stressPerception, stressPerception, // Using stress_perception for both old 'stress' and new field
        sensationsJson, spo2, heartRate, timestamp
      ]);
      
      console.log('✅ INTRA-SESSION RESPONSE SAVED TO DATABASE');
      console.log('📋📋📋📋📋📋📋📋📋📋📋📋📋📋📋📋📋📋\n');
      log.info(`Intra-session response saved: phase=${phaseNumber}, clarity=${clarity}, energy=${energy}, stress=${stressPerception}`);
      
      return { success: true };
    } catch (error) {
      log.error('❌ Failed to save intra-session response:', error);
      throw error;
    }
  }

  /**
   * Get all intra-session responses for a session
   */
  async getIntraSessionResponses(sessionId) {
    try {
      await this.init();
      const query = `
        SELECT * FROM intra_session_responses 
        WHERE session_id = ? 
        ORDER BY phase_number ASC
      `;
      const responses = await this.db.getAllAsync(query, [sessionId]);
      return responses || [];
    } catch (error) {
      log.error('Error fetching intra-session responses:', error);
      return [];
    }
  }

  /**
   * Get complete survey data for a session
   */
  async getSessionSurveyData(sessionId) {
    try {
      log.info(`Fetching survey data for session: ${sessionId}`);
      
      // Get main survey data
      const surveyRow = await this.db.getFirstAsync(
        'SELECT * FROM session_surveys WHERE session_id = ?',
        [sessionId]
      );
      
      // Get intra-session responses
      const responsesResult = await this.db.getAllAsync(
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
      if (surveyRow) {
        if (surveyRow.clarity_pre !== null && surveyRow.energy_pre !== null) {
          surveyData.preSession = {
            clarity: surveyRow.clarity_pre,
            energy: surveyRow.energy_pre
          };
        }
        
        if (surveyRow.clarity_post !== null && surveyRow.energy_post !== null && surveyRow.stress_post !== null) {
          surveyData.postSession = {
            clarity: surveyRow.clarity_post,
            energy: surveyRow.energy_post,
            stress: surveyRow.stress_post,
            notes: surveyRow.notes_post || undefined
          };
        }
      }
      
      // Process intra-session responses
      for (const row of responsesResult) {
        surveyData.intraSessionResponses.push({
          clarity: row.clarity,
          energy: row.energy,
          stress: row.stress,
          phaseNumber: row.phase_number,
          timestamp: row.timestamp
        });
      }
      
      log.info(`Survey data retrieved for ${sessionId}:`, {
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
      const row = await this.db.getFirstAsync(
        'SELECT clarity_pre, energy_pre, clarity_post, energy_post, stress_post FROM session_surveys WHERE session_id = ?',
        [sessionId]
      );
      
      if (!row) {
        return {
          hasPreSession: false,
          hasPostSession: false,
          isPreSessionComplete: false,
          isPostSessionComplete: false
        };
      }
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
      log.info(`Deleting survey data for session: ${sessionId}`);
      
      await this.db.runAsync('DELETE FROM session_surveys WHERE session_id = ?', [sessionId]);
      await this.db.runAsync('DELETE FROM intra_session_responses WHERE session_id = ?', [sessionId]);
      
      log.info(`Survey data deleted for session: ${sessionId}`);
      return { success: true };
    } catch (error) {
      log.error('❌ Failed to delete survey data:', error);
      throw error;
    }
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