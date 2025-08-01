// Conditional imports for Expo Go compatibility
let BackgroundTask = null;
let TaskManager = null;

try {
  BackgroundTask = require('expo-background-task');
  TaskManager = require('expo-task-manager');
} catch (error) {
  console.log('Background task modules not available in Expo Go');
}

import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKGROUND_SESSION_TASK = 'background-session-task';
const BACKGROUND_SESSION_KEY = 'background_session_state';

// Global task definition - must be called in global scope (only if TaskManager is available)
if (TaskManager) {
  TaskManager.defineTask(BACKGROUND_SESSION_TASK, async () => {
  try {
    console.log('🔄 Background task executing...');
    
    // Get current session state from storage
    const sessionStateJson = await AsyncStorage.getItem(BACKGROUND_SESSION_KEY);
    if (!sessionStateJson) {
      console.log('⚠️ No background session state found');
      return BackgroundTask.BackgroundTaskResult.NoData;
    }

    const sessionState = JSON.parse(sessionStateJson);
    const now = Date.now();
    
    // Update session timer
    if (sessionState.isActive && !sessionState.isPaused) {
      const elapsed = Math.floor((now - sessionState.startTime) / 1000);
      
      // Check if we need to advance phase
      const phaseElapsed = Math.floor((now - sessionState.phaseStartTime) / 1000);
      let updatedState = { ...sessionState };
      
      // Get protocol durations from session state (with fallbacks)
      const hypoxicDuration = sessionState.hypoxicDuration || 300; // 5 minutes default
      const hyperoxicDuration = sessionState.hyperoxicDuration || 120; // 2 minutes default  
      const totalCycles = sessionState.totalCycles || 5; // 5 cycles default

      if (sessionState.currentPhase === 'HYPOXIC' && phaseElapsed >= hypoxicDuration) {
        // Advance to hyperoxic phase
        updatedState.currentPhase = 'HYPEROXIC';
        updatedState.phaseStartTime = now;
        console.log('🔄 Advanced to HYPEROXIC phase in background');
      } else if (sessionState.currentPhase === 'HYPEROXIC' && phaseElapsed >= hyperoxicDuration) {
        // Advance to next cycle or complete
        if (sessionState.currentCycle >= totalCycles) {
          // Session complete
          updatedState.isActive = false;
          updatedState.isCompleted = true;
          console.log('✅ IHHT session completed in background');
        } else {
          // Next cycle
          updatedState.currentCycle += 1;
          updatedState.currentPhase = 'HYPOXIC';
          updatedState.phaseStartTime = now;
          console.log(`🔄 Advanced to cycle ${updatedState.currentCycle} in background`);
        }
      }
      
      // Safety check - auto-pause if session runs too long (fail-safe)
      if (elapsed > 3600) { // 1 hour max
        updatedState.isPaused = true;
        updatedState.pauseReason = 'AUTO_SAFETY_PAUSE';
        console.log('⚠️ Auto-paused session due to safety timeout');
      }
      
      // Save updated state
      await AsyncStorage.setItem(BACKGROUND_SESSION_KEY, JSON.stringify(updatedState));
      
      console.log(`🕐 Background session update: ${elapsed}s elapsed, phase: ${updatedState.currentPhase}, cycle: ${updatedState.currentCycle}`);
    }
    
          return BackgroundTask?.BackgroundTaskResult?.NewData;
  } catch (error) {
    console.error('❌ Background task failed:', error);
    return BackgroundTask?.BackgroundTaskResult?.Failed;
  }
  });
}

export class BackgroundSessionManager {
  /**
   * Start background monitoring for the current session
   */
  static async startBackgroundMonitoring(sessionData) {
    if (!BackgroundTask || !TaskManager) {
      console.log('⚠️ Background tasks not available - running in Expo Go mode');
      return false;
    }
    
    try {
      // Save initial session state for background task
      const backgroundState = {
        sessionId: sessionData.id,
        startTime: sessionData.startTime,
        phaseStartTime: sessionData.startTime,
        currentPhase: 'HYPOXIC',
        currentCycle: 1,
        totalCycles: 5,
        isActive: true,
        isPaused: false,
        isCompleted: false
      };
      
      await AsyncStorage.setItem(BACKGROUND_SESSION_KEY, JSON.stringify(backgroundState));
      
      // Register background task
      await BackgroundTask.registerTaskAsync(BACKGROUND_SESSION_TASK, {
        minimumInterval: 60, // Check every minute minimum
      });
      
      console.log('✅ Background session monitoring started');
      return true;
    } catch (error) {
      console.error('❌ Failed to start background monitoring:', error);
      return false;
    }
  }

  /**
   * Update background session state (call when phase/cycle changes)
   */
  static async updateBackgroundState(updates) {
    try {
      const sessionStateJson = await AsyncStorage.getItem(BACKGROUND_SESSION_KEY);
      if (sessionStateJson) {
        const currentState = JSON.parse(sessionStateJson);
        const updatedState = { ...currentState, ...updates };
        await AsyncStorage.setItem(BACKGROUND_SESSION_KEY, JSON.stringify(updatedState));
        console.log('🔄 Background state updated:', updates);
      }
    } catch (error) {
      console.error('❌ Failed to update background state:', error);
    }
  }

  /**
   * Pause background session monitoring
   */
  static async pauseBackgroundSession() {
    await this.updateBackgroundState({
      isPaused: true,
      pauseTime: Date.now()
    });
  }

  /**
   * Resume background session monitoring
   */
  static async resumeBackgroundSession() {
    await this.updateBackgroundState({
      isPaused: false,
      pauseTime: null
    });
  }

  /**
   * Stop background monitoring
   */
  static async stopBackgroundMonitoring() {
    if (!BackgroundTask || !TaskManager) {
      console.log('⚠️ Background tasks not available - running in Expo Go mode');
      return false;
    }
    
    try {
      // Unregister background task
      await BackgroundTask.unregisterTaskAsync(BACKGROUND_SESSION_TASK);
      
      // Clear background state
      await AsyncStorage.removeItem(BACKGROUND_SESSION_KEY);
      
      console.log('🛑 Background session monitoring stopped');
      return true;
    } catch (error) {
      console.error('❌ Failed to stop background monitoring:', error);
      return false;
    }
  }

  /**
   * Get current background session state
   */
  static async getBackgroundState() {
    try {
      const sessionStateJson = await AsyncStorage.getItem(BACKGROUND_SESSION_KEY);
      return sessionStateJson ? JSON.parse(sessionStateJson) : null;
    } catch (error) {
      console.error('❌ Failed to get background state:', error);
      return null;
    }
  }

  /**
   * Check if background task is available
   */
  static async isBackgroundTaskAvailable() {
    if (!BackgroundTask || !TaskManager) {
      return false;
    }
    
    try {
      const status = await BackgroundTask.getStatusAsync();
      return status === BackgroundTask.BackgroundTaskStatus.Available;
    } catch (error) {
      console.error('❌ Failed to check background task status:', error);
      return false;
    }
  }

  /**
   * Sync foreground session with background state (call on app foreground)
   */
  static async syncWithBackgroundState() {
    try {
      const backgroundState = await this.getBackgroundState();
      if (backgroundState && backgroundState.isActive) {
        console.log('🔄 Syncing with background state:', backgroundState);
        return backgroundState;
      }
      return null;
    } catch (error) {
      console.error('❌ Failed to sync with background state:', error);
      return null;
    }
  }
} 