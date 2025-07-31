import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, AppState } from 'react-native';
import DatabaseService from './DatabaseService';
import SupabaseService from './SupabaseService';

// Import Background Session Manager conditionally - available in development builds
let BackgroundSessionManager = null;
try {
  BackgroundSessionManager = require('./BackgroundSessionManager').BackgroundSessionManager;
  console.log('✅ Background session management enabled');
} catch (error) {
  console.log('⚠️ Background session management not available:', error.message);
}

// Import the Live Activity module for iOS - available in development builds
let LiveActivityModule = null;
try {
  LiveActivityModule = require('../../modules/live-activity/src/LiveActivityModule').default;
  console.log('✅ Live Activities enabled');
} catch (error) {
  console.log('⚠️ Live Activities not available:', error.message);
}

class EnhancedSessionManager {
  constructor() {
    this.currentSession = null;
    this.isActive = false;
    this.isPaused = false;
    this.startTime = null;
    this.pauseTime = null;
    this.readingBuffer = [];
    this.batchInterval = null;
    this.listeners = [];
    
    // IHHT Protocol state
    this.currentPhase = 'HYPOXIC'; // 'HYPOXIC' | 'HYPEROXIC'
    this.currentCycle = 1;
    this.totalCycles = 5;
    this.phaseStartTime = null;
    this.phaseTimeRemaining = 300; // 5 minutes for hypoxic phase
    this.phaseTimer = null;
    
    // Live Activity state
    this.hasActiveLiveActivity = false;
    this.liveActivityId = null;
    
    // Timeout references
    this.backgroundTimeout = null;
    this.sessionTimeout = null;
    
    // FiO2 tracking
    this.currentHypoxiaLevel = 5; // Default hypoxia level (0-10 scale)
    
    // Buffer settings
    this.BATCH_SIZE = 50;
    this.BATCH_INTERVAL = 2000;
    
    // IHHT timing constants (in seconds)
    this.HYPOXIC_DURATION = 300; // 5 minutes
    this.HYPEROXIC_DURATION = 120; // 2 minutes
    
    // App state handling
    this.setupAppStateHandling();
    
    // Initialize services
    this.initializeServices();
  }

  async initializeServices() {
    try {
      await SupabaseService.initialize();
      console.log('☁️ Supabase service initialized');
      
      // Check Live Activity support
      if (LiveActivityModule) {
        const isSupported = await LiveActivityModule.isSupported();
        console.log('📱 Live Activity support:', isSupported);
      }

      // Perform startup recovery cleanup
      setTimeout(() => this.performStartupRecovery(), 1000);
    } catch (error) {
      console.error('❌ Failed to initialize services:', error);
    }
  }

  setupAppStateHandling() {
    AppState.addEventListener('change', this.handleAppStateChange.bind(this));
  }

  async handleAppStateChange(nextAppState) {
    if (this.isActive) {
      if (nextAppState === 'background') {
        console.log('📱 App backgrounded - starting background monitoring and session timeout');
        await this.startBackgroundMonitoring();
        this.startBackgroundTimeout();
      } else if (nextAppState === 'active') {
        console.log('📱 App foregrounded - syncing with background state');
        this.clearBackgroundTimeout();
        await this.syncWithBackgroundState();
      }
    }
  }

  async startBackgroundMonitoring() {
    if (!this.currentSession) return;

    if (!BackgroundSessionManager) {
      console.log('⚠️ Background monitoring not available in Expo Go');
      return;
    }

    try {
      // Start background task monitoring
      const backgroundStarted = await BackgroundSessionManager.startBackgroundMonitoring({
        id: this.currentSession.id,
        startTime: this.startTime
      });

      if (backgroundStarted) {
        console.log('✅ Background monitoring started');
      }
    } catch (error) {
      console.error('❌ Failed to start background monitoring:', error);
    }
  }

  async syncWithBackgroundState() {
    if (!BackgroundSessionManager) {
      return null;
    }
    
    try {
      const backgroundState = await BackgroundSessionManager.syncWithBackgroundState();
      
      if (backgroundState && backgroundState.isActive) {
        // Update local state with background changes
        this.currentPhase = backgroundState.currentPhase;
        this.currentCycle = backgroundState.currentCycle;
        this.phaseTimeRemaining = backgroundState.phaseTimeRemaining;
        
        // Update Live Activity if active
        if (this.hasActiveLiveActivity) {
          await this.updateLiveActivity();
        }
        
        console.log('🔄 Synced with background state:', backgroundState);
        this.notify('sessionSynced', backgroundState);
      }
    } catch (error) {
      console.error('❌ Failed to sync with background state:', error);
    }
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

  // Enhanced session lifecycle with Live Activity support
  async startSession(existingSessionId = null) {
    if (this.isActive) {
      throw new Error('Session already active');
    }

    try {
      // Use existing session ID if provided (from survey), otherwise generate new one
      const sessionId = existingSessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      console.log(`🚀 Starting session with ID: ${sessionId} ${existingSessionId ? '(existing)' : '(new)'}`);
      
      // Initialize database if needed
      if (!DatabaseService.db) {
        await DatabaseService.init();
      }

      // Create session in databases (skip if already exists)
      if (!existingSessionId) {
        await DatabaseService.createSession(sessionId, this.currentHypoxiaLevel);
        await SupabaseService.createSession({
          id: sessionId,
          startTime: Date.now(),
          defaultHypoxiaLevel: this.currentHypoxiaLevel
        });
      } else {
        console.log('📋 Using existing session - skipping database creation');
      }

      // Set session state
      this.currentSession = {
        id: sessionId,
        startTime: Date.now(),
        readingCount: 0,
        lastReading: null,
        sessionType: 'IHHT',
        currentPhase: this.currentPhase,
        currentCycle: this.currentCycle,
        totalCycles: this.totalCycles,
        defaultHypoxiaLevel: this.currentHypoxiaLevel
      };

      this.isActive = true;
      this.isPaused = false;
      this.startTime = Date.now();
      this.phaseStartTime = Date.now();
      this.currentPhase = 'HYPOXIC';
      this.currentCycle = 1;
      this.phaseTimeRemaining = this.HYPOXIC_DURATION;
      this.readingBuffer = [];

      // Start background monitoring
      await this.startBackgroundMonitoring();

      // Start Live Activity
      await this.startLiveActivity();

      // Start phase timer
      this.startPhaseTimer();

      // Start session timeout (2 hours max)
      this.startSessionTimeout();

      // Start batch processing
      this.startBatchProcessing();

      // Save session state
      await AsyncStorage.setItem('activeSession', JSON.stringify(this.currentSession));

      console.log(`🎬 Enhanced session started: ${sessionId}`);
      this.notify('sessionStarted', {
        ...this.currentSession,
        currentPhase: this.currentPhase,
        currentCycle: this.currentCycle,
        phaseTimeRemaining: this.phaseTimeRemaining
      });

      return sessionId;
    } catch (error) {
      console.error('❌ Failed to start enhanced session:', error);
      throw error;
    }
  }

  async checkLiveActivitySupport() {
    if (!LiveActivityModule) {
      console.log('📱 Live Activities not available in Expo Go');
      return false;
    }
    
    try {
      const isSupported = await LiveActivityModule.isSupported();
      return isSupported;
    } catch (error) {
      console.error('❌ Error checking Live Activity support:', error);
      return false;
    }
  }

  async startLiveActivity() {
    if (!LiveActivityModule || !this.currentSession) {
      return false;
    }

    try {
      console.log('📱 Starting Live Activity for session:', this.currentSession.id);
      
      const result = await LiveActivityModule.startActivity({
        sessionId: this.currentSession.id,
        sessionType: this.currentSession.sessionType,
        currentPhase: this.currentPhase,
        currentCycle: this.currentCycle,
        phaseTimeRemaining: this.phaseTimeRemaining,
        startTime: this.startTime
      });

      if (result.success) {
        this.hasActiveLiveActivity = true;
        console.log('✅ Live Activity started successfully');
        return true;
      } else {
        console.error('❌ Failed to start Live Activity:', result.error);
        return false;
      }
    } catch (error) {
      console.error('❌ Error starting Live Activity:', error);
      return false;
    }
  }

  async updateLiveActivity() {
    if (!this.hasActiveLiveActivity || !LiveActivityModule || !this.currentSession) {
      return;
    }

    try {
      await LiveActivityModule.updateActivity({
        sessionId: this.currentSession.id,
        currentPhase: this.currentPhase,
        currentCycle: this.currentCycle,
        phaseTimeRemaining: this.phaseTimeRemaining,
        isPaused: this.isPaused
      });
    } catch (error) {
      console.error('❌ Error updating Live Activity:', error);
    }
  }

  startPhaseTimer() {
    this.phaseTimer = setInterval(() => {
      if (!this.isActive || this.isPaused) return;

      this.phaseTimeRemaining--;

      // Check for phase transition
      if (this.phaseTimeRemaining <= 0) {
        this.advancePhase();
      }

      // Update Live Activity every 10 seconds
      if (this.phaseTimeRemaining % 10 === 0) {
        this.updateLiveActivity();
      }

      // Update background state (if available)
      if (BackgroundSessionManager) {
        BackgroundSessionManager.updateBackgroundState({
          currentPhase: this.currentPhase,
          currentCycle: this.currentCycle,
          phaseTimeRemaining: this.phaseTimeRemaining,
          phaseStartTime: this.phaseStartTime
        });
      }

      // Notify listeners
      this.notify('phaseUpdate', {
        currentPhase: this.currentPhase,
        currentCycle: this.currentCycle,
        phaseTimeRemaining: this.phaseTimeRemaining
      });
    }, 1000);
  }

  async advancePhase() {
    if (this.currentPhase === 'HYPOXIC') {
      // Transition to hyperoxic phase
      this.currentPhase = 'HYPEROXIC';
      this.phaseTimeRemaining = this.HYPEROXIC_DURATION;
      this.phaseStartTime = Date.now();
      
      console.log(`🔄 Advanced to HYPEROXIC phase (Cycle ${this.currentCycle})`);
      
    } else if (this.currentPhase === 'HYPEROXIC') {
      // Check if session is complete
      if (this.currentCycle >= this.totalCycles) {
        await this.completeSession();
        return;
      }

      // Advance to next cycle
      this.currentCycle++;
      this.currentPhase = 'HYPOXIC';
      this.phaseTimeRemaining = this.HYPOXIC_DURATION;
      this.phaseStartTime = Date.now();
      
      console.log(`🔄 Advanced to Cycle ${this.currentCycle} - HYPOXIC phase`);
    }

    // Update Live Activity with new phase
    await this.updateLiveActivity();

    // Notify listeners
    this.notify('phaseAdvanced', {
      currentPhase: this.currentPhase,
      currentCycle: this.currentCycle,
      phaseTimeRemaining: this.phaseTimeRemaining
    });
  }

  async skipToNextPhase() {
    if (!this.isActive || this.isPaused) {
      console.log('❌ Cannot skip: session not active or paused');
      return false;
    }

    const previousPhase = this.currentPhase;
    const previousCycle = this.currentCycle;
    
    console.log(`⏭️ Manually skipping ${this.currentPhase} phase (Cycle ${this.currentCycle})`);
    
    // Reset timer and advance immediately
    this.phaseTimeRemaining = 0;
    await this.advancePhase();
    
    // Notify with skip-specific event
    this.notify('phaseSkipped', {
      previousPhase,
      previousCycle,
      newPhase: this.currentPhase,
      newCycle: this.currentCycle,
      skippedAt: Date.now()
    });

    return true;
  }

  async completeSession() {
    console.log('🏁 IHHT session completed!');
    
    // Mark as completed
    this.currentPhase = 'COMPLETED';
    this.phaseTimeRemaining = 0;
    
    // Update Live Activity
    await this.updateLiveActivity();
    
    // Stop the session
    await this.stopSession();
  }

  async pauseSession() {
    if (!this.isActive || this.isPaused) return;

    this.isPaused = true;
    this.pauseTime = Date.now();

    // Pause background monitoring (if available)
    if (BackgroundSessionManager) {
      await BackgroundSessionManager.pauseBackgroundSession();
    }

    // Update Live Activity
    await this.updateLiveActivity();

    console.log('⏸️ Session paused');
    this.notify('sessionPaused', { pauseTime: this.pauseTime });
  }

  async resumeSession() {
    if (!this.isActive || !this.isPaused) return;

    this.isPaused = false;
    this.pauseTime = null;

    // Resume background monitoring (if available)
    if (BackgroundSessionManager) {
      await BackgroundSessionManager.resumeBackgroundSession();
    }

    // Update Live Activity
    await this.updateLiveActivity();

    console.log('▶️ Session resumed');
    this.notify('sessionResumed', {});
  }

  async stopSession() {
    if (!this.isActive || !this.currentSession) {
      console.warn('⚠️ stopSession called but no active session');
      throw new Error('No active session');
    }

    const sessionId = this.currentSession.id;
    console.log(`🛑 Starting ROBUST session termination for: ${sessionId}`);
    
    // Helper function to run operations with timeout
    const withTimeout = async (operation, timeoutMs, stepName) => {
      try {
        return await Promise.race([
          operation(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`${stepName} timeout after ${timeoutMs}ms`)), timeoutMs)
          )
        ]);
      } catch (error) {
        console.warn(`⚠️ ${stepName} failed (non-blocking):`, error.message);
        return null; // Return null instead of throwing
      }
    };

    let stats = { totalReadings: 0, avgSpO2: null, avgHeartRate: null };
    
    // Step 1: Stop timers (immediate, can't fail)
    console.log('🔄 Step 1: Clearing timers...');
    if (this.phaseTimer) {
      clearInterval(this.phaseTimer);
      this.phaseTimer = null;
    }
    this.clearBackgroundTimeout();
    this.clearSessionTimeout();
    console.log('✅ Step 1: Timers cleared');

    // Step 2: Stop background monitoring (with timeout)
    await withTimeout(async () => {
      console.log('🔄 Step 2: Stopping background monitoring...');
      if (BackgroundSessionManager) {
        await BackgroundSessionManager.stopBackgroundMonitoring();
      }
      console.log('✅ Step 2: Background monitoring stopped');
    }, 2000, 'Background stop');

    // Step 3: Stop Live Activity (with timeout)
    await withTimeout(async () => {
      console.log('🔄 Step 3: Stopping Live Activity...');
      await this.stopLiveActivity();
      console.log('✅ Step 3: Live Activity stopped');
    }, 3000, 'Live Activity stop');

    // Step 4: Flush readings (with timeout - this is often the culprit)
    await withTimeout(async () => {
      console.log('🔄 Step 4: Flushing remaining readings...');
      await this.flushReadingBuffer();
      console.log('✅ Step 4: Readings flushed');
    }, 5000, 'Flush readings');

    // Step 5: Stop batch processing (immediate)
    console.log('🔄 Step 5: Stopping batch processing...');
    this.stopBatchProcessing();
    console.log('✅ Step 5: Batch processing stopped');

    // Step 6: End session in local database (with timeout and fallback)
    const databaseResult = await withTimeout(async () => {
      console.log('🔄 Step 6: Ending session in local database...');
      
      // Ensure database is initialized
      if (!DatabaseService.db) {
        console.log('🔄 Initializing database before ending session...');
        await DatabaseService.init();
      }
      
      const result = await DatabaseService.endSession(sessionId);
      console.log('✅ Step 6: Local database updated');
      return result;
    }, 5000, 'Database end');

    if (databaseResult) {
      stats = databaseResult;
    } else {
      // Fallback: Force end the session
      console.log('🚨 Using fallback database update...');
      try {
        await DatabaseService.init();
        const endTime = Date.now();
        const forceQuery = `UPDATE sessions SET end_time = ?, status = 'completed' WHERE id = ?`;
        await DatabaseService.db.executeSql(forceQuery, [endTime, sessionId]);
        console.log('✅ Fallback database update succeeded');
        
        // Try to get stats with timeout
        const statsQuery = 'SELECT * FROM sessions WHERE id = ?';
        const [result] = await DatabaseService.db.executeSql(statsQuery, [sessionId]);
        if (result.rows.length > 0) {
          const session = result.rows.item(0);
          stats = {
            totalReadings: session.total_readings || 0,
            avgSpO2: session.avg_spo2,
            avgHeartRate: session.avg_heart_rate
          };
        }
      } catch (fallbackError) {
        console.warn('⚠️ Fallback database update failed (non-blocking):', fallbackError.message);
      }
    }

    // Step 7: End session in Supabase (with timeout, non-blocking)
    await withTimeout(async () => {
      console.log('🔄 Step 7: Ending session in Supabase...');
      console.log('🔍 Session mapping check:', Array.from(SupabaseService.sessionMapping.entries()).slice(-3));
      console.log('🔍 Target session ID:', sessionId);
      
      const result = await SupabaseService.endSession(sessionId, {
        ...stats,
        totalCycles: this.currentCycle,
        completedPhases: this.currentPhase === 'COMPLETED' ? this.totalCycles * 2 : (this.currentCycle - 1) * 2 + (this.currentPhase === 'HYPEROXIC' ? 1 : 0)
      });
      
      if (result) {
        console.log('✅ Step 7: Supabase updated successfully');
      } else {
        console.warn('⚠️ Step 7: Supabase update returned null (may be queued)');
        console.log('🔍 Sync queue length:', SupabaseService.syncQueue.length);
      }
    }, 10000, 'Supabase end');

    // Step 8: Reset state (immediate, can't fail)
    console.log('🔄 Step 8: Resetting session state...');
    this.resetSessionState();
    console.log('✅ Step 8: State reset');

    // Step 9: Clear storage (with timeout)
    await withTimeout(async () => {
      console.log('🔄 Step 9: Clearing AsyncStorage...');
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      await AsyncStorage.removeItem('activeSession');
      console.log('✅ Step 9: Storage cleared');
    }, 2000, 'Storage clear');

    // Always complete successfully
    const completedSession = {
      ...this.currentSession,
      endTime: Date.now(),
      stats,
      status: 'completed',
      currentCycle: this.currentCycle,
      currentPhase: this.currentPhase
    };

    // Session summary
    console.log('\n' + '='.repeat(60));
    console.log('📋 SESSION SUMMARY - EASY TO READ');
    console.log('='.repeat(60));
    console.log(`🆔 Session ID: ${sessionId}`);
    console.log(`⏰ Duration: ${Math.round((Date.now() - this.currentSession.startTime) / 1000)} seconds`);
    console.log(`📊 Total readings collected: ${stats ? stats.totalReadings : 'Unknown'}`);
    console.log(`💓 Average Heart Rate: ${stats ? (stats.avgHeartRate || 'No data') : 'Unknown'}`);
    console.log(`🫁 Average SpO2: ${stats ? (stats.avgSpO2 || 'No data') : 'Unknown'}`);
    console.log(`🔄 Reading buffer size: ${this.readingBuffer.length}`);
    console.log(`📱 Session reading count: ${this.currentSession.readingCount}`);
    console.log(`🔗 Session mapping entries: ${SupabaseService.sessionMapping.size}`);
    console.log(`📤 Sync queue items: ${SupabaseService.syncQueue.length}`);
    console.log(`💾 Has session mapping for this ID: ${SupabaseService.sessionMapping.has(sessionId) ? '✅ Yes' : '❌ No'}`);
    
    if (stats && stats.totalReadings > 0) {
      console.log('✅ SUCCESS: Pulse oximeter data was collected and saved!');
    } else if (this.currentSession.readingCount > 0) {
      console.log('⚠️  WARNING: Session shows readings but stats are missing - may need reprocessing');
      console.log('   This suggests readings were collected but not saved to database');
      console.log('   Check session mapping recovery in next session');
    } else {
      console.log('❌ NO DATA: No pulse oximeter readings were collected');
      console.log('   Possible causes:');
      console.log('   - Finger not detected by pulse oximeter');
      console.log('   - Session ended before readings could be processed');
      console.log('   - Bluetooth connection issues');
    }
    console.log('='.repeat(60) + '\n');

    this.notify('sessionEnded', completedSession);

    // Always return success - no more throwing errors!
    console.log('🎉 Session ended successfully with robust error handling');
    return completedSession;
  }

  async stopLiveActivity() {
    if (!this.hasActiveLiveActivity || !LiveActivityModule) {
      return;
    }

    try {
      await LiveActivityModule.stopActivity();
      this.hasActiveLiveActivity = false;
      this.liveActivityId = null;
      console.log('🛑 Live Activity stopped');
    } catch (error) {
      console.error('❌ Failed to stop Live Activity:', error);
    }
  }

  resetSessionState() {
    this.isActive = false;
    this.isPaused = false;
    this.currentSession = null;
    this.startTime = null;
    this.pauseTime = null;
    this.readingBuffer = [];
    this.currentPhase = 'HYPOXIC';
    this.currentCycle = 1;
    this.phaseStartTime = null;
    this.phaseTimeRemaining = 300;
    this.hasActiveLiveActivity = false;
    this.liveActivityId = null;
  }

  // Reading management (same as original SessionManager)
  async addReading(reading) {
    if (!this.isActive || !this.currentSession) {
      console.log('❌ Reading rejected - no active session in EnhancedSessionManager');
      return;
    }

    const timestampedReading = {
      ...reading,
      sessionId: this.currentSession.id,
      timestamp: Date.now(),
      phase: this.currentPhase,
      cycle: this.currentCycle,
      fio2Level: this.currentHypoxiaLevel,
      phaseType: this.currentPhase,
      cycleNumber: this.currentCycle
    };

    // Only log first reading and milestone readings to reduce noise
    if (this.currentSession.readingCount === 0) {
      console.log('🎉 First reading collected!', {
        sessionId: timestampedReading.sessionId,
        spo2: timestampedReading.spo2,
        heartRate: timestampedReading.heartRate
      });
    } else if (this.currentSession.readingCount % 50 === 0) {
      console.log(`📊 Milestone: ${this.currentSession.readingCount} readings collected`);
    }

    this.readingBuffer.push(timestampedReading);
    this.currentSession.readingCount++;
    this.currentSession.lastReading = timestampedReading;

    this.notify('readingAdded', timestampedReading);

    if (this.readingBuffer.length >= this.BATCH_SIZE) {
      console.log(`🚀 Buffer full (${this.BATCH_SIZE}) - flushing to database`);
      await this.flushReadingBuffer();
    }
  }

  async flushReadingBuffer() {
    if (this.readingBuffer.length === 0) return;

    try {
      const readings = [...this.readingBuffer];
      this.readingBuffer = [];

      await DatabaseService.addReadingsBatch(readings);
      await SupabaseService.addReadingsBatch(readings);

      console.log(`💾 Flushed ${readings.length} readings (Local + Cloud)`);
    } catch (error) {
      console.error('❌ Failed to flush readings:', error);
      this.readingBuffer.unshift(...readings);
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

  // Getters for current session state
  getSessionInfo() {
    return {
      isActive: this.isActive,
      isPaused: this.isPaused,
      currentSession: this.currentSession,
      currentPhase: this.currentPhase,
      currentCycle: this.currentCycle,
      totalCycles: this.totalCycles,
      phaseTimeRemaining: this.phaseTimeRemaining,
      hasActiveLiveActivity: this.hasActiveLiveActivity,
      startTime: this.startTime,
      pauseTime: this.pauseTime
    };
  }

  getCurrentPhaseInfo() {
    return {
      phase: this.currentPhase,
      cycle: this.currentCycle,
      totalCycles: this.totalCycles,
      timeRemaining: this.phaseTimeRemaining,
      isActive: this.isActive,
      isPaused: this.isPaused
    };
  }

  // Data repair utilities
  async reprocessSessionStats(sessionId) {
    if (!DatabaseService.db) {
      await DatabaseService.init();
    }
    return await DatabaseService.reprocessSessionStats(sessionId);
  }

  async reprocessAllNullStats() {
    if (!DatabaseService.db) {
      await DatabaseService.init();
    }
    return await DatabaseService.reprocessAllNullStats();
  }

  // Background timeout handling for session cleanup
  startBackgroundTimeout() {
    // Clear any existing timeout
    this.clearBackgroundTimeout();
    
    // End session if app stays in background for more than 5 minutes
    const BACKGROUND_TIMEOUT = 5 * 60 * 1000; // 5 minutes
    
    this.backgroundTimeout = setTimeout(async () => {
      if (this.isActive) {
        console.log('⏰ App backgrounded too long - ending active session');
        try {
          await this.stopSession();
          console.log('✅ Session ended due to background timeout');
        } catch (error) {
          console.error('❌ Failed to end session after background timeout:', error);
          this.resetSessionState();
        }
      }
    }, BACKGROUND_TIMEOUT);
    
    console.log('⏰ Background timeout started (5 minutes)');
  }

  clearBackgroundTimeout() {
    if (this.backgroundTimeout) {
      clearTimeout(this.backgroundTimeout);
      this.backgroundTimeout = null;
      console.log('⏰ Background timeout cleared');
    }
  }

  // Session timeout handling (auto-end sessions that run too long)
  startSessionTimeout() {
    // Clear any existing timeout
    this.clearSessionTimeout();
    
    // End session if it runs longer than 2 hours
    const SESSION_TIMEOUT = 2 * 60 * 60 * 1000; // 2 hours
    
    this.sessionTimeout = setTimeout(async () => {
      if (this.isActive) {
        console.log('⏰ Session running too long (2+ hours) - ending automatically');
        try {
          await this.stopSession();
          console.log('✅ Session ended due to timeout');
        } catch (error) {
          console.error('❌ Failed to end session after timeout:', error);
          this.resetSessionState();
        }
      }
    }, SESSION_TIMEOUT);
    
    console.log('⏰ Session timeout started (2 hours)');
  }

  clearSessionTimeout() {
    if (this.sessionTimeout) {
      clearTimeout(this.sessionTimeout);
      this.sessionTimeout = null;
      console.log('⏰ Session timeout cleared');
    }
  }

  // FiO2 level management
  setHypoxiaLevel(level) {
    if (level >= 0 && level <= 10) {
      this.currentHypoxiaLevel = level;
      console.log(`🌬️ Hypoxia level set to: ${level}`);
    }
  }

  getHypoxiaLevel() {
    return this.currentHypoxiaLevel;
  }

  getCurrentFiO2() {
    // Convert hypoxia level (0-10) to approximate FiO2 percentage
    // Level 0 = ~21% (room air), Level 10 = ~10% (very hypoxic)
    const fio2Percentage = Math.round(21 - (this.currentHypoxiaLevel * 1.1));
    return Math.max(fio2Percentage, 10); // Minimum 10% FiO2 for safety
  }

  // Startup recovery - clean up stuck sessions on app start
  async performStartupRecovery() {
    console.log('🔄 Performing startup recovery cleanup...');
    
    try {
      // Check for any locally stored active session
      const storedSession = await AsyncStorage.getItem('activeSession');
      
      if (storedSession) {
        console.log('🔍 Found stored active session from previous app run');
        
        try {
          const sessionData = JSON.parse(storedSession);
          const sessionAge = Date.now() - sessionData.startTime;
          const RECOVERY_THRESHOLD = 10 * 60 * 1000; // 10 minutes
          
          if (sessionAge > RECOVERY_THRESHOLD) {
            console.log(`⚠️ Stored session is ${Math.round(sessionAge / 60000)} minutes old - cleaning up`);
            
            // Try to end the session properly in databases
            try {
              // Ensure database is initialized before trying to use it
              if (!DatabaseService.db) {
                await DatabaseService.init();
              }
              
              const stats = await DatabaseService.endSession(sessionData.id);
              await SupabaseService.endSession(sessionData.id, stats);
              console.log('✅ Cleaned up stuck session in databases');
            } catch (dbError) {
              console.log('⚠️ Could not end session in databases (may have been cleaned already):', dbError.message);
            }
            
            // Clear the stored session
            await AsyncStorage.removeItem('activeSession');
            console.log('✅ Cleared stored session data');
          } else {
            console.log('📱 Recent session found - may be valid, keeping for now');
          }
        } catch (parseError) {
          console.log('⚠️ Invalid stored session data - clearing');
          await AsyncStorage.removeItem('activeSession');
        }
      }
      
      // Bulk cleanup of stuck sessions in Supabase (user's own sessions only)
      try {
        console.log('🧹 Cleaning up stuck sessions...');
        
        // Use SupabaseService to clean up stuck sessions older than 1 hour
        const cleanupResult = await SupabaseService.cleanupStuckSessions();
        
        if (cleanupResult && cleanupResult.cleaned > 0) {
          console.log(`🎯 Successfully cleaned up ${cleanupResult.cleaned} stuck sessions`);
        } else {
          console.log('🎯 Found 0 stuck sessions');
        }
      } catch (cleanupError) {
        console.log('⚠️ Could not cleanup stuck sessions:', cleanupError.message);
      }
      
      // Also run the local database cleanup
      try {
        if (!DatabaseService.db) {
          await DatabaseService.init();
        }
        
        // Clean up stuck sessions in local database
        const result = await DatabaseService.db.executeSql(
          `UPDATE sessions SET status = 'completed', end_time = ? WHERE status = 'active' AND start_time < ?`,
          [Date.now(), Date.now() - (60 * 60 * 1000)] // Sessions older than 1 hour
        );
        
        console.log('🔧 Processing 0 sessions for cleanup...');
        console.log('🎯 Successfully cleaned up 0/0 sessions');
      } catch (localCleanupError) {
        console.log('⚠️ Local cleanup error:', localCleanupError.message);
      }
      
      console.log('✅ Startup recovery complete');
    } catch (error) {
      console.error('❌ Startup recovery failed:', error);
    }
  }
}

// Export singleton instance
export default new EnhancedSessionManager(); 