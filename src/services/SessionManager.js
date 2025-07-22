import AsyncStorage from '@react-native-async-storage/async-storage';
import DatabaseService from './DatabaseService';

class SessionManager {
  constructor() {
    this.currentSession = null;
    this.isActive = false;
    this.startTime = null;
    this.readingBuffer = [];
    this.batchInterval = null;
    this.listeners = [];
    
    // Buffer settings
    this.BATCH_SIZE = 50; // Insert readings in batches of 50
    this.BATCH_INTERVAL = 2000; // Every 2 seconds
  }

  // Event system for UI updates
  addListener(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  notify(event, data) {
    this.listeners.forEach(listener => {
      try {
        listener(event, data);
      } catch (error) {
        console.error('Session listener error:', error);
      }
    });
  }

  // Session lifecycle
  async startSession() {
    if (this.isActive) {
      throw new Error('Session already active');
    }

    try {
      // Generate unique session ID
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Initialize database if needed
      if (!DatabaseService.db) {
        await DatabaseService.init();
      }

      // Create session in database
      await DatabaseService.createSession(sessionId);

      // Set session state
      this.currentSession = {
        id: sessionId,
        startTime: Date.now(),
        readingCount: 0,
        lastReading: null
      };

      this.isActive = true;
      this.startTime = Date.now();
      this.readingBuffer = [];

      // Start batch processing
      this.startBatchProcessing();

      // Save session state
      await AsyncStorage.setItem('activeSession', JSON.stringify(this.currentSession));

      console.log(`🎬 Session started: ${sessionId}`);
      this.notify('sessionStarted', this.currentSession);

      return sessionId;
    } catch (error) {
      console.error('❌ Failed to start session:', error);
      throw error;
    }
  }

  async stopSession() {
    if (!this.isActive || !this.currentSession) {
      throw new Error('No active session');
    }

    try {
      // Flush any remaining readings
      await this.flushReadingBuffer();
      
      // Stop batch processing
      this.stopBatchProcessing();

      // End session in database and get stats
      const stats = await DatabaseService.endSession(this.currentSession.id);

      // Update session object
      const completedSession = {
        ...this.currentSession,
        endTime: Date.now(),
        stats,
        status: 'completed'
      };

      console.log(`🏁 Session completed: ${this.currentSession.id}`, stats);

      // Reset state
      this.isActive = false;
      this.currentSession = null;
      this.startTime = null;
      this.readingBuffer = [];

      // Clear active session storage
      await AsyncStorage.removeItem('activeSession');

      this.notify('sessionEnded', completedSession);

      return completedSession;
    } catch (error) {
      console.error('❌ Failed to stop session:', error);
      throw error;
    }
  }

  async pauseSession() {
    if (!this.isActive) return;

    this.isActive = false;
    await this.flushReadingBuffer();
    this.stopBatchProcessing();
    
    console.log('⏸️ Session paused');
    this.notify('sessionPaused', this.currentSession);
  }

  async resumeSession() {
    if (this.isActive || !this.currentSession) return;

    this.isActive = true;
    this.startBatchProcessing();
    
    console.log('▶️ Session resumed');
    this.notify('sessionResumed', this.currentSession);
  }

  // Data collection
  addReading(bleData) {
    if (!this.isActive || !this.currentSession) {
      return; // Ignore readings when no active session
    }

    const reading = {
      sessionId: this.currentSession.id,
      timestamp: Date.now(),
      spo2: bleData.spo2,
      heartRate: bleData.heartRate,
      signalStrength: bleData.signalStrength || 0,
      isFingerDetected: bleData.isFingerDetected || false
    };

    // Add to buffer
    this.readingBuffer.push(reading);

    // Update session state
    this.currentSession.readingCount++;
    this.currentSession.lastReading = reading;

    // Notify listeners for real-time UI updates
    this.notify('newReading', reading);

    // Auto-flush if buffer is full
    if (this.readingBuffer.length >= this.BATCH_SIZE) {
      this.flushReadingBuffer();
    }
  }

  async flushReadingBuffer() {
    if (this.readingBuffer.length === 0) return;

    try {
      const readings = [...this.readingBuffer];
      this.readingBuffer = [];
      
      await DatabaseService.addReadingsBatch(readings);
      console.log(`💾 Flushed ${readings.length} readings to database`);
    } catch (error) {
      console.error('❌ Failed to flush readings:', error);
      // Put readings back in buffer on error
      this.readingBuffer = [...this.readingBuffer, ...readings];
    }
  }

  startBatchProcessing() {
    this.batchInterval = setInterval(async () => {
      await this.flushReadingBuffer();
    }, this.BATCH_INTERVAL);
  }

  stopBatchProcessing() {
    if (this.batchInterval) {
      clearInterval(this.batchInterval);
      this.batchInterval = null;
    }
  }

  // Session info
  getSessionDuration() {
    if (!this.startTime) return 0;
    return Date.now() - this.startTime;
  }

  getFormattedDuration() {
    const duration = this.getSessionDuration();
    const hours = Math.floor(duration / 3600000);
    const minutes = Math.floor((duration % 3600000) / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  getCurrentSession() {
    return this.currentSession;
  }

  isSessionActive() {
    return this.isActive;
  }

  // Recovery methods
  async recoverSession() {
    try {
      const savedSession = await AsyncStorage.getItem('activeSession');
      if (savedSession) {
        const session = JSON.parse(savedSession);
        
        // Check if session is still in database and active
        const dbSession = await DatabaseService.getSession(session.id);
        if (dbSession && dbSession.status === 'active') {
          this.currentSession = session;
          this.isActive = true;
          this.startTime = session.startTime;
          this.startBatchProcessing();
          
          console.log(`🔄 Recovered session: ${session.id}`);
          this.notify('sessionRecovered', session);
          return session;
        } else {
          // Clean up orphaned session
          await AsyncStorage.removeItem('activeSession');
        }
      }
    } catch (error) {
      console.error('❌ Failed to recover session:', error);
    }
    return null;
  }

  // Session history
  async getAllSessions() {
    try {
      return await DatabaseService.getAllSessions();
    } catch (error) {
      console.error('❌ Failed to get sessions:', error);
      return [];
    }
  }

  async getSessionWithData(sessionId) {
    try {
      const session = await DatabaseService.getSession(sessionId);
      const readings = await DatabaseService.getSessionReadings(sessionId, true); // Valid only
      const stats = await DatabaseService.getSessionStats(sessionId);
      
      return {
        ...session,
        readings,
        stats
      };
    } catch (error) {
      console.error('❌ Failed to get session data:', error);
      return null;
    }
  }

  // Data management
  async exportSession(sessionId) {
    try {
      const sessionData = await this.getSessionWithData(sessionId);
      if (!sessionData) {
        throw new Error('Session not found');
      }

      const exportData = {
        sessionInfo: {
          id: sessionData.id,
          startTime: sessionData.start_time,
          endTime: sessionData.end_time,
          duration: sessionData.end_time - sessionData.start_time,
          totalReadings: sessionData.total_readings
        },
        statistics: sessionData.stats,
        readings: sessionData.readings.map(reading => ({
          timestamp: reading.timestamp,
          spo2: reading.spo2,
          heartRate: reading.heart_rate,
          signalStrength: reading.signal_strength
        }))
      };

      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      console.error('❌ Failed to export session:', error);
      throw error;
    }
  }

  async clearAllData() {
    try {
      await this.stopSession(); // Stop any active session
      await DatabaseService.clearAllData();
      await AsyncStorage.removeItem('activeSession');
      
      console.log('🗑️ All session data cleared');
      this.notify('dataCleared');
    } catch (error) {
      console.error('❌ Failed to clear data:', error);
      throw error;
    }
  }

  async getStorageInfo() {
    try {
      return await DatabaseService.getStorageInfo();
    } catch (error) {
      console.error('❌ Failed to get storage info:', error);
      return { sessionCount: 0, readingCount: 0, estimatedSizeMB: 0 };
    }
  }
}

export default new SessionManager(); 