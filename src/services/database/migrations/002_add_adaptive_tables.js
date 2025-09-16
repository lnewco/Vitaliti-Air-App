/**
 * Migration 002: Add Adaptive Tables
 * Creates tables for the adaptive training system
 */

const migration = {
  version: 2,
  name: 'add_adaptive_tables',

  up: async (db) => {
    // Add adaptive columns to sessions table
    await db.execAsync(`
      ALTER TABLE sessions ADD COLUMN session_subtype TEXT DEFAULT 'calibration'
    `);
    await db.execAsync(`
      ALTER TABLE sessions ADD COLUMN starting_altitude_level INTEGER DEFAULT 6
    `);
    await db.execAsync(`
      ALTER TABLE sessions ADD COLUMN current_altitude_level INTEGER DEFAULT 6
    `);
    await db.execAsync(`
      ALTER TABLE sessions ADD COLUMN adaptive_system_enabled INTEGER DEFAULT 1
    `);
    await db.execAsync(`
      ALTER TABLE sessions ADD COLUMN total_mask_lifts INTEGER DEFAULT 0
    `);
    await db.execAsync(`
      ALTER TABLE sessions ADD COLUMN total_altitude_adjustments INTEGER DEFAULT 0
    `);

    // Session adaptive events table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS session_adaptive_events (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        event_type TEXT NOT NULL CHECK (event_type IN ('mask_lift', 'dial_adjustment', 'recovery_complete', 'altitude_phase_complete')),
        event_timestamp INTEGER NOT NULL,
        altitude_phase_number INTEGER,
        recovery_phase_number INTEGER,
        current_altitude_level INTEGER,
        spo2_value INTEGER,
        heart_rate_value INTEGER,
        adjustment_type TEXT,
        adjustment_value REAL,
        additional_data TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      )
    `);

    // Session phase stats table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS session_phase_stats (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        phase_type TEXT NOT NULL CHECK (phase_type IN ('altitude', 'recovery')),
        phase_number INTEGER NOT NULL,
        avg_spo2 REAL,
        min_spo2 INTEGER,
        max_spo2 INTEGER,
        avg_heart_rate REAL,
        min_heart_rate INTEGER,
        max_heart_rate INTEGER,
        duration INTEGER,
        start_time INTEGER,
        end_time INTEGER,
        mask_events_count INTEGER DEFAULT 0,
        altitude_level INTEGER,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        UNIQUE(session_id, phase_type, phase_number)
      )
    `);

    // Altitude levels reference table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS altitude_levels (
        level INTEGER PRIMARY KEY CHECK (level BETWEEN 1 AND 15),
        target_spo2 INTEGER NOT NULL,
        recovery_threshold INTEGER NOT NULL,
        description TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      )
    `);

    // Cycle metrics table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS cycle_metrics (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        cycle_number INTEGER NOT NULL,
        hypoxic_duration INTEGER,
        hyperoxic_duration INTEGER,
        avg_spo2_hypoxic REAL,
        min_spo2_hypoxic INTEGER,
        max_spo2_hypoxic INTEGER,
        avg_spo2_hyperoxic REAL,
        min_spo2_hyperoxic INTEGER,
        max_spo2_hyperoxic INTEGER,
        avg_hr_hypoxic REAL,
        avg_hr_hyperoxic REAL,
        recovery_time INTEGER,
        recovery_efficiency REAL,
        mask_lift_count INTEGER DEFAULT 0,
        dial_adjustments INTEGER DEFAULT 0,
        altitude_level INTEGER,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        UNIQUE(session_id, cycle_number)
      )
    `);

    // Session adaptation metrics table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS session_adaptation_metrics (
        id TEXT PRIMARY KEY,
        session_id TEXT UNIQUE NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        initial_spo2_baseline REAL,
        final_spo2_baseline REAL,
        avg_recovery_time REAL,
        best_recovery_time INTEGER,
        worst_recovery_time INTEGER,
        total_mask_lifts INTEGER DEFAULT 0,
        successful_recoveries INTEGER DEFAULT 0,
        failed_recoveries INTEGER DEFAULT 0,
        altitude_progression TEXT,
        time_at_target INTEGER,
        adaptation_score REAL,
        efficiency_score REAL,
        notes TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      )
    `);

    // Insert default altitude levels
    const altitudeLevels = [
      [1, 90, 95, 'Beginner - Minimal altitude simulation'],
      [2, 89, 95, 'Easy - Light altitude simulation'],
      [3, 88, 95, 'Moderate - Low altitude'],
      [4, 87, 95, 'Moderate Plus - Medium-low altitude'],
      [5, 86, 95, 'Intermediate - Medium altitude'],
      [6, 85, 95, 'Intermediate Plus - Medium-high altitude'],
      [7, 84, 95, 'Advanced - High altitude'],
      [8, 83, 95, 'Advanced Plus - Very high altitude'],
      [9, 82, 95, 'Expert - Extreme altitude'],
      [10, 81, 95, 'Expert Plus - Ultra extreme altitude'],
      [11, 80, 95, 'Elite - Maximum sustainable altitude'],
      [12, 79, 95, 'Elite Plus - Beyond normal limits'],
      [13, 78, 95, 'Professional - Competition level'],
      [14, 77, 95, 'Professional Plus - Peak performance'],
      [15, 76, 95, 'Maximum - Absolute limit']
    ];

    for (const level of altitudeLevels) {
      await db.runAsync(
        `INSERT OR IGNORE INTO altitude_levels (level, target_spo2, recovery_threshold, description)
         VALUES (?, ?, ?, ?)`,
        level
      );
    }
  },

  down: async (db) => {
    // Drop tables
    await db.execAsync('DROP TABLE IF EXISTS session_adaptation_metrics');
    await db.execAsync('DROP TABLE IF EXISTS cycle_metrics');
    await db.execAsync('DROP TABLE IF EXISTS altitude_levels');
    await db.execAsync('DROP TABLE IF EXISTS session_phase_stats');
    await db.execAsync('DROP TABLE IF EXISTS session_adaptive_events');

    // Note: We cannot easily remove columns from sessions table in SQLite
    // Would need to recreate the table without the columns
  }
};

export default migration;