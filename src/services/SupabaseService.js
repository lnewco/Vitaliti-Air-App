import supabase from '../config/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

class SupabaseService {
  constructor() {
    this.isOnline = true;
    this.syncQueue = [];
    this.deviceId = null;
    this.sessionMapping = new Map(); // local_session_id -> supabase_uuid
  }

  async initializeDeviceId() {
    try {
      let deviceId = await AsyncStorage.getItem('deviceId');
      if (!deviceId) {
        deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await AsyncStorage.setItem('deviceId', deviceId);
      }
      this.deviceId = deviceId;
      console.log('📱 Device ID initialized:', deviceId);
    } catch (error) {
      console.error('❌ Failed to initialize device ID:', error);
    }
  }

  async setupNetworkMonitoring() {
    // Simplified: assume we're always online
    // If Supabase calls fail, they'll be queued automatically
    this.isOnline = true;
    console.log('🌐 Network monitoring: Simplified mode (assuming online)');
    
    // Try to process any existing sync queue every 30 seconds
    setInterval(() => {
      if (this.syncQueue.length > 0) {
        console.log('🔄 Attempting to process sync queue...');
        this.processSyncQueue();
      }
    }, 30000); // Check every 30 seconds
  }

  // Session Management
  async createSession(sessionData) {
    try {
      const session = {
        device_id: this.deviceId,
        start_time: new Date(sessionData.startTime).toISOString(),
        status: 'active',
        total_readings: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        // Store the local session ID as metadata
        local_session_id: sessionData.id
      };

      const { data, error } = await supabase
        .from('sessions')
        .insert([session])
        .select();

      if (error) {
        console.error('❌ Supabase session creation failed, queuing for sync:', error.message);
        this.queueForSync('createSession', sessionData);
        return null;
      }

      console.log('☁️ Session created in Supabase:', data[0].id);
      
      // Store the mapping between local and Supabase session IDs
      this.sessionMapping.set(sessionData.id, data[0].id);
      
      return data[0];
    } catch (error) {
      console.error('❌ Error creating session, queuing for sync:', error.message);
      this.queueForSync('createSession', sessionData);
      return null;
    }
  }

  async endSession(sessionId, stats) {
    try {
      // Get the Supabase UUID for this local session ID
      const supabaseSessionId = this.sessionMapping.get(sessionId);
      if (!supabaseSessionId) {
        console.warn('⚠️ No Supabase session mapping found for ending session:', sessionId);
        this.queueForSync('endSession', { sessionId, stats });
        return null;
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
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('sessions')
        .update(updates)
        .eq('id', supabaseSessionId)
        .select();

      if (error) {
        console.error('❌ Supabase session update failed:', error);
        this.queueForSync('endSession', { sessionId, stats });
        return null;
      }

      console.log('☁️ Session ended in Supabase:', sessionId);
      return data[0];
    } catch (error) {
      console.error('❌ Error ending session:', error);
      this.queueForSync('endSession', { sessionId, stats });
      return null;
    }
  }

  // Reading Management
  async addReading(reading) {
    try {
      // Get the Supabase UUID for this local session ID
      const supabaseSessionId = this.sessionMapping.get(reading.sessionId);
      if (!supabaseSessionId) {
        console.warn('⚠️ No Supabase session mapping found for:', reading.sessionId);
        this.queueForSync('addReading', reading);
        return null;
      }

      const supabaseReading = {
        session_id: supabaseSessionId,
        timestamp: new Date(reading.timestamp).toISOString(),
        spo2: reading.spo2,
        heart_rate: reading.heartRate,
        signal_strength: reading.signalStrength,
        is_valid: reading.spo2 !== null && reading.heartRate !== null && reading.isFingerDetected,
        created_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('readings')
        .insert([supabaseReading])
        .select();

      if (error) {
        console.error('❌ Supabase reading insert failed, queuing for sync:', error.message);
        this.queueForSync('addReading', reading);
        return null;
      }

      return data[0];
    } catch (error) {
      console.error('❌ Error adding reading, queuing for sync:', error.message);
      this.queueForSync('addReading', reading);
      return null;
    }
  }

  async addReadingsBatch(readings) {
    try {
      // Check if we have all the session mappings
      const firstReading = readings[0];
      if (!firstReading) return null;
      
      const supabaseSessionId = this.sessionMapping.get(firstReading.sessionId);
      if (!supabaseSessionId) {
        console.warn('⚠️ No Supabase session mapping found for batch:', firstReading.sessionId);
        this.queueForSync('addReadingsBatch', readings);
        return null;
      }

      const supabaseReadings = readings.map(reading => ({
        session_id: supabaseSessionId,
        timestamp: new Date(reading.timestamp).toISOString(),
        spo2: reading.spo2,
        heart_rate: reading.heartRate,
        signal_strength: reading.signalStrength,
        is_valid: reading.spo2 !== null && reading.heartRate !== null && reading.isFingerDetected,
        created_at: new Date().toISOString()
      }));

      const { data, error } = await supabase
        .from('readings')
        .insert(supabaseReadings)
        .select();

      if (error) {
        console.error('❌ Supabase batch insert failed:', error);
        this.queueForSync('addReadingsBatch', readings);
        return null;
      }

      console.log(`☁️ Batch inserted ${data.length} readings to Supabase`);
      return data;
    } catch (error) {
      console.error('❌ Error batch inserting readings:', error);
      this.queueForSync('addReadingsBatch', readings);
      return null;
    }
  }

  // Data Retrieval
  async getAllSessions() {
    try {
      if (!this.isOnline) {
        console.log('📱 Offline: Cannot fetch sessions from Supabase');
        return [];
      }

      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('device_id', this.deviceId)
        .order('start_time', { ascending: false })
        .limit(20);

      if (error) {
        console.error('❌ Error fetching sessions:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('❌ Error getting sessions:', error);
      return [];
    }
  }

  async getSessionReadings(sessionId, validOnly = false) {
    try {
      if (!this.isOnline) {
        console.log('📱 Offline: Cannot fetch readings from Supabase');
        return [];
      }

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
        console.error('❌ Error fetching readings:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('❌ Error getting readings:', error);
      return [];
    }
  }

  // Sync Queue Management
  queueForSync(operation, data) {
    const syncItem = {
      id: Date.now() + Math.random(),
      operation,
      data,
      timestamp: Date.now()
    };
    
    this.syncQueue.push(syncItem);
    console.log(`📤 Queued for sync: ${operation}`, syncItem.id);
    
    // Persist queue to storage
    this.persistSyncQueue();
  }

  async persistSyncQueue() {
    try {
      await AsyncStorage.setItem('supabaseSyncQueue', JSON.stringify(this.syncQueue));
    } catch (error) {
      console.error('❌ Failed to persist sync queue:', error);
    }
  }

  async loadSyncQueue() {
    try {
      const queue = await AsyncStorage.getItem('supabaseSyncQueue');
      if (queue) {
        this.syncQueue = JSON.parse(queue);
        console.log(`📥 Loaded ${this.syncQueue.length} items from sync queue`);
      }
    } catch (error) {
      console.error('❌ Failed to load sync queue:', error);
    }
  }

  async processSyncQueue() {
    if (!this.isOnline || this.syncQueue.length === 0) return;

    console.log(`🔄 Processing ${this.syncQueue.length} sync queue items`);
    
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
          case 'addReading':
            success = await this.addReading(item.data) !== null;
            break;
          case 'addReadingsBatch':
            success = await this.addReadingsBatch(item.data) !== null;
            break;
        }

        if (success) {
          processedItems.push(item.id);
          console.log(`✅ Synced: ${item.operation}`, item.id);
        }
      } catch (error) {
        console.error(`❌ Failed to sync ${item.operation}:`, error);
      }
    }

    // Remove successfully processed items
    this.syncQueue = this.syncQueue.filter(item => !processedItems.includes(item.id));
    await this.persistSyncQueue();

    console.log(`✅ Sync complete. ${processedItems.length} items processed, ${this.syncQueue.length} remaining`);
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
    console.log('🗑️ Sync queue cleared');
  }

  async initialize() {
    await this.initializeDeviceId();
    await this.setupNetworkMonitoring();
    await this.loadSyncQueue();
    
    if (this.isOnline && this.syncQueue.length > 0) {
      await this.processSyncQueue();
    }
  }
}

export default new SupabaseService(); 