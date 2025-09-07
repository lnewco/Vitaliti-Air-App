/**
 * NativeBackgroundService - Implementation using native modules
 * 
 * This service uses react-native-background-timer and other native modules
 * for true background processing. Only available in development/production builds.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import BaseBackgroundService from '../abstract/BaseBackgroundService';
import moduleLoader from '../../modules/ModuleLoader';

const BACKGROUND_STATE_KEY = '@background_session_state';
const BACKGROUND_SYNC_KEY = '@background_sync_data';

export default class NativeBackgroundService extends BaseBackgroundService {
  constructor() {
    super();
    this.isNative = true;
    this.backgroundTimer = null;
    this.backgroundInterval = null;
    this.phaseStartTime = null;
    this.lastSyncTime = null;
  }

  async initialize() {
    console.log('🚀 Initializing Native Background Service');
    
    // Load native background timer module
    this.backgroundTimer = await moduleLoader.loadBackgroundTimer();
    
    if (!this.backgroundTimer || !this.backgroundTimer.isNative) {
      console.warn('⚠️ Native BackgroundTimer not available, service degraded');
      this.isNative = false;
    }
    
    // Clear any stale background state
    await this.clearStaleBackgroundState();
    
    return true;
  }

  async startBackgroundMonitoring(sessionData) {
    if (!this.backgroundTimer) {
      console.warn('⚠️ BackgroundTimer not available');
      return false;
    }

    console.log('📱 Starting native background monitoring for session:', sessionData.id);
    
    this.isActive = true;
    this.sessionData = sessionData;
    this.phaseStartTime = Date.now();
    
    // Save initial state
    await this.saveBackgroundState({
      sessionId: sessionData.id,
      startTime: Date.now(),
      currentPhase: sessionData.currentPhase,
      currentCycle: sessionData.currentCycle,
      phaseTimeRemaining: sessionData.phaseTimeRemaining,
      isActive: true,
      isPaused: false,
    });
    
    // Start background timer that continues even when app is backgrounded
    this.backgroundInterval = this.backgroundTimer.runBackgroundTimer(() => {
      this.backgroundTick();
    }, 1000);
    
    console.log('✅ Native background monitoring started');
    return true;
  }

  async backgroundTick() {
    if (!this.isActive || !this.sessionData) return;
    
    try {
      // Get current state
      const state = await this.getBackgroundState();
      if (!state || !state.isActive || state.isPaused) return;
      
      // Calculate time elapsed
      const now = Date.now();
      const elapsed = Math.floor((now - this.phaseStartTime) / 1000);
      
      // Update phase time remaining
      const phaseDuration = state.currentPhase === 'HYPOXIC' 
        ? this.sessionData.hypoxicDuration 
        : this.sessionData.hyperoxicDuration;
      
      const timeRemaining = Math.max(0, phaseDuration - elapsed);
      
      // Check for phase transition
      let phaseChanged = false;
      let newPhase = state.currentPhase;
      let newCycle = state.currentCycle;
      
      if (timeRemaining === 0) {
        if (state.currentPhase === 'HYPOXIC') {
          newPhase = 'HYPEROXIC';
          phaseChanged = true;
        } else {
          newCycle = state.currentCycle + 1;
          newPhase = 'HYPOXIC';
          phaseChanged = true;
        }
        
        this.phaseStartTime = now;
      }
      
      // Update state
      await this.saveBackgroundState({
        ...state,
        currentPhase: newPhase,
        currentCycle: newCycle,
        phaseTimeRemaining: timeRemaining,
        lastUpdate: now,
        phaseChanges: (state.phaseChanges || 0) + (phaseChanged ? 1 : 0),
      });
      
      // Save sync data if phase changed
      if (phaseChanged) {
        await this.saveSyncData({
          timestamp: now,
          event: 'phaseChange',
          fromPhase: state.currentPhase,
          toPhase: newPhase,
          cycle: newCycle,
        });
      }
      
    } catch (error) {
      console.error('❌ Background tick error:', error);
    }
  }

  async stopBackgroundMonitoring() {
    console.log('🛑 Stopping native background monitoring');
    
    if (this.backgroundInterval && this.backgroundTimer) {
      this.backgroundTimer.stopBackgroundTimer(this.backgroundInterval);
      this.backgroundInterval = null;
    }
    
    this.isActive = false;
    this.sessionData = null;
    
    // Clear background state
    await AsyncStorage.removeItem(BACKGROUND_STATE_KEY);
    await AsyncStorage.removeItem(BACKGROUND_SYNC_KEY);
    
    console.log('✅ Native background monitoring stopped');
    return true;
  }

  async updateBackgroundState(state) {
    const currentState = await this.getBackgroundState();
    
    await this.saveBackgroundState({
      ...currentState,
      ...state,
      lastUpdate: Date.now(),
    });
  }

  async syncWithBackgroundState() {
    console.log('🔄 Syncing with native background state');
    
    const state = await this.getBackgroundState();
    const syncData = await this.getSyncData();
    
    if (!state || !state.isActive) {
      console.log('📱 No active background session to sync');
      return null;
    }
    
    // Calculate current state based on elapsed time
    const now = Date.now();
    const timeSinceLastUpdate = (now - state.lastUpdate) / 1000;
    
    // Adjust phase time remaining
    if (!state.isPaused) {
      state.phaseTimeRemaining = Math.max(0, state.phaseTimeRemaining - timeSinceLastUpdate);
    }
    
    console.log('✅ Synced with background state:', {
      phaseChanges: syncData ? syncData.length : 0,
      currentPhase: state.currentPhase,
      phaseTimeRemaining: state.phaseTimeRemaining,
    });
    
    // Clear sync data after reading
    await AsyncStorage.removeItem(BACKGROUND_SYNC_KEY);
    
    return {
      ...state,
      syncData,
    };
  }

  async pauseBackgroundSession() {
    const state = await this.getBackgroundState();
    
    if (state && state.isActive) {
      await this.saveBackgroundState({
        ...state,
        isPaused: true,
        pauseTime: Date.now(),
      });
      
      console.log('⏸️ Background session paused');
    }
  }

  async resumeBackgroundSession() {
    const state = await this.getBackgroundState();
    
    if (state && state.isActive && state.isPaused) {
      // Adjust phase start time for pause duration
      const pauseDuration = Date.now() - state.pauseTime;
      this.phaseStartTime += pauseDuration;
      
      await this.saveBackgroundState({
        ...state,
        isPaused: false,
        pauseTime: null,
      });
      
      console.log('▶️ Background session resumed');
    }
  }

  // Helper methods
  
  async saveBackgroundState(state) {
    try {
      await AsyncStorage.setItem(BACKGROUND_STATE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error('❌ Failed to save background state:', error);
    }
  }

  async getBackgroundState() {
    try {
      const stateStr = await AsyncStorage.getItem(BACKGROUND_STATE_KEY);
      return stateStr ? JSON.parse(stateStr) : null;
    } catch (error) {
      console.error('❌ Failed to get background state:', error);
      return null;
    }
  }

  async saveSyncData(data) {
    try {
      const existing = await this.getSyncData();
      const syncData = existing || [];
      syncData.push(data);
      
      await AsyncStorage.setItem(BACKGROUND_SYNC_KEY, JSON.stringify(syncData));
    } catch (error) {
      console.error('❌ Failed to save sync data:', error);
    }
  }

  async getSyncData() {
    try {
      const dataStr = await AsyncStorage.getItem(BACKGROUND_SYNC_KEY);
      return dataStr ? JSON.parse(dataStr) : null;
    } catch (error) {
      console.error('❌ Failed to get sync data:', error);
      return null;
    }
  }

  async clearStaleBackgroundState() {
    const state = await this.getBackgroundState();
    
    if (state) {
      const staleTime = 2 * 60 * 60 * 1000; // 2 hours
      const now = Date.now();
      
      if (state.lastUpdate && (now - state.lastUpdate) > staleTime) {
        console.log('🧹 Clearing stale background state');
        await AsyncStorage.removeItem(BACKGROUND_STATE_KEY);
        await AsyncStorage.removeItem(BACKGROUND_SYNC_KEY);
      }
    }
  }
}