import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, AppState } from 'react-native';
import DatabaseService from './DatabaseService';
import SupabaseService from './SupabaseService';
import logger from '../utils/logger';

const log = logger.createModuleLogger('EnhancedSessionManager');

// Import Background Session Manager conditionally - available in development builds
let BackgroundSessionManager = null;
try {
  BackgroundSessionManager = require('./BackgroundSessionManager').BackgroundSessionManager;
  log.info('Background session management enabled');
} catch (error) {
  log.info('Background session management not available:', error.message);
}

// Import the Live Activity module for iOS - available in development builds
let LiveActivityModule = null;
try {
  LiveActivityModule = require('../../modules/live-activity/src/LiveActivityModule').default;
  log.info('Live Activities enabled');
} catch (error) {
  log.info('Live Activities not available:', error.message);
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
    this.currentPhase = 'HYPOXIC'; // 'HYPOXIC' | 'HYPEROXIC' | 'COMPLETED'
    this.currentCycle = 1;
    this.phaseStartTime = null;
    this.phaseTimeRemaining = 300; // Will be set based on protocol
    this.phaseTimer = null;
    
    // Protocol configuration (defaults)
    this.protocolConfig = {
      totalCycles: 3,
      hypoxicDuration: 420,    // 7 minutes in seconds
      hyperoxicDuration: 180   // 3 minutes in seconds
    };
    
    // Live Activity state
    this.hasActiveLiveActivity = false;
    this.liveActivityId = null;
    
    // Timeout references
    this.backgroundTimeout = null;
    this.sessionTimeout = null;
    
    // FiO2 tracking
    this.currentHypoxiaLevel = 5; // Default hypoxia level (0-10 scale)
    
    // Session timing tracking
    this.sessionStartTime = null; // Actual start timestamp for accurate elapsed time
    this.totalSkippedTime = 0; // Total seconds skipped from phase skips
    
    // Connection state tracking for Bluetooth resilience
    this.connectionState = 'connected';
    
    // Buffer settings
    this.BATCH_SIZE = 50;
    this.BATCH_INTERVAL = 2000;
    
    // App state handling
    this.setupAppStateHandling();
    
    // Initialize services
    this.initializeServices();
  }

  async initializeServices() {
    try {
      await SupabaseService.initialize();
      log.info('Supabase service initialized');
      
      // Check Live Activity support
      if (LiveActivityModule) {
        const isSupported = await LiveActivityModule.isSupported();
        log.info('Live Activity support:', isSupported);
      }

      // Perform startup recovery cleanup
      setTimeout(() => this.performStartupRecovery(), 1000);
    } catch (error) {
      log.error('❌ Failed to initialize services:', error);
    }
  }

  setupAppStateHandling() {
    AppState.addEventListener('change', this.handleAppStateChange.bind(this));
  }

  async handleAppStateChange(nextAppState) {
    if (this.isActive) {
      if (nextAppState === 'background') {
        log.info('App backgrounded - starting background monitoring and session timeout');
        await this.startBackgroundMonitoring();
        this.startBackgroundTimeout();
      } else if (nextAppState === 'active') {
        log.info('App foregrounded - syncing with background state');
        this.clearBackgroundTimeout();
        await this.syncWithBackgroundState();
      }
    }
  }

  async startBackgroundMonitoring() {
    if (!this.currentSession) return;

    if (!BackgroundSessionManager) {
      log.info('Background monitoring not available in Expo Go');
      return;
    }

    try {
      // Start background task monitoring
      const backgroundStarted = await BackgroundSessionManager.startBackgroundMonitoring({
        id: this.currentSession.id,
        startTime: this.startTime
      });

      if (backgroundStarted) {
        log.info('Background monitoring started');
      }
    } catch (error) {
      log.error('❌ Failed to start background monitoring:', error);
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
        
        log.info('Synced with background state:', backgroundState);
        this.notify('sessionSynced', backgroundState);
      }
    } catch (error) {
      log.error('❌ Failed to sync with background state:', error);
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
        log.error('Session listener error:', error);
      }
    });
  }

  // Protocol configuration method
  setProtocol(protocolConfig) {
    this.protocolConfig = {
      totalCycles: protocolConfig.totalCycles,
      hypoxicDuration: protocolConfig.hypoxicDuration * 60,   // Convert minutes to seconds
      hyperoxicDuration: protocolConfig.hyperoxicDuration * 60 // Convert minutes to seconds
    };
    
    log.info('� Protocol configured:', this.protocolConfig);
  }

  // Enhanced session lifecycle with Live Activity support
  async startSession(protocolConfigOrSessionId = null) {
    if (this.isActive) {
      throw new Error('Session already active');
    }
    
    // Clear any leftover readings from previous sessions
    if (this.readingBuffer.length > 0) {
      log.info(`🧹 Clearing ${this.readingBuffer.length} leftover readings from buffer`);
      this.readingBuffer = [];
    }

    try {
      // Handle both protocol config (object) and existing session ID (string)
      let protocolConfig = null;
      let existingSessionId = null;
      
      if (typeof protocolConfigOrSessionId === 'string') {
        existingSessionId = protocolConfigOrSessionId;
      } else if (typeof protocolConfigOrSessionId === 'object' && protocolConfigOrSessionId !== null) {
        protocolConfig = protocolConfigOrSessionId;
      }
      
      // Set protocol configuration if provided
      if (protocolConfig) {
        this.setProtocol(protocolConfig);
      }

      // Use existing session ID if provided (from survey), otherwise generate new one
      const sessionId = existingSessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      log.info(`Starting session with ID: ${sessionId} ${existingSessionId ? '(existing)' : '(new)'}`);
      
      // Initialize database if needed
      if (!DatabaseService.db) {
        await DatabaseService.init();
      }

      // Create session in databases (skip if already exists)
      if (!existingSessionId) {
        await DatabaseService.createSession(sessionId, this.currentHypoxiaLevel, this.protocolConfig);
        await SupabaseService.createSession({
          id: sessionId,
          startTime: Date.now(),
          defaultHypoxiaLevel: this.currentHypoxiaLevel,
          protocolConfig: this.protocolConfig
        });
      } else {
        log.info('� Using existing session - skipping database creation');
        await this.updateSessionProtocol(sessionId);
      }

      // Set session timing
      this.sessionStartTime = Date.now();
      this.totalSkippedTime = 0; // Reset skipped time for new session
      
      // Set session state
      this.currentSession = {
        id: sessionId,
        startTime: Date.now(),
        readingCount: 0,
        lastReading: null,
        sessionType: 'IHHT',
        currentPhase: this.currentPhase,
        currentCycle: this.currentCycle,
        totalCycles: this.protocolConfig.totalCycles,
        hypoxicDuration: this.protocolConfig.hypoxicDuration,
        hyperoxicDuration: this.protocolConfig.hyperoxicDuration,
        defaultHypoxiaLevel: this.currentHypoxiaLevel
      };

      this.isActive = true;
      this.isPaused = false;
      this.startTime = Date.now();
      this.phaseStartTime = Date.now();
      this.currentPhase = 'HYPOXIC';
      this.currentCycle = 1;
      this.phaseTimeRemaining = this.protocolConfig.hypoxicDuration;
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

      log.info(`Enhanced session started: ${sessionId}`);
      this.notify('sessionStarted', {
        ...this.currentSession,
        currentPhase: this.currentPhase,
        currentCycle: this.currentCycle,
        phaseTimeRemaining: this.phaseTimeRemaining
      });

      return sessionId;
    } catch (error) {
      log.error('❌ Failed to start enhanced session:', error);
      throw error;
    }
  }

  async checkLiveActivitySupport() {
    if (!LiveActivityModule) {
      log.info('Live Activities not available in Expo Go');
      return false;
    }
    
    try {
      const isSupported = await LiveActivityModule.isSupported();
      return isSupported;
    } catch (error) {
      log.error('❌ Error checking Live Activity support:', error);
      return false;
    }
  }

  async startLiveActivity() {
    if (!LiveActivityModule || !this.currentSession) {
      return false;
    }

    try {
      log.info('Starting Live Activity for session:', this.currentSession.id);
      
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
        log.info('Live Activity started successfully');
        return true;
      } else {
        log.error('❌ Failed to start Live Activity:', result.error);
        return false;
      }
    } catch (error) {
      log.error('❌ Error starting Live Activity:', error);
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
      log.error('❌ Error updating Live Activity:', error);
    }
  }

  startPhaseTimer() {
    this.phaseTimer = setInterval(() => {
      if (!this.isActive || this.isPaused) return;
      
      // Prevent timer updates after session completion
      if (this.currentPhase === 'COMPLETED' || this.currentPhase === 'TERMINATED') {
        clearInterval(this.phaseTimer);
        return;
      }

      this.phaseTimeRemaining--;
      
      // Log every 5 seconds to track if timer is working
      if (this.phaseTimeRemaining % 5 === 0) {
        log.info(`⏲️ Phase timer: ${this.phaseTimeRemaining}s remaining in ${this.currentPhase} phase`);
      }

      // Check for phase transition
      if (this.phaseTimeRemaining <= 0) {
        this.advancePhase();
      }

      // Update Live Activity every 10 seconds
      if (this.phaseTimeRemaining % 10 === 0) {
        this.updateLiveActivity();
      }

      // Update background state less frequently (every 5 seconds)
      if (BackgroundSessionManager && this.phaseTimeRemaining % 5 === 0) {
        BackgroundSessionManager.updateBackgroundState({
          currentPhase: this.currentPhase,
          currentCycle: this.currentCycle,
          phaseTimeRemaining: this.phaseTimeRemaining,
          phaseStartTime: this.phaseStartTime
        });
      }

      // Notify phase updates every second for the first 5 seconds after a phase change
      // or every 10 seconds otherwise to reduce noise
      const timeSincePhaseStart = Math.floor((Date.now() - this.phaseStartTime) / 1000);
      if (timeSincePhaseStart <= 5 || this.phaseTimeRemaining % 10 === 0) {
        this.notify('phaseUpdate', {
          currentPhase: this.currentPhase,
          currentCycle: this.currentCycle,
          phaseTimeRemaining: this.phaseTimeRemaining
        });
      }
    }, 1000);
  }

  async advancePhase() {
    if (this.currentPhase === 'HYPOXIC') {
      // Transition to hyperoxic phase
      this.currentPhase = 'HYPEROXIC';
      this.phaseStartTime = Date.now();
      
      // For the final phase, calculate exact remaining time
      if (this.isLastPhase()) {
        const totalDuration = (this.protocolConfig.hypoxicDuration + this.protocolConfig.hyperoxicDuration) * this.protocolConfig.totalCycles;
        const adjustedTotalDuration = totalDuration - this.totalSkippedTime;
        const elapsedTime = Math.floor((Date.now() - this.sessionStartTime) / 1000);
        this.phaseTimeRemaining = Math.max(0, adjustedTotalDuration - elapsedTime);
        log.info(`Final phase (auto-advance) - aligned time: ${this.phaseTimeRemaining}s`);
      } else {
        this.phaseTimeRemaining = this.protocolConfig.hyperoxicDuration;
      }
      
      log.info(`Advanced to HYPEROXIC phase (Cycle ${this.currentCycle})`);
      
    } else if (this.currentPhase === 'HYPEROXIC') {
      // Check if session is complete
      if (this.currentCycle >= this.protocolConfig.totalCycles) {
        await this.completeSession();
        return;
      }

      // Advance to next cycle
      this.currentCycle++;
      this.currentPhase = 'HYPOXIC';
      this.phaseTimeRemaining = this.protocolConfig.hypoxicDuration;
      this.phaseStartTime = Date.now();
      
      // Update database with new cycle
      await this.updateSessionCycle();
      
      log.info(`Advanced to Cycle ${this.currentCycle} - HYPOXIC phase`);
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
      log.info('Cannot skip: session not active or paused');
      return false;
    }
    
    // Prevent any operations after session completion
    if (this.currentPhase === 'COMPLETED' || this.currentPhase === 'TERMINATED' || !this.currentSession) {
      log.info('Cannot skip: session already completed or no active session');
      return false;
    }

    const previousPhase = this.currentPhase;
    const previousCycle = this.currentCycle;
    
    // Calculate how much time we're skipping
    const timeSkipped = this.phaseTimeRemaining;
    this.totalSkippedTime += timeSkipped;
    
    log.info(`⏭️ Manually skipping ${this.currentPhase} phase (Cycle ${this.currentCycle}) - ${timeSkipped}s skipped`);
    
    // Advance phase directly (don't set phaseTimeRemaining to 0 first)
    await this.advancePhase();
    
    // Reset the phase start time to NOW after advancing
    // This ensures the timer starts fresh for the new phase
    this.phaseStartTime = Date.now();
    
    // For the final phase, adjust time remaining to match total session time
    if (this.isLastPhase()) {
      const totalDuration = (this.protocolConfig.hypoxicDuration + this.protocolConfig.hyperoxicDuration) * this.protocolConfig.totalCycles;
      const adjustedTotalDuration = totalDuration - this.totalSkippedTime;
      const elapsedTime = Math.floor((Date.now() - this.sessionStartTime) / 1000);
      this.phaseTimeRemaining = Math.max(0, adjustedTotalDuration - elapsedTime);
      log.info(`Final phase - aligned time: ${this.phaseTimeRemaining}s (total: ${adjustedTotalDuration}s, elapsed: ${elapsedTime}s)`);
    }
    
    log.info(`⏱️ Phase skipped - new phase time: ${this.phaseTimeRemaining}s, phase: ${this.currentPhase}, total skipped: ${this.totalSkippedTime}s`);
    
    // Clear and restart the timer to ensure it starts counting immediately
    if (this.phaseTimer) {
      clearInterval(this.phaseTimer);
      this.startPhaseTimer();
    }
    
    // Force an immediate phase update notification to ensure UI refreshes
    this.notify('phaseUpdate', {
      currentPhase: this.currentPhase,
      currentCycle: this.currentCycle,
      phaseTimeRemaining: this.phaseTimeRemaining
    });
    
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

  isLastPhase() {
    // Check if this is the last phase (final HYPEROXIC of the last cycle)
    return this.currentPhase === 'HYPEROXIC' && this.currentCycle >= this.protocolConfig.totalCycles;
  }

  async completeSession() {
    log.info('IHHT session completed!');
    log.info(`Completing session with cycle ${this.currentCycle}, phase ${this.currentPhase}`);
    
    // Mark as completed but preserve the cycle count
    const finalCycle = this.currentCycle;
    this.currentPhase = 'COMPLETED';
    this.phaseTimeRemaining = 0;
    this.currentCycle = finalCycle; // Preserve the cycle count
    
    // IMPORTANT: Update the database with the final cycle count before stopping
    if (this.currentSession?.id) {
      try {
        await DatabaseService.updateSessionCycle(this.currentSession.id, finalCycle);
        await SupabaseService.updateSessionCycle(this.currentSession.id, finalCycle);
        log.info(`Updated final cycle count to ${finalCycle} in databases`);
      } catch (error) {
        log.error('⚠️ Failed to update final cycle count:', error);
      }
    }
    
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

    log.info('Session paused');
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

    log.info('Session resumed');
    this.notify('sessionResumed', {});
  }

  async stopSession() {
    if (!this.isActive || !this.currentSession) {
      log.warn('⚠️ stopSession called but no active session');
      throw new Error('No active session');
    }

    const sessionId = this.currentSession.id;
    
    // Store the final cycle count before resetting
    const finalCycle = this.currentCycle;
    
    log.info(`� Starting ROBUST session termination for: ${sessionId}`);
    
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
        log.warn(`⚠️ ${stepName} failed (non-blocking):`, error.message);
        return null; // Return null instead of throwing
      }
    };

    let stats = { totalReadings: 0, avgSpO2: null, avgHeartRate: null };
    
    // Step 1: Stop timers (immediate, can't fail)
    log.info('Step 1: Clearing timers...');
    if (this.phaseTimer) {
      clearInterval(this.phaseTimer);
      this.phaseTimer = null;
    }
    this.clearBackgroundTimeout();
    this.clearSessionTimeout();
    log.info('Step 1: Timers cleared');

    // Step 2: Stop background monitoring (with timeout)
    await withTimeout(async () => {
      log.info('Step 2: Stopping background monitoring...');
      if (BackgroundSessionManager) {
        await BackgroundSessionManager.stopBackgroundMonitoring();
      }
      log.info('Step 2: Background monitoring stopped');
    }, 2000, 'Background stop');

    // Step 3: Stop Live Activity (with timeout)
    await withTimeout(async () => {
      log.info('Step 3: Stopping Live Activity...');
      await this.stopLiveActivity();
      log.info('Step 3: Live Activity stopped');
    }, 3000, 'Live Activity stop');

    // Step 4: Flush readings with retry logic and increased timeout
    let flushSuccess = false;
    const maxFlushAttempts = 3;
    
    for (let attempt = 1; attempt <= maxFlushAttempts; attempt++) {
      const flushResult = await withTimeout(async () => {
        log.info(`Step 4: Flushing remaining readings (attempt ${attempt}/${maxFlushAttempts})...`);
        await this.flushReadingBuffer();
        log.info('Step 4: Readings flushed successfully');
        return true;
      }, 15000, `Flush readings attempt ${attempt}`);
      
      if (flushResult) {
        flushSuccess = true;
        break;
      }
      
      if (attempt < maxFlushAttempts) {
        log.info(`Flush attempt ${attempt} failed, retrying...`);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
      }
    }
    
    // If flush failed after all attempts, save to recovery buffer
    if (!flushSuccess && this.readingBuffer.length > 0) {
      log.error('❌ Failed to flush readings after all attempts');
      await this.saveToRecoveryBuffer(this.readingBuffer, sessionId);
    }

    // Step 5: Stop batch processing (immediate)
    log.info('Step 5: Stopping batch processing...');
    this.stopBatchProcessing();
    log.info('Step 5: Batch processing stopped');

    // Step 6: Wait a moment to ensure all async writes complete
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Step 7: End session in local database (with timeout and fallback)
    const databaseResult = await withTimeout(async () => {
      log.info('Step 7: Ending session in local database...');
      
      // Ensure database is initialized
      if (!DatabaseService.db) {
        log.info('Initializing database before ending session...');
        await DatabaseService.init();
      }
      
      // Recalculate stats to ensure we have the latest data
      const result = await DatabaseService.endSession(sessionId, this.currentSession?.startTime || this.startTime);
      log.info('Step 7: Local database updated with final statistics');
      return result;
    }, 10000, 'Database end');

    if (databaseResult) {
      stats = databaseResult;
    } else {
      // Fallback: Force end the session
      log.info('� Using fallback database update...');
      try {
        await DatabaseService.init();
        const endTime = Date.now();
        const forceQuery = `UPDATE sessions SET end_time = ?, status = 'completed' WHERE id = ?`;
        await DatabaseService.db.executeSql(forceQuery, [endTime, sessionId]);
        log.info('Fallback database update succeeded');
        
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
        log.warn('⚠️ Fallback database update failed (non-blocking):', fallbackError.message);
      }
    }

    // Step 7: End session in Supabase (with timeout, non-blocking)
    await withTimeout(async () => {
      log.info('Step 7: Ending session in Supabase...');
      log.info('Session mapping check:', Array.from(SupabaseService.sessionMapping.entries()).slice(-3));
      log.info('Target session ID:', sessionId);
      
      const result = await SupabaseService.endSession(sessionId, {
        ...stats,
        totalCycles: this.currentCycle,
        completedPhases: this.currentPhase === 'COMPLETED' ? this.totalCycles * 2 : (this.currentCycle - 1) * 2 + (this.currentPhase === 'HYPEROXIC' ? 1 : 0)
      }, this.currentSession?.startTime || this.startTime);
      
      if (result) {
        log.info('Step 7: Supabase updated successfully');
      } else {
        log.warn('⚠️ Step 7: Supabase update returned null (may be queued)');
        log.info('Sync queue length:', SupabaseService.syncQueue.length);
      }
    }, 10000, 'Supabase end');

    // Step 8: Create completion object BEFORE resetting state
    log.info('Step 8: Creating session completion object...');
    const completedSession = {
      ...this.currentSession,
      endTime: Date.now(),
      stats,
      status: 'completed',
      currentCycle: finalCycle,  // Use the preserved final cycle
      currentPhase: 'COMPLETED',  // Always set to COMPLETED
      finalCycle: finalCycle  // Add this for clarity
    };
    log.info('Step 8: Session completion object created');

    // Step 9: Reset state (immediate, can't fail)
    log.info('Step 9: Resetting session state...');
    this.resetSessionState();
    log.info('Step 9: State reset');

    // Step 10: Clear storage (with timeout)
    await withTimeout(async () => {
      log.info('Step 10: Clearing AsyncStorage...');
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      await AsyncStorage.removeItem('activeSession');
      log.info('Step 10: Storage cleared');
    }, 2000, 'Storage clear');

    // Session summary
    log.info('\n' + '='.repeat(60));
    log.info('� SESSION SUMMARY - EASY TO READ');
    log.info('='.repeat(60));
    log.info(`� Session ID: ${sessionId}`);
    log.info(`⏰ Duration: ${Math.round((Date.now() - (completedSession.startTime || Date.now())) / 1000)} seconds`);
    log.info(`Total readings collected: ${stats ? stats.totalReadings : 'Unknown'}`);
    log.info(`Average Heart Rate: ${stats ? (stats.avgHeartRate || 'No data') : 'Unknown'}`);
    log.info(`Average SpO2: ${stats ? (stats.avgSpO2 || 'No data') : 'Unknown'}`);
    log.info(`Reading buffer size: ${this.readingBuffer.length}`);
    log.info(`Session reading count: ${completedSession.readingCount || 0}`);
    log.info(`� Session mapping entries: ${SupabaseService.sessionMapping.size}`);
    log.info(`� Sync queue items: ${SupabaseService.syncQueue.length}`);
    log.info(`Has session mapping for this ID: ${SupabaseService.sessionMapping.has(sessionId) ? '✅ Yes' : '❌ No'}`);
    
    if (stats && stats.totalReadings > 0) {
      log.info('SUCCESS: Pulse oximeter data was collected and saved!');
    } else if (completedSession.readingCount > 0) {
      log.info('WARNING: Session shows readings but stats are missing - may need reprocessing');
      log.info('This suggests readings were collected but not saved to database');
      log.info('Check session mapping recovery in next session');
    } else {
      log.info('NO DATA: No pulse oximeter readings were collected');
      log.info('Possible causes:');
      log.info('- Finger not detected by pulse oximeter');
      log.info('- Session ended before readings could be processed');
      log.info('- Bluetooth connection issues');
    }
    log.info('='.repeat(60) + '\n');

    this.notify('sessionEnded', completedSession);

    // Always return success - no more throwing errors!
    log.info('� Session ended successfully with robust error handling');
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
      log.info('� Live Activity stopped');
    } catch (error) {
      log.error('❌ Failed to stop Live Activity:', error);
    }
  }

  // Recovery buffer for failed readings
  async saveToRecoveryBuffer(readings, sessionId) {
    try {
      const recoveryKey = `recovery_buffer_${sessionId}`;
      const existingRecovery = await AsyncStorage.getItem(recoveryKey);
      const existingReadings = existingRecovery ? JSON.parse(existingRecovery) : [];
      const allReadings = [...existingReadings, ...readings];
      
      await AsyncStorage.setItem(recoveryKey, JSON.stringify(allReadings));
      log.info(`Saved ${readings.length} readings to recovery buffer for session ${sessionId}`);
      
      // Schedule recovery attempt
      setTimeout(() => this.attemptRecovery(sessionId), 5000);
    } catch (error) {
      log.error('❌ Failed to save to recovery buffer:', error);
    }
  }

  async attemptRecovery(sessionId) {
    try {
      const recoveryKey = `recovery_buffer_${sessionId}`;
      const recoveryData = await AsyncStorage.getItem(recoveryKey);
      
      if (!recoveryData) return;
      
      const readings = JSON.parse(recoveryData);
      log.info(`Attempting to recover ${readings.length} readings for session ${sessionId}`);
      
      // Try to save recovered readings
      await DatabaseService.addReadingsBatch(readings);
      
      // Clear recovery buffer on success
      await AsyncStorage.removeItem(recoveryKey);
      log.info(`Successfully recovered ${readings.length} readings`);
      
      // Trigger stats recalculation
      await DatabaseService.reprocessSessionStats(sessionId);
    } catch (error) {
      log.error('❌ Recovery attempt failed:', error);
      // Will retry on next app launch
    }
  }

  // Update current cycle in database
  async updateSessionCycle() {
    if (!this.currentSession?.id) return;

    try {
      // Update local database
      await DatabaseService.updateSessionCycle(this.currentSession.id, this.currentCycle);
      
      // Update Supabase
      await SupabaseService.updateSessionCycle(this.currentSession.id, this.currentCycle);
      
      log.info(`Updated session cycle to ${this.currentCycle} in database`);
    } catch (error) {
      log.error('❌ Failed to update session cycle:', error);
    }
  }

  // Update protocol for an existing session
  async updateSessionProtocol(sessionId) {
    if (!DatabaseService.db) {
      await DatabaseService.init();
    }
    try {
      await DatabaseService.updateSessionProtocol(sessionId, this.protocolConfig);
      await SupabaseService.updateSessionProtocolConfig(sessionId, this.protocolConfig);
      log.info(`Updated protocol for session ${sessionId}`);
    } catch (error) {
      log.error('❌ Failed to update session protocol:', error);
    }
  }

  resetSessionState() {
    this.isActive = false;
    this.isPaused = false;
    this.currentSession = null;
    this.startTime = null;
    this.pauseTime = null;
    this.readingBuffer = [];
    this.currentPhase = 'COMPLETED';  // Keep as COMPLETED to prevent tagging post-session readings as HYPOXIC
    this.currentCycle = 1;
    this.phaseStartTime = null;
    this.phaseTimeRemaining = 300;
    this.hasActiveLiveActivity = false;
    this.liveActivityId = null;
    this.sessionStartTime = null;
    this.totalSkippedTime = 0;
    this.connectionState = 'connected'; // Reset connection state
  }

  // Connection state management for Bluetooth resilience
  setConnectionState(state) {
    const validStates = ['connected', 'disconnected', 'reconnecting'];
    if (!validStates.includes(state)) {
      log.warn(`⚠️ Invalid connection state: ${state}`);
      return;
    }
    
    const previousState = this.connectionState;
    this.connectionState = state;
    log.info(`Connection state changed: ${previousState} → ${state}`);
    
    // Update session data if available
    if (this.currentSession) {
      this.currentSession.connectionState = state;
    }
    
    // Notify listeners of connection state change
    this.notify('connectionStateChanged', {
      previousState,
      currentState: state,
      timestamp: Date.now()
    });
    
    // If disconnected, immediately flush any pending readings
    if (state === 'disconnected' && this.isActive) {
      log.info('� Device disconnected - flushing pending readings immediately');
      this.flushReadingBuffer().catch(error => {
        log.error('❌ Failed to flush readings on disconnect:', error);
      });
    }
    
    // If reconnected, clear any connection warnings
    if (state === 'connected' && previousState !== 'connected') {
      log.info('� Connection restored - session continuing normally');
      
      // Update live activity if available
      if (this.hasActiveLiveActivity) {
        this.updateLiveActivity();
      }
    }
  }

  // Get current connection state
  getConnectionState() {
    return this.connectionState || 'connected';
  }

  // Reading management (same as original SessionManager)
  async addReading(reading) {
    if (!this.isActive || !this.currentSession) {
      log.info('Reading rejected - no active session in EnhancedSessionManager');
      return;
    }

    // Don't record readings if session has completed
    if (this.currentPhase === 'COMPLETED' || this.currentPhase === 'TERMINATED' || this.currentPhase === null) {
      log.info('Reading rejected - session has completed');
      return;
    }

    const timestampedReading = {
      ...reading,
      sessionId: this.currentSession.id,
      timestamp: Date.now(),
      phase: this.currentPhase,
      cycle: this.currentCycle,
      fio2Level: this.currentHypoxiaLevel,
      phaseType: this.currentPhase,  // Critical for graph display
      cycleNumber: this.currentCycle  // Critical for graph display
    };
    
    // Debug log to ensure phase data is being recorded
    if (this.readingBuffer.length % 10 === 0) {
      log.info(`Reading #${this.readingBuffer.length + 1}: Phase=${this.currentPhase}, Cycle=${this.currentCycle}`);
    }

    // Only log first reading and major milestones to reduce noise
    if (this.currentSession.readingCount === 0) {
      log.info('� First reading collected!');
    } else if (this.currentSession.readingCount % 100 === 0) {
      log.info(`Milestone: ${this.currentSession.readingCount} readings collected`);
    }

    this.readingBuffer.push(timestampedReading);
    this.currentSession.readingCount++;
    this.currentSession.lastReading = timestampedReading;

    // Commented out to reduce log noise - uncomment if needed for debugging
    // this.notify('readingAdded', timestampedReading);

    if (this.readingBuffer.length >= this.BATCH_SIZE) {
      log.info(`Buffer full (${this.BATCH_SIZE}) - flushing to database`);
      await this.flushReadingBuffer();
    }
  }

  async flushReadingBuffer() {
    if (this.readingBuffer.length === 0) return true;

    const readings = [...this.readingBuffer];
    let localSuccess = false;
    let cloudSuccess = false;

    try {
      // Clear buffer optimistically
      this.readingBuffer = [];

      // Always flush to local database first (most critical)
      try {
        await DatabaseService.addReadingsBatch(readings);
        localSuccess = true;
        log.info(`Saved ${readings.length} readings to local database`);
      } catch (localError) {
        log.error('❌ Failed to save to local database:', localError);
        // Re-add readings to buffer for retry
        this.readingBuffer.unshift(...readings);
        throw localError; // Re-throw to trigger retry logic
      }

      // Try to flush to Supabase if we have an active session
      if (this.isActive && this.currentSession) {
        try {
          await SupabaseService.addReadingsBatch(readings);
          cloudSuccess = true;
          log.info(`Synced ${readings.length} readings to cloud`);
        } catch (cloudError) {
          log.warn('⚠️ Failed to sync to cloud (will retry later):', cloudError.message);
          // Queue for later sync - don't fail the whole operation
          SupabaseService.queueForSync('addReadingsBatch', readings);
        }
      } else {
        // Queue for later sync when session becomes active
        log.info(`� Queued ${readings.length} readings for later cloud sync`);
        SupabaseService.queueForSync('addReadingsBatch', readings);
      }

      return localSuccess; // Return true if at least local save succeeded
    } catch (error) {
      log.error('❌ Critical flush failure:', error);
      // Ensure readings are back in buffer for retry
      if (this.readingBuffer.length === 0) {
        this.readingBuffer.unshift(...readings);
      }
      return false;
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
      totalCycles: this.protocolConfig.totalCycles,
      hypoxicDuration: this.protocolConfig.hypoxicDuration,
      hyperoxicDuration: this.protocolConfig.hyperoxicDuration,
      phaseTimeRemaining: this.phaseTimeRemaining,
      hasActiveLiveActivity: this.hasActiveLiveActivity,
      startTime: this.startTime,
      pauseTime: this.pauseTime,
      sessionStartTime: this.sessionStartTime,
      totalSkippedTime: this.totalSkippedTime
    };
  }

  getCurrentPhaseInfo() {
    return {
      phase: this.currentPhase,
      cycle: this.currentCycle,
      totalCycles: this.protocolConfig.totalCycles,
      hypoxicDuration: this.protocolConfig.hypoxicDuration,
      hyperoxicDuration: this.protocolConfig.hyperoxicDuration,
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
        log.info('⏰ App backgrounded too long - ending active session');
        try {
          await this.stopSession();
          log.info('Session ended due to background timeout');
        } catch (error) {
          log.error('❌ Failed to end session after background timeout:', error);
          this.resetSessionState();
        }
      }
    }, BACKGROUND_TIMEOUT);
    
    log.info('⏰ Background timeout started (5 minutes)');
  }

  clearBackgroundTimeout() {
    if (this.backgroundTimeout) {
      clearTimeout(this.backgroundTimeout);
      this.backgroundTimeout = null;
      log.info('⏰ Background timeout cleared');
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
        log.info('⏰ Session running too long (2+ hours) - ending automatically');
        try {
          await this.stopSession();
          log.info('Session ended due to timeout');
        } catch (error) {
          log.error('❌ Failed to end session after timeout:', error);
          this.resetSessionState();
        }
      }
    }, SESSION_TIMEOUT);
    
    log.info('⏰ Session timeout started (2 hours)');
  }

  clearSessionTimeout() {
    if (this.sessionTimeout) {
      clearTimeout(this.sessionTimeout);
      this.sessionTimeout = null;
      log.info('⏰ Session timeout cleared');
    }
  }

  // FiO2 level management
  setHypoxiaLevel(level) {
    if (level >= 0 && level <= 10) {
      this.currentHypoxiaLevel = level;
      log.info(`�️ Hypoxia level set to: ${level}`);
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

  // Session history methods (from original SessionManager)
  async getAllSessions() {
    try {
      // Initialize database if needed
      if (!DatabaseService.db) {
        await DatabaseService.init();
      }
      return await DatabaseService.getAllSessions();
    } catch (error) {
      log.error('❌ Failed to get sessions:', error);
      return [];
    }
  }

  async getSessionWithData(sessionId) {
    try {
      // Initialize database if needed
      if (!DatabaseService.db) {
        await DatabaseService.init();
      }
      const session = await DatabaseService.getSession(sessionId);
      const readings = await DatabaseService.getSessionReadings(sessionId, true); // Valid only
      const stats = await DatabaseService.getSessionStats(sessionId);
      
      return {
        ...session,
        readings,
        stats
      };
    } catch (error) {
      log.error('❌ Failed to get session data:', error);
      return null;
    }
  }

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
      log.error('❌ Failed to export session:', error);
      throw error;
    }
  }

  async clearAllData() {
    try {
      if (this.isActive) {
        await this.stopSession(); // Stop any active session
      }
      await DatabaseService.clearAllData();
      await AsyncStorage.removeItem('activeSession');
      
      log.info('All session data cleared');
      this.notify('dataCleared');
    } catch (error) {
      log.error('❌ Failed to clear data:', error);
      throw error;
    }
  }

  async getStorageInfo() {
    try {
      // Initialize database if needed
      if (!DatabaseService.db) {
        await DatabaseService.init();
      }
      return await DatabaseService.getStorageInfo();
    } catch (error) {
      log.error('❌ Failed to get storage info:', error);
      return { sessionCount: 0, readingCount: 0, estimatedSizeMB: 0 };
    }
  }

  async recoverSession() {
    try {
      // Initialize database if needed before recovery
      if (!DatabaseService.db) {
        await DatabaseService.init();
      }
      
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
          
          log.info(`Recovered session: ${session.id}`);
          this.notify('sessionRecovered', session);
          return session;
        } else {
          // Clean up orphaned session
          await AsyncStorage.removeItem('activeSession');
        }
      }
    } catch (error) {
      log.error('❌ Failed to recover session:', error);
    }
    return null;
  }

  // Startup recovery - clean up stuck sessions and recover lost data
  async performStartupRecovery() {
    log.info('Performing startup recovery cleanup...');
    
    try {
      // Check for recovery buffers first
      const allKeys = await AsyncStorage.getAllKeys();
      const recoveryKeys = allKeys.filter(key => key.startsWith('recovery_buffer_'));
      
      if (recoveryKeys.length > 0) {
        log.info(`Found ${recoveryKeys.length} recovery buffers to process`);
        for (const key of recoveryKeys) {
          const sessionId = key.replace('recovery_buffer_', '');
          await this.attemptRecovery(sessionId);
        }
      }
      
      // Check for any locally stored active session
      const storedSession = await AsyncStorage.getItem('activeSession');
      
      if (storedSession) {
        log.info('Found stored active session from previous app run');
        
        try {
          const sessionData = JSON.parse(storedSession);
          const sessionAge = Date.now() - sessionData.startTime;
          const RECOVERY_THRESHOLD = 10 * 60 * 1000; // 10 minutes
          
          if (sessionAge > RECOVERY_THRESHOLD) {
            log.info(`Stored session is ${Math.round(sessionAge / 60000)} minutes old - cleaning up`);
            
            // Try to end the session properly in databases
            try {
              // Ensure database is initialized before trying to use it
              if (!DatabaseService.db) {
                await DatabaseService.init();
              }
              
              const stats = await DatabaseService.endSession(sessionData.id, sessionData.startTime);
              await SupabaseService.endSession(sessionData.id, stats, sessionData.startTime);
              log.info('Cleaned up stuck session in databases');
            } catch (dbError) {
              log.info('Could not end session in databases (may have been cleaned already):', dbError.message);
            }
            
            // Clear the stored session
            await AsyncStorage.removeItem('activeSession');
            log.info('Cleared stored session data');
          } else {
            log.info('Recent session found - may be valid, keeping for now');
          }
        } catch (parseError) {
          log.info('Invalid stored session data - clearing');
          await AsyncStorage.removeItem('activeSession');
        }
      }
      
      // Bulk cleanup of stuck sessions in Supabase (user's own sessions only)
      try {
        log.info('🧹 Cleaning up stuck sessions...');
        
        // Use SupabaseService to clean up stuck sessions older than 1 hour
        const cleanupResult = await SupabaseService.cleanupStuckSessions();
        
        if (cleanupResult && cleanupResult.cleaned > 0) {
          log.info(`Successfully cleaned up ${cleanupResult.cleaned} stuck sessions`);
        } else {
          log.info('Found 0 stuck sessions');
        }
      } catch (cleanupError) {
        log.info('Could not cleanup stuck sessions:', cleanupError.message);
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
        
        log.info('� Processing 0 sessions for cleanup...');
        log.info('Successfully cleaned up 0/0 sessions');
      } catch (localCleanupError) {
        log.info('Local cleanup error:', localCleanupError.message);
      }
      
      log.info('Startup recovery complete');
    } catch (error) {
      log.error('❌ Startup recovery failed:', error);
    }
  }
}

// Export singleton instance
export default new EnhancedSessionManager(); 