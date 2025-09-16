import SupabaseService from '../../src/services/SupabaseService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import supabase from '../../src/config/supabase';

// Mock the Supabase client
jest.mock('../../src/config/supabase');

// Mock DatabaseService
jest.mock('../../src/services/DatabaseService', () => ({
  __esModule: true,
  default: {
    getIntraSessionResponses: jest.fn().mockResolvedValue([])
  }
}));

// Mock authService
jest.mock('../../src/auth/AuthService', () => ({
  __esModule: true,
  default: {
    getCurrentUser: jest.fn().mockResolvedValue({ id: 'user-123' })
  }
}));

describe('SupabaseService', () => {
  let mockSupabase;

  beforeEach(() => {
    jest.clearAllMocks();
    AsyncStorage.clear();

    // Reset the Supabase Service state
    SupabaseService.isOnline = true;
    SupabaseService.syncQueue = [];
    SupabaseService.sessionMapping = new Map();

    // Setup mock Supabase client
    mockSupabase = {
      auth: {
        getSession: jest.fn().mockResolvedValue({
          data: { session: { user: { id: 'user-123' } } },
          error: null
        }),
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'user-123' } },
          error: null
        })
      },
      from: jest.fn((table) => ({
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: {}, error: null }),
        upsert: jest.fn().mockResolvedValue({ data: [], error: null })
      }))
    };

    // Apply the mock
    Object.assign(supabase, mockSupabase);
  });

  describe('Initialization', () => {
    test('should initialize device ID', async () => {
      await SupabaseService.initializeDeviceId();

      expect(SupabaseService.deviceId).toBeDefined();
      expect(SupabaseService.deviceId).toMatch(/^device_\d+_[a-z0-9]+$/);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'deviceId',
        expect.stringMatching(/^device_/)
      );
    });

    test('should restore existing device ID', async () => {
      const existingDeviceId = 'device_12345_abc123';
      AsyncStorage.getItem.mockResolvedValueOnce(existingDeviceId);

      await SupabaseService.initializeDeviceId();

      expect(SupabaseService.deviceId).toBe(existingDeviceId);
      expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    });
  });

  describe('Session Management', () => {
    test('should create a session in Supabase', async () => {
      const sessionData = {
        localSessionId: 'IHHT_123456_abc',
        startTime: Date.now(),
        sessionType: 'IHHT'
      };

      const mockResponse = {
        id: 'uuid-123',
        ...sessionData
      };

      supabase.from().insert.mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: mockResponse,
            error: null
          })
        })
      });

      const result = await SupabaseService.createSession(sessionData);

      expect(result).toEqual(mockResponse);
      expect(SupabaseService.sessionMapping.has(sessionData.localSessionId)).toBe(true);
      expect(SupabaseService.sessionMapping.get(sessionData.localSessionId)).toBe('uuid-123');
    });

    test('should handle offline session creation', async () => {
      SupabaseService.isOnline = false;

      const sessionData = {
        localSessionId: 'IHHT_123456_abc',
        startTime: Date.now()
      };

      const result = await SupabaseService.createSession(sessionData);

      expect(result).toBeNull();
      expect(SupabaseService.syncQueue.length).toBe(1);
      expect(SupabaseService.syncQueue[0].operation).toBe('createSession');
    });

    test('should end a session', async () => {
      const localSessionId = 'IHHT_123456_abc';
      const supabaseId = 'uuid-123';
      SupabaseService.sessionMapping.set(localSessionId, supabaseId);

      const stats = {
        avgSpo2: 92,
        minSpo2: 85,
        maxSpo2: 99
      };

      supabase.from().update.mockReturnValue({
        eq: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: supabaseId, ...stats },
              error: null
            })
          })
        })
      });

      const result = await SupabaseService.endSession(localSessionId, stats);

      expect(result).toBeDefined();
      expect(supabase.from).toHaveBeenCalledWith('sessions');
    });
  });

  describe('Session Mapping', () => {
    test('should persist session mapping to AsyncStorage', async () => {
      SupabaseService.sessionMapping.set('local-1', 'uuid-1');
      SupabaseService.sessionMapping.set('local-2', 'uuid-2');

      await SupabaseService.persistSessionMapping();

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'sessionMapping',
        JSON.stringify({
          'local-1': 'uuid-1',
          'local-2': 'uuid-2'
        })
      );
    });

    test('should restore session mapping from AsyncStorage', async () => {
      const storedMapping = {
        'local-1': 'uuid-1',
        'local-2': 'uuid-2'
      };

      AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(storedMapping));

      await SupabaseService.restoreSessionMapping();

      expect(SupabaseService.sessionMapping.size).toBe(2);
      expect(SupabaseService.sessionMapping.get('local-1')).toBe('uuid-1');
      expect(SupabaseService.sessionMapping.get('local-2')).toBe('uuid-2');
    });

    test('should clean up old session mappings', async () => {
      const oneDayAgo = Date.now() - (25 * 60 * 60 * 1000); // 25 hours ago
      const recentTime = Date.now() - (60 * 60 * 1000); // 1 hour ago

      const storedMapping = {
        [`IHHT_${oneDayAgo}_old`]: 'uuid-old',
        [`IHHT_${recentTime}_recent`]: 'uuid-recent'
      };

      AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(storedMapping));

      await SupabaseService.restoreSessionMapping();

      expect(SupabaseService.sessionMapping.size).toBe(1);
      expect(SupabaseService.sessionMapping.has(`IHHT_${recentTime}_recent`)).toBe(true);
      expect(SupabaseService.sessionMapping.has(`IHHT_${oneDayAgo}_old`)).toBe(false);
    });
  });

  describe('Sync Queue Management', () => {
    test('should queue operations when offline', () => {
      SupabaseService.isOnline = false;

      SupabaseService.queueForSync('endSession', {
        sessionId: 'test-session',
        stats: { avgSpo2: 92 }
      });

      expect(SupabaseService.syncQueue.length).toBe(1);
      expect(SupabaseService.syncQueue[0]).toMatchObject({
        operation: 'endSession',
        data: { sessionId: 'test-session' }
      });
    });

    test('should not queue when session mapping is missing', () => {
      SupabaseService.isOnline = false;

      SupabaseService.queueForSync('updateSessionCycle', {
        sessionId: 'unmapped-session',
        cycleNumber: 1
      });

      expect(SupabaseService.syncQueue.length).toBe(0);
    });

    test('should process sync queue when online', async () => {
      SupabaseService.sessionMapping.set('local-session', 'uuid-123');

      SupabaseService.syncQueue = [
        {
          id: 'item-1',
          operation: 'endSession',
          data: { sessionId: 'local-session', avgSpo2: 92 },
          timestamp: Date.now()
        }
      ];

      // Mock the endSession method
      SupabaseService.endSession = jest.fn().mockResolvedValue({ success: true });

      await SupabaseService.processSyncQueue();

      expect(SupabaseService.endSession).toHaveBeenCalledWith('local-session', { avgSpo2: 92 });
      expect(SupabaseService.syncQueue.length).toBe(0);
    });

    test('should persist sync queue to AsyncStorage', async () => {
      SupabaseService.syncQueue = [
        {
          id: 'item-1',
          operation: 'test',
          data: { test: true },
          timestamp: Date.now()
        }
      ];

      await SupabaseService.persistSyncQueue();

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'supabaseSyncQueue',
        JSON.stringify(SupabaseService.syncQueue)
      );
    });

    test('should load sync queue from AsyncStorage', async () => {
      const storedQueue = [
        {
          id: 'item-1',
          operation: 'test',
          data: { test: true },
          timestamp: Date.now()
        }
      ];

      AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(storedQueue));

      await SupabaseService.loadSyncQueue();

      expect(SupabaseService.syncQueue).toEqual(storedQueue);
    });
  });

  describe('Survey Synchronization', () => {
    test('should sync pre-session survey', async () => {
      const localSessionId = 'IHHT_123456_abc';
      const supabaseId = 'uuid-123';
      SupabaseService.sessionMapping.set(localSessionId, supabaseId);

      supabase.from().upsert.mockResolvedValue({
        data: [{ id: 1, session_id: supabaseId }],
        error: null
      });

      const result = await SupabaseService.syncPreSessionSurvey(
        localSessionId, 3, 4, 2
      );

      expect(result.success).toBe(true);
      expect(supabase.from).toHaveBeenCalledWith('session_surveys');
    });

    test('should sync post-session survey', async () => {
      const localSessionId = 'IHHT_123456_abc';
      const supabaseId = 'uuid-123';
      SupabaseService.sessionMapping.set(localSessionId, supabaseId);

      supabase.from().update.mockReturnValue({
        eq: jest.fn().mockResolvedValue({
          data: [{ id: 1, session_id: supabaseId }],
          error: null
        })
      });

      const result = await SupabaseService.syncPostSessionSurvey(
        localSessionId, 4, 4, 1, 'Felt great!', ['none'], 5
      );

      expect(result.success).toBe(true);
      expect(supabase.from).toHaveBeenCalledWith('session_surveys');
    });
  });

  describe('Error Handling', () => {
    test('should handle Supabase errors gracefully', async () => {
      const error = { message: 'Database error' };

      supabase.from().insert.mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: null,
            error
          })
        })
      });

      const result = await SupabaseService.createSession({
        localSessionId: 'test-session'
      });

      expect(result).toBeNull();
      expect(SupabaseService.syncQueue.length).toBe(1);
    });

    test('should handle missing session mapping', async () => {
      const result = await SupabaseService.endSession('unmapped-session', {});

      expect(result).toBeNull();
    });

    test('should clear invalid queue items', async () => {
      // Add items with missing session mappings
      SupabaseService.syncQueue = [
        {
          id: 'item-1',
          operation: 'endSession',
          data: { sessionId: 'unmapped-1' },
          timestamp: Date.now()
        },
        {
          id: 'item-2',
          operation: 'endSession',
          data: { sessionId: 'unmapped-2' },
          timestamp: Date.now()
        }
      ];

      await SupabaseService.clearInvalidQueueItems();

      expect(SupabaseService.syncQueue.length).toBe(0);
    });
  });

  describe('Online/Offline State', () => {
    test('should track online state', () => {
      SupabaseService.isOnline = true;
      expect(SupabaseService.isOnline).toBe(true);

      SupabaseService.isOnline = false;
      expect(SupabaseService.isOnline).toBe(false);
    });

    test('should queue operations when offline', () => {
      SupabaseService.isOnline = false;
      SupabaseService.sessionMapping.set('local-session', 'uuid-123');

      SupabaseService.queueForSync('test', {
        sessionId: 'local-session'
      });

      expect(SupabaseService.syncQueue.length).toBe(1);
    });
  });
});