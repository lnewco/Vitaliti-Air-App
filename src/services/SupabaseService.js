import supabase from '../config/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import authService from '../auth/AuthService';
import logger from '../utils/logger';
import DatabaseService from './DatabaseService';

const log = logger.createModuleLogger('SupabaseService');

/**
 * SupabaseService - Manages cloud synchronization and data persistence
 *
 * Handles all interactions with Supabase backend including session syncing,
 * user authentication state, and offline-to-online data synchronization.
 */
class SupabaseService {
  constructor() {
    this.isOnline = true;
    this.syncQueue = [];
    this.deviceId = null;
    this.sessionMapping = new Map(); // local_session_id -> supabase_uuid
    this.lastSyncTime = null; // For throttling sync queue processing
  }

  /**
   * Initializes unique device identifier for session tracking
   * @returns {Promise<void>}
   */
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

  /**
   * Gets or creates the device ID
   * @returns {Promise<string>} Device identifier
   */
  async getDeviceId() {
    if (!this.deviceId) {
      await this.initializeDeviceId();
    }
    return this.deviceId;
  }



  /**
   * Verifies session data from Supabase
   * @param {string} supabaseSessionId - UUID of the session in Supabase
   * @returns {Promise<Object|null>} Session data or null if error
   */
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
        // Wrap in try-catch to prevent crashes
        this.processSyncQueue().catch(error => {
          log.error('❌ Sync queue processing error:', error);
        });
      }
    }, 10000); // Check every 10 seconds (more frequent)
  }

  // Session Management
  /**
   * Creates a new session in Supabase and maps it to local session
   * @param {Object} sessionData - Session data including localSessionId
   * @returns {Promise<Object>} Created session with Supabase ID
   */
  async createSession(sessionData) {
    try {
      // Get current authenticated user directly from Supabase
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      log.info('Supabase auth.getUser():', authUser?.id, authError);
      
      // Use Supabase user if available, otherwise null for anonymous sessions
      const userId = authUser?.id || null;
      log.info('Using user_id for session:', userId);
      
      // CRITICAL: Ensure we have the local session ID
      if (!sessionData.id) {
        log.error('❌ CRITICAL: No session ID provided to createSession');
        throw new Error('Session ID is required');
      }
      
      const session = {
        device_id: this.deviceId,
        user_id: userId, // Use the userId we got from Supabase auth
        start_time: new Date(sessionData.startTime).toISOString(),
        status: 'active',
        total_readings: 0,
        session_type: 'IHHT',
        default_hypoxia_level: sessionData.defaultHypoxiaLevel || null,
        // Altitude progression fields
        starting_altitude_level: sessionData.startingAltitudeLevel || 6,
        current_altitude_level: sessionData.startingAltitudeLevel || 6,
        recommended_altitude_level: sessionData.recommendedAltitude || null,
        user_adjusted_altitude: sessionData.userAdjustedAltitude || false,
        manual_selection_difference: sessionData.manualSelectionDiff || 0,
        session_subtype: sessionData.sessionSubtype || 'training',
        adaptive_system_enabled: sessionData.adaptiveEnabled !== false,
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

      log.info('Creating session with device_id:', this.deviceId, 'user_id:', userId || 'null');
      
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

  /**
   * Ends a session in Supabase with final statistics
   * @param {string} sessionId - Local session ID
   * @param {Object} stats - Session statistics
   * @param {number|null} startTime - Optional session start timestamp
   * @returns {Promise<Object>} Updated session data
   */
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
        // Don't queue if this is an old session (likely from a crash)
        const sessionAge = sessionId.match(/\d{13}/); // Extract timestamp from session ID
        if (sessionAge) {
          const timestamp = parseInt(sessionAge[0]);
          const age = Date.now() - timestamp;
          if (age > 3600000) { // Older than 1 hour
            log.warn('🗑️ Ignoring end request for old session (>1 hour):', sessionId);
            return null;
          }
        }
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
        // Altitude progression fields
        current_altitude_level: stats.currentAltitudeLevel || stats.startingAltitudeLevel || 6,
        total_mask_lifts: stats.totalMaskLifts || 0,
        total_altitude_adjustments: stats.totalAltitudeAdjustments || 0,
        actual_cycles_completed: stats.actualCyclesCompleted || stats.cyclesCompleted || 0,
        actual_hypoxic_time: stats.actualHypoxicTime || 0,
        actual_hyperoxic_time: stats.actualHyperoxicTime || 0,
        completion_percentage: stats.completionPercentage || 0,
        // SpO2 and HR fields
        avg_spo2: stats.avgSpO2,
        min_spo2: stats.minSpO2,
        max_spo2: stats.maxSpO2,
        avg_heart_rate: stats.avgHeartRate,
        min_heart_rate: stats.minHeartRate,
        max_heart_rate: stats.maxHeartRate,
        total_duration_seconds: totalDuration,
        updated_at: new Date().toISOString()
      };

      // Log what altitude data we're syncing
      log.info('📤 Syncing altitude progression data:', {
        currentAltitude: updates.current_altitude_level,
        maskLifts: updates.total_mask_lifts,
        adjustments: updates.total_altitude_adjustments,
        cycles: updates.actual_cycles_completed,
        completion: updates.completion_percentage
      });

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
      
      // Sync intra-session responses
      try {
        const localResponses = await DatabaseService.getIntraSessionResponses(sessionId);
        
        if (localResponses && localResponses.length > 0) {
          log.info(`📤 Syncing ${localResponses.length} intra-session responses`);
          
          // Get current user for user_id
          const { data: { user } } = await supabase.auth.getUser();
          const userId = user?.id;
          
          for (const response of localResponses) {
            const { error: syncError } = await supabase
              .from('intra_session_responses')
              .insert({
                session_id: supabaseSessionId,
                user_id: userId,
                cycle_number: response.cycle_number,
                phase_number: response.phase_number,
                clarity: response.clarity,
                energy: response.energy,
                stress: response.stress,
                stress_perception: response.stress_perception,
                sensations: response.sensations ? JSON.parse(response.sensations) : [],
                spo2_value: response.spo2_value,
                hr_value: response.hr_value,
                timestamp: new Date(response.timestamp).toISOString(),
                created_at: new Date().toISOString()
              });
            
            if (syncError) {
              log.error('Failed to sync intra-session response:', syncError);
            }
          }
          
          log.info('✅ Intra-session responses synced');
        }
      } catch (error) {
        log.error('Error syncing intra-session responses:', error);
        // Don't throw - allow session to complete even if survey sync fails
      }
      
      // Sync adaptive events
      try {
        const adaptiveEvents = await DatabaseService.getAdaptiveEvents(sessionId);
        
        if (adaptiveEvents && adaptiveEvents.length > 0) {
          log.info(`📤 Syncing ${adaptiveEvents.length} adaptive events`);
          
          for (const event of adaptiveEvents) {
            // Parse additional data if it's a string
            let additionalData = event.additional_data;
            if (typeof additionalData === 'string') {
              try {
                additionalData = JSON.parse(additionalData);
              } catch (e) {
                additionalData = {};
              }
            }
            
            const { error: syncError } = await supabase
              .from('session_adaptive_events')
              .insert({
                session_id: supabaseSessionId,
                event_type: event.event_type,
                event_timestamp: new Date(event.event_timestamp).toISOString(),
                altitude_phase_number: event.altitude_phase_number,
                recovery_phase_number: event.recovery_phase_number,
                current_altitude_level: event.current_altitude_level,
                spo2_value: event.spo2_value,
                additional_data: additionalData
              });
            
            if (syncError) {
              log.error('Failed to sync adaptive event:', syncError);
            }
          }
          
          log.info('✅ Adaptive events synced');
        }
      } catch (error) {
        log.error('Error syncing adaptive events:', error);
        // Don't throw - allow session to complete
      }
      
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
      log.info('🔍 First reading sample:', JSON.stringify(firstReading, null, 2));
      
      // CRITICAL: Check if the session_id is already a UUID (from fixed code)
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(localSessionId);
      
      let supabaseSessionId;
      if (isUUID) {
        log.info('✅ Session ID is already a Supabase UUID:', localSessionId);
        supabaseSessionId = localSessionId;
      } else {
        supabaseSessionId = this.sessionMapping.get(localSessionId);
        
        if (supabaseSessionId) {
          log.info('✅ Found existing session mapping:', localSessionId, '→', supabaseSessionId);
        } else {
          log.warn('⚠️ No session mapping found, attempting recovery for:', localSessionId);
          log.info('📋 Current session mappings:', Array.from(this.sessionMapping.entries()));
        }
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
        fio2_level: reading.fio2_level || reading.fio2Level || null,
        phase_type: reading.phase_type || reading.phaseType || null,
        cycle_number: reading.cycle_number || reading.cycleNumber || null,
        data_source: reading.data_source || 'unknown',  // Track mock vs real data
        created_at: new Date().toISOString()
      }));

      // Log the actual data being sent
      log.info('📤 Sending to Supabase RPC:');
      log.info('  - device_id:', deviceIdToUse);
      log.info('  - readings count:', supabaseReadings.length);
      log.info('  - first reading to insert:', JSON.stringify(supabaseReadings[0], null, 2));
      
      // Use atomic function that sets device_id and inserts in same transaction
      const { data, error } = await supabase.rpc('insert_readings_with_device_id', {
        device_id_value: deviceIdToUse,
        readings_data: supabaseReadings
      });

      if (error) {
        log.error('❌ CRITICAL: Batch insert failed!');
        log.error('  - Error code:', error.code);
        log.error('  - Error message:', error.message);
        log.error('  - Error details:', JSON.stringify(error, null, 2));
        log.error('  - Session ID used:', supabaseSessionId);
        log.error('  - Device ID used:', deviceIdToUse);
        this.queueForSync('addReadingsBatch', readings);
        return null;
      }

      log.info(`✅ Successfully inserted ${data?.length || 0} readings to Supabase`);
      if (data && data.length > 0) {
        log.info('  - First inserted reading ID:', data[0].reading_id);
      }
      return data;
    } catch (error) {
      log.error('❌ Error batch inserting readings:', error.message || error);
      // Only queue if there's a valid session ID
      const sessionId = readings[0]?.session_id || readings[0]?.sessionId;
      if (sessionId && sessionId !== 'unknown' && sessionId !== 'undefined') {
        this.queueForSync('addReadingsBatch', readings);
      } else {
        log.warn('⚠️ Skipping queue for invalid session:', sessionId);
      }
      return null;
    }
  }

  // Save adaptive event (mask lifts, dial adjustments, etc.)
  async saveAdaptiveEvent(event) {
    try {
      // Get the Supabase session ID if we have a local session ID
      let supabaseSessionId = event.session_id;
      if (this.sessionMapping.has(event.session_id)) {
        supabaseSessionId = this.sessionMapping.get(event.session_id);
      }

      const adaptiveEvent = {
        session_id: supabaseSessionId,
        event_type: event.event_type,
        event_timestamp: event.event_timestamp || new Date().toISOString(),
        altitude_phase_number: event.altitude_phase_number || null,
        recovery_phase_number: event.recovery_phase_number || null,
        current_altitude_level: event.current_altitude_level || null,
        spo2_value: event.spo2_value || null,
        additional_data: typeof event.additional_data === 'string' 
          ? JSON.parse(event.additional_data) 
          : event.additional_data || {},
        created_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('session_adaptive_events')
        .insert([adaptiveEvent])
        .select();

      if (error) {
        // Silently queue for later sync if RLS policy violation or auth issue
        if (error.code === '42501' || error.code === 'PGRST301') {
          log.info('Adaptive event queued for sync (auth/RLS):', event.event_type);
        } else {
          // Log other errors as warnings instead of errors to avoid popups
          log.warn('Adaptive event queued for sync:', event.event_type, error.message);
        }
        this.queueForSync('saveAdaptiveEvent', event);
        return null;
      }

      log.info(`✅ Adaptive event saved to Supabase: ${event.event_type}`);
      return data[0];
    } catch (error) {
      log.error('Error saving adaptive event:', error);
      this.queueForSync('saveAdaptiveEvent', event);
      return null;
    }
  }

  // Save phase metrics (SpO2 statistics per altitude/recovery phase)
  async savePhaseMetrics(metrics) {
    try {
      // Get the Supabase session ID if we have a local session ID
      let supabaseSessionId = metrics.session_id || metrics.sessionId;
      if (this.sessionMapping.has(supabaseSessionId)) {
        supabaseSessionId = this.sessionMapping.get(supabaseSessionId);
      }

      const phaseData = {
        session_id: supabaseSessionId,
        phase_type: metrics.phase_type || metrics.phaseType,
        phase_number: metrics.phase_number || metrics.phaseNumber,
        altitude_level: metrics.altitude_level || metrics.altitudeLevel || null,
        start_time: metrics.start_time || metrics.startTime,
        end_time: metrics.end_time || metrics.endTime || null,
        duration_seconds: metrics.duration_seconds || metrics.durationSeconds || null,
        min_spo2: metrics.min_spo2 || metrics.minSpO2 || null,
        max_spo2: metrics.max_spo2 || metrics.maxSpO2 || null,
        avg_spo2: metrics.avg_spo2 || metrics.avgSpO2 || null,
        spo2_readings_count: metrics.spo2_readings_count || metrics.spo2ReadingsCount || 0,
        mask_lift_count: metrics.mask_lift_count || metrics.maskLiftCount || 0,
        target_min_spo2: metrics.target_min_spo2 || metrics.targetMinSpO2 || null,
        target_max_spo2: metrics.target_max_spo2 || metrics.targetMaxSpO2 || null,
        recovery_trigger: metrics.recovery_trigger || metrics.recoveryTrigger || null,
        time_to_95_percent_seconds: metrics.time_to_95_percent_seconds || metrics.timeTo95PercentSeconds || null,
        time_above_95_percent_seconds: metrics.time_above_95_percent_seconds || metrics.timeAbove95PercentSeconds || null,
        created_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('session_phase_stats')
        .upsert([phaseData])
        .select();

      if (error) {
        // Silently queue for later sync if RLS policy violation or auth issue
        if (error.code === '42501' || error.code === 'PGRST301') {
          log.info('Phase metrics queued for sync (auth/RLS):', metrics.phase_type || metrics.phaseType);
        } else {
          log.warn('Phase metrics queued for sync:', error.message);
        }
        this.queueForSync('savePhaseMetrics', metrics);
        return null;
      }

      log.info(`✅ Phase metrics saved to Supabase: ${metrics.phase_type || metrics.phaseType} #${metrics.phase_number || metrics.phaseNumber}`);
      return data[0];
    } catch (error) {
      log.error('Error saving phase metrics:', error);
      this.queueForSync('savePhaseMetrics', metrics);
      return null;
    }
  }

  // Save cycle metrics to Supabase
  async saveCycleMetrics(metrics) {
    try {
      // Get the Supabase session ID if we have a local session ID
      let supabaseSessionId = metrics.sessionId;
      if (this.sessionMapping.has(metrics.sessionId)) {
        supabaseSessionId = this.sessionMapping.get(metrics.sessionId);
      }

      const cycleData = {
        session_id: supabaseSessionId,
        cycle_number: metrics.cycleNumber,
        
        // Hypoxic phase metrics
        hypoxic_phase_id: metrics.hypoxicPhaseId || null,
        desaturation_rate: metrics.desaturationRate || null,
        time_in_zone: metrics.timeInZone || 0,
        time_below_83: metrics.timeBelow83 || 0,
        spo2_volatility_in_zone: metrics.spo2VolatilityInZone || null,
        spo2_volatility_out_of_zone: metrics.spo2VolatilityOutOfZone || null,
        spo2_volatility_total: metrics.spo2VolatilityTotal || null,
        min_spo2: metrics.minSpO2 || null,
        hypoxic_duration: metrics.hypoxicDuration || null,
        
        // Recovery phase metrics
        recovery_phase_id: metrics.recoveryPhaseId || null,
        spo2_recovery_time: metrics.spo2RecoveryTime || null,
        hr_recovery_60s: metrics.hrRecovery60s || null,
        peak_hr_hypoxic: metrics.peakHrHypoxic || null,
        hr_at_recovery_start: metrics.hrAtRecoveryStart || null,
        recovery_duration: metrics.recoveryDuration || null,
        recovery_efficiency_score: metrics.recoveryEfficiencyScore || null,
        
        // Cycle score
        cycle_adaptation_score: metrics.cycleAdaptationScore || null,
        
        created_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('session_cycle_metrics')
        .upsert([cycleData])
        .select();

      if (error) {
        if (error.code === '42501' || error.code === 'PGRST301') {
          log.info('Cycle metrics queued for sync (auth/RLS)');
        } else {
          log.warn('Cycle metrics queued for sync:', error.message);
        }
        this.queueForSync('saveCycleMetrics', metrics);
        return null;
      }

      log.info(`✅ Cycle metrics saved to Supabase: Cycle ${metrics.cycleNumber}`);
      return data[0];
    } catch (error) {
      log.error('Error saving cycle metrics:', error);
      this.queueForSync('saveCycleMetrics', metrics);
      return null;
    }
  }

  // Save adaptation metrics to Supabase
  async saveAdaptationMetrics(metrics) {
    try {
      // Get the Supabase session ID if we have a local session ID
      let supabaseSessionId = metrics.sessionId;
      if (this.sessionMapping.has(metrics.sessionId)) {
        supabaseSessionId = this.sessionMapping.get(metrics.sessionId);
      }

      const adaptationData = {
        session_id: supabaseSessionId,
        
        // Hypoxic efficiency
        total_time_in_zone: metrics.totalTimeInZone || 0,
        avg_desaturation_rate: metrics.avgDesaturationRate || null,
        min_desaturation_rate: metrics.minDesaturationRate || null,
        max_desaturation_rate: metrics.maxDesaturationRate || null,
        desaturation_consistency: metrics.desaturationConsistency || null,
        therapeutic_efficiency_score: metrics.therapeuticEfficiencyScore || null,
        
        // Volatility
        avg_volatility_in_zone: metrics.avgVolatilityInZone || null,
        avg_volatility_out_of_zone: metrics.avgVolatilityOutOfZone || null,
        avg_volatility_total: metrics.avgVolatilityTotal || null,
        
        // Tolerance
        hypoxic_stability_score: metrics.hypoxicStabilityScore || 100,
        total_mask_lifts: metrics.totalMaskLifts || 0,
        avg_mask_lift_recovery_10s: metrics.avgMaskLiftRecovery10s || null,
        avg_mask_lift_recovery_15s: metrics.avgMaskLiftRecovery15s || null,
        
        // Recovery
        avg_spo2_recovery_time: metrics.avgSpo2RecoveryTime || null,
        min_spo2_recovery_time: metrics.minSpo2RecoveryTime || null,
        max_spo2_recovery_time: metrics.maxSpo2RecoveryTime || null,
        recovery_consistency: metrics.recoveryConsistency || null,
        avg_hr_recovery: metrics.avgHrRecovery || null,
        
        // Progression
        first_cycle_score: metrics.firstCycleScore || null,
        last_cycle_score: metrics.lastCycleScore || null,
        intra_session_improvement: metrics.intraSessionImprovement || null,
        
        // Overall
        session_adaptation_index: metrics.sessionAdaptationIndex || null,
        altitude_level_achieved: metrics.altitudeLevelAchieved || null,
        
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('session_adaptation_metrics')
        .upsert([adaptationData])
        .select();

      if (error) {
        if (error.code === '42501' || error.code === 'PGRST301') {
          log.info('Adaptation metrics queued for sync (auth/RLS)');
        } else {
          log.warn('Adaptation metrics queued for sync:', error.message);
        }
        this.queueForSync('saveAdaptationMetrics', metrics);
        return null;
      }

      log.info(`✅ Adaptation metrics saved to Supabase for session`);
      return data[0];
    } catch (error) {
      log.error('Error saving adaptation metrics:', error);
      this.queueForSync('saveAdaptationMetrics', metrics);
      return null;
    }
  }

  // Update session altitude level in real-time
  async updateSessionAltitudeLevel(sessionId, newLevel) {
    try {
      // Get the Supabase session ID if we have a local session ID  
      let supabaseSessionId = sessionId;
      if (this.sessionMapping.has(sessionId)) {
        supabaseSessionId = this.sessionMapping.get(sessionId);
      }

      const { data, error } = await supabase
        .from('sessions')
        .update({ 
          current_altitude_level: newLevel,
          total_altitude_adjustments: supabase.rpc('increment', { row_id: supabaseSessionId, column: 'total_altitude_adjustments' })
        })
        .eq('id', supabaseSessionId)
        .select();

      if (error) {
        // Try simpler update without increment
        const { data: retryData, error: retryError } = await supabase
          .from('sessions')
          .update({ current_altitude_level: newLevel })
          .eq('id', supabaseSessionId)
          .select();
          
        if (retryError) {
          log.warn('Failed to update session altitude level:', retryError.message);
          this.queueForSync('updateAltitudeLevel', { sessionId, newLevel });
          return null;
        }
        
        log.info(`✅ Updated session altitude level to ${newLevel}`);
        return retryData[0];
      }

      log.info(`✅ Updated session altitude level to ${newLevel} with increment`);
      return data[0];
    } catch (error) {
      log.error('Error updating session altitude level:', error);
      this.queueForSync('updateAltitudeLevel', { sessionId, newLevel });
      return null;
    }
  }



  // Sync Queue Management
  queueForSync(operation, data) {
    // Extract session ID to validate before queuing
    let sessionId = null;
    if (operation === 'addReadingsBatch' && Array.isArray(data) && data.length > 0) {
      sessionId = data[0]?.session_id || data[0]?.sessionId;
    } else if (operation === 'endSession' || operation === 'updateSessionCycle') {
      sessionId = data?.sessionId;
    } else if (operation === 'updateSessionProtocolConfig') {
      sessionId = data?.localSessionId;
    } else if (operation === 'createSession') {
      sessionId = data?.id || data?.localSessionId;
    } else {
      sessionId = data?.localSessionId || data?.sessionId || data?.session_id;
    }
    
    // CRITICAL: Don't queue items with invalid session IDs
    if (!sessionId || sessionId === 'unknown' || sessionId === 'undefined' || 
        sessionId === 'null' || sessionId === 'IHHT_TRAINING') {
      log.warn(`⚠️ Rejecting queue item with invalid session ID: ${sessionId} for operation: ${operation}`);
      return;
    }
    
    // Check for duplicate items to prevent infinite queuing
    if (operation.includes('survey') || operation.includes('response') || operation === 'endSession') {
      const isDuplicate = this.syncQueue.some(item => 
        item.operation === operation && 
        (item.data.localSessionId === data.localSessionId || 
         item.data.sessionId === data.sessionId)
      );
      
      if (isDuplicate) {
        log.info(`Skipping duplicate queue item: ${operation} for session ${data.localSessionId || data.sessionId}`);
        return;
      }
    }
    
    // CRITICAL: Limit endSession operations for old sessions
    if (operation === 'endSession') {
      const endSessionCount = this.syncQueue.filter(item => 
        item.operation === 'endSession' && 
        item.data.sessionId === data.sessionId
      ).length;
      
      if (endSessionCount >= 3) {
        log.warn(`⚠️ Too many endSession attempts for ${data.sessionId}, skipping`);
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
    
    // CRITICAL: Clean up old endSession operations that keep failing
    const beforeCleanup = this.syncQueue.length;
    this.syncQueue = this.syncQueue.filter(item => {
      // Remove endSession operations that are too old (> 5 minutes) or have too many retries
      if (item.operation === 'endSession') {
        const age = now - item.timestamp;
        if (age > 300000 || item.retryCount >= 3) { // 5 minutes or 3 retries
          log.warn(`🗑️ Removing old/failed endSession for ${item.data.sessionId}`);
          return false;
        }
      }
      return true;
    });
    
    if (beforeCleanup !== this.syncQueue.length) {
      log.info(`🧹 Removed ${beforeCleanup - this.syncQueue.length} old endSession operations`);
      await this.persistSyncQueue();
    }

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
          case 'saveAdaptiveEvent':
            success = await this.saveAdaptiveEvent(item.data) !== null;
            break;
          case 'savePhaseMetrics':
            success = await this.savePhaseMetrics(item.data) !== null;
            break;
          case 'saveCycleMetrics':
            success = await this.saveCycleMetrics(item.data) !== null;
            break;
          case 'saveAdaptationMetrics':
            success = await this.saveAdaptationMetrics(item.data) !== null;
            break;
          case 'updateAltitudeLevel':
            success = await this.updateSessionAltitudeLevel(item.data.sessionId, item.data.newLevel) !== null;
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
        } else {
          // Increment retry count for failed items
          item.retryCount = (item.retryCount || 0) + 1;
          log.warn(`⚠️ Failed ${item.operation}, retry count: ${item.retryCount}`);
        }
      } catch (error) {
        log.error(`❌ Failed to sync ${item.operation}:`, error);
        // Increment retry count on error
        item.retryCount = (item.retryCount || 0) + 1;
      }
    }

    // Remove successfully processed items
    this.syncQueue = this.syncQueue.filter(item => !processedItems.includes(item.id));
    await this.persistSyncQueue();

    log.info(`Sync complete. ${processedItems.length} items processed, ${this.syncQueue.length} remaining`);
  }



  // Public method to manually trigger cleanup of invalid queue items
  async clearInvalidQueueItems() {
    try {
      log.info('🧹 Manually clearing invalid queue items...');
      await this.loadSyncQueue();
      const originalLength = this.syncQueue.length;
      await this.cleanupOrphanedSyncItems();
      const removed = originalLength - this.syncQueue.length;
      log.info(`✅ Removed ${removed} invalid items from queue`);
      return removed;
    } catch (error) {
      log.error('❌ Failed to clear invalid queue items:', error);
      return 0;
    }
  }

  async clearSyncQueue() {
    this.syncQueue = [];
    await this.persistSyncQueue();
    log.info('Sync queue cleared');
  }


  async cleanupAbandonedSessions() {
    try {
      log.info('🧹 Checking for abandoned sessions from app crash/termination...');
      
      // Check if there's an active session in AsyncStorage that wasn't properly ended
      const activeSessionStr = await AsyncStorage.getItem('activeSession');
      if (activeSessionStr) {
        const activeSession = JSON.parse(activeSessionStr);
        const sessionAge = Date.now() - activeSession.startTime;
        
        // If session is older than 30 minutes, it's likely abandoned
        if (sessionAge > 1800000) { // 30 minutes
          log.warn(`🗑️ Found abandoned session: ${activeSession.id}, age: ${Math.floor(sessionAge/60000)} minutes`);
          
          // Mark it as abandoned in local database
          try {
            await DatabaseService.endSession(activeSession.id, {
              avgSpO2: null,
              avgHeartRate: null,
              endReason: 'abandoned'
            }, activeSession.startTime);
            log.info('✅ Marked abandoned session as ended in local DB');
          } catch (dbError) {
            log.error('Failed to end abandoned session in DB:', dbError);
          }
          
          // Clear the active session
          await AsyncStorage.removeItem('activeSession');
          log.info('✅ Cleared abandoned session from storage');
        }
      }
    } catch (error) {
      log.error('❌ Error cleaning up abandoned sessions:', error);
    }
  }

  async initialize() {
    try {
      log.info('� Initializing SupabaseService...');
      
      // Clean up any abandoned sessions FIRST
      await this.cleanupAbandonedSessions();
      
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
      
      // Clean up orphaned sync items with undefined sessionIds BEFORE checking size
      await this.cleanupOrphanedSyncItems();
      
      // Clean up old endSession operations from crashed/terminated sessions
      const now = Date.now();
      const beforeEndSessionCleanup = this.syncQueue.length;
      this.syncQueue = this.syncQueue.filter(item => {
        if (item.operation === 'endSession') {
          const sessionId = item.data?.sessionId;
          // Remove endSession operations for sessions that don't exist in our mapping
          // and are older than 1 minute (likely from a crash)
          if (!this.sessionMapping.has(sessionId) && (now - item.timestamp) > 60000) {
            log.warn(`🗑️ Removing orphaned endSession for non-existent session: ${sessionId}`);
            return false;
          }
        }
        return true;
      });
      
      if (beforeEndSessionCleanup !== this.syncQueue.length) {
        log.info(`✅ Cleaned ${beforeEndSessionCleanup - this.syncQueue.length} orphaned endSession operations`);
        await this.persistSyncQueue();
      }
      
      // After cleanup, if still too many items OR if we have problematic items, clear the queue
      const hasProblematicItems = this.syncQueue.some(item => 
        item.operation === 'intra_session_response'
      );
      
      if (this.syncQueue.length > 50 || hasProblematicItems) {
        log.info(`🧹 Clearing sync queue due to: ${this.syncQueue.length} items or problematic operations`);
        this.syncQueue = [];
        await this.persistSyncQueue();
        log.info('Sync queue cleared completely');
      }
      
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
  /**
   * Syncs pre-session survey data to Supabase
   * @param {string} localSessionId - Local session ID
   * @param {number} clarityPre - Mental clarity rating (1-5)
   * @param {number} energyPre - Energy level rating (1-5)
   * @param {number} stressPre - Stress level rating (1-5)
   * @returns {Promise<void>}
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
      
      // Direct insert into session_surveys table (no device_id column exists)
      const { data, error } = await supabase
        .from('session_surveys')
        .insert([{
          session_id: supabaseId,
          user_id: currentUser?.id || null,
          clarity_pre: clarityPre,
          energy_pre: energyPre,
          stress_pre: stressPre,
          created_at: new Date().toISOString()
        }])
        .select();

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
  /**
   * Syncs post-session survey data to Supabase
   * @param {string} localSessionId - Local session ID
   * @param {number} clarityPost - Mental clarity rating (1-5)
   * @param {number} energyPost - Energy level rating (1-5)
   * @param {number} stressPost - Stress level rating (1-5)
   * @param {string|null} notesPost - Optional session notes
   * @param {Array} symptoms - Array of symptom strings
   * @param {number|null} overallRating - Overall session rating (1-5)
   * @returns {Promise<void>}
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

      // Get current authenticated user directly from Supabase
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const userId = authUser?.id || null;
      
      // Use upsert to avoid duplicate constraint violations
      const { data, error } = await supabase
        .from('intra_session_responses')
        .upsert({
          session_id: supabaseId,
          user_id: userId,
          cycle_number: cycleNumber,
          phase_number: cycleNumber, // Using cycle_number as phase_number
          clarity: clarity,
          energy: energy,
          stress_perception: stressPerception,
          stress: stressPerception, // Also set stress field for compatibility
          sensations: sensations || [],
          spo2_value: spo2,
          hr_value: heartRate,
          timestamp: timestamp ? new Date(timestamp).toISOString() : new Date().toISOString()
        }, {
          onConflict: 'session_id,cycle_number,phase_number'
        })
        .select();

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