import supabase from '../config/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import authService from '../auth/AuthService';
import logger from '../utils/logger';
import DatabaseService from './DatabaseService';

const log = logger.createModuleLogger('SupabaseService');

class SupabaseService {
  constructor() {
    this.isOnline = true;
    this.syncQueue = [];
    this.deviceId = null;
    this.sessionMapping = new Map(); // local_session_id -> supabase_uuid
    this.lastSyncTime = null; // For throttling sync queue processing
  }

  async initializeDeviceId() {
    try {
      let deviceId = await AsyncStorage.getItem('deviceId');
      if (!deviceId) {
        deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await AsyncStorage.setItem('deviceId', deviceId);
      }
      this.deviceId = deviceId;
      log.info('Device ID initialized:', deviceId);
    } catch (error) {
      log.error('❌ Failed to initialize device ID:', error);
    }
  }

  // Persist session mapping to AsyncStorage
  async persistSessionMapping() {
    try {
      const mappingData = Array.from(this.sessionMapping.entries());
      // Use 'sessionMapping' key for backward compatibility
      await AsyncStorage.setItem('sessionMapping', JSON.stringify(Object.fromEntries(this.sessionMapping)));
      log.info('Persisted session mapping with', mappingData.length, 'entries');
    } catch (error) {
      log.error('❌ Failed to persist session mapping:', error);
    }
  }

  // Restore session mapping from AsyncStorage
  async restoreSessionMapping() {
    try {
      // Try to load from 'sessionMapping' key (backward compatible)
      const mappingJson = await AsyncStorage.getItem('sessionMapping');
      if (mappingJson) {
        const mappingObj = JSON.parse(mappingJson);
        this.sessionMapping = new Map(Object.entries(mappingObj));
        log.info('Restored session mapping with', this.sessionMapping.size, 'entries');
        
        // Clean up old mappings (older than 24 hours)
        const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
        const entries = Array.from(this.sessionMapping.entries());
        const cleanedEntries = entries.filter(([localId]) => {
          // Parse the timestamp from the local session ID if it includes one
          const timestamp = parseInt(localId.split('_')[1] || '0');
          return timestamp > oneDayAgo || timestamp === 0;
        });
        
        if (cleanedEntries.length < entries.length) {
          this.sessionMapping = new Map(cleanedEntries);
          await this.persistSessionMapping();
          log.info('🧹 Cleaned up', entries.length - cleanedEntries.length, 'old session mappings');
        }
      } else {
        log.info('� No stored session mappings found');
      }
    } catch (error) {
      log.error('❌ Failed to restore session mapping:', error);
      this.sessionMapping = new Map();
    }
  }

  async getDeviceId() {
    if (!this.deviceId) {
      await this.initializeDeviceId();
    }
    return this.deviceId;
  }



  // Get session data from database
  async verifySessionData(supabaseSessionId) {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('id, device_id, user_id, local_session_id, status')
        .eq('id', supabaseSessionId)
        .single();
      
      if (error) {
        log.error('❌ Failed to fetch session data:', error);
        return null;
      }
      
      return data;
    } catch (error) {
      log.error('❌ Error fetching session data:', error);
      return null;
    }
  }

  async setupNetworkMonitoring() {
    // Simplified: assume we're always online
    // If Supabase calls fail, they'll be queued automatically
    this.isOnline = true;
    log.info('Network monitoring: Simplified mode (assuming online)');
    
    // Try to process any existing sync queue every 10 seconds
    setInterval(() => {
      if (this.syncQueue.length > 0) {
        log.info('Attempting to process sync queue...');
        this.processSyncQueue();
      }
    }, 10000); // Check every 10 seconds (more frequent)
  }

  // Session Management
  async createSession(sessionData) {
    try {
      // Get current authenticated user (fall back to anonymous)
      const currentUser = authService.getCurrentUser();
      log.info('AuthService getCurrentUser():', currentUser);
      
      // Check actual Supabase auth state
      const { data: authUser, error: authError } = await supabase.auth.getUser();
      log.info('Supabase auth.getUser():', authUser, authError);
      
      // Check auth session
      const { data: authSession, error: sessionError } = await supabase.auth.getSession();
      log.info('Supabase auth.getSession():', authSession, sessionError);
      
      // CRITICAL: Ensure we have the local session ID
      if (!sessionData.id) {
        log.error('❌ CRITICAL: No session ID provided to createSession');
        throw new Error('Session ID is required');
      }
      
      const session = {
        device_id: this.deviceId,
        user_id: currentUser?.id || null, // Link to authenticated user or anonymous
        start_time: new Date(sessionData.startTime).toISOString(),
        status: 'active',
        total_readings: 0,
        session_type: 'IHHT',
        default_hypoxia_level: sessionData.defaultHypoxiaLevel || null,
        // Protocol configuration
        total_cycles: sessionData.protocolConfig?.totalCycles || 3,
        hypoxic_duration: sessionData.protocolConfig?.hypoxicDuration || 420, // 7 minutes
        hyperoxic_duration: sessionData.protocolConfig?.hyperoxicDuration || 180, // 3 minutes
        // Planned protocol (same as total initially)
        planned_total_cycles: sessionData.protocolConfig?.totalCycles || 3,
        planned_hypoxic_duration: sessionData.protocolConfig?.hypoxicDuration || 420,
        planned_hyperoxic_duration: sessionData.protocolConfig?.hyperoxicDuration || 180,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        // CRITICAL: Store the local session ID for mapping recovery
        local_session_id: sessionData.id
      };

      log.info('Creating session with device_id:', this.deviceId, 'user_id:', currentUser?.id || 'null');
      
      // Ensure device ID is set
      if (!this.deviceId) {
        log.error('🚨 CRITICAL: deviceId is null! Initializing now...');
        await this.initializeDeviceId();
        log.info('� Initialized deviceId:', this.deviceId);
        session.device_id = this.deviceId;
      }

      // RLS policy now fixed - device_id check works directly without session variables
      log.info('RLS policy allows device_id-based sessions');

      const { data, error } = await supabase
        .from('sessions')
        .insert([session])
        .select();

      if (error) {
        log.error('❌ Supabase session creation failed, queuing for sync:', error.message);
        this.queueForSync('createSession', sessionData);
        return null;
      }

      log.info('Session created in Supabase:', data[0].id);
      
      // Store the mapping between local and Supabase session IDs
      this.sessionMapping.set(sessionData.id, data[0].id);
      log.info('� Added session mapping:', sessionData.id, '→', data[0].id);
      log.info('� Total mappings now:', this.sessionMapping.size);
      
      // Persist the mapping to AsyncStorage for recovery after app restart
      await this.persistSessionMapping();
      
      return data[0];
    } catch (error) {
      log.error('❌ Error creating session, queuing for sync:', error.message);
      this.queueForSync('createSession', sessionData);
      return null;
    }
  }

  async endSession(sessionId, stats, startTime = null) {
    try {
      // Get the Supabase UUID for this local session ID
      let supabaseSessionId = this.sessionMapping.get(sessionId);
      
      // If mapping is lost (app restart), try to recover it
      if (!supabaseSessionId) {
        log.info('Session mapping not in memory, checking persistent storage...');
        await this.restoreSessionMapping();
        supabaseSessionId = this.sessionMapping.get(sessionId);
      }
      
      // If still not found, look it up from database
      if (!supabaseSessionId) {
        log.info('Session mapping lost, looking up Supabase session ID...');
        
        try {
          const { data, error } = await supabase
            .from('sessions')
            .select('id')
            .eq('local_session_id', sessionId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
            
          if (data && !error) {
            supabaseSessionId = data.id;
            // Restore the mapping and persist it
            this.sessionMapping.set(sessionId, supabaseSessionId);
            await this.persistSessionMapping();
            log.info('Found and restored Supabase session:', supabaseSessionId);
          }
        } catch (lookupError) {
          log.error('❌ Failed to lookup session:', lookupError);
        }
      }
      
      if (!supabaseSessionId) {
        log.warn('⚠️ No Supabase session found for ending session:', sessionId);
        this.queueForSync('endSession', { sessionId, stats });
        return null;
      }

      // Calculate total duration if startTime provided
      let totalDuration = null;
      if (startTime) {
        totalDuration = Math.floor((Date.now() - startTime) / 1000); // Convert to seconds
      }

      const updates = {
        end_time: new Date().toISOString(),
        status: 'completed',
        total_readings: stats.totalReadings,
        avg_spo2: stats.avgSpO2,
        min_spo2: stats.minSpO2,
        max_spo2: stats.maxSpO2,
        avg_heart_rate: stats.avgHeartRate,
        min_heart_rate: stats.minHeartRate,
        max_heart_rate: stats.maxHeartRate,
        total_duration_seconds: totalDuration,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('sessions')
        .update(updates)
        .eq('id', supabaseSessionId)
        .select();

      if (error) {
        log.error('❌ Supabase session update failed:', error);
        this.queueForSync('endSession', { sessionId, stats });
        return null;
      }

      log.info('Session ended in Supabase:', sessionId);
      return data[0];
    } catch (error) {
      log.error('❌ Error ending session in Supabase:', error);
      log.error('❌ Supabase error details:', error.message, error.stack);
      log.error('❌ Session ID:', sessionId, 'Stats:', stats);
      this.queueForSync('endSession', { sessionId, stats });
      return null;
    }
  }

  async updateSessionCycle(sessionId, currentCycle) {
    try {
      // Get the Supabase UUID for this local session ID
      let supabaseSessionId = this.sessionMapping.get(sessionId);
      
      if (!supabaseSessionId) {
        log.warn('⚠️ No Supabase session mapping found for cycle update:', sessionId);
        this.queueForSync('updateSessionCycle', { sessionId, currentCycle });
        return null;
      }

      const { data, error } = await supabase
        .from('sessions')
        .update({ 
          current_cycle: currentCycle,
          updated_at: new Date().toISOString()
        })
        .eq('id', supabaseSessionId)
        .select();

      if (error) {
        log.error('❌ Supabase cycle update failed:', error);
        this.queueForSync('updateSessionCycle', { sessionId, currentCycle });
        return null;
      }

      log.info(`Updated session ${sessionId} to cycle ${currentCycle} in Supabase`);
      return data[0];
    } catch (error) {
      log.error('❌ Error updating session cycle in Supabase:', error);
      this.queueForSync('updateSessionCycle', { sessionId, currentCycle });
      return null;
    }
  }

  // Reading Management
  async addReading(reading) {
    try {
      // Get session mapping
      let supabaseSessionId = this.sessionMapping.get(reading.sessionId);
      
      // Recover session mapping if needed
      if (!supabaseSessionId) {
        supabaseSessionId = await this.recoverSessionMapping(reading.sessionId);
        if (!supabaseSessionId) {
          log.error('❌ Failed to recover session mapping for:', reading.sessionId);
          this.queueForSync('addReading', reading);
          return null;
        }
      }

      // Get session data to determine correct device_id
      const sessionData = await this.verifySessionData(supabaseSessionId);
      const deviceIdToUse = sessionData?.device_id || this.deviceId;

      // Get current authenticated user
      const currentUser = authService.getCurrentUser();
      
      // Use atomic function for single reading insert
      const { data, error } = await supabase.rpc('insert_single_reading_with_device_id', {
        device_id_value: deviceIdToUse,
        p_session_id: supabaseSessionId,
        p_user_id: currentUser?.id || null,
        p_timestamp: new Date(reading.timestamp).toISOString(),
        p_spo2: reading.spo2,
        p_heart_rate: reading.heartRate,
        p_signal_strength: reading.signalStrength,
        p_is_valid: (reading.spo2 !== null && reading.spo2 > 0) || 
                    (reading.heartRate !== null && reading.heartRate > 0),
        p_fio2_level: reading.fio2Level || null,
        p_phase_type: reading.phaseType || null,
        p_cycle_number: reading.cycleNumber || null,
        p_created_at: new Date().toISOString()
      });

      if (error) {
        log.error('❌ Single reading insert failed:', error);
        this.queueForSync('addReading', reading);
        return null;
      }

      return data[0];
    } catch (error) {
      log.error('❌ Error adding reading:', error.message);
      this.queueForSync('addReading', reading);
      return null;
    }
  }

  async addReadingsBatch(readings) {
    try {
      // Get session mapping
      const firstReading = readings[0];
      if (!firstReading) {
        log.warn('⚠️ Empty readings batch');
        return null;
      }
      
      const localSessionId = firstReading.session_id || firstReading.sessionId;
      log.info('📊 Processing readings batch for session:', localSessionId, 'Count:', readings.length);
      
      let supabaseSessionId = this.sessionMapping.get(localSessionId);
      
      if (supabaseSessionId) {
        log.info('✅ Found existing session mapping:', localSessionId, '→', supabaseSessionId);
      } else {
        log.warn('⚠️ No session mapping found, attempting recovery for:', localSessionId);
        log.info('📋 Current session mappings:', Array.from(this.sessionMapping.entries()));
      }
      
      // Recover session mapping if needed
      if (!supabaseSessionId) {
        supabaseSessionId = await this.recoverSessionMapping(localSessionId);
        if (!supabaseSessionId) {
          log.error('❌ Failed to recover session mapping for batch:', localSessionId);
          log.error('❌ Will queue batch for later sync');
          this.queueForSync('addReadingsBatch', readings);
          return null;
        }
      }

      // Get session data to determine correct device_id
      const sessionData = await this.verifySessionData(supabaseSessionId);
      const deviceIdToUse = sessionData?.device_id || this.deviceId;
      
      // Get current authenticated user
      const currentUser = authService.getCurrentUser();
      
      // Prepare readings data
      const supabaseReadings = readings.map(reading => ({
        session_id: supabaseSessionId,
        user_id: currentUser?.id || null,
        timestamp: new Date(reading.timestamp).toISOString(),
        spo2: reading.spo2,
        heart_rate: reading.heartRate,
        signal_strength: reading.signalStrength,
        is_valid: (reading.spo2 !== null && reading.spo2 > 0) || 
                 (reading.heartRate !== null && reading.heartRate > 0),
        fio2_level: reading.fio2Level || null,
        phase_type: reading.phaseType || null,
        cycle_number: reading.cycleNumber || null,
        created_at: new Date().toISOString()
      }));

      // Use atomic function that sets device_id and inserts in same transaction
      const { data, error } = await supabase.rpc('insert_readings_with_device_id', {
        device_id_value: deviceIdToUse,
        readings_data: supabaseReadings
      });

      if (error) {
        log.error('❌ Batch insert failed:', error);
        this.queueForSync('addReadingsBatch', readings);
        return null;
      }

      log.info(`Successfully inserted ${data.length} readings to Supabase`);
      return data;
    } catch (error) {
      log.error('❌ Error batch inserting readings:', error);
      this.queueForSync('addReadingsBatch', readings);
      return null;
    }
  }

  // Data Retrieval
  async getAllSessions() {
    try {
      if (!this.isOnline) {
        log.info('Offline: Cannot fetch sessions from Supabase');
        return [];
      }

      // Get current authenticated user
      const currentUser = authService.getCurrentUser();
      
      let query = supabase.from('sessions').select('*');
      
      if (currentUser) {
        // Authenticated: get user's sessions
        query = query.eq('user_id', currentUser.id);
      } else {
        // Anonymous: get sessions for this device
        query = query.eq('device_id', this.deviceId).is('user_id', null);
      }
      
      const { data, error } = await query
        .order('start_time', { ascending: false })
        .limit(20);

      if (error) {
        log.error('❌ Error fetching sessions:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      log.error('❌ Error getting sessions:', error);
      return [];
    }
  }

  async getSessionReadings(sessionId, validOnly = false) {
    try {
      if (!this.isOnline) {
        log.info('Offline: Cannot fetch readings from Supabase');
        return [];
      }

      // Fetch readings for the session (user filter handled by session access)
      let query = supabase
        .from('readings')
        .select('*')
        .eq('session_id', sessionId)
        .order('timestamp', { ascending: true });

      if (validOnly) {
        query = query.eq('is_valid', true);
      }

      const { data, error } = await query;

      if (error) {
        log.error('❌ Error fetching readings:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      log.error('❌ Error getting readings:', error);
      return [];
    }
  }

  // Sync Queue Management
  queueForSync(operation, data) {
    // Check for duplicate survey items to prevent infinite queuing
    if (operation.includes('survey') || operation.includes('response')) {
      const isDuplicate = this.syncQueue.some(item => 
        item.operation === operation && 
        item.data.localSessionId === data.localSessionId
      );
      
      if (isDuplicate) {
        log.info(`Skipping duplicate queue item: ${operation} for session ${data.localSessionId}`);
        return;
      }
    }

    const syncItem = {
      id: Date.now() + Math.random(),
      operation,
      data,
      timestamp: Date.now(),
      retryCount: 0
    };
    
    this.syncQueue.push(syncItem);
    log.info(`� Queued for sync: ${operation}`, syncItem.id);
    
    // Persist queue to storage
    this.persistSyncQueue();
  }

  async persistSyncQueue() {
    try {
      await AsyncStorage.setItem('supabaseSyncQueue', JSON.stringify(this.syncQueue));
    } catch (error) {
      log.error('❌ Failed to persist sync queue:', error);
    }
  }

  async loadSyncQueue() {
    try {
      const queue = await AsyncStorage.getItem('supabaseSyncQueue');
      if (queue) {
        this.syncQueue = JSON.parse(queue);
        log.info(`� Loaded ${this.syncQueue.length} items from sync queue`);
      }
    } catch (error) {
      log.error('❌ Failed to load sync queue:', error);
    }
  }

  async cleanupOrphanedSyncItems() {
    const originalLength = this.syncQueue.length;
    
    // Remove items where sessionId is invalid or uses old patterns
    this.syncQueue = this.syncQueue.filter(item => {
      // Extract sessionId based on operation type
      let sessionId = null;
      
      if (item.operation === 'endSession' || item.operation === 'updateSessionCycle') {
        sessionId = item.data?.sessionId;
      } else if (item.operation === 'updateSessionProtocolConfig') {
        sessionId = item.data?.localSessionId;
      } else if (item.operation === 'createSession') {
        sessionId = item.data?.id || item.data?.localSessionId;
      } else if (item.operation === 'addReadingsBatch' && Array.isArray(item.data) && item.data.length > 0) {
        sessionId = item.data[0]?.session_id || item.data[0]?.sessionId;
      } else {
        sessionId = item.data?.localSessionId || item.data?.sessionId || item.data?.session_id;
      }
      
      // Remove if sessionId is invalid or uses old patterns
      const isOrphan = !sessionId || 
                       sessionId === 'undefined' || 
                       sessionId === 'unknown' ||
                       sessionId === 'null' ||
                       sessionId === 'IHHT_TRAINING';  // Old pattern without timestamp
      
      if (isOrphan) {
        log.info(`🧹 Removing orphaned sync item: ${item.operation} with invalid sessionId: ${sessionId}`);
        return false;
      }
      
      // Also validate format - should contain timestamp
      if (typeof sessionId === 'string' && 
          (sessionId === sessionId.toUpperCase()) && // All caps likely old pattern
          !sessionId.match(/\d{13}/)) { // Should contain timestamp
        log.info(`🧹 Removing sync item with old format: ${item.operation} sessionId: ${sessionId}`);
        return false;
      }
      
      return true;
    });
    
    if (this.syncQueue.length !== originalLength) {
      log.info(`✅ Cleaned up ${originalLength - this.syncQueue.length} orphaned sync items`);
      await this.persistSyncQueue();
    }
  }

  async processSyncQueue() {
    if (!this.isOnline || this.syncQueue.length === 0) return;

    // Throttle sync processing to prevent infinite loops (minimum 1 second between runs)
    const now = Date.now();
    if (this.lastSyncTime && (now - this.lastSyncTime) < 1000) {
      log.info('⏱️ Sync queue throttled - too soon since last run');
      return;
    }
    this.lastSyncTime = now;

    log.info(`Processing ${this.syncQueue.length} sync queue items`);
    log.info('Current session mappings:', Array.from(this.sessionMapping.entries()));
    
    // Debug: Log details of queued items
    this.syncQueue.forEach((item, index) => {
      // Handle different data structures for different operations
      let sessionId = 'unknown';
      if (item.operation === 'addReadingsBatch' && Array.isArray(item.data) && item.data.length > 0) {
        sessionId = item.data[0].session_id || 'unknown';
      } else {
        sessionId = item.data.localSessionId || item.data.sessionId || item.data.session_id || 'unknown';
      }
      console.log(`📋 Queue item ${index + 1}: ${item.operation} for session ${sessionId}`);
    });
    
    const processedItems = [];
    
    for (const item of this.syncQueue) {
      try {
        let success = false;
        
        switch (item.operation) {
          case 'createSession':
            success = await this.createSession(item.data) !== null;
            break;
          case 'endSession':
            success = await this.endSession(item.data.sessionId, item.data.stats) !== null;
            break;
          case 'updateSessionCycle':
            success = await this.updateSessionCycle(item.data.sessionId, item.data.currentCycle) !== null;
            break;
          case 'updateSessionProtocolConfig':
            const protocolResult = await this.updateSessionProtocolConfig(item.data.localSessionId, item.data.protocolConfig);
            success = protocolResult.success && !protocolResult.queued;
            break;
          case 'updateSessionsWithUserId':
            const userIdResult = await this.updateSessionsWithUserId(item.data.userId);
            success = userIdResult.success;
            break;
          case 'handleAnonymousAccess':
            const anonymousResult = await this.handleAnonymousAccess();
            success = anonymousResult.success;
            break;
          case 'addReading':
            success = await this.addReading(item.data) !== null;
            break;
          case 'addReadingsBatch':
            success = await this.addReadingsBatch(item.data) !== null;
            break;
          case 'pre_session_survey':
            // Pre-session surveys deprecated - skip this item
            log.info('⚠️ Skipping deprecated pre-session survey sync');
            success = true; // Mark as success to remove from queue
            break;
          case 'post_session_survey':
            // Check if session mapping exists before trying to sync
            const supabaseId2 = this.sessionMapping.get(item.data.localSessionId);
            if (supabaseId2) {
              const postResult = await this.syncPostSessionSurvey(item.data.localSessionId, item.data.clarityPost, item.data.energyPost, item.data.stressPost, item.data.notesPost);
              success = postResult.success && !postResult.queued;
            } else {
              // Keep in queue but don't retry yet (session mapping doesn't exist)
              success = false;
            }
            break;
          case 'intra_session_response':
            // Check if session mapping exists before trying to sync
            const supabaseId3 = this.sessionMapping.get(item.data.localSessionId);
            if (supabaseId3) {
              const intraResult = await this.syncIntraSessionResponse(item.data.localSessionId, item.data.phaseNumber, item.data.clarity, item.data.energy, item.data.stress, item.data.timestamp);
              success = intraResult.success && !intraResult.queued;
            } else {
              // Keep in queue but don't retry yet (session mapping doesn't exist)
              success = false;
            }
            break;
        }

        if (success) {
          processedItems.push(item.id);
          log.info(`Synced: ${item.operation}`, item.id);
        }
      } catch (error) {
        log.error(`❌ Failed to sync ${item.operation}:`, error);
      }
    }

    // Remove successfully processed items
    this.syncQueue = this.syncQueue.filter(item => !processedItems.includes(item.id));
    await this.persistSyncQueue();

    log.info(`Sync complete. ${processedItems.length} items processed, ${this.syncQueue.length} remaining`);
  }

  // Real-time subscriptions (for future use)
  subscribeToSessions(callback) {
    if (!this.isOnline) return null;

    return supabase
      .channel('sessions')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'sessions',
          filter: `device_id=eq.${this.deviceId}`
        }, 
        callback
      )
      .subscribe();
  }

  subscribeToReadings(sessionId, callback) {
    if (!this.isOnline) return null;

    return supabase
      .channel('readings')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'readings',
          filter: `session_id=eq.${sessionId}`
        }, 
        callback
      )
      .subscribe();
  }

  // Utility methods
  isConnected() {
    return this.isOnline;
  }

  getSyncQueueLength() {
    return this.syncQueue.length;
  }

  async clearSyncQueue() {
    this.syncQueue = [];
    await this.persistSyncQueue();
    log.info('Sync queue cleared');
  }

  // Manual trigger for sync queue processing (for debugging)
  async forceSyncQueueProcessing() {
    log.info('� Manual sync queue processing triggered');
    await this.processSyncQueue();
    return {
      remaining: this.syncQueue.length,
      mappings: Array.from(this.sessionMapping.entries())
    };
  }

  async initialize() {
    try {
      log.info('� Initializing SupabaseService...');
      
      // Force clear any existing auth sessions that might cause recovery errors
      try {
        // Clear AsyncStorage auth data
        const allKeys = await AsyncStorage.getAllKeys();
        const authKeys = allKeys.filter(key => 
          key.includes('supabase') || 
          key.includes('sb-') || 
          key.includes('auth.token') ||
          key.includes('yhbywcawiothhoqaurgy')
        );
        
        if (authKeys.length > 0) {
          await AsyncStorage.multiRemove(authKeys);
          log.info('🧹 Cleared', authKeys.length, 'auth storage keys');
        }
        
        // Note: Not clearing auth sessions to avoid interfering with app auth flow
        log.info('� Skipping auth session clear to prevent login redirect');
      } catch (authError) {
        log.info('� No auth sessions to clear (expected for anonymous mode)');
      }
      
      await this.initializeDeviceId();
      
      // Fix RLS issues by ensuring proper authentication
      try {
        // Get current auth state
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          log.info('User authenticated:', user.id);
          // Update sessions with authenticated user_id to fix RLS
          await this.updateSessionsWithUserId(user.id);
        } else {
          log.info('No authenticated user - skipping anonymous access (causing SQL errors)');
          // Skip anonymous access for now to prevent SQL errors
          // TODO: Implement proper anonymous session handling when RLS policies are fixed
        }
             } catch (authError) {
         log.info('Auth check failed:', authError.message);
         // Skip fallback to prevent SQL errors
         log.info('Skipping anonymous access fallback (causing SQL errors)');
       }
      
      await this.setupNetworkMonitoring();
      await this.loadSyncQueue();
      await this.loadSessionMapping();
      
      // Clear massive sync queue backup due to RLS errors
      if (this.syncQueue.length > 100) {
        log.info(`🧹 Clearing ${this.syncQueue.length} backed up sync items due to RLS errors`);
        this.syncQueue = [];
        await this.persistSyncQueue();
        log.info('Sync queue cleared');
      }

      // Clean up orphaned sync items with undefined sessionIds
      await this.cleanupOrphanedSyncItems();
      
      // Additional cleanup specifically for IHHT_TRAINING pattern
      const beforeExtraCleanup = this.syncQueue.length;
      this.syncQueue = this.syncQueue.filter(item => {
        const sessionId = item.data?.sessionId || item.data?.localSessionId || 
                         (item.data?.[0]?.session_id) || (item.data?.[0]?.sessionId);
        if (sessionId === 'IHHT_TRAINING') {
          log.warn(`🧹 Removing legacy ${sessionId} sync item:`, item.operation);
          return false;
        }
        return true;
      });
      
      if (beforeExtraCleanup !== this.syncQueue.length) {
        log.info(`✅ Extra cleanup removed ${beforeExtraCleanup - this.syncQueue.length} legacy items`);
        await this.persistSyncQueue();
      }
      
      if (this.isOnline && this.syncQueue.length > 0) {
        await this.processSyncQueue();
      }
      
      log.info('SupabaseService initialized successfully');
    } catch (error) {
      log.error('❌ SupabaseService initialization failed:', error);
      // Don't throw - let the app continue with local storage only
      log.info('Continuing with local storage only');
    }
  }

  // Session mapping recovery from database
  async recoverSessionMapping(localSessionId) {
    try {
      log.info('🔍 Attempting to recover session mapping for:', localSessionId);
      
      // First try: Look for exact local_session_id match
      const { data: primaryData, error: primaryError } = await supabase
        .from('sessions')
        .select('id, local_session_id, device_id, start_time, status')
        .eq('local_session_id', localSessionId)
        .eq('status', 'active')
        .single();
      
      if (primaryData && !primaryError) {
        const supabaseSessionId = primaryData.id;
        this.sessionMapping.set(localSessionId, supabaseSessionId);
        await this.persistSessionMapping();
        log.info('✅ Successfully recovered session mapping (primary):', localSessionId, '→', supabaseSessionId);
        return supabaseSessionId;
      }
      
      log.warn('⚠️ Primary recovery failed, attempting secondary recovery by device_id and recency');
      
      // Secondary recovery: Find most recent active session for this device
      if (this.deviceId) {
        const { data: secondaryData, error: secondaryError } = await supabase
          .from('sessions')
          .select('id, local_session_id, device_id, start_time, status')
          .eq('device_id', this.deviceId)
          .eq('status', 'active')
          .order('start_time', { ascending: false })
          .limit(1);
        
        if (secondaryData && secondaryData.length > 0 && !secondaryError) {
          const session = secondaryData[0];
          // Only use this if the session is recent (within last hour)
          const sessionAge = Date.now() - new Date(session.start_time).getTime();
          if (sessionAge < 60 * 60 * 1000) { // 1 hour
            log.warn('⚠️ Using recent active session as fallback:', session.id);
            log.warn('⚠️ Original local_session_id:', session.local_session_id, 'Requested:', localSessionId);
            this.sessionMapping.set(localSessionId, session.id);
            await this.persistSessionMapping();
            return session.id;
          } else {
            log.error('❌ Found session but it\'s too old:', sessionAge / 1000 / 60, 'minutes');
          }
        }
      }
      
      log.error('❌ No active session found in Supabase for:', localSessionId);
      log.error('❌ Session mapping size:', this.sessionMapping.size);
      log.error('❌ Current mappings:', Array.from(this.sessionMapping.entries()));
      return null;
    } catch (error) {
      log.error('❌ Failed to recover session mapping:', error);
      return null;
    }
  }

  // Clean up stuck sessions for the current user/device
  async cleanupStuckSessions() {
    try {
      log.info('Searching for stuck active sessions...');
      
      // Query for sessions that are still active but older than 1 hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      
      // Get current user (may be null for anonymous sessions)
      const currentUser = authService.getCurrentUser();
      
      let query = supabase
        .from('sessions')
        .select('id, local_session_id, created_at')
        .eq('status', 'active')
        .lt('created_at', oneHourAgo);
      
      // Filter by user if authenticated, or by device_id if anonymous
      if (currentUser?.id) {
        query = query.eq('user_id', currentUser.id);
      } else {
        query = query.eq('device_id', this.deviceId);
      }
      
      const { data: stuckSessions, error } = await query;
      
      if (error) {
        log.error('❌ Error querying stuck sessions:', error);
        return { cleaned: 0, error: error.message };
      }
      
      log.info(`Found ${stuckSessions?.length || 0} stuck sessions`);
      
      if (!stuckSessions || stuckSessions.length === 0) {
        return { cleaned: 0 };
      }
      
      // Clean up each stuck session
      let cleanedCount = 0;
      for (const session of stuckSessions) {
        try {
          const { error: updateError } = await supabase
            .from('sessions')
            .update({ 
              status: 'completed',
              end_time: new Date().toISOString()
            })
            .eq('id', session.id);
          
          if (!updateError) {
            cleanedCount++;
            log.info(`Cleaned stuck session: ${session.local_session_id}`);
          } else {
            log.warn(`⚠️ Could not clean session ${session.local_session_id}:`, updateError.message);
          }
        } catch (sessionError) {
          log.warn(`⚠️ Error cleaning session ${session.local_session_id}:`, sessionError.message);
        }
      }
      
      return { cleaned: cleanedCount, total: stuckSessions.length };
    } catch (error) {
      log.error('❌ Cleanup stuck sessions failed:', error);
      return { cleaned: 0, error: error.message };
    }
  }

  // Load session mapping from storage (called during initialization)
  async loadSessionMapping() {
    try {
      // Use the restoreSessionMapping method which includes cleanup logic
      await this.restoreSessionMapping();
    } catch (error) {
      log.error('❌ Failed to load session mapping:', error);
    }
  }

  // ========================================
  // SURVEY DATA SYNC
  // ========================================

  /**
   * Sync pre-session survey data to Supabase (reactivated for AI feedback engine)
   */
  async syncPreSessionSurvey(localSessionId, clarityPre, energyPre, stressPre) {
    try {
      log.info(`Syncing pre-session survey for: ${localSessionId}`);
      
      // Get the Supabase session UUID
      const supabaseId = this.sessionMapping.get(localSessionId);
      if (!supabaseId) {
        log.warn('⚠️ No Supabase mapping found for local session, queuing for later sync');
        this.queueForSync('pre_session_survey', { localSessionId, clarityPre, energyPre, stressPre });
        return { success: true, queued: true };
      }

      // Get session data to determine correct device_id
      const sessionData = await this.verifySessionData(supabaseId);
      const deviceIdToUse = sessionData?.device_id || this.deviceId;
      
      // Get current authenticated user
      const currentUser = authService.getCurrentUser();
      
      // Use atomic function for pre-session survey insert
      const { data, error } = await supabase.rpc('insert_pre_session_survey_with_device_id', {
        device_id_value: deviceIdToUse,
        p_session_id: supabaseId,
        p_user_id: currentUser?.id || null,
        p_clarity_pre: clarityPre,
        p_energy_pre: energyPre,
        p_stress_pre: stressPre
      });

      if (error) {
        log.error('❌ Failed to sync pre-session survey:', error);
        this.queueForSync('pre_session_survey', { localSessionId, clarityPre, energyPre, stressPre });
        return { success: false, error: error.message };
      }

      log.info('Pre-session survey synced to Supabase');
      return { success: true, data };
    } catch (error) {
      log.error('❌ Error syncing pre-session survey:', error);
      this.queueForSync('pre_session_survey', { localSessionId, clarityPre, energyPre, stressPre });
      return { success: false, error: error.message };
    }
  }

  //     // Get current authenticated user
  //     const currentUser = authService.getCurrentUser();
      
  //     // Use atomic function for survey insert
  //     const { data, error } = await supabase.rpc('insert_pre_session_survey_with_device_id', {
  //       device_id_value: deviceIdToUse,
  //       p_session_id: supabaseId,
  //       p_user_id: currentUser?.id || null,
  //       p_clarity_pre: clarityPre,
  //       p_energy_pre: energyPre
  //     });

  //     if (error) {
  //       log.error('❌ Failed to sync pre-session survey:', error);
  //       this.queueForSync('pre_session_survey', { localSessionId, clarityPre, energyPre });
  //       return { success: false, error: error.message };
  //     }

  //     log.info('Pre-session survey synced to Supabase');
  //     return { success: true, data };
  //   } catch (error) {
  //     log.error('❌ Error syncing pre-session survey:', error);
  //     this.queueForSync('pre_session_survey', { localSessionId, clarityPre, energyPre });
  //     return { success: false, error: error.message };
  //   }
  // }

  /**
   * Sync post-session survey data to Supabase
   */
  async syncPostSessionSurvey(localSessionId, clarityPost, energyPost, stressPost, notesPost = null, symptoms = [], overallRating = null) {
    try {
      log.info(`Syncing post-session survey for: ${localSessionId}`);
      
      // Get the Supabase session UUID
      const supabaseId = this.sessionMapping.get(localSessionId);
      if (!supabaseId) {
        log.warn('⚠️ No Supabase mapping found for local session, queuing for later sync');
        this.queueForSync('post_session_survey', { 
          localSessionId, clarityPost, energyPost, stressPost, 
          notesPost, symptoms, overallRating 
        });
        return { success: true, queued: true };
      }

      // Get session data to determine correct device_id
      const sessionData = await this.verifySessionData(supabaseId);
      const deviceIdToUse = sessionData?.device_id || this.deviceId;

      // Get current authenticated user
      const currentUser = authService.getCurrentUser();
      
      // Use atomic function for survey insert with enhanced fields
      const { data, error } = await supabase.rpc('insert_post_session_survey_with_device_id', {
        device_id_value: deviceIdToUse,
        p_session_id: supabaseId,
        p_user_id: currentUser?.id || null,
        p_clarity_post: clarityPost,
        p_energy_post: energyPost,
        p_stress_post: stressPost,
        p_notes_post: notesPost,
        p_post_symptoms: symptoms || [],
        p_overall_rating: overallRating
      });

      if (error) {
        log.error('❌ Failed to sync post-session survey:', error);
        this.queueForSync('post_session_survey', { 
          localSessionId, clarityPost, energyPost, stressPost, 
          notesPost, symptoms, overallRating 
        });
        return { success: false, error: error.message };
      }

      log.info('Post-session survey synced to Supabase');
      return { success: true, data };
    } catch (error) {
      log.error('❌ Error syncing post-session survey:', error);
      this.queueForSync('post_session_survey', { 
        localSessionId, clarityPost, energyPost, stressPost, 
        notesPost, symptoms, overallRating 
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Sync intra-session response to Supabase
   */
  async syncIntraSessionResponse(localSessionId, cycleNumber, clarity, energy, stressPerception, sensations = [], spo2 = null, heartRate = null, timestamp = null) {
    try {
      log.info(`Syncing intra-session response for: ${localSessionId}, cycle: ${cycleNumber}`);
      
      // Get the Supabase session UUID
      const supabaseId = this.sessionMapping.get(localSessionId);
      if (!supabaseId) {
        log.warn('⚠️ No Supabase mapping found for local session, queuing for later sync');
        this.queueForSync('intra_session_response', { 
          localSessionId, cycleNumber, clarity, energy, stressPerception, 
          sensations, spo2, heartRate, timestamp 
        });
        return { success: true, queued: true };
      }

      // Get session data to determine correct device_id
      const sessionData = await this.verifySessionData(supabaseId);
      const deviceIdToUse = sessionData?.device_id || this.deviceId;

      // Get current authenticated user
      const currentUser = authService.getCurrentUser();
      
      // Use atomic function for intra-session response insert with enhanced fields
      const { data, error } = await supabase.rpc('insert_intra_session_response_with_device_id', {
        device_id_value: deviceIdToUse,
        p_session_id: supabaseId,
        p_user_id: currentUser?.id || null,
        p_cycle_number: cycleNumber,
        p_clarity: clarity,
        p_energy: energy,
        p_stress_perception: stressPerception,
        p_sensations: sensations,
        p_spo2_value: spo2,
        p_hr_value: heartRate,
        p_timestamp: timestamp ? new Date(timestamp).toISOString() : new Date().toISOString()
      });

      if (error) {
        log.error('❌ Failed to sync intra-session response:', error);
        this.queueForSync('intra_session_response', { 
          localSessionId, cycleNumber, clarity, energy, stressPerception, 
          sensations, spo2, heartRate, timestamp 
        });
        return { success: false, error: error.message };
      }

      log.info('Intra-session response synced to Supabase');
      return { success: true, data };
    } catch (error) {
      log.error('❌ Error syncing intra-session response:', error);
      this.queueForSync('intra_session_response', { 
        localSessionId, cycleNumber, clarity, energy, stressPerception, 
        sensations, spo2, heartRate, timestamp 
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get survey data for a session from Supabase
   */
  async getSessionSurveyData(sessionId) {
    try {
      log.info(`Fetching survey data from Supabase for session: ${sessionId}`);
      
      // Get main survey data
      const { data: surveyData, error: surveyError } = await supabase
        .from('session_surveys')
        .select('*')
        .eq('session_id', sessionId)
        .single();

      // Get intra-session responses
      const { data: responsesData, error: responsesError } = await supabase
        .from('intra_session_responses')
        .select('*')
        .eq('session_id', sessionId)
        .order('phase_number', { ascending: true });

      if (surveyError && surveyError.code !== 'PGRST116') { // PGRST116 = no rows found
        log.error('❌ Failed to fetch survey data:', surveyError);
        return { success: false, error: surveyError.message };
      }

      if (responsesError) {
        log.error('❌ Failed to fetch intra-session responses:', responsesError);
        return { success: false, error: responsesError.message };
      }

      const result = {
        sessionId,
        preSession: null,
        postSession: null,
        intraSessionResponses: responsesData || []
      };

      // Process survey data
      if (surveyData) {
        if (surveyData.clarity_pre !== null && surveyData.energy_pre !== null) {
          result.preSession = {
            clarity: surveyData.clarity_pre,
            energy: surveyData.energy_pre
          };
        }

        if (surveyData.clarity_post !== null && surveyData.energy_post !== null && surveyData.stress_post !== null) {
          result.postSession = {
            clarity: surveyData.clarity_post,
            energy: surveyData.energy_post,
            stress: surveyData.stress_post,
            notes: surveyData.notes_post || undefined
          };
        }
      }

      log.info(`Survey data fetched from Supabase for ${sessionId}`);
      return { success: true, data: result };
    } catch (error) {
      log.error('❌ Error fetching survey data from Supabase:', error);
      return { success: false, error: error.message };
    }
  }

  // Update protocol configuration for an existing session
  async updateSessionProtocolConfig(localSessionId, protocolConfig) {
    try {
      log.info(`Updating protocol config for session: ${localSessionId}`);
      
      // Get the Supabase session UUID
      const supabaseId = this.sessionMapping.get(localSessionId);
      if (!supabaseId) {
        log.warn('⚠️ No Supabase mapping found for local session, queuing for later sync');
        this.queueForSync('updateSessionProtocolConfig', { localSessionId, protocolConfig });
        return { success: true, queued: true };
      }

             const updates = {
         total_cycles: protocolConfig.totalCycles || 3,
         hypoxic_duration: protocolConfig.hypoxicDuration || 420, // 7 minutes
         hyperoxic_duration: protocolConfig.hyperoxicDuration || 180, // 3 minutes
         planned_total_cycles: protocolConfig.totalCycles || 3,
         planned_hypoxic_duration: protocolConfig.hypoxicDuration || 420,
         planned_hyperoxic_duration: protocolConfig.hyperoxicDuration || 180,
         updated_at: new Date().toISOString()
       };

      const { data, error } = await supabase
        .from('sessions')
        .update(updates)
        .eq('id', supabaseId)
        .select();

      if (error) {
        log.error('❌ Failed to update protocol config:', error);
        this.queueForSync('updateSessionProtocolConfig', { localSessionId, protocolConfig });
        return { success: false, error: error.message };
      }

      log.info('Protocol config updated in Supabase');
      return { success: true, data };
    } catch (error) {
      log.error('❌ Error updating protocol config in Supabase:', error);
      this.queueForSync('updateSessionProtocolConfig', { localSessionId, protocolConfig });
      return { success: false, error: error.message };
    }
  }

  // Helper method to update sessions with authenticated user_id
  async updateSessionsWithUserId(userId) {
    try {
      log.info('� Attempting to update sessions with authenticated user_id:', userId);
             const { data, error } = await supabase
         .from('sessions')
         .update({ user_id: userId })
         .is('user_id', null) // Only update sessions that are currently anonymous
         .select();

      if (error) {
        log.error('❌ Failed to update sessions with user_id:', error);
        this.queueForSync('updateSessionsWithUserId', { userId });
        return { success: false, error: error.message };
      }
      log.info(`Updated ${data.length} sessions with user_id: ${userId}`);
      return { success: true, data };
    } catch (error) {
      log.error('❌ Error updating sessions with user_id:', error);
      this.queueForSync('updateSessionsWithUserId', { userId });
      return { success: false, error: error.message };
    }
  }

  // Helper method to handle anonymous access
  async handleAnonymousAccess() {
    try {
      log.info('� Handling anonymous access for device_id:', this.deviceId);
             const { data, error } = await supabase
         .from('sessions')
         .select('id')
         .eq('device_id', this.deviceId)
         .is('user_id', null) // Only select anonymous sessions
         .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        log.error('❌ Failed to find anonymous session for device_id:', error);
        this.queueForSync('handleAnonymousAccess', { deviceId: this.deviceId });
        return { success: false, error: error.message };
      }

      if (data) {
        log.info('Found existing anonymous session for device_id:', this.deviceId);
        return { success: true, data };
      }

      // If no anonymous session, create one
      const newSession = {
        device_id: this.deviceId,
        user_id: null, // Explicitly set to null for anonymous access
        start_time: new Date().toISOString(),
        status: 'active',
        total_readings: 0,
        session_type: 'IHHT',
        default_hypoxia_level: null, // No default for anonymous
        // Protocol configuration
        total_cycles: 3,
        hypoxic_duration: 420, // 7 minutes
        hyperoxic_duration: 180, // 3 minutes
        // Planned protocol (same as total initially)
        planned_total_cycles: 3,
        planned_hypoxic_duration: 420,
        planned_hyperoxic_duration: 180,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        // Store the local session ID as metadata
        local_session_id: null // No local ID for anonymous sessions
      };

      const { data: createdSession, error: createError } = await supabase
        .from('sessions')
        .insert([newSession])
        .select();

      if (createError) {
        log.error('❌ Failed to create anonymous session:', createError);
        this.queueForSync('handleAnonymousAccess', { deviceId: this.deviceId });
        return { success: false, error: createError.message };
      }

      log.info('Created new anonymous session for device_id:', this.deviceId);
      return { success: true, data: createdSession };
    } catch (error) {
      log.error('❌ Error handling anonymous access:', error);
      this.queueForSync('handleAnonymousAccess', { deviceId: this.deviceId });
      return { success: false, error: error.message };
    }
  }

  // ========================================
  // CALIBRATION SESSION SYNC METHODS
  // ========================================

  // ========================================
  // NEW SURVEY METHODS FOR AI FEEDBACK ENGINE
  // ========================================

  async savePreSessionSurvey(sessionId, energy, mentalClarity, stress) {
    try {
      // validate inputs before processing
      if (!sessionId || energy == null || mentalClarity == null || stress == null) {
        throw new Error('Missing required survey parameters');
      }

      // Use the enhanced sync method
      const result = await this.syncPreSessionSurvey(sessionId, mentalClarity, energy, stress);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to save pre-session survey');
      }
      
      return result.data;
    } catch (error) {
      log.error('Error saving pre-session survey:', error);
      throw error;
    }
  }

  async savePostSessionSurvey(sessionId, energy, mentalClarity, breathingComfort, sessionSatisfaction, symptoms = [], overallRating = null) {
    try {
      // Validate inputs to ensure data integrity
      if (!sessionId || energy == null || mentalClarity == null || breathingComfort == null || sessionSatisfaction == null) {
        throw new Error('Missing required survey parameters');
      }

      // Map breathing comfort and session satisfaction to stress (temporary mapping)
      const stressPost = Math.round((breathingComfort + sessionSatisfaction) / 2);
      
      // Use the enhanced sync method
      const result = await this.syncPostSessionSurvey(
        sessionId, 
        mentalClarity, 
        energy, 
        stressPost,
        null, // notes
        symptoms,
        overallRating
      );
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to save post-session survey');
      }
      
      return result.data;
    } catch (error) {
      log.error('Error saving post-session survey:', error);
      throw error;
    }
  }

  async saveIntraSessionResponse(sessionId, cycleNumber, stressPerception, energy, clarity, sensations = [], spo2 = null, heartRate = null) {
    try {
      // Validate inputs to ensure all required parameters are present
      if (!sessionId || cycleNumber == null || stressPerception == null || energy == null || clarity == null) {
        throw new Error('Missing required intra-session parameters');
      }

      // Use the enhanced sync method
      const result = await this.syncIntraSessionResponse(
        sessionId,
        cycleNumber,
        clarity,
        energy,
        stressPerception,
        sensations,
        spo2,
        heartRate
      );
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to save intra-session response');
      }
      
      return result.data;
    } catch (error) {
      log.error('Error saving intra-session response:', error);
      throw error;
    }
  }

  // Sync all user sessions from Supabase to local database
  async syncSessionsToLocalDatabase() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        log.warn('No authenticated user for session sync');
        return { success: false, count: 0 };
      }

      log.info('🔄 Starting sync of Supabase sessions to local database...');
      log.info('User ID:', user.id);
      log.info('Device ID:', this.deviceId);
      
      // Initialize deviceId if not already done
      if (!this.deviceId) {
        await this.initializeDeviceId();
        log.info('Device ID after init:', this.deviceId);
      }
      
      // Simple query - just get all sessions for this user
      // Don't use complex OR queries that might fail
      const query = supabase
        .from('sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100); // Get up to 100 sessions
      
      const { data: sessions, error } = await query;

      if (error) {
        console.error('[SupabaseService] ❌ Error fetching sessions from Supabase:');
        console.error('  Message:', error?.message || 'Unknown error');
        if (error?.hint) console.error('  Hint:', error.hint);
        if (error?.details) console.error('  Details:', error.details);
        if (error?.code) console.error('  Code:', error.code);
        return { success: false, count: 0, error: error.message };
      }

      if (!sessions || sessions.length === 0) {
        log.info('No sessions found in Supabase');
        return { success: true, count: 0 };
      }

      log.info(`📥 Found ${sessions.length} sessions in Supabase to sync`);
      
      // Initialize local database
      await DatabaseService.init();
      
      let syncedCount = 0;
      for (const session of sessions) {
        try {
          // Check if session already exists locally
          const existingSession = await DatabaseService.getSession(session.local_session_id || session.id);
          
          if (!existingSession) {
            // Create the session in local database
            const sessionId = session.local_session_id || session.id;
            
            // First create the session
            await DatabaseService.createSession(
              sessionId,
              session.default_altitude_level || 6,
              {
                totalCycles: session.planned_total_cycles || 3,
                hypoxicDuration: session.planned_hypoxic_duration || 420,
                hyperoxicDuration: session.planned_hyperoxic_duration || 180
              }
            );
            
            // Then update it with the actual data
            if (session.status === 'completed' || session.end_time) {
              await DatabaseService.endSession(sessionId, {
                avgSpO2: session.average_spo2,
                avgHeartRate: session.average_heart_rate,
                minSpO2: session.min_spo2,
                maxSpO2: session.max_spo2,
                totalReadings: session.total_readings
              });
            }
            
            syncedCount++;
            log.info(`✅ Synced session ${sessionId} to local database`);
          }
        } catch (error) {
          log.error(`Failed to sync session ${session.id}:`, error);
        }
      }
      
      log.info(`✅ Sync complete: ${syncedCount} sessions added to local database`);
      return { success: true, count: syncedCount };
      
    } catch (error) {
      // Safe error logging without JSON.stringify which can fail
      const errorMessage = error?.message || error?.toString() || 'Unknown error';
      
      // Log error safely without JSON.stringify
      console.error('[SupabaseService] ❌ Error syncing sessions to local database:');
      console.error('  Message:', errorMessage);
      if (error?.stack) console.error('  Stack:', error.stack);
      if (error?.name) console.error('  Name:', error.name);
      if (error?.code) console.error('  Code:', error.code);
      
      return { success: false, count: 0, error: errorMessage };
    }
  }

}

export default new SupabaseService(); 