/**
 * Migration 001: Initial Schema
 * Creates the base tables for the application
 */

const migration = {
  version: 1,
  name: 'initial_schema',

  up: async (db) => {
    // Sessions table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        start_time INTEGER,
        end_time INTEGER,
        status TEXT DEFAULT 'active',
        session_type TEXT DEFAULT 'IHHT',
        device_id TEXT,
        avg_spo2 REAL,
        min_spo2 REAL,
        max_spo2 REAL,
        avg_heart_rate REAL,
        min_heart_rate REAL,
        max_heart_rate REAL,
        total_duration INTEGER,
        hypoxic_time INTEGER,
        hyperoxic_time INTEGER,
        mask_removals INTEGER DEFAULT 0,
        default_hypoxia_level INTEGER,
        total_cycles INTEGER DEFAULT 3,
        hypoxic_duration INTEGER DEFAULT 420,
        hyperoxic_duration INTEGER DEFAULT 180,
        baseline_spo2 INTEGER,
        baseline_heart_rate INTEGER,
        planned_total_cycles INTEGER DEFAULT 3,
        planned_hypoxic_duration INTEGER DEFAULT 420,
        planned_hyperoxic_duration INTEGER DEFAULT 180,
        created_at INTEGER,
        updated_at INTEGER
      )
    `);

    // Readings table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS readings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT REFERENCES sessions(id),
        timestamp INTEGER,
        spo2 INTEGER,
        heart_rate INTEGER,
        pleth REAL,
        signal_quality REAL,
        is_valid INTEGER DEFAULT 1,
        phase TEXT,
        cycle_number INTEGER,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      )
    `);

    // Surveys table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS surveys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT REFERENCES sessions(id),
        clarity_pre INTEGER,
        energy_pre INTEGER,
        stress_pre INTEGER,
        clarity_post INTEGER,
        energy_post INTEGER,
        stress_post INTEGER,
        notes_post TEXT,
        symptoms TEXT,
        overall_rating INTEGER,
        survey_timestamp_pre INTEGER,
        survey_timestamp_post INTEGER,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        updated_at INTEGER
      )
    `);

    // Intra-session responses table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS intra_session_responses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT REFERENCES sessions(id),
        phase_number INTEGER,
        cycle_number INTEGER,
        clarity INTEGER,
        energy INTEGER,
        stress_perception INTEGER,
        sensations TEXT,
        spo2 INTEGER,
        heart_rate INTEGER,
        response_timestamp INTEGER,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      )
    `);
  },

  down: async (db) => {
    await db.execAsync('DROP TABLE IF EXISTS intra_session_responses');
    await db.execAsync('DROP TABLE IF EXISTS surveys');
    await db.execAsync('DROP TABLE IF EXISTS readings');
    await db.execAsync('DROP TABLE IF EXISTS sessions');
  }
};

export default migration;