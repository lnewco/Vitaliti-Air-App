import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, AppState } from 'react-native';
import DatabaseService from './DatabaseService';
import SupabaseService from './SupabaseService';

// Import Background Session Manager conditionally
let BackgroundSessionManager = null;
try {
  BackgroundSessionManager = require('./BackgroundSessionManager').BackgroundSessionManager;
} catch (error) {
  console.log('Background Session Manager not available in Expo Go');
}

// Import the Live Activity module for iOS
let LiveActivityModule = null;
if (Platform.OS === 'ios') {
  try {
    LiveActivityModule = require('../../modules/live-activity').default;
  } catch (error) {
    console.warn('Live Activity module not available:', error);
  }
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
        console.log('📱 App backgrounded - starting background monitoring');
        await this.startBackgroundMonitoring();
      } else if (nextAppState === 'active') {
        console.log('📱 App foregrounded - syncing with background state');
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
  async startSession() {
    if (this.isActive) {
      throw new Error('Session already active');
    }

    try {
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Initialize database if needed
      if (!DatabaseService.db) {
        await DatabaseService.init();
      }

      // Create session in databases
      await DatabaseService.createSession(sessionId);
      await SupabaseService.createSession({
        id: sessionId,
        startTime: Date.now()
      });

      // Set session state
      this.currentSession = {
        id: sessionId,
        startTime: Date.now(),
        readingCount: 0,
        lastReading: null
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

  async startLiveActivity() {
    if (!LiveActivityModule || Platform.OS !== 'ios') {
      console.log('🚫 Live Activity not supported on this platform');
      return;
    }

    try {
      const result = await LiveActivityModule.startActivity({
        sessionId: this.currentSession.id,
        sessionType: 'IHHT',
        startTime: this.startTime,
        totalCycles: this.totalCycles
      });

      if (result.success) {
        this.hasActiveLiveActivity = true;
        this.liveActivityId = result.activityId;
        console.log('🌟 Live Activity started:', result.activityId);
      }
    } catch (error) {
      console.error('❌ Failed to start Live Activity:', error);
    }
  }

  async updateLiveActivity() {
    if (!this.hasActiveLiveActivity || !LiveActivityModule) return;

    try {
      await LiveActivityModule.updateActivity({
        currentPhase: this.currentPhase,
        currentCycle: this.currentCycle,
        phaseTimeRemaining: this.phaseTimeRemaining,
        pausedAt: this.isPaused ? Date.now() : undefined
      });
    } catch (error) {
      console.error('❌ Failed to update Live Activity:', error);
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
      throw new Error('No active session');
    }

    try {
      // Stop timers
      if (this.phaseTimer) {
        clearInterval(this.phaseTimer);
        this.phaseTimer = null;
      }

      // Stop background monitoring (if available)
      if (BackgroundSessionManager) {
        await BackgroundSessionManager.stopBackgroundMonitoring();
      }

      // Stop Live Activity
      await this.stopLiveActivity();

      // Flush any remaining readings
      await this.flushReadingBuffer();
      
      // Stop batch processing
      this.stopBatchProcessing();

      // End session in databases
      const stats = await DatabaseService.endSession(this.currentSession.id);
      await SupabaseService.endSession(this.currentSession.id, {
        ...stats,
        totalCycles: this.currentCycle,
        completedPhases: this.currentPhase === 'COMPLETED' ? this.totalCycles * 2 : (this.currentCycle - 1) * 2 + (this.currentPhase === 'HYPEROXIC' ? 1 : 0)
      });

      const completedSession = {
        ...this.currentSession,
        endTime: Date.now(),
        stats,
        status: 'completed',
        currentCycle: this.currentCycle,
        currentPhase: this.currentPhase
      };

      console.log(`🏁 Enhanced session completed: ${this.currentSession.id}`, stats);

      // Reset state
      this.resetSessionState();

      // Clear storage
      await AsyncStorage.removeItem('activeSession');

      this.notify('sessionEnded', completedSession);

      return completedSession;
    } catch (error) {
      console.error('❌ Failed to stop enhanced session:', error);
      throw error;
    }
  }

  async stopLiveActivity() {
    if (!this.hasActiveLiveActivity || !LiveActivityModule) return;

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
      return;
    }

    const timestampedReading = {
      ...reading,
      sessionId: this.currentSession.id,
      timestamp: Date.now(),
      phase: this.currentPhase,
      cycle: this.currentCycle
    };

    this.readingBuffer.push(timestampedReading);
    this.currentSession.readingCount++;
    this.currentSession.lastReading = timestampedReading;

    this.notify('readingAdded', timestampedReading);

    if (this.readingBuffer.length >= this.BATCH_SIZE) {
      await this.flushReadingBuffer();
    }
  }

  async flushReadingBuffer() {
    if (this.readingBuffer.length === 0) return;

    try {
      const readings = [...this.readingBuffer];
      this.readingBuffer = [];

      await DatabaseService.addReadings(readings);
      await SupabaseService.addReadings(readings);

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
}

// Export singleton instance
export default new EnhancedSessionManager(); 