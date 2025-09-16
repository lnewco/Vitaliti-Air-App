import DatabaseService from '../../src/services/DatabaseService';
import * as SQLite from 'expo-sqlite';

// Mock SupabaseService that DatabaseService depends on
jest.mock('../../src/services/SupabaseService', () => ({
  __esModule: true,
  default: {
    syncPhaseMetrics: jest.fn().mockResolvedValue({ success: true }),
    syncCycleMetrics: jest.fn().mockResolvedValue({ success: true }),
    syncAdaptiveMetrics: jest.fn().mockResolvedValue({ success: true }),
    saveAdaptiveEvent: jest.fn().mockResolvedValue({ success: true }),
    updateSessionAltitudeLevel: jest.fn().mockResolvedValue({ success: true })
  }
}));

describe('DatabaseService', () => {
  let mockDb;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset the mock database
    mockDb = {
      execAsync: jest.fn().mockResolvedValue(undefined),
      runAsync: jest.fn().mockResolvedValue({ lastInsertRowId: 1 }),
      getAllAsync: jest.fn().mockResolvedValue([]),
      getFirstAsync: jest.fn().mockResolvedValue(null)
    };

    SQLite.openDatabaseAsync.mockResolvedValue(mockDb);
  });

  describe('Initialization', () => {
    test('should initialize database successfully', async () => {
      await DatabaseService.init();

      expect(SQLite.openDatabaseAsync).toHaveBeenCalledWith('vitaliti.db');
      expect(mockDb.execAsync).toHaveBeenCalled();
    });

    test('should handle initialization errors', async () => {
      const error = new Error('Database connection failed');
      SQLite.openDatabaseAsync.mockRejectedValue(error);

      await expect(DatabaseService.init()).rejects.toThrow('Database connection failed');
    });
  });

  describe('Session Management', () => {
    beforeEach(async () => {
      await DatabaseService.init();
    });

    test('should create a new session', async () => {
      const sessionId = 'TEST_SESSION_123';
      const hypoxiaLevel = 6;
      const protocolConfig = {
        totalCycles: 3,
        hypoxicDuration: 420,
        hyperoxicDuration: 180
      };

      mockDb.getAllAsync.mockResolvedValueOnce([]); // No existing session

      const result = await DatabaseService.createSession(sessionId, hypoxiaLevel, protocolConfig);

      expect(result).toBe(sessionId);
      expect(mockDb.getAllAsync).toHaveBeenCalledWith(
        'SELECT id FROM sessions WHERE id = ?',
        [sessionId]
      );
      expect(mockDb.runAsync).toHaveBeenCalled();
    });

    test('should not create duplicate sessions', async () => {
      const sessionId = 'EXISTING_SESSION_123';

      // Mock existing session
      mockDb.getAllAsync.mockResolvedValueOnce([{ id: sessionId }]);

      const result = await DatabaseService.createSession(sessionId);

      expect(result).toBe(sessionId);
      expect(mockDb.runAsync).not.toHaveBeenCalled();
    });

    test('should end a session with statistics', async () => {
      const sessionId = 'TEST_SESSION_123';
      const stats = {
        avgSpo2: 92,
        minSpo2: 85,
        maxSpo2: 99,
        avgHeartRate: 75
      };

      mockDb.runAsync.mockResolvedValueOnce({ changes: 1 });

      await DatabaseService.endSession(sessionId, stats);

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE sessions SET'),
        expect.arrayContaining([
          'completed',
          expect.any(Number), // end_time
          stats.avgSpo2,
          stats.minSpo2,
          stats.maxSpo2,
          stats.avgHeartRate,
          sessionId
        ])
      );
    });

    test('should get session by ID', async () => {
      const sessionId = 'TEST_SESSION_123';
      const mockSession = {
        id: sessionId,
        start_time: Date.now(),
        status: 'active'
      };

      mockDb.getFirstAsync.mockResolvedValueOnce(mockSession);

      const result = await DatabaseService.getSession(sessionId);

      expect(result).toEqual(mockSession);
      expect(mockDb.getFirstAsync).toHaveBeenCalledWith(
        'SELECT * FROM sessions WHERE id = ?',
        [sessionId]
      );
    });

    test('should get all sessions', async () => {
      const mockSessions = [
        { id: 'SESSION_1', start_time: 1000, status: 'completed' },
        { id: 'SESSION_2', start_time: 2000, status: 'active' }
      ];

      mockDb.getAllAsync.mockResolvedValueOnce([{ count: 1 }]); // Table exists
      mockDb.getAllAsync.mockResolvedValueOnce(mockSessions);

      const result = await DatabaseService.getAllSessions();

      expect(result).toEqual(mockSessions);
      expect(mockDb.getAllAsync).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM sessions'),
        expect.any(Array)
      );
    });
  });

  describe('Survey Management', () => {
    beforeEach(async () => {
      await DatabaseService.init();
    });

    test('should save pre-session survey', async () => {
      const sessionId = 'TEST_SESSION_123';
      const clarityPre = 3;
      const energyPre = 4;
      const stressPre = 2;

      mockDb.runAsync.mockResolvedValueOnce({ lastInsertRowId: 1 });

      await DatabaseService.savePreSessionSurvey(sessionId, clarityPre, energyPre, stressPre);

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO surveys'),
        expect.arrayContaining([sessionId, clarityPre, energyPre, stressPre])
      );
    });

    test('should validate survey scale values', async () => {
      const sessionId = 'TEST_SESSION_123';

      await expect(
        DatabaseService.savePreSessionSurvey(sessionId, 6, 3, 3) // 6 is invalid
      ).rejects.toThrow('Invalid survey scale values');

      await expect(
        DatabaseService.savePreSessionSurvey(sessionId, 3, -1, 3) // -1 is invalid
      ).rejects.toThrow('Invalid survey scale values');
    });

    test('should save post-session survey', async () => {
      const sessionId = 'TEST_SESSION_123';
      const clarityPost = 4;
      const energyPost = 4;
      const stressPost = 1;
      const notesPost = 'Felt great!';
      const symptoms = ['headache', 'fatigue'];
      const overallRating = 4;

      // Mock existing survey
      mockDb.getAllAsync.mockResolvedValueOnce([{ id: 1 }]);
      mockDb.runAsync.mockResolvedValueOnce({ changes: 1 });

      await DatabaseService.savePostSessionSurvey(
        sessionId, clarityPost, energyPost, stressPost,
        notesPost, symptoms, overallRating
      );

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE surveys SET'),
        expect.arrayContaining([
          clarityPost, energyPost, stressPost, notesPost,
          JSON.stringify(symptoms), overallRating
        ])
      );
    });
  });

  describe('Adaptive System Methods', () => {
    beforeEach(async () => {
      await DatabaseService.init();
    });

    test('should save adaptive events', async () => {
      const event = {
        sessionId: 'TEST_SESSION_123',
        eventType: 'mask_lift',
        altitudePhaseNumber: 1,
        currentAltitudeLevel: 6,
        spo2Value: 83,
        adjustment: 'none'
      };

      mockDb.runAsync.mockResolvedValueOnce({ lastInsertRowId: 1 });

      await DatabaseService.saveAdaptiveEvent(event);

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO session_adaptive_events'),
        expect.arrayContaining([
          expect.any(String), // id
          event.sessionId,
          event.eventType,
          expect.any(Number), // timestamp
          event.altitudePhaseNumber
        ])
      );
    });

    test('should get completed adaptive sessions', async () => {
      const mockSessions = [
        { id: 'SESSION_1', session_subtype: 'training' },
        { id: 'SESSION_2', session_subtype: 'calibration' }
      ];

      mockDb.getAllAsync.mockResolvedValueOnce(mockSessions);

      const result = await DatabaseService.getCompletedAdaptiveSessions();

      expect(result).toEqual(mockSessions);
      expect(mockDb.getAllAsync).toHaveBeenCalledWith(
        expect.stringContaining('status = \'completed\''),
        []
      );
    });

    test('should update session altitude level', async () => {
      const sessionId = 'TEST_SESSION_123';
      const newLevel = 8;

      mockDb.runAsync.mockResolvedValueOnce({ changes: 1 });

      await DatabaseService.updateSessionAltitudeLevel(sessionId, newLevel);

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE sessions SET current_altitude_level'),
        [newLevel, sessionId]
      );
    });
  });

  describe('Metrics Saving', () => {
    beforeEach(async () => {
      await DatabaseService.init();
    });

    test('should save phase statistics', async () => {
      const phaseStats = {
        sessionId: 'TEST_SESSION_123',
        phaseType: 'altitude',
        phaseNumber: 1,
        avgSpo2: 88,
        minSpo2: 83,
        maxSpo2: 92,
        avgHeartRate: 82,
        minHeartRate: 75,
        maxHeartRate: 89,
        duration: 420000
      };

      mockDb.runAsync.mockResolvedValueOnce({ lastInsertRowId: 1 });

      await DatabaseService.savePhaseStats(phaseStats);

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO session_phase_stats'),
        expect.arrayContaining([
          expect.any(String), // id
          phaseStats.sessionId,
          phaseStats.phaseType,
          phaseStats.phaseNumber
        ])
      );
    });

    test('should save cycle metrics', async () => {
      const metrics = {
        sessionId: 'TEST_SESSION_123',
        cycleNumber: 1,
        hypoxicDuration: 420000,
        hyperoxicDuration: 180000,
        avgSpo2Hypoxic: 87,
        avgSpo2Hyperoxic: 98
      };

      mockDb.runAsync.mockResolvedValueOnce({ lastInsertRowId: 1 });

      await DatabaseService.saveCycleMetrics(metrics);

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO cycle_metrics'),
        expect.arrayContaining([
          expect.any(String), // id
          metrics.sessionId,
          metrics.cycleNumber
        ])
      );
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await DatabaseService.init();
    });

    test('should handle database errors gracefully', async () => {
      const error = new Error('Database error');
      mockDb.runAsync.mockRejectedValueOnce(error);

      // Should not throw, but log error
      await expect(
        DatabaseService.createSession('TEST_SESSION')
      ).rejects.toThrow();
    });

    test('should validate survey scale correctly', () => {
      expect(DatabaseService.isValidSurveyScale(1)).toBe(true);
      expect(DatabaseService.isValidSurveyScale(5)).toBe(true);
      expect(DatabaseService.isValidSurveyScale(0)).toBe(false);
      expect(DatabaseService.isValidSurveyScale(6)).toBe(false);
      expect(DatabaseService.isValidSurveyScale(null)).toBe(false);
    });
  });
});