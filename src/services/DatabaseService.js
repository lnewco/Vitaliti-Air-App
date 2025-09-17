import * as SQLite from 'expo-sqlite';
import logger from '../utils/logger';

const log = logger.createModuleLogger('DatabaseService');

/**
 * DatabaseService - Local SQLite database management for offline-first storage
 * 
 * Handles all local data persistence including sessions, readings, surveys, and adaptive metrics.
 * Works in conjunction with SupabaseService for cloud synchronization.
 */
class DatabaseService {
  constructor() {
    this.db = null;
  }

  /**
   * Initializes the database and creates/migrates all required tables
   * @returns {Promise<void>}
   * @throws {Error} If database initialization fails
   */
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

    // Create new tables for IHHT adaptation metrics
    const createCycleMetricsTable = `
      CREATE TABLE IF NOT EXISTS session_cycle_metrics (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        cycle_number INTEGER NOT NULL,
        
        -- Hypoxic Phase Metrics
        hypoxic_phase_id TEXT REFERENCES session_phase_stats(id),
        desaturation_rate INTEGER,
        time_in_zone INTEGER DEFAULT 0,
        time_below_83 INTEGER DEFAULT 0,
        spo2_volatility_in_zone REAL,
        spo2_volatility_out_of_zone REAL,
        spo2_volatility_total REAL,
        min_spo2 INTEGER,
        hypoxic_duration INTEGER,
        
        -- Recovery Phase Metrics  
        recovery_phase_id TEXT REFERENCES session_phase_stats(id),
        spo2_recovery_time INTEGER,
        hr_recovery_60s INTEGER,
        peak_hr_hypoxic INTEGER,
        hr_at_recovery_start INTEGER,
        recovery_duration INTEGER,
        recovery_efficiency_score REAL,
        
        -- Cycle Adaptation Score
        cycle_adaptation_score REAL,
        
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      );
    `;

    const createAdaptationMetricsTable = `
      CREATE TABLE IF NOT EXISTS session_adaptation_metrics (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        
        -- Hypoxic Efficiency (aggregated from cycles)
        total_time_in_zone INTEGER DEFAULT 0,
        avg_desaturation_rate REAL,
        min_desaturation_rate INTEGER,
        max_desaturation_rate INTEGER,
        desaturation_consistency REAL,
        therapeutic_efficiency_score REAL,
        
        -- SpO2 Volatility
        avg_volatility_in_zone REAL,
        avg_volatility_out_of_zone REAL,
        avg_volatility_total REAL,
        
        -- Hypoxic Tolerance  
        hypoxic_stability_score INTEGER DEFAULT 100,
        total_mask_lifts INTEGER DEFAULT 0,
        avg_mask_lift_recovery_10s REAL,
        avg_mask_lift_recovery_15s REAL,
        
        -- Recovery Dynamics (aggregated)
        avg_spo2_recovery_time REAL,
        min_spo2_recovery_time INTEGER,
        max_spo2_recovery_time INTEGER,
        recovery_consistency REAL,
        avg_hr_recovery REAL,
        
        -- Cycle Progression
        first_cycle_score REAL,
        last_cycle_score REAL,
        intra_session_improvement REAL,
        
        -- Overall
        session_adaptation_index REAL,
        altitude_level_achieved INTEGER,
        
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      );
    `;

    const createAdaptationIndexes = `
      CREATE INDEX IF NOT EXISTS idx_cycle_metrics_session ON session_cycle_metrics(session_id);
      CREATE INDEX IF NOT EXISTS idx_cycle_metrics_cycle ON session_cycle_metrics(session_id, cycle_number);
      CREATE INDEX IF NOT EXISTS idx_adaptation_metrics_session ON session_adaptation_metrics(session_id);
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
      ${createCycleMetricsTable}
      ${createAdaptationMetricsTable}
      ${createIndexes}
      ${createSurveyIndexes}
      ${createAdaptiveIndexes}
      ${createAdaptationIndexes}
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
      
      // Add new columns to session_phase_stats for IHHT metrics
      const phaseStatsColumns = [
        'time_in_therapeutic_zone INTEGER DEFAULT 0',
        'time_to_therapeutic_zone INTEGER',
        'spo2_volatility_in_zone REAL',
        'spo2_volatility_out_of_zone REAL',
        'spo2_volatility_total REAL',  // Total volatility for entire phase
        'time_below_83 INTEGER DEFAULT 0',
        'peak_heart_rate INTEGER',
        'hr_at_phase_end INTEGER',
        'hr_recovery_60s INTEGER',
        'spo2_recovery_slope REAL'
      ];
      
      for (const column of phaseStatsColumns) {
        try {
          await this.db.execAsync(`ALTER TABLE session_phase_stats ADD COLUMN ${column}`);
          log.info(`✅ Added IHHT metric column to session_phase_stats: ${column.split(' ')[0]}`);
        } catch (e) {
          // Column probably already exists - that's fine
        }
      }
      
      // Add recovery_duration column to session_cycle_metrics if it doesn't exist
      try {
        await this.db.execAsync(`ALTER TABLE session_cycle_metrics ADD COLUMN recovery_duration INTEGER`);
        log.info(`✅ Added recovery_duration column to session_cycle_metrics`);
      } catch (e) {
        // Column probably already exists - that's fine
      }
      
      // Add mask lift recovery columns to session_adaptation_metrics if they don't exist
      try {
        await this.db.execAsync(`ALTER TABLE session_adaptation_metrics ADD COLUMN avg_mask_lift_recovery_10s REAL`);
        await this.db.execAsync(`ALTER TABLE session_adaptation_metrics ADD COLUMN avg_mask_lift_recovery_15s REAL`);
        log.info(`✅ Added mask lift recovery columns to session_adaptation_metrics`);
      } catch (e) {
        // Columns probably already exist - that's fine
      }
      
    } catch (error) {
      log.info('Database column setup completed with expected warnings');
    }
  }

  // Session Management
  /**
   * Creates a new training session in the database
   * @param {string} sessionId - Unique session identifier
   * @param {number|null} hypoxiaLevel - Initial hypoxia level (0-100)
   * @param {Object|null} protocolConfig - Session protocol configuration
   * @returns {Promise<Object>} Created session object
   */
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



  // Adaptive Instructions System Methods

  // Get completed adaptive sessions for user (local SQLite version)
  async getCompletedAdaptiveSessions() {
    try {
      // First check if the column exists to avoid crashes on unmigrated databases
      const tableInfo = await this.db.getAllAsync("PRAGMA table_info(sessions)");
      const hasAdaptiveColumn = tableInfo.some(col => col.name === 'adaptive_system_enabled');

      let query;
      if (hasAdaptiveColumn) {
        // Use the new column if it exists
        query = `
          SELECT id, session_subtype, start_time, end_time
          FROM sessions
          WHERE status = 'completed' AND adaptive_system_enabled = 1
          ORDER BY start_time DESC
        `;
      } else {
        // Fallback for older database schema - consider all completed sessions as adaptive
        log.warn('adaptive_system_enabled column not found, using fallback query');
        query = `
          SELECT id, session_subtype, start_time, end_time
          FROM sessions
          WHERE status = 'completed'
          ORDER BY start_time DESC
        `;
      }

      const result = await this.db.getAllAsync(query, []);
      return result || [];
    } catch (error) {
      log.error('Error getting completed adaptive sessions:', error);
      // Return empty array as safest fallback
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
    log.info(`Saved ${phaseStats.phaseType} phase stats locally for session ${phaseStats.sessionId}`);
    
    // Trigger sync to Supabase
    try {
      // Import dynamically to avoid circular dependency
      const { default: SupabaseService } = await import('./SupabaseService.js');
      if (SupabaseService) {
        await SupabaseService.savePhaseMetrics(phaseStats);
        log.info(`✅ Synced phase metrics to Supabase: ${phaseStats.phaseType} #${phaseStats.phaseNumber}`);
      }
    } catch (syncError) {
      // Don't fail the whole operation if sync fails
      log.warn('Failed to sync phase metrics to Supabase:', syncError.message);
    }
    
    return id;
  }

  // Save cycle metrics (combined hypoxic + recovery phase metrics)
  async saveCycleMetrics(metrics) {
    try {
      const query = `
        INSERT INTO session_cycle_metrics (
          id, session_id, cycle_number,
          hypoxic_phase_id, desaturation_rate, time_in_zone, time_below_83,
          spo2_volatility_in_zone, spo2_volatility_out_of_zone, spo2_volatility_total,
          min_spo2, hypoxic_duration,
          recovery_phase_id, spo2_recovery_time, hr_recovery_60s,
          peak_hr_hypoxic, hr_at_recovery_start, recovery_duration, recovery_efficiency_score,
          cycle_adaptation_score, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      const id = this.generateId();
      const values = [
        id,
        metrics.sessionId,
        metrics.cycleNumber,
        // Hypoxic metrics
        metrics.hypoxicPhaseId || null,
        metrics.desaturationRate || null,
        metrics.timeInZone || 0,
        metrics.timeBelow83 || 0,
        metrics.spo2VolatilityInZone || null,
        metrics.spo2VolatilityOutOfZone || null,
        metrics.spo2VolatilityTotal || null,
        metrics.minSpO2 || null,
        metrics.hypoxicDuration || null,
        // Recovery metrics
        metrics.recoveryPhaseId || null,
        metrics.spo2RecoveryTime || null,
        metrics.hrRecovery60s || null,
        metrics.peakHrHypoxic || null,
        metrics.hrAtRecoveryStart || null,
        metrics.recoveryDuration || null,
        metrics.recoveryEfficiencyScore || null,
        metrics.cycleAdaptationScore || null,
        Date.now()
      ];
      
      await this.db.runAsync(query, values);
      log.info(`✅ Saved cycle ${metrics.cycleNumber} metrics for session ${metrics.sessionId}`);
      
      // Trigger sync to Supabase
      try {
        const { default: SupabaseService } = await import('./SupabaseService.js');
        if (SupabaseService) {
          await SupabaseService.saveCycleMetrics(metrics);
          log.info(`✅ Synced cycle metrics to Supabase`);
        }
      } catch (syncError) {
        log.warn('Failed to sync cycle metrics to Supabase:', syncError.message);
      }
      
      return id;
    } catch (error) {
      log.error('Failed to save cycle metrics:', error);
      return null;
    }
  }

  // Save session-wide adaptation metrics (aggregated from cycles)
  async saveAdaptationMetrics(metrics) {
    try {
      const query = `
        INSERT INTO session_adaptation_metrics (
          id, session_id,
          total_time_in_zone, avg_desaturation_rate, min_desaturation_rate,
          max_desaturation_rate, desaturation_consistency, therapeutic_efficiency_score,
          avg_volatility_in_zone, avg_volatility_out_of_zone, avg_volatility_total,
          hypoxic_stability_score, total_mask_lifts, avg_mask_lift_recovery_10s, avg_mask_lift_recovery_15s,
          avg_spo2_recovery_time, min_spo2_recovery_time, max_spo2_recovery_time,
          recovery_consistency, avg_hr_recovery,
          first_cycle_score, last_cycle_score, intra_session_improvement,
          session_adaptation_index, altitude_level_achieved,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      const id = this.generateId();
      const now = Date.now();
      const values = [
        id,
        metrics.sessionId,
        // Hypoxic efficiency
        metrics.totalTimeInZone || 0,
        metrics.avgDesaturationRate || null,
        metrics.minDesaturationRate || null,
        metrics.maxDesaturationRate || null,
        metrics.desaturationConsistency || null,
        metrics.therapeuticEfficiencyScore || null,
        // Volatility
        metrics.avgVolatilityInZone || null,
        metrics.avgVolatilityOutOfZone || null,
        metrics.avgVolatilityTotal || null,
        // Tolerance
        metrics.hypoxicStabilityScore || 100,
        metrics.totalMaskLifts || 0,
        metrics.avgMaskLiftRecovery10s || null,
        metrics.avgMaskLiftRecovery15s || null,
        // Recovery
        metrics.avgSpo2RecoveryTime || null,
        metrics.minSpo2RecoveryTime || null,
        metrics.maxSpo2RecoveryTime || null,
        metrics.recoveryConsistency || null,
        metrics.avgHrRecovery || null,
        // Progression
        metrics.firstCycleScore || null,
        metrics.lastCycleScore || null,
        metrics.intraSessionImprovement || null,
        // Overall
        metrics.sessionAdaptationIndex || null,
        metrics.altitudeLevelAchieved || null,
        now,
        now
      ];
      
      await this.db.runAsync(query, values);
      log.info(`✅ Saved adaptation metrics for session ${metrics.sessionId}`);
      
      // Trigger sync to Supabase
      try {
        const { default: SupabaseService } = await import('./SupabaseService.js');
        if (SupabaseService) {
          await SupabaseService.saveAdaptationMetrics(metrics);
          log.info(`✅ Synced adaptation metrics to Supabase`);
        }
      } catch (syncError) {
        log.warn('Failed to sync adaptation metrics to Supabase:', syncError.message);
      }
      
      return id;
    } catch (error) {
      log.error('Failed to save adaptation metrics:', error);
      return null;
    }
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
      log.info(`✅ Updated session ${sessionId} to altitude level ${newAltitudeLevel} locally`);
      
      // Trigger sync to Supabase
      try {
        // Import dynamically to avoid circular dependency
        const { default: SupabaseService } = await import('./SupabaseService.js');
        if (SupabaseService) {
          await SupabaseService.updateSessionAltitudeLevel(sessionId, newAltitudeLevel);
          log.info(`✅ Synced altitude level update to Supabase`);
        }
      } catch (syncError) {
        // Don't fail the whole operation if sync fails
        log.warn('Failed to sync altitude level to Supabase:', syncError.message);
      }
      
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
      let additionalDataObj;
      if (typeof event.additional_data === 'string') {
        additionalDataStr = event.additional_data;
        try {
          additionalDataObj = JSON.parse(event.additional_data);
        } catch {
          additionalDataObj = {};
        }
      } else if (event.additional_data) {
        additionalDataStr = JSON.stringify(event.additional_data);
        additionalDataObj = event.additional_data;
      } else if (event.additionalData) {
        // Handle camelCase variant
        additionalDataStr = JSON.stringify(event.additionalData);
        additionalDataObj = event.additionalData;
      } else {
        additionalDataStr = '{}';
        additionalDataObj = {};
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
      log.info(`Saved adaptive event locally: ${event.event_type || event.eventType}`);
      
      // Trigger sync to Supabase
      try {
        // Import dynamically to avoid circular dependency
        const { default: SupabaseService } = await import('./SupabaseService.js');
        if (SupabaseService) {
          // Format event for Supabase
          const supabaseEvent = {
            session_id: event.session_id || event.sessionId,
            event_type: event.event_type || event.eventType,
            event_timestamp: event.event_timestamp || event.eventTimestamp,
            altitude_phase_number: event.altitude_phase_number || event.altitudePhaseNumber || null,
            recovery_phase_number: event.recovery_phase_number || event.recoveryPhaseNumber || null,
            current_altitude_level: event.current_altitude_level || event.currentAltitudeLevel || null,
            spo2_value: event.spo2_value || additionalDataObj?.spo2Value || null,
            additional_data: additionalDataObj
          };
          await SupabaseService.saveAdaptiveEvent(supabaseEvent);
          log.info(`✅ Synced adaptive event to Supabase: ${event.event_type || event.eventType}`);
        }
      } catch (syncError) {
        // Don't fail the whole operation if sync fails
        log.warn('Failed to sync adaptive event to Supabase:', syncError.message);
      }
      
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


  // Helper method to generate UUID-like ID for SQLite
  generateId() {
    return 'xxxx-xxxx-4xxx-yxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Ends an active session and calculates final statistics
   * @param {string} sessionId - Session to end
   * @param {Object|null} providedStats - Optional pre-calculated stats
   * @param {number|null} startTime - Session start timestamp
   * @returns {Promise<Object>} Session with final stats
   */
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
        // Use minimal default stats since getSessionStats was removed
        log.warn(`getSessionStats was removed - using default stats for session: ${sessionId}`);
        stats = {
          totalReadings: 0,
          avgSpO2: null,
          minSpO2: null,
          maxSpO2: null,
          avgHeartRate: null,
          minHeartRate: null,
          maxHeartRate: null
        };
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


  /**
   * Gets a session by ID
   * @param {string} sessionId - Session identifier
   * @returns {Promise<Object|null>} Session object or null if not found
   */
  async getSession(sessionId) {
    const query = 'SELECT * FROM sessions WHERE id = ?';
    const result = await this.db.getFirstAsync(query, [sessionId]);
    return result;
  }

  /**
   * Gets all sessions ordered by start time (newest first)
   * @returns {Promise<Array>} Array of session objects
   */
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







  // Data Management





  // ========================================
  // CALIBRATION SESSION MANAGEMENT
  // ========================================




  // ========================================
  // SURVEY DATA MANAGEMENT
  // ========================================

  /**
   * Save pre-session survey data (reactivated for AI feedback engine)
   */
  /**
   * Saves pre-session survey responses
   * @param {string} sessionId - Session identifier
   * @param {number} clarityPre - Mental clarity rating (1-5)
   * @param {number} energyPre - Energy level rating (1-5)
   * @param {number} stressPre - Stress level rating (1-5)
   * @returns {Promise<Object>} Survey data object
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
  /**
   * Saves post-session survey responses
   * @param {string} sessionId - Session identifier
   * @param {number} clarityPost - Mental clarity rating (1-5)
   * @param {number} energyPost - Energy level rating (1-5)
   * @param {number} stressPost - Stress level rating (1-5)
   * @param {string|null} notesPost - Optional session notes
   * @param {Array} symptoms - Array of symptom strings
   * @param {number|null} overallRating - Overall session rating (1-5)
   * @returns {Promise<Object>} Survey data object
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
   * Validate survey scale value (1-5)
   */
  isValidSurveyScale(value) {
    return Number.isInteger(value) && value >= 1 && value <= 5;
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
      
      // Note: getSessionReadings, getSessionStats, getSessionBaselineHRV, and getSessionHRVStats were removed
      log.warn('Multiple data retrieval methods were removed - returning minimal session data');
      const readings = [];
      const stats = {};
      
      // Get survey data if available
      let surveyData = null;
      try {
        surveyData = await this.getSessionSurveyData(sessionId);
      } catch (error) {
        log.warn('Survey data not available for session:', sessionId);
      }
      
      const baselineHRV = null;
      const hrvStats = null;
      
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

}

export default new DatabaseService(); 