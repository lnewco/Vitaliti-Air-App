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
import Constants from 'expo-constants';
import DatabaseService from './DatabaseService';
import SupabaseService from './SupabaseService';
import serviceFactory from './ServiceFactory';
import runtimeEnvironment from '../utils/RuntimeEnvironment';
import AggressiveBackgroundService from './AggressiveBackgroundService';
import HKWorkoutService from './native/HKWorkoutService';
import AdaptiveInstructionEngine from './AdaptiveInstructionEngine';

// Configure notification handling
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
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
    this.currentPhase = 'ALTITUDE'; // 'ALTITUDE' | 'RECOVERY' | 'TRANSITION'
    this.currentCycle = 1;
    this.phaseStartTime = null;
    this.phaseTimeRemaining = 300; // Will be set based on protocol
    this.phaseTimer = null;
    this.nextPhaseAfterTransition = null; // Track what phase comes after transition
    
    // Adaptive instruction system
    this.adaptiveEngine = new AdaptiveInstructionEngine();
    this.currentSessionType = 'calibration'; // Will be determined based on user history
    this.adaptiveInstructionCallback = null;
    
    // Protocol configuration (defaults)
    this.protocolConfig = {
      totalCycles: 3,
      altitudeDuration: 420,    // 7 minutes in seconds (renamed from hypoxicDuration)
      recoveryDuration: 180     // 3 minutes in seconds (renamed from hyperoxicDuration)
    };
    
    // Service references (will be loaded based on environment)
    this.backgroundService = null;
    this.aggressiveBackgroundService = null;
    this.liveActivityService = null;
    this.notificationService = null;
    
    // Live Activity state
    this.hasActiveLiveActivity = false;
    
    // Timeout references
    this.backgroundTimeout = null;
    this.sessionTimeout = null;
    
    // Altitude level tracking
    this.currentAltitudeLevel = 6; // Default altitude level (1-11 scale)
    
    // App state tracking for notifications
    this.appState = AppState.currentState;
    
    // Buffer settings
    this.BATCH_SIZE = 50;
    this.BATCH_INTERVAL = 2000;
    
    // Track initialization
    this.initialized = false;
    
    // HKWorkout integration for iOS background execution
    this.connectedDeviceId = null;
    this.isUsingHKWorkout = false;
    
    // Setup app state handling
    this.setupAppStateHandling();
    
    // Initialize services
    this.initializeServices();
    
    // Setup HKWorkout event listeners if available
    this.setupHKWorkoutListeners();
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
      
      // Only use aggressive background service in development
      const isProduction = Constants.appOwnership === 'standalone' && !__DEV__;
      if (!isProduction) {
        this.aggressiveBackgroundService = new AggressiveBackgroundService();
        await this.aggressiveBackgroundService.initialize();
      } else {
        console.log('📱 Production mode - skipping aggressive background service');
        this.aggressiveBackgroundService = null;
      }
      
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
    
    // Track current app state for notification handling
    this.appState = nextAppState;
    
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
        hypoxicDuration: this.protocolConfig.altitudeDuration,
        hyperoxicDuration: this.protocolConfig.recoveryDuration,
        altitudeDuration: this.protocolConfig.altitudeDuration,
        recoveryDuration: this.protocolConfig.recoveryDuration,
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

  async startSession(sessionId, protocolConfig = {}) {
    console.log('🔍 StartSession called with:', { sessionId, protocolConfig });
    
    if (this.isActive) {
      throw new Error('Session already active');
    }
    
    if (!sessionId) {
      throw new Error('Session ID is required');
    }

    try {
      console.log('🎬 Starting enhanced IHHT session with ID:', sessionId);
      console.log('📋 Protocol configuration:', protocolConfig);
      
      // Wait for initialization if needed
      if (!this.initialized) {
        console.log('⏳ Service not initialized, initializing now...');
        await this.initializeServices();
        // Additional wait to ensure everything is ready
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Update protocol configuration
      console.log('📝 Step 1: Updating protocol configuration...');
      this.protocolConfig = {
        totalCycles: protocolConfig.totalCycles || this.protocolConfig.totalCycles,
        altitudeDuration: protocolConfig.hypoxicDuration || this.protocolConfig.altitudeDuration,
        recoveryDuration: protocolConfig.hyperoxicDuration || this.protocolConfig.recoveryDuration
      };
      console.log('✅ Protocol config updated:', this.protocolConfig);

      // Determine session type (calibration vs training)
      console.log('📝 Step 2: Determining session type...');
      await this.determineSessionType();
      console.log(`✅ Session type determined: ${this.currentSessionType}`);
      
      // Store additional protocol data for session creation
      const defaultAltitudeLevel = protocolConfig.defaultAltitudeLevel || 6;
      
      // Initialize adaptive engine with the starting altitude phase
      console.log('📝 Step 3: Initializing adaptive engine...');
      this.adaptiveEngine.startAltitudePhase(sessionId, 1, defaultAltitudeLevel, this.currentSessionType);
      const baselineHRV = protocolConfig.baselineHRV || null;
      console.log('✅ Adaptive engine initialized');
      
      // Create session in LOCAL DATABASE FIRST
      console.log('📝 Step 4: Creating session in local database...');
      await DatabaseService.init();
      await DatabaseService.createSession(sessionId, defaultAltitudeLevel, this.protocolConfig);
      console.log('✅ Session created in local database:', sessionId);
      
      // Then create session in Supabase with proper session data
      console.log('📝 Step 5: Creating session in Supabase...');
      let supabaseSession = null;
      try {
        supabaseSession = await SupabaseService.createSession({
          id: sessionId,  // Pass the session ID
          startTime: new Date().toISOString(),
          defaultAltitudeLevel: defaultAltitudeLevel,
          baselineHRV: baselineHRV,
          protocolConfig: this.protocolConfig
        });
        console.log('✅ Supabase session created:', supabaseSession?.id);
      } catch (supabaseError) {
        console.error('⚠️ Supabase session creation failed:', supabaseError.message);
        console.error('Supabase error details:', {
          message: supabaseError.message,
          stack: supabaseError.stack,
          name: supabaseError.name
        });
        // Continue with local session even if Supabase fails
        console.log('📝 Continuing with local session only...');
      }
      
      if (!supabaseSession) {
        console.warn('⚠️ No Supabase session created, using local session only');
      }

      // Initialize session state
      this.currentSession = {
        id: sessionId,
        supabaseId: supabaseSession?.id || sessionId,  // Store the Supabase session ID, fallback to sessionId
        startTime: new Date().toISOString()
      };
      this.isActive = true;
      this.isPaused = false;
      this.startTime = Date.now();
      this.currentPhase = 'ALTITUDE';
      this.currentCycle = 1;
      this.phaseTimeRemaining = this.protocolConfig.altitudeDuration;
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
      console.log('📝 Step 6: Checking Live Activity support...');
      try {
        const liveActivitySupported = await this.checkLiveActivitySupport();
        if (liveActivitySupported) {
          console.log('📱 Live Activity supported, starting...');
          await this.startLiveActivity();
        } else {
          console.log('📱 Live Activity not supported in this environment');
        }
      } catch (liveActivityError) {
        console.warn('⚠️ Live Activity error (non-fatal):', liveActivityError.message);
      }

      // Schedule phase notifications
      console.log('📝 Step 7: Scheduling phase notifications...');
      try {
        await this.schedulePhaseNotifications();
        console.log('✅ Phase notifications scheduled');
      } catch (notificationError) {
        console.warn('⚠️ Notification scheduling error (non-fatal):', notificationError.message);
      }

      // Start HKWorkout for iOS background execution with BLE
      if (HKWorkoutService.isAvailable && this.connectedDeviceId) {
        console.log('🏃 Starting HKWorkout with BLE device:', this.connectedDeviceId);
        const workoutResult = await HKWorkoutService.startWorkout(this.connectedDeviceId);
        if (workoutResult.success) {
          this.isUsingHKWorkout = true;
          console.log('✅ HKWorkout started for unlimited background execution');
        } else {
          console.warn('⚠️ HKWorkout failed to start:', workoutResult.error);
        }
      }

      // Start AGGRESSIVE background monitoring for maximum persistence
      console.log('📝 Step 8: Starting background monitoring services...');
      if (this.aggressiveBackgroundService) {
        try {
          console.log('🔥 Starting AGGRESSIVE background monitoring');
          await this.aggressiveBackgroundService.startAggressiveBackgroundMonitoring({
            id: sessionId,
            currentPhase: this.currentPhase,
            currentCycle: this.currentCycle,
            phaseTimeRemaining: this.phaseTimeRemaining,
            totalCycles: this.protocolConfig.totalCycles,
            hypoxicDuration: this.protocolConfig.altitudeDuration,
            hyperoxicDuration: this.protocolConfig.recoveryDuration,
          });
          console.log('✅ Aggressive background monitoring started');
        } catch (aggressiveError) {
          console.warn('⚠️ Aggressive background service error (non-fatal):', aggressiveError.message);
        }
      }
      
      // Also start basic background monitoring as fallback
      if (this.backgroundService) {
        try {
          await this.backgroundService.startBackgroundMonitoring({
            id: sessionId,
            currentPhase: this.currentPhase,
            currentCycle: this.currentCycle,
            phaseTimeRemaining: this.phaseTimeRemaining,
            totalCycles: this.protocolConfig.totalCycles,
            hypoxicDuration: this.protocolConfig.altitudeDuration,
            hyperoxicDuration: this.protocolConfig.recoveryDuration,
          });
          console.log('✅ Basic background monitoring started');
        } catch (backgroundError) {
          console.warn('⚠️ Basic background service error (non-fatal):', backgroundError.message);
        }
      }

      // Start phase timer
      console.log('📝 Step 9: Starting phase timer...');
      this.startPhaseTimer();
      console.log('✅ Phase timer started');

      // Start session timeout (2 hours max)
      console.log('📝 Step 10: Starting session timeout...');
      this.startSessionTimeout();
      console.log('✅ Session timeout started');

      // Start batch processing
      console.log('📝 Step 11: Starting batch processing...');
      this.startBatchProcessing();
      console.log('✅ Batch processing started');

      // Save session state
      console.log('📝 Step 12: Saving session state to AsyncStorage...');
      await AsyncStorage.setItem('activeSession', JSON.stringify(this.currentSession));
      console.log('✅ Session state saved');

      console.log(`🎉 Enhanced session started successfully: ${sessionId}`);
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
      console.error('Full error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
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
        hypoxicDuration: this.protocolConfig.altitudeDuration,
        hyperoxicDuration: this.protocolConfig.recoveryDuration,
        altitudeDuration: this.protocolConfig.altitudeDuration,
        recoveryDuration: this.protocolConfig.recoveryDuration,
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
    // Only send notification if app is not active
    if (this.appState === 'active') {
      console.log('📱 App is active, skipping phase notification');
      return;
    }
    
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') return;
      
      const phaseAction = phase === 'RECOVERY' ? 'Take OFF mask' : 'Put ON mask';
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `🔵 ${phase === 'RECOVERY' ? 'Recovery' : 'Altitude'} Phase Now`,
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
      const phaseDuration = this.currentPhase === 'ALTITUDE' ? this.protocolConfig.altitudeDuration : this.protocolConfig.recoveryDuration;
      const timeElapsedInPhase = phaseDuration - this.phaseTimeRemaining;
      
      if (timeElapsedInPhase < 10) {
        console.log(`📱 Skipping notifications - phase just started (${timeElapsedInPhase}s elapsed)`);
        return;
      }
      
      if (warningTime > 0) {
        const nextPhase = this.currentPhase === 'ALTITUDE' ? 'Recovery' : 'Altitude';
        
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
      const nextPhase = this.currentPhase === 'ALTITUDE' ? 'Recovery' : 'Altitude';
      const instruction = nextPhase === 'Altitude' ? 'Put ON mask' : 'Take OFF mask';
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `${nextPhase === 'Altitude' ? '🔴' : '🔵'} ${nextPhase} Phase Now`,
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
    console.log('⏱️ Starting phase timer for', this.currentPhase, 'phase');
    
    this.phaseTimer = setInterval(() => {
      if (!this.isActive || this.isPaused) return;
      
      // Calculate time remaining based on elapsed time
      const elapsed = Math.floor((Date.now() - this.phaseStartTime) / 1000);
      const phaseDuration = this.currentPhase === 'TRANSITION'
        ? 10  // Transition phase is always 10 seconds
        : this.currentPhase === 'ALTITUDE' 
          ? this.protocolConfig.altitudeDuration 
          : this.protocolConfig.recoveryDuration;
      
      this.phaseTimeRemaining = Math.max(0, phaseDuration - elapsed);
      
      // Log every 5 seconds for debugging
      if (elapsed % 5 === 0) {
        console.log(`⏱️ Phase timer: ${this.currentPhase} - ${this.phaseTimeRemaining}s remaining`);
      }

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

    // If currently in TRANSITION, move to the scheduled phase
    if (this.currentPhase === 'TRANSITION') {
      this.currentPhase = this.nextPhaseAfterTransition;
      this.phaseTimeRemaining = this.nextPhaseAfterTransition === 'RECOVERY' 
        ? this.protocolConfig.recoveryDuration 
        : this.protocolConfig.altitudeDuration;
      this.phaseStartTime = Date.now();
      
      console.log(`🔄 Transition complete - starting ${this.currentPhase} phase`);
      
      // Send notification for actual phase start
      await this.sendPhaseStartNotification(this.currentPhase);
      this.nextPhaseAfterTransition = null;
      return;
    }

    // When transitioning from ALTITUDE, go to TRANSITION first
    if (this.currentPhase === 'ALTITUDE') {
      // Calculate altitude adjustment for NEXT altitude phase (if any)
      if (this.adaptiveEngine) {
        try {
          const altitudeAdjustment = this.adaptiveEngine.calculateNextAltitudeLevel();
          console.log('🎯 Altitude adjustment calculation:', altitudeAdjustment);
          
          // Show altitude adjustment instruction to user if needed
          if (altitudeAdjustment.adjustment !== 0 && this.adaptiveInstructionCallback) {
            this.adaptiveInstructionCallback({
              type: 'altitude_adjustment',
              adjustment: altitudeAdjustment.adjustment,
              newLevel: altitudeAdjustment.newLevel,
              reason: altitudeAdjustment.reason,
              message: altitudeAdjustment.adjustment > 0 
                ? `Increase altitude to level ${altitudeAdjustment.newLevel}` 
                : `Decrease altitude to level ${altitudeAdjustment.newLevel}`,
              showDuringTransition: true
            });
            
            // Record the altitude adjustment event (use 'dial_adjustment' to match DB constraint)
            await this.recordAdaptiveEvent('dial_adjustment', {
              adjustment: altitudeAdjustment.adjustment,
              new_level: altitudeAdjustment.newLevel,
              reason: altitudeAdjustment.reason
            });
          }
        } catch (error) {
          console.error('❌ Error calculating altitude adjustment:', error);
        }
      }
      
      this.currentPhase = 'TRANSITION';
      this.nextPhaseAfterTransition = 'RECOVERY';
      this.phaseTimeRemaining = 10; // 10 seconds
      this.phaseStartTime = Date.now();
      
      console.log('⚠️ Entering mask switch transition → Take OFF mask for Recovery phase');
      
    } else if (this.currentPhase === 'RECOVERY') {
      // Check if session is complete
      if (this.currentCycle >= this.protocolConfig.totalCycles) {
        console.log(`🎉 DEBUG: Session completing - cycle ${this.currentCycle}/${this.protocolConfig.totalCycles}`);
        await this.completeSession();
        return;
      }

      // Move to next cycle via transition
      this.currentCycle++;
      this.currentPhase = 'TRANSITION';
      this.nextPhaseAfterTransition = 'ALTITUDE';
      this.phaseTimeRemaining = 10; // 10 seconds
      this.phaseStartTime = Date.now();
      
      // Update database with new cycle
      await this.updateSessionCycle();
      
      console.log(`⚠️ Entering mask switch transition → PUT ON mask for Hypoxic phase (Cycle ${this.currentCycle})`);
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

    // Stop AGGRESSIVE background monitoring
    if (this.aggressiveBackgroundService) {
      console.log('🔥 Stopping AGGRESSIVE background monitoring');
      await this.aggressiveBackgroundService.stopAggressiveBackgroundMonitoring();
    }
    
    // Stop basic background monitoring
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

    // Update session in LOCAL DATABASE FIRST
    if (this.currentSession) {
      // End session in local database - MUST PASS START TIME!
      await DatabaseService.endSession(
        this.currentSession.id,
        {
          avgSpO2: stats.avgSpO2,
          avgHeartRate: stats.avgHeartRate,
          minSpO2: stats.minSpO2,
          maxSpO2: stats.maxSpO2,
          totalReadings: stats.totalReadings
        },
        this.startTime  // THIS WAS MISSING - causing 0:00 duration!
      );
      console.log('✅ Session ended in local database:', this.currentSession.id, 'Duration:', duration, 'seconds');
      
      // Then update in Supabase
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

    // Set phase to COMPLETED so UI can detect it
    this.currentPhase = 'COMPLETED';
    
    // Notify listeners that session is complete
    this.notify('sessionCompleted', {
      sessionId: this.currentSession?.id,
      cycles: this.currentCycle,
      totalCycles: this.protocolConfig?.totalCycles
    });

    // Give UI time to detect completion before stopping
    setTimeout(async () => {
      // Stop the session
      await this.stopSession('completed');
    }, 2000); // 2 seconds for UI to handle completion
  }

  // Alias for stopSession to maintain compatibility with IHHTTrainingScreen
  async endSession() {
    console.log('📊 Ending session (called from UI)');
    
    // Check if session is already ended
    if (!this.isActive && !this.currentSession) {
      console.log('⚠️ Session already ended - returning last known info');
      // Try to get session ID from storage if available
      const storedSession = await AsyncStorage.getItem('lastEndedSession');
      if (storedSession) {
        return JSON.parse(storedSession);
      }
      return null;
    }
    
    // Get the current session info before stopping
    const sessionInfo = this.currentSession ? {
      sessionId: this.currentSession.id,
      duration: Date.now() - this.startTime,
      cycles: this.currentCycle,
      totalCycles: this.protocolConfig?.totalCycles
    } : null;
    
    // Store session info for later retrieval
    if (sessionInfo) {
      await AsyncStorage.setItem('lastEndedSession', JSON.stringify(sessionInfo));
    }
    
    // Stop the session if it's still active
    if (this.isActive) {
      await this.stopSession('manual');
    }
    
    // Return session info for navigation
    return sessionInfo;
  }

  resetSessionState() {
    this.currentSession = null;
    this.isActive = false;
    this.isPaused = false;
    this.startTime = null;
    this.pauseTime = null;
    this.currentPhase = 'ALTITUDE';
    this.currentCycle = 1;
    this.phaseTimeRemaining = 0;
    this.phaseStartTime = null;
    this.readingBuffer = [];
    this.hasActiveLiveActivity = false;
    
    // Stop HKWorkout if running
    if (this.isUsingHKWorkout) {
      HKWorkoutService.stopWorkout().then(result => {
        console.log('🛑 HKWorkout stopped:', result);
      }).catch(error => {
        console.error('❌ Failed to stop HKWorkout:', error);
      });
      this.isUsingHKWorkout = false;
    }
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

    // Process adaptive instructions with SpO2 data
    if (reading.spo2 && reading.spo2 > 0) {
      await this.processAdaptiveInstruction(reading);
    }

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
      // Check for incomplete session
      const sessionStr = await AsyncStorage.getItem('activeSession');
      if (sessionStr) {
        const session = JSON.parse(sessionStr);
        console.log('🔧 Found incomplete session:', session.id);
        
        // Check if session was recently active (within last 10 minutes)
        const sessionAge = Date.now() - new Date(session.startTime).getTime();
        const tenMinutes = 10 * 60 * 1000;
        
        if (sessionAge < tenMinutes) {
          console.log('🔄 Recent session found - preparing recovery data');
          
          // Get any background state from aggressive service
          const backgroundState = await this.getBackgroundSessionState();
          
          // Store recovery data for UI to access
          const recoveryData = {
            sessionId: session.id,
            currentPhase: backgroundState?.currentPhase || session.currentPhase || 'ALTITUDE',
            currentCycle: backgroundState?.currentCycle || session.currentCycle || 1,
            phaseTimeRemaining: backgroundState?.phaseTimeRemaining || session.phaseTimeRemaining || 180,
            totalCycles: session.totalCycles || 3,
            hypoxicDuration: session.hypoxicDuration || this.protocolConfig.altitudeDuration || 420,
            hyperoxicDuration: session.hyperoxicDuration || this.protocolConfig.recoveryDuration || 180,
            altitudeDuration: this.protocolConfig.altitudeDuration || 420,
            recoveryDuration: this.protocolConfig.recoveryDuration || 180,
            startTime: session.startTime,
            sessionAge: Math.round(sessionAge / 1000), // seconds
            backgroundTime: backgroundState?.totalBackgroundTime || 0,
            canRecover: true
          };
          
          await AsyncStorage.setItem('sessionRecovery', JSON.stringify(recoveryData));
          console.log(`🔄 Session recovery prepared: ${recoveryData.currentPhase} phase, Cycle ${recoveryData.currentCycle}, ${recoveryData.phaseTimeRemaining}s remaining`);
          
          // Don't auto-cleanup - let user decide
          return recoveryData;
        } else {
          console.log('🗑️ Old session found - cleaning up');
          await this.cleanupAbandonedSession(session);
        }
      }
      
      // Check for background state without active session (edge case)
      const backgroundState = await this.getBackgroundSessionState();
      if (backgroundState && backgroundState.isActive) {
        console.log('🔧 Found orphaned background state - cleaning up');
        await AsyncStorage.removeItem('@aggressive_session_state');
      }
      
    } catch (error) {
      console.error('❌ Recovery check failed:', error);
    }
    
    return null;
  }

  async getBackgroundSessionState() {
    try {
      const stateStr = await AsyncStorage.getItem('@aggressive_session_state');
      return stateStr ? JSON.parse(stateStr) : null;
    } catch (error) {
      console.warn('⚠️ Could not read background session state:', error);
      return null;
    }
  }

  async cleanupAbandonedSession(session) {
    try {
      // Mark session as abandoned in Supabase
      await SupabaseService.endSession(session.id, { 
        endReason: 'abandoned',
        avgSpO2: null,
        avgHeartRate: null 
      }, Date.now());
      
      // Clean up local storage
      await AsyncStorage.removeItem('activeSession');
      await AsyncStorage.removeItem('sessionRecovery');
      await AsyncStorage.removeItem('@aggressive_session_state');
      
      console.log('✅ Cleaned up abandoned session:', session.id);
    } catch (error) {
      console.error('❌ Failed to cleanup abandoned session:', error);
    }
  }

  // Check if there's a recoverable session
  async getRecoverableSession() {
    try {
      const recoveryStr = await AsyncStorage.getItem('sessionRecovery');
      return recoveryStr ? JSON.parse(recoveryStr) : null;
    } catch (error) {
      console.error('❌ Failed to get recoverable session:', error);
      return null;
    }
  }

  // Resume a recovered session (after app restart)
  async resumeRecoveredSession(recoveryData) {
    try {
      console.log(`🔄 Resuming recovered session: ${recoveryData.sessionId}`);
      
      // Restore session state
      this.currentSession = {
        id: recoveryData.sessionId,
        startTime: recoveryData.startTime,
        totalCycles: recoveryData.totalCycles,
        hypoxicDuration: recoveryData.hypoxicDuration,
        hyperoxicDuration: recoveryData.hyperoxicDuration
      };
      
      // Restore protocol configuration
      this.protocolConfig = {
        totalCycles: recoveryData.totalCycles,
        altitudeDuration: recoveryData.hypoxicDuration,
        recoveryDuration: recoveryData.hyperoxicDuration
      };
      
      // Restore session progress
      this.currentPhase = recoveryData.currentPhase;
      this.currentCycle = recoveryData.currentCycle;
      this.phaseTimeRemaining = recoveryData.phaseTimeRemaining;
      this.startTime = new Date(recoveryData.startTime);
      this.phaseStartTime = Date.now(); // Reset phase timer
      
      // Activate session
          this.isActive = true;
      this.isPaused = false;
      
      // Restart services
      await activateKeepAwakeAsync();
      
      // Start aggressive background monitoring
      if (this.aggressiveBackgroundService) {
        await this.aggressiveBackgroundService.startAggressiveBackgroundMonitoring({
          id: recoveryData.sessionId,
          currentPhase: this.currentPhase,
          currentCycle: this.currentCycle,
          phaseTimeRemaining: this.phaseTimeRemaining,
          totalCycles: this.protocolConfig.totalCycles,
          hypoxicDuration: this.protocolConfig.altitudeDuration,
          hyperoxicDuration: this.protocolConfig.recoveryDuration,
        });
      }
      
      // Start regular background monitoring as fallback
      if (this.backgroundService) {
        await this.backgroundService.startBackgroundMonitoring({
          id: recoveryData.sessionId,
          currentPhase: this.currentPhase,
          currentCycle: this.currentCycle,
          phaseTimeRemaining: this.phaseTimeRemaining,
          totalCycles: this.protocolConfig.totalCycles,
          hypoxicDuration: this.protocolConfig.altitudeDuration,
          hyperoxicDuration: this.protocolConfig.recoveryDuration,
        });
      }
      
      // Schedule notifications for current phase
      await this.schedulePhaseNotifications();
      
      // Start phase timer
      this.startPhaseTimer();
      
      // Start session timeout
      this.startSessionTimeout();
      
      // Start batch processing for readings
      this.startBatchProcessing();
      
      // Update session state in storage
      await AsyncStorage.setItem('activeSession', JSON.stringify(this.currentSession));
      
      // Clear recovery data
      await AsyncStorage.removeItem('sessionRecovery');
      
      // Automatically reconnect to previously connected devices
      await this.reconnectBluetoothDevices();
      
      console.log(`✅ Session resumed successfully: ${recoveryData.currentPhase} phase, Cycle ${recoveryData.currentCycle}, ${recoveryData.phaseTimeRemaining}s remaining`);
      
      // Notify listeners
      this.notify('sessionResumed', {
        ...this.currentSession,
        currentPhase: this.currentPhase,
        currentCycle: this.currentCycle,
        phaseTimeRemaining: this.phaseTimeRemaining,
        recoveredFromBackground: true,
        backgroundTime: recoveryData.backgroundTime,
        capabilities: runtimeEnvironment.capabilities
      });
      
      return this.currentSession.id;
    } catch (error) {
      console.error('❌ Failed to resume session:', error);
      // Cleanup on failure
      await this.cleanupAbandonedSession({ id: recoveryData.sessionId });
      throw error;
    }
  }

  // Decline session recovery and clean up
  async declineSessionRecovery() {
    try {
      const recoveryData = await this.getRecoverableSession();
      if (recoveryData) {
        console.log('🗑️ User declined session recovery - cleaning up');
        await this.cleanupAbandonedSession({ id: recoveryData.sessionId });
      }
    } catch (error) {
      console.error('❌ Failed to decline session recovery:', error);
    }
  }

  // Getters for current state
  getSessionInfo() {
    return {
      isActive: this.isActive,
      isPaused: this.isPaused,
      currentSession: this.currentSession,
      currentPhase: this.currentPhase,
      nextPhaseAfterTransition: this.nextPhaseAfterTransition,
      currentCycle: this.currentCycle,
      phaseTimeRemaining: this.phaseTimeRemaining,
      sessionStartTime: this.startTime, // Add session start time for UI timer
      startTime: this.startTime, // Also include as startTime for backward compatibility
      totalCycles: this.protocolConfig.totalCycles,
      hypoxicDuration: this.protocolConfig.hypoxicDuration,
      hyperoxicDuration: this.protocolConfig.hyperoxicDuration,
      capabilities: runtimeEnvironment.capabilities,
      environment: runtimeEnvironment.environmentName,
      currentAltitudeLevel: this.currentAltitudeLevel
    };
  }

  setAltitudeLevel(level) {
    if (level >= 1 && level <= 11) {
      this.currentAltitudeLevel = level;
      this.notify('altitudeLevelChanged', { level });
    }
  }

  // Set protocol configuration (called before starting session)
  setProtocol(config) {
    console.log('🔧 Setting protocol configuration:', config);
    this.protocolConfig = {
      totalCycles: config.totalCycles || 3,
      altitudeDuration: config.hypoxicDuration || 420,
      recoveryDuration: config.hyperoxicDuration || 180
    };
  }

  // Get protocol configuration
  getProtocol() {
    return this.protocolConfig;
  }

  // Automatically reconnect to Bluetooth devices after session recovery
  async reconnectBluetoothDevices() {
    try {
      console.log('🔄 Attempting to reconnect Bluetooth devices...');
      
      // Import BluetoothService to avoid circular dependencies
      const { default: BluetoothService } = await import('./BluetoothService.js');
      
      // Check if any devices are already connected
      if (BluetoothService.isAnyDeviceConnected) {
        console.log('✅ Bluetooth devices already connected');
        return;
      }
      
      // Start scanning for pulse oximeter (most critical device for sessions)
      console.log('🔍 Starting pulse-ox scan for reconnection...');
      await BluetoothService.startScan('pulse-ox');
      
      // Give it a few seconds to find and connect
      setTimeout(async () => {
        if (!BluetoothService.isPulseOxConnected) {
          console.log('⚠️ Pulse oximeter not reconnected automatically - user may need to manually reconnect');
        } else {
          console.log('✅ Pulse oximeter reconnected successfully');
        }
      }, 5000);
      
    } catch (error) {
      console.error('❌ Failed to reconnect Bluetooth devices:', error);
    }
  }

  // Set the connected BLE device for background execution
  setConnectedDevice(deviceId) {
    this.connectedDeviceId = deviceId;
    console.log('📱 EnhancedSessionManager: BLE device set:', deviceId);
    
    // If session is active and HKWorkout available, notify native module
    if (this.isActive && HKWorkoutService.isAvailable) {
      HKWorkoutService.setBluetoothDevice(deviceId);
      HKWorkoutService.notifyBluetoothConnected();
    }
  }

  // Clear connected device
  clearConnectedDevice() {
    this.connectedDeviceId = null;
    console.log('📱 EnhancedSessionManager: BLE device cleared');
    
    // Notify native module if session is active
    if (this.isActive && HKWorkoutService.isAvailable) {
      HKWorkoutService.notifyBluetoothDisconnected();
    }
  }

  // Setup HKWorkout event listeners
  setupHKWorkoutListeners() {
    if (!HKWorkoutService.isAvailable) return;

    // Listen for timer ticks from native module
    HKWorkoutService.onTick((data) => {
      if (!this.isActive || this.isPaused) return;
      
      // Update phase time remaining based on native timer
      const now = Date.now();
      const phaseElapsed = Math.floor((now - this.phaseStartTime) / 1000);
      const expectedRemaining = this.currentPhase === 'ALTITUDE' 
        ? this.protocolConfig.altitudeDuration - phaseElapsed
        : this.protocolConfig.recoveryDuration - phaseElapsed;
      
      // Only update if there's a significant difference (> 2 seconds)
      if (Math.abs(this.phaseTimeRemaining - expectedRemaining) > 2) {
        console.log('⏱️ Syncing timer with native module:', expectedRemaining);
        this.phaseTimeRemaining = Math.max(0, expectedRemaining);
      }
    });

    // Listen for app state changes
    HKWorkoutService.onAppStateChange((data) => {
      console.log('📱 HKWorkout app state:', data.state);
    });

    // Listen for Bluetooth reconnection requests
    HKWorkoutService.onBluetoothReconnect(async (deviceId) => {
      console.log('🔄 HKWorkout requesting BLE reconnection:', deviceId);
      // This would trigger reconnection logic if needed
    });
  }

  // Adaptive instruction system methods
  setAdaptiveInstructionCallback(callback) {
    this.adaptiveInstructionCallback = callback;
    console.log('📋 Adaptive instruction callback set');
  }

  async determineSessionType() {
    try {
      // Check if user has completed any sessions with the new adaptive system
      const completedSessions = await DatabaseService.getCompletedAdaptiveSessions();
      this.currentSessionType = completedSessions.length === 0 ? 'calibration' : 'training';
      console.log(`📊 Session type determined: ${this.currentSessionType} (${completedSessions.length} completed sessions found)`);
      return this.currentSessionType;
    } catch (error) {
      console.error('❌ Error determining session type:', error);
      // Default to calibration for safety - this will be the most common case initially
      this.currentSessionType = 'calibration';
      console.log(`📊 Session type defaulted to: ${this.currentSessionType} (due to error)`);
      return this.currentSessionType;
    }
  }

  async processAdaptiveInstruction(spo2Data) {
    if (!this.isActive || !this.adaptiveEngine) {
      console.log('🔇 Skipping adaptive processing - session not active or engine not initialized');
      return;
    }

    if (!spo2Data || typeof spo2Data.spo2 !== 'number' || spo2Data.spo2 <= 0) {
      console.log('🔇 Skipping adaptive processing - invalid SpO2 data:', spo2Data);
      return;
    }

    try {
      console.log(`🎯 Processing adaptive instruction - SpO2: ${spo2Data.spo2}%, Phase: ${this.currentPhase}, Type: ${this.currentSessionType}`);
      
      // Process SpO2 reading for mask lift instructions based on current phase
      let maskLiftInstruction = null;
      if (this.currentPhase === 'ALTITUDE') {
        maskLiftInstruction = this.adaptiveEngine.processAltitudeSpO2Reading(
          spo2Data.spo2,
          this.currentSessionType,
          Date.now()
        );
      } else if (this.currentPhase === 'RECOVERY') {
        const recoveryResult = this.adaptiveEngine.processRecoverySpO2Reading(
          spo2Data.spo2,
          Date.now()
        );
        // Recovery processing returns different info, not mask lift instructions
        console.log('🔵 Recovery phase SpO2 processing:', recoveryResult);
      }

      if (maskLiftInstruction) {
        console.log('🎯 Mask lift instruction triggered:', maskLiftInstruction);
        
        if (this.adaptiveInstructionCallback) {
          try {
            this.adaptiveInstructionCallback({
              type: 'mask_lift',
              ...maskLiftInstruction
            });
          } catch (callbackError) {
            console.error('❌ Error in adaptive instruction callback:', callbackError);
          }
        } else {
          console.log('⚠️ Adaptive instruction callback not set - instruction will be logged only');
        }

        // Record the adaptive event
        await this.recordAdaptiveEvent('mask_lift', {
          spo2_value: spo2Data.spo2,
          threshold: maskLiftInstruction.threshold,
          message: maskLiftInstruction.message
        });
      }

                 // Note: Altitude phases run for full 7 minutes - no early advancement based on SpO2

    } catch (error) {
      console.error('❌ Error processing adaptive instruction:', error);
    }
  }

  async recordAdaptiveEvent(eventType, data) {
    if (!this.currentSession) return;

    try {
      const eventData = {
        session_id: this.currentSession.id,
        event_type: eventType,
        event_timestamp: new Date().toISOString(),
        altitude_phase_number: this.currentPhase === 'ALTITUDE' ? this.currentCycle : null,
        recovery_phase_number: this.currentPhase === 'RECOVERY' ? this.currentCycle : null,
        current_altitude_level: this.protocolConfig.defaultAltitudeLevel || 6,
        spo2_value: data.spo2_value || null,
        additional_data: JSON.stringify(data)
      };

      await DatabaseService.saveAdaptiveEvent(eventData);
      console.log(`📝 Recorded adaptive event: ${eventType}`);
    } catch (error) {
      console.error(`❌ Failed to record adaptive event ${eventType}:`, error);
    }
  }

  getPhaseElapsedTime() {
    if (!this.phaseStartTime) return 0;
    return Math.floor((Date.now() - this.phaseStartTime) / 1000);
  }
}

// Create singleton instance
const enhancedSessionManager = new EnhancedSessionManager();

export default enhancedSessionManager;