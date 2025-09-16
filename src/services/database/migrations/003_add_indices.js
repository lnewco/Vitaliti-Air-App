/**
 * Migration 003: Add Indices
 * Creates indices for improved query performance
 */

const migration = {
  version: 3,
  name: 'add_indices',

  up: async (db) => {
    // Sessions table indices
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)
    `);
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status)
    `);
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_sessions_start_time ON sessions(start_time)
    `);
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_sessions_device_id ON sessions(device_id)
    `);

    // Readings table indices
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_readings_session_id ON readings(session_id)
    `);
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_readings_timestamp ON readings(timestamp)
    `);
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_readings_phase_cycle ON readings(phase, cycle_number)
    `);

    // Surveys table indices
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_surveys_session_id ON surveys(session_id)
    `);

    // Intra-session responses indices
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_intra_session_session_id ON intra_session_responses(session_id)
    `);
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_intra_session_phase_cycle ON intra_session_responses(phase_number, cycle_number)
    `);

    // Adaptive events indices
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_adaptive_events_session_id ON session_adaptive_events(session_id)
    `);
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_adaptive_events_type ON session_adaptive_events(event_type)
    `);
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_adaptive_events_timestamp ON session_adaptive_events(event_timestamp)
    `);

    // Phase stats indices
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_phase_stats_session_id ON session_phase_stats(session_id)
    `);
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_phase_stats_phase ON session_phase_stats(phase_type, phase_number)
    `);

    // Cycle metrics indices
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_cycle_metrics_session_id ON cycle_metrics(session_id)
    `);

    // Session adaptation metrics index
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_adaptation_metrics_session_id ON session_adaptation_metrics(session_id)
    `);
  },

  down: async (db) => {
    // Drop all indices
    const indices = [
      'idx_sessions_user_id',
      'idx_sessions_status',
      'idx_sessions_start_time',
      'idx_sessions_device_id',
      'idx_readings_session_id',
      'idx_readings_timestamp',
      'idx_readings_phase_cycle',
      'idx_surveys_session_id',
      'idx_intra_session_session_id',
      'idx_intra_session_phase_cycle',
      'idx_adaptive_events_session_id',
      'idx_adaptive_events_type',
      'idx_adaptive_events_timestamp',
      'idx_phase_stats_session_id',
      'idx_phase_stats_phase',
      'idx_cycle_metrics_session_id',
      'idx_adaptation_metrics_session_id'
    ];

    for (const index of indices) {
      await db.execAsync(`DROP INDEX IF EXISTS ${index}`);
    }
  }
};

export default migration;