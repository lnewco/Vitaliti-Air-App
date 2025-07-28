import SQLite from 'react-native-sqlite-storage';

// Enable promise-based API
SQLite.enablePromise(true);

class DatabaseService {
  constructor() {
    this.db = null;
  }

  async init() {
    try {
      console.log('🗄️ Initializing database...');
      this.db = await SQLite.openDatabase({
        name: 'vitaliti.db',
        location: 'default',
      });
      
      await this.createTables();
      console.log('✅ Database initialized successfully');
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
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
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
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
        FOREIGN KEY (session_id) REFERENCES sessions (id)
      );
    `;

    const createIndexes = `
      CREATE INDEX IF NOT EXISTS idx_readings_session_time ON readings(session_id, timestamp);
      CREATE INDEX IF NOT EXISTS idx_readings_valid ON readings(is_valid) WHERE is_valid = 1;
      CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
    `;

    await this.db.executeSql(createSessionsTable);
    await this.db.executeSql(createReadingsTable);
    await this.db.executeSql(createIndexes);
    
    // Add new columns one by one (will silently fail if columns already exist, which is fine)
    try {
      // Check if columns exist by trying to add them individually
      const readingsColumns = ['fio2_level INTEGER', 'phase_type TEXT', 'cycle_number INTEGER'];
      const sessionsColumns = [
        'session_type TEXT DEFAULT \'IHHT\'', 
        'current_phase TEXT', 
        'current_cycle INTEGER DEFAULT 1', 
        'total_cycles INTEGER DEFAULT 5',
        'default_hypoxia_level INTEGER'
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
      
      console.log('✅ FiO2 tracking columns verified/added to local database');
    } catch (error) {
      console.log('📝 FiO2 column setup completed with expected warnings');
    }
  }

  // Session Management
  async createSession(sessionId, hypoxiaLevel = null) {
    const query = `
      INSERT INTO sessions (id, start_time, status, session_type, default_hypoxia_level)
      VALUES (?, ?, 'active', 'IHHT', ?)
    `;
    const startTime = Date.now();
    
    await this.db.executeSql(query, [sessionId, startTime, hypoxiaLevel]);
    console.log(`🎬 Session created: ${sessionId} (Hypoxia Level: ${hypoxiaLevel})`);
    return sessionId;
  }

  async endSession(sessionId) {
    const endTime = Date.now();
    
    // Calculate session statistics
    const stats = await this.getSessionStats(sessionId);
    
    const query = `
      UPDATE sessions 
      SET end_time = ?, status = 'completed',
          total_readings = ?, avg_spo2 = ?, min_spo2 = ?, max_spo2 = ?,
          avg_heart_rate = ?, min_heart_rate = ?, max_heart_rate = ?
      WHERE id = ?
    `;
    
    await this.db.executeSql(query, [
      endTime,
      stats.totalReadings,
      stats.avgSpO2,
      stats.minSpO2,
      stats.maxSpO2,
      stats.avgHeartRate,
      stats.minHeartRate,
      stats.maxHeartRate,
      sessionId
    ]);
    
    console.log(`🏁 Session ended: ${sessionId}`);
    return stats;
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
      INSERT INTO readings (session_id, timestamp, spo2, heart_rate, signal_strength, is_valid, fio2_level, phase_type, cycle_number)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      reading.cycleNumber || null
    ]);
  }

  async addReadingsBatch(readings) {
    if (readings.length === 0) return;
    
    await this.db.transaction(async (tx) => {
      const query = `
        INSERT INTO readings (session_id, timestamp, spo2, heart_rate, signal_strength, is_valid, fio2_level, phase_type, cycle_number)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          reading.cycleNumber || null
        ]);
      }
    });
    
    console.log(`📦 Batch inserted ${readings.length} readings with FiO2 data`);
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
    console.log('📊 Session stats calculated:', {
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
    console.log(`🔄 Reprocessing stats for session: ${sessionId}`);
    
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
    
    console.log(`✅ Reprocessed stats for session ${sessionId}:`, stats);
    return stats;
  }

  async reprocessAllNullStats() {
    console.log('🔄 Reprocessing all sessions with null statistics...');
    
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
    
    console.log(`📋 Found ${sessionsToReprocess.length} sessions to reprocess`);
    
    const results = [];
    for (const sessionId of sessionsToReprocess) {
      try {
        const stats = await this.reprocessSessionStats(sessionId);
        results.push({ sessionId, success: true, stats });
      } catch (error) {
        console.error(`❌ Failed to reprocess session ${sessionId}:`, error);
        results.push({ sessionId, success: false, error: error.message });
      }
    }
    
    const successful = results.filter(r => r.success).length;
    console.log(`✅ Reprocessed ${successful}/${sessionsToReprocess.length} sessions successfully`);
    
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
    console.log('🧹 Cleaned up old sessions');
  }

  async clearAllData() {
    await this.db.executeSql('DELETE FROM readings');
    await this.db.executeSql('DELETE FROM sessions');
    console.log('🗑️ Cleared all data');
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

  async close() {
    if (this.db) {
      await this.db.close();
      this.db = null;
      console.log('📱 Database closed');
    }
  }
}

export default new DatabaseService(); 