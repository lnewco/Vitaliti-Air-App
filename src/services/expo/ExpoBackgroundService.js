/**
 * ExpoBackgroundService - Fallback implementation for Expo Go
 * 
 * This service uses timestamp-based calculations and scheduled notifications
 * to simulate background processing. Works in Expo Go but with limitations.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import BaseBackgroundService from '../abstract/BaseBackgroundService';

const SESSION_STATE_KEY = '@expo_session_state';

export default class ExpoBackgroundService extends BaseBackgroundService {
  constructor() {
    super();
    this.isNative = false;
    this.phaseStartTimestamp = null;
    this.standardInterval = null;
  }

  async initialize() {
    console.log('📱 Initializing Expo Background Service (Fallback Mode)');
    
    // Configure notifications
    await Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    
    // Request notification permissions
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      console.warn('⚠️ Notification permissions not granted');
    }
    
    return true;
  }

  async startBackgroundMonitoring(sessionData) {
    console.log('📱 Starting Expo background monitoring (timestamp-based)');
    
    this.isActive = true;
    this.sessionData = sessionData;
    this.phaseStartTimestamp = Date.now();
    
    // Save session state with timestamp
    await this.saveSessionState({
      sessionId: sessionData.id,
      startTimestamp: Date.now(),
      phaseStartTimestamp: this.phaseStartTimestamp,
      currentPhase: sessionData.currentPhase,
      currentCycle: sessionData.currentCycle,
      totalCycles: sessionData.totalCycles,
      hypoxicDuration: sessionData.hypoxicDuration,
      hyperoxicDuration: sessionData.hyperoxicDuration,
      isActive: true,
      isPaused: false,
    });
    
    // Schedule notifications for phase changes
    await this.schedulePhaseNotifications(sessionData);
    
    // Start standard interval for foreground updates
    this.standardInterval = setInterval(() => {
      this.updateTimerDisplay();
    }, 1000);
    
    console.log('✅ Expo background monitoring started (limited functionality)');
    console.warn('⚠️ Note: Timer will pause when app is backgrounded in Expo Go');
    
    return true;
  }

  async schedulePhaseNotifications(sessionData) {
    // Cancel any existing notifications
    await Notifications.cancelAllScheduledNotificationsAsync();
    
    const { currentPhase, currentCycle, totalCycles, hypoxicDuration, hyperoxicDuration } = sessionData;
    
    let notificationTime = Date.now();
    let phase = currentPhase;
    let cycle = currentCycle;
    const notifications = [];
    
    // Calculate and schedule notifications for remaining phases
    while (cycle <= totalCycles) {
      const duration = phase === 'HYPOXIC' ? hypoxicDuration : hyperoxicDuration;
      notificationTime += duration * 1000;
      
      // Switch phase
      if (phase === 'HYPOXIC') {
        phase = 'HYPEROXIC';
        notifications.push({
          time: notificationTime,
          title: '🔵 Switch to Hyperoxic Phase',
          body: `Take OFF mask - Cycle ${cycle}/${totalCycles}`,
        });
      } else {
        cycle++;
        if (cycle <= totalCycles) {
          phase = 'HYPOXIC';
          notifications.push({
            time: notificationTime,
            title: '🔴 Switch to Hypoxic Phase',
            body: `Put ON mask - Starting Cycle ${cycle}/${totalCycles}`,
          });
        }
      }
      
      // Limit notifications to prevent overwhelming the user
      if (notifications.length >= 10) break;
    }
    
    // Schedule the notifications
    for (const notif of notifications) {
      const trigger = new Date(notif.time);
      
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: notif.title,
            body: notif.body,
            sound: true,
            priority: 'high',
          },
          trigger,
        });
      } catch (error) {
        console.warn('⚠️ Failed to schedule notification:', error);
      }
    }
    
    console.log(`📱 Scheduled ${notifications.length} phase change notifications`);
  }

  async updateTimerDisplay() {
    // This is called every second when app is in foreground
    // Used to update UI, actual time calculation happens in syncWithBackgroundState
    if (this.isActive && this.sessionData) {
      // Notify listeners for UI updates
      // The actual time calculation will be done by EnhancedSessionManager
    }
  }

  async stopBackgroundMonitoring() {
    console.log('🛑 Stopping Expo background monitoring');
    
    if (this.standardInterval) {
      clearInterval(this.standardInterval);
      this.standardInterval = null;
    }
    
    // Cancel scheduled notifications
    await Notifications.cancelAllScheduledNotificationsAsync();
    
    this.isActive = false;
    this.sessionData = null;
    
    // Clear session state
    await AsyncStorage.removeItem(SESSION_STATE_KEY);
    
    console.log('✅ Expo background monitoring stopped');
    return true;
  }

  async updateBackgroundState(state) {
    const currentState = await this.getSessionState();
    
    if (currentState) {
      await this.saveSessionState({
        ...currentState,
        ...state,
        lastUpdate: Date.now(),
      });
    }
  }

  async syncWithBackgroundState() {
    console.log('🔄 Calculating state from timestamps (Expo mode)');
    
    const state = await this.getSessionState();
    
    if (!state || !state.isActive) {
      console.log('📱 No active session to sync');
      return null;
    }
    
    const now = Date.now();
    
    // Calculate elapsed time since phase started
    let elapsedMs = now - state.phaseStartTimestamp;
    
    // Adjust for pause if applicable
    if (state.isPaused && state.pauseTimestamp) {
      elapsedMs = state.pauseTimestamp - state.phaseStartTimestamp;
    }
    
    const elapsedSeconds = Math.floor(elapsedMs / 1000);
    
    // Calculate current phase and cycle based on elapsed time
    let totalElapsed = elapsedSeconds;
    let currentPhase = state.currentPhase;
    let currentCycle = state.currentCycle;
    let phaseTimeRemaining = 0;
    let phaseChanges = 0;
    
    // Simulate phase progression based on elapsed time
    while (totalElapsed > 0 && currentCycle <= state.totalCycles) {
      const phaseDuration = currentPhase === 'HYPOXIC' 
        ? state.hypoxicDuration 
        : state.hyperoxicDuration;
      
      if (totalElapsed >= phaseDuration) {
        // Phase completed
        totalElapsed -= phaseDuration;
        phaseChanges++;
        
        if (currentPhase === 'HYPOXIC') {
          currentPhase = 'HYPEROXIC';
        } else {
          currentCycle++;
          currentPhase = 'HYPOXIC';
        }
      } else {
        // Currently in this phase
        phaseTimeRemaining = phaseDuration - totalElapsed;
        break;
      }
    }
    
    const syncedState = {
      ...state,
      currentPhase,
      currentCycle,
      phaseTimeRemaining,
      phaseChanges,
      syncedAt: now,
    };
    
    console.log('✅ State calculated from timestamps:', {
      elapsed: elapsedSeconds,
      phaseChanges,
      currentPhase,
      phaseTimeRemaining,
    });
    
    // Update stored state
    await this.saveSessionState(syncedState);
    
    return syncedState;
  }

  async pauseBackgroundSession() {
    const state = await this.getSessionState();
    
    if (state && state.isActive) {
      await this.saveSessionState({
        ...state,
        isPaused: true,
        pauseTimestamp: Date.now(),
      });
      
      // Cancel remaining notifications
      await Notifications.cancelAllScheduledNotificationsAsync();
      
      console.log('⏸️ Session paused (Expo mode)');
    }
  }

  async resumeBackgroundSession() {
    const state = await this.getSessionState();
    
    if (state && state.isActive && state.isPaused) {
      const pauseDuration = Date.now() - state.pauseTimestamp;
      
      // Adjust phase start timestamp
      const newPhaseStart = state.phaseStartTimestamp + pauseDuration;
      
      await this.saveSessionState({
        ...state,
        isPaused: false,
        pauseTimestamp: null,
        phaseStartTimestamp: newPhaseStart,
      });
      
      // Reschedule notifications from current point
      await this.schedulePhaseNotifications({
        ...state,
        phaseStartTimestamp: newPhaseStart,
      });
      
      console.log('▶️ Session resumed (Expo mode)');
    }
  }

  // Helper methods
  
  async saveSessionState(state) {
    try {
      await AsyncStorage.setItem(SESSION_STATE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error('❌ Failed to save session state:', error);
    }
  }

  async getSessionState() {
    try {
      const stateStr = await AsyncStorage.getItem(SESSION_STATE_KEY);
      return stateStr ? JSON.parse(stateStr) : null;
    } catch (error) {
      console.error('❌ Failed to get session state:', error);
      return null;
    }
  }
}