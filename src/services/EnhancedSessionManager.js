/**
 * EnhancedSessionManager - Manages IHHT training sessions with hybrid background support
 * 
 * This manager automatically adapts to the runtime environment:
 * - Full native features in production/TestFlight builds
 * - Graceful fallbacks in Expo Go
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, AppState } from 'react-native';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Notifications from 'expo-notifications';
import DatabaseService from './DatabaseService';
import SupabaseService from './SupabaseService';
import serviceFactory from './ServiceFactory';
import runtimeEnvironment from '../utils/RuntimeEnvironment';

// Configure notification handling
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

class EnhancedSessionManager {
  constructor() {
    // Core session state
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
    this.phaseStartTime = null;
    this.phaseTimeRemaining = 300; // Will be set based on protocol
    this.phaseTimer = null;
    
    // Protocol configuration (defaults)
    this.protocolConfig = {
      totalCycles: 3,
      hypoxicDuration: 420,    // 7 minutes in seconds
      hyperoxicDuration: 180   // 3 minutes in seconds
    };
    
    // Service references (will be loaded based on environment)
    this.backgroundService = null;
    this.liveActivityService = null;
    this.notificationService = null;
    
    // Live Activity state
    this.hasActiveLiveActivity = false;
    
    // Timeout references
    this.backgroundTimeout = null;
    this.sessionTimeout = null;
    
    // FiO2 tracking
    this.currentHypoxiaLevel = 5; // Default hypoxia level (0-10 scale)
    
    // Buffer settings
    this.BATCH_SIZE = 50;
    this.BATCH_INTERVAL = 2000;
    
    // Track initialization
    this.initialized = false;
    
    // Setup app state handling
    this.setupAppStateHandling();
    
    // Initialize services
    this.initializeServices();
  }

  async initializeServices() {
    try {
      console.log('🎬 Starting Enhanced Session Manager initialization');
      console.log('🎬 About to initialize service factory');
      
      // Clear any leftover notifications from previous sessions immediately
      try {
        await Notifications.cancelAllScheduledNotificationsAsync();
        console.log('🔔 Cleared all notifications during initialization');
      } catch (error) {
        console.error('❌ Error clearing notifications during init:', error);
      }
      
      // Initialize service factory
      await serviceFactory.initialize();
      
      // Create services based on environment
      this.backgroundService = await serviceFactory.createBackgroundService();
      this.liveActivityService = await serviceFactory.createLiveActivityService();
      this.notificationService = await serviceFactory.createNotificationService();
      
      // Initialize Supabase
      await SupabaseService.initialize();
      console.log('☁️ Supabase service initialized');
      
      // Log capabilities
      this.logCapabilities();
      
      // Request notification permissions (might fail in Expo Go)
      try {
        await this.notificationService.requestPermission();
      } catch (error) {
        // Silently handle permission errors in Expo Go
        if (error.message && error.message.includes('ExpoPushTokenManager')) {
          console.log('📱 Notification permissions skipped in Expo Go');
        } else {
          console.warn('⚠️ Notification permission error:', error.message);
        }
      }
      
      // Perform startup recovery cleanup
      setTimeout(() => this.performStartupRecovery(), 1000);
      
      this.initialized = true;
      console.log('✅ Enhanced Session Manager initialized');
      
    } catch (error) {
      // Log error quietly without disrupting the user
      console.log('📱 Service initialization partial - running in fallback mode');
      
      // Ensure we have basic services even if some failed
      if (!this.backgroundService) {
        const ExpoBackgroundService = require('./expo/ExpoBackgroundService').default;
        this.backgroundService = new ExpoBackgroundService();
        await this.backgroundService.initialize();
      }
      
      // Continue with degraded functionality
      this.initialized = true;
    }
  }

  logCapabilities() {
    const capabilities = runtimeEnvironment.capabilities;
    console.log('📱 Session Manager Capabilities:', {
      environment: runtimeEnvironment.environmentName,
      backgroundTimer: this.backgroundService?.isNative || false,
      liveActivities: capabilities.liveActivities,
      notifications: this.notificationService?.isNative ? 'Rich' : 'Basic',
      backgroundBLE: capabilities.backgroundBLE,
    });
  }

  setupAppStateHandling() {
    AppState.addEventListener('change', this.handleAppStateChange.bind(this));
  }

  async handleAppStateChange(nextAppState) {
    console.log('📱 App state changed to:', nextAppState);
    console.log('📱 DEBUG: Session active status:', this.isActive);
    console.log('📱 DEBUG: Current session:', this.currentSession?.id);
    
    if (this.isActive) {
      if (nextAppState === 'background') {
        console.log('📱 App backgrounded - session will continue (background timeout disabled)');
        console.log('📱 DEBUG: Phase at background:', this.currentPhase, 'Cycle:', this.currentCycle);
        // DISABLED: Don't start background timeout that ends the session
        // await this.startBackgroundMonitoring();
        // this.startBackgroundTimeout();
      } else if (nextAppState === 'active') {
        console.log('📱 App foregrounded - checking session status');
        console.log('📱 DEBUG: Session still active?', this.isActive);
        console.log('📱 DEBUG: Current session after foreground:', this.currentSession?.id);
        console.log('📱 DEBUG: Phase after foreground:', this.currentPhase, 'Cycle:', this.currentCycle);
        
        if (!this.isActive) {
          console.log('🚨 DEBUG: Session was ended while in background!');
        }
        // Session should still be active, no need to sync
        // this.clearBackgroundTimeout();
        // await this.syncWithBackgroundState();
      }
    } else {
      console.log('📱 DEBUG: No active session during app state change');
    }
  }

  async startBackgroundMonitoring() {
    if (!this.currentSession || !this.backgroundService) return;
    
    try {
      await this.backgroundService.startBackgroundMonitoring({
        id: this.currentSession.id,
        currentPhase: this.currentPhase,
        currentCycle: this.currentCycle,
        phaseTimeRemaining: this.phaseTimeRemaining,
        totalCycles: this.protocolConfig.totalCycles,
        hypoxicDuration: this.protocolConfig.hypoxicDuration,
        hyperoxicDuration: this.protocolConfig.hyperoxicDuration,
      });
      
      // Update Live Activity if supported
      if (this.hasActiveLiveActivity) {
        await this.updateLiveActivity();
      }
    } catch (error) {
      console.error('❌ Error starting background monitoring:', error);
    }
  }

  async syncWithBackgroundState() {
    if (!this.backgroundService) return;
    
    try {
      const backgroundState = await this.backgroundService.syncWithBackgroundState();
      
      if (backgroundState && backgroundState.isActive) {
        // Update local state with background changes
        this.currentPhase = backgroundState.currentPhase;
        this.currentCycle = backgroundState.currentCycle;
        this.phaseTimeRemaining = backgroundState.phaseTimeRemaining;
        
        // Update Live Activity if active
        if (this.hasActiveLiveActivity) {
          await this.updateLiveActivity();
        }
        
        // Notify listeners of sync
        this.notify('backgroundSync', backgroundState);
        
        console.log('🔄 Synced with background state:', {
          phaseChanges: backgroundState.phaseChanges || 0,
          currentPhase: this.currentPhase,
          timeRemaining: this.phaseTimeRemaining,
        });
      }
    } catch (error) {
      console.error('❌ Error syncing background state:', error);
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
    // Create a copy of listeners array to avoid modification during iteration
    const listenersCopy = [...this.listeners];
    listenersCopy.forEach(listener => {
      try {
        listener(event, data);
      } catch (error) {
        console.error('Error notifying listener:', error);
      }
    });
  }
  
  clearListeners() {
    console.log(`🧹 Clearing ${this.listeners.length} listeners`);
    this.listeners = [];
  }

  async startSession(userIdOrSessionId, protocolSettings = {}) {
    if (this.isActive) {
      throw new Error('Session already active');
    }

    try {
      // Handle both old and new calling patterns
      // Old: startSession(sessionId) 
      // New: startSession(userId, protocolSettings)
      let userId = userIdOrSessionId;
      let sessionId = null;
      
      // If it looks like a session ID (has underscore pattern), treat it as old format
      if (typeof userIdOrSessionId === 'string' && userIdOrSessionId.includes('_')) {
        sessionId = userIdOrSessionId;
        userId = null; // Will be set from auth or device ID
        console.log('🎬 Starting enhanced IHHT session with existing ID:', sessionId);
      } else {
        console.log('🎬 Starting enhanced IHHT session for user:', userId);
      }
      
      // Wait for initialization if needed
      if (!this.initialized) {
        console.log('⏳ Waiting for initialization...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Use pre-configured protocol if setProtocol was called, otherwise use passed settings
      if (protocolSettings.totalCycles || protocolSettings.hypoxicDuration || protocolSettings.hyperoxicDuration) {
        this.protocolConfig = {
          totalCycles: protocolSettings.totalCycles || this.protocolConfig.totalCycles,
          hypoxicDuration: protocolSettings.hypoxicDuration || this.protocolConfig.hypoxicDuration,
          hyperoxicDuration: protocolSettings.hyperoxicDuration || this.protocolConfig.hyperoxicDuration
        };
      }
      
      // Create session record (only if we don't have an existing sessionId)
      if (!sessionId) {
        sessionId = await SupabaseService.createSession({
          user_id: userId,
          protocol_type: 'STANDARD_IHHT',
          target_spo2: 85,
          recovery_spo2: 95,
          total_cycles: this.protocolConfig.totalCycles,
          cycle_duration: this.protocolConfig.hypoxicDuration + this.protocolConfig.hyperoxicDuration,
          start_time: new Date().toISOString()
        });
      }

      // Initialize session state
      this.currentSession = { 
        id: sessionId, 
        userId,
        startTime: new Date().toISOString()
      };
      this.isActive = true;
      this.isPaused = false;
      this.startTime = Date.now();
      this.currentPhase = 'HYPOXIC';
      this.currentCycle = 1;
      this.phaseTimeRemaining = this.protocolConfig.hypoxicDuration;
      this.phaseStartTime = Date.now();
      this.readingBuffer = [];

      // Keep screen awake during session
      try {
        await activateKeepAwakeAsync();
        console.log('📱 Keep-awake activated');
      } catch (error) {
        console.warn('⚠️ Could not activate keep-awake:', error);
      }

      // Start Live Activity if supported
      const liveActivitySupported = await this.checkLiveActivitySupport();
      if (liveActivitySupported) {
        await this.startLiveActivity();
      }

      // Schedule phase notifications
      await this.schedulePhaseNotifications();

      // Start background monitoring if available
      if (this.backgroundService) {
        await this.backgroundService.startBackgroundMonitoring({
          id: sessionId,
          currentPhase: this.currentPhase,
          currentCycle: this.currentCycle,
          phaseTimeRemaining: this.phaseTimeRemaining,
          totalCycles: this.protocolConfig.totalCycles,
          hypoxicDuration: this.protocolConfig.hypoxicDuration,
          hyperoxicDuration: this.protocolConfig.hyperoxicDuration,
        });
      }

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
        phaseTimeRemaining: this.phaseTimeRemaining,
        capabilities: runtimeEnvironment.capabilities
      });

      return sessionId;
    } catch (error) {
      console.error('❌ Failed to start enhanced session:', error);
      throw error;
    }
  }

  async checkLiveActivitySupport() {
    if (!this.liveActivityService) return false;
    
    try {
      const isSupported = await this.liveActivityService.isSupported();
      console.log('📱 Live Activity support:', isSupported);
      return isSupported;
    } catch (error) {
      console.error('❌ Error checking Live Activity support:', error);
      return false;
    }
  }

  async startLiveActivity() {
    if (!this.liveActivityService || !this.currentSession) return false;

    try {
      console.log('📱 Starting Live Activity for session');
      
      const result = await this.liveActivityService.startActivity({
        sessionId: this.currentSession.id,
        currentPhase: this.currentPhase,
        currentCycle: this.currentCycle,
        totalCycles: this.protocolConfig.totalCycles,
        phaseTimeRemaining: this.phaseTimeRemaining,
        hypoxicDuration: this.protocolConfig.hypoxicDuration,
        hyperoxicDuration: this.protocolConfig.hyperoxicDuration,
      });

      if (result.success) {
        this.hasActiveLiveActivity = true;
        console.log('✅ Live Activity started successfully');
        return true;
      } else {
        console.log('⚠️ Live Activity not started:', result.reason);
        return false;
      }
    } catch (error) {
      console.error('❌ Error starting Live Activity:', error);
      return false;
    }
  }

  async updateLiveActivity() {
    if (!this.hasActiveLiveActivity || !this.liveActivityService) return;

    try {
      await this.liveActivityService.updateActivity({
        currentPhase: this.currentPhase,
        currentCycle: this.currentCycle,
        phaseTimeRemaining: this.phaseTimeRemaining,
        isPaused: this.isPaused
      });
    } catch (error) {
      console.error('❌ Error updating Live Activity:', error);
    }
  }

  async stopLiveActivity() {
    if (!this.hasActiveLiveActivity || !this.liveActivityService) return;

    try {
      await this.liveActivityService.endActivity();
      this.hasActiveLiveActivity = false;
      console.log('✅ Live Activity stopped');
    } catch (error) {
      console.error('❌ Error stopping Live Activity:', error);
    }
  }

  async sendPhaseStartNotification(phase) {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') return;
      
      const phaseAction = phase === 'HYPEROXIC' ? 'Take OFF mask' : 'Put ON mask';
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `🔵 ${phase === 'HYPEROXIC' ? 'Hyperoxic' : 'Hypoxic'} Phase Now`,
          body: phaseAction,
          data: { type: 'phaseStart', phase }
        },
        trigger: null // Send immediately
      });
      
      console.log(`📱 Sent immediate "${phase} Phase Now" notification`);
    } catch (error) {
      console.error('❌ Error sending phase start notification:', error);
    }
  }

  async schedulePhaseNotifications() {
    try {
      // Aggressively cancel all existing notifications multiple times to ensure cleanup
      await Notifications.cancelAllScheduledNotificationsAsync();
      // Wait a moment then cancel again to ensure cleanup
      await new Promise(resolve => setTimeout(resolve, 100));
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log('📱 Double-cancelled all existing notifications before scheduling new ones');
      
      // Request permission first
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        console.log('📱 Notification permission not granted');
        return;
      }
      
      // Don't schedule notifications at session start (when phase just started)
      // Only schedule when we're mid-phase and have enough time remaining
      const warningTime = (this.phaseTimeRemaining - 30) * 1000;
      console.log(`📱 Notification timing: phaseTimeRemaining=${this.phaseTimeRemaining}s, warningTime=${warningTime}ms, currentPhase=${this.currentPhase}`);
      
      // Skip notifications if we just started the phase (within first 10 seconds)
      const phaseDuration = this.currentPhase === 'HYPOXIC' ? this.protocolConfig.hypoxicDuration : this.protocolConfig.hyperoxicDuration;
      const timeElapsedInPhase = phaseDuration - this.phaseTimeRemaining;
      
      if (timeElapsedInPhase < 10) {
        console.log(`📱 Skipping notifications - phase just started (${timeElapsedInPhase}s elapsed)`);
        return;
      }
      
      if (warningTime > 0) {
        const nextPhase = this.currentPhase === 'HYPOXIC' ? 'Hyperoxic' : 'Hypoxic';
        
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `⏰ ${nextPhase} Phase Coming Up`,
            body: `Get ready to switch in 30 seconds`,
            data: { type: 'phaseWarning' }
          },
          trigger: {
            seconds: Math.max(1, Math.floor(warningTime / 1000))
          }
        });
      }
      
      // Schedule phase change notification
      const changeTime = this.phaseTimeRemaining * 1000;
      const nextPhase = this.currentPhase === 'HYPOXIC' ? 'Hyperoxic' : 'Hypoxic';
      const instruction = nextPhase === 'Hypoxic' ? 'Put ON mask' : 'Take OFF mask';
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `${nextPhase === 'Hypoxic' ? '🔴' : '🔵'} ${nextPhase} Phase Now`,
          body: instruction,
          data: { type: 'phaseChange' }
        },
        trigger: {
          seconds: Math.max(1, Math.floor(changeTime / 1000))
        }
      });
      
      console.log('📱 Scheduled phase notifications');
    } catch (error) {
      console.error('❌ Error scheduling notifications:', error);
    }
  }

  startPhaseTimer() {
    // Use timestamp-based calculation for better accuracy
    this.phaseStartTime = Date.now();
    
    this.phaseTimer = setInterval(() => {
      if (!this.isActive || this.isPaused) return;

      // Calculate time remaining based on elapsed time
      const elapsed = Math.floor((Date.now() - this.phaseStartTime) / 1000);
      const phaseDuration = this.currentPhase === 'HYPOXIC' 
        ? this.protocolConfig.hypoxicDuration 
        : this.protocolConfig.hyperoxicDuration;
      
      this.phaseTimeRemaining = Math.max(0, phaseDuration - elapsed);

      // Check for phase transition
      if (this.phaseTimeRemaining <= 0) {
        this.advancePhase();
      }

      // Update Live Activity every 10 seconds
      if (this.phaseTimeRemaining % 10 === 0) {
        this.updateLiveActivity();
      }

      // Update background state if available
      if (this.backgroundService) {
        this.backgroundService.updateBackgroundState({
          currentPhase: this.currentPhase,
          currentCycle: this.currentCycle,
          phaseTimeRemaining: this.phaseTimeRemaining
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

  // Public method to skip to next phase
  async skipToNextPhase() {
    if (!this.isActive) {
      console.log('⚠️ Cannot skip phase - session not active');
      return false;
    }
    
    if (this.isPaused) {
      console.log('⚠️ Cannot skip phase - session is paused');
      return false;
    }
    
    if (this.currentPhase === 'COMPLETED') {
      console.log('⚠️ Cannot skip phase - session already completed');
      return false;
    }
    
    console.log('⏭️ User requested skip to next phase');
    await this.advancePhase();
    return true;
  }

  async advancePhase() {
    console.log(`🔄 Advancing from ${this.currentPhase} phase (Cycle ${this.currentCycle})`);

    if (this.currentPhase === 'HYPOXIC') {
      // Transition to hyperoxic phase
      this.currentPhase = 'HYPEROXIC';
      this.phaseTimeRemaining = this.protocolConfig.hyperoxicDuration;
      this.phaseStartTime = Date.now();
      
      console.log(`🔄 Advanced to HYPEROXIC phase (Cycle ${this.currentCycle})`);
      
      // Send immediate notification for phase start
      await this.sendPhaseStartNotification('HYPEROXIC');
      
    } else if (this.currentPhase === 'HYPEROXIC') {
      // Check if session is complete
      if (this.currentCycle >= this.protocolConfig.totalCycles) {
        console.log(`🎉 DEBUG: Session completing - cycle ${this.currentCycle}/${this.protocolConfig.totalCycles}`);
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
      
      console.log(`🔄 Advanced to Cycle ${this.currentCycle} - HYPOXIC phase`);
      
      // Send immediate notification for phase start
      await this.sendPhaseStartNotification('HYPOXIC');
    }

    // Schedule new notifications for this phase
    await this.schedulePhaseNotifications();

    // Update Live Activity with new phase
    await this.updateLiveActivity();

    // Notify listeners
    this.notify('phaseAdvanced', {
      currentPhase: this.currentPhase,
      currentCycle: this.currentCycle,
      phaseTimeRemaining: this.phaseTimeRemaining
    });
  }

  async updateSessionCycle() {
    if (!this.currentSession) return;

    try {
      await SupabaseService.updateSessionCycle(this.currentSession.id, this.currentCycle);
    } catch (error) {
      console.error('❌ Failed to update session cycle:', error);
    }
  }

  async pauseSession() {
    if (!this.isActive || this.isPaused) return;

    this.isPaused = true;
    this.pauseTime = Date.now();

    // Allow screen to sleep when paused
    try {
      await deactivateKeepAwake();
    } catch (error) {
      console.warn('⚠️ Could not deactivate keep-awake:', error);
    }

    // Pause background monitoring
    if (this.backgroundService) {
      await this.backgroundService.pauseBackgroundSession();
    }

    // Update Live Activity
    await this.updateLiveActivity();

    console.log('⏸️ Session paused');
    this.notify('sessionPaused', { pauseTime: this.pauseTime });
  }

  async resumeSession() {
    if (!this.isActive || !this.isPaused) return;

    // Calculate pause duration and adjust phase start time
    const pauseDuration = Date.now() - this.pauseTime;
    this.phaseStartTime += pauseDuration;
    
    this.isPaused = false;
    this.pauseTime = null;

    // Reactivate keep-awake
    try {
      await activateKeepAwakeAsync();
    } catch (error) {
      console.warn('⚠️ Could not activate keep-awake:', error);
    }

    // Resume background monitoring
    if (this.backgroundService) {
      await this.backgroundService.resumeBackgroundSession();
    }

    // Reschedule notifications from current point
    await this.schedulePhaseNotifications();

    // Update Live Activity
    await this.updateLiveActivity();

    console.log('▶️ Session resumed');
    this.notify('sessionResumed', {});
  }

  async stopSession(reason = 'manual') {
    if (!this.isActive) return;

    console.log('🛑 Stopping enhanced session...', reason);

    // Clear timers
    if (this.phaseTimer) {
      clearInterval(this.phaseTimer);
      this.phaseTimer = null;
    }
    this.clearBackgroundTimeout();
    this.clearSessionTimeout();

    // Stop background monitoring
    if (this.backgroundService) {
      await this.backgroundService.stopBackgroundMonitoring();
    }

    // Stop Live Activity
    await this.stopLiveActivity();

    // Cancel notifications
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log('📱 Cancelled all notifications');
    } catch (error) {
      console.error('❌ Error cancelling notifications:', error);
    }

    // Flush remaining readings
    await this.flushReadingBuffer();

    // Stop batch processing
    this.stopBatchProcessing();

    // Allow screen to sleep
    try {
      await deactivateKeepAwake();
    } catch (error) {
      console.warn('⚠️ Could not deactivate keep-awake:', error);
    }

    // Calculate session stats
    const duration = Math.floor((Date.now() - this.startTime) / 1000);
    const stats = await this.calculateSessionStats();

    // Update session in database
    if (this.currentSession) {
      await SupabaseService.endSession(
        this.currentSession.id, 
        {
          avgSpO2: stats.avgSpO2,
          avgHeartRate: stats.avgHeartRate
        },
        this.startTime
      );
    }

    // Clear session state
    const sessionId = this.currentSession?.id;
    this.resetSessionState();

    // Clear stored session
    await AsyncStorage.removeItem('activeSession');

    console.log('✅ Session stopped successfully');
    
    // Notify listeners before clearing them
    this.notify('sessionStopped', { sessionId, duration, stats, reason });
    
    // Give listeners time to process the stop event, then clear
    setTimeout(() => {
      this.clearListeners();
    }, 100);

    return { sessionId, duration, stats, reason };
  }

  async completeSession() {
    console.log('🎉 Session completed successfully!');
    
    // Mark session as completed
    if (this.currentSession) {
      // Session will be marked as completed in stopSession
      console.log('🎉 Session completed with', this.currentCycle, 'cycles');
    }

    // Stop the session
    await this.stopSession();
  }

  resetSessionState() {
    this.currentSession = null;
    this.isActive = false;
    this.isPaused = false;
    this.startTime = null;
    this.pauseTime = null;
    this.currentPhase = 'HYPOXIC';
    this.currentCycle = 1;
    this.phaseTimeRemaining = 0;
    this.phaseStartTime = null;
    this.readingBuffer = [];
    this.hasActiveLiveActivity = false;
  }

  async addReading(reading) {
    if (!this.isActive || !this.currentSession) return;

    const enhancedReading = {
      ...reading,
      session_id: this.currentSession.id,
      timestamp: new Date().toISOString(),
      phase: this.currentPhase,
      cycle: this.currentCycle,
      phase_time_remaining: this.phaseTimeRemaining
    };

    this.readingBuffer.push(enhancedReading);

    // Flush if buffer is full
    if (this.readingBuffer.length >= this.BATCH_SIZE) {
      await this.flushReadingBuffer();
    }
  }

  async flushReadingBuffer() {
    if (this.readingBuffer.length === 0) return;

    const readings = [...this.readingBuffer];
    this.readingBuffer = [];

    try {
      await SupabaseService.addReadingsBatch(readings);
      console.log(`📊 Flushed ${readings.length} readings to database`);
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

  async calculateSessionStats() {
    if (!this.currentSession) return { avgSpO2: null, avgHeartRate: null };

    try {
      // For now, return default stats - this would normally calculate from readings
      // TODO: Implement actual stats calculation from session readings
      return { avgSpO2: 95, avgHeartRate: 72 };
    } catch (error) {
      console.error('❌ Failed to calculate session stats:', error);
      return { avgSpO2: null, avgHeartRate: null };
    }
  }

  // Background timeout handling
  startBackgroundTimeout() {
    this.clearBackgroundTimeout();
    
    const BACKGROUND_TIMEOUT = 5 * 60 * 1000; // 5 minutes
    
    this.backgroundTimeout = setTimeout(async () => {
      if (this.isActive) {
        console.log('⏰ App backgrounded too long - ending session');
        await this.stopSession();
      }
    }, BACKGROUND_TIMEOUT);
    
    console.log('⏰ Background timeout started (5 minutes)');
  }

  clearBackgroundTimeout() {
    if (this.backgroundTimeout) {
      clearTimeout(this.backgroundTimeout);
      this.backgroundTimeout = null;
    }
  }

  // Session timeout handling
  startSessionTimeout() {
    this.clearSessionTimeout();
    
    const SESSION_TIMEOUT = 2 * 60 * 60 * 1000; // 2 hours
    
    this.sessionTimeout = setTimeout(async () => {
      if (this.isActive) {
        console.log('⏰ Session timeout (2 hours) - ending session');
        await this.stopSession();
      }
    }, SESSION_TIMEOUT);
    
    console.log('⏰ Session timeout started (2 hours)');
  }

  clearSessionTimeout() {
    if (this.sessionTimeout) {
      clearTimeout(this.sessionTimeout);
      this.sessionTimeout = null;
    }
  }

  // Recovery and cleanup
  async performStartupRecovery() {
    try {
      const sessionStr = await AsyncStorage.getItem('activeSession');
      if (sessionStr) {
        const session = JSON.parse(sessionStr);
        console.log('🔧 Found incomplete session:', session.id);
        
        // Mark as abandoned
        await SupabaseService.endSession(session.id, {}, Date.now());
        
        await AsyncStorage.removeItem('activeSession');
        console.log('✅ Cleaned up abandoned session');
      }
    } catch (error) {
      console.error('❌ Recovery cleanup failed:', error);
    }
  }

  // Getters for current state
  getSessionInfo() {
    return {
      isActive: this.isActive,
      isPaused: this.isPaused,
      currentSession: this.currentSession,
      currentPhase: this.currentPhase,
      currentCycle: this.currentCycle,
      phaseTimeRemaining: this.phaseTimeRemaining,
      sessionStartTime: this.startTime, // Add session start time for UI timer
      totalCycles: this.protocolConfig.totalCycles,
      hypoxicDuration: this.protocolConfig.hypoxicDuration,
      hyperoxicDuration: this.protocolConfig.hyperoxicDuration,
      capabilities: runtimeEnvironment.capabilities,
      environment: runtimeEnvironment.environmentName
    };
  }

  setHypoxiaLevel(level) {
    if (level >= 0 && level <= 10) {
      this.currentHypoxiaLevel = level;
      this.notify('hypoxiaLevelChanged', { level });
    }
  }

  // Set protocol configuration (called before starting session)
  setProtocol(config) {
    console.log('🔧 Setting protocol configuration:', config);
    this.protocolConfig = {
      totalCycles: config.totalCycles || 3,
      hypoxicDuration: config.hypoxicDuration || 420,
      hyperoxicDuration: config.hyperoxicDuration || 180
    };
  }

  // Get protocol configuration
  getProtocol() {
    return this.protocolConfig;
  }
}

// Create singleton instance
const enhancedSessionManager = new EnhancedSessionManager();

export default enhancedSessionManager;