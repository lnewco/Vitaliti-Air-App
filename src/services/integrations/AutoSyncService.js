import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import IntegrationManager from './IntegrationManager';

// Conditional imports for expo packages
let BackgroundFetch = null;
let TaskManager = null;

try {
  BackgroundFetch = require('expo-background-fetch');
  TaskManager = require('expo-task-manager');
} catch (error) {
  console.log('Background fetch not available:', error.message);
}

const BACKGROUND_SYNC_TASK = 'background-integration-sync';

class AutoSyncService {
  constructor() {
    this.isRegistered = false;
    this.userId = null;
    this.setupAppStateHandling();
  }

  async initialize(userId) {
    this.userId = userId;
    console.log('🔄 AutoSyncService initialized for user:', userId);
    
    // Register background task
    await this.registerBackgroundTask();
    
    // Start background sync
    await this.startBackgroundSync();
  }

  setupAppStateHandling() {
    AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active' && this.userId) {
        // App became active, do a quick sync check
        this.performQuickSync();
      }
    });
  }

  async registerBackgroundTask() {
    if (!TaskManager || !BackgroundFetch) {
      console.log('📱 Background fetch not available - using app state sync only');
      return;
    }

    try {
      // Define the background task
      TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
        console.log('🔄 Background sync task executing...');
        
        try {
          // Get stored user ID
          const storedUserId = await AsyncStorage.getItem('currentUserId');
          if (!storedUserId) {
            console.log('No user ID found for background sync');
            return BackgroundFetch.BackgroundFetchResult.NoData;
          }

          // Perform sync
          const result = await this.performBackgroundSync(storedUserId);
          
          if (result.success) {
            console.log('✅ Background sync completed:', result.summary);
            return BackgroundFetch.BackgroundFetchResult.NewData;
          } else {
            console.log('⚠️ Background sync failed:', result.error);
            return BackgroundFetch.BackgroundFetchResult.Failed;
          }
        } catch (error) {
          console.error('Background sync task error:', error);
          return BackgroundFetch.BackgroundFetchResult.Failed;
        }
      });

      this.isRegistered = true;
      console.log('✅ Background sync task registered');
    } catch (error) {
      console.error('Failed to register background sync task:', error);
    }
  }

  async startBackgroundSync() {
    if (!this.isRegistered) {
      await this.registerBackgroundTask();
    }

    if (!BackgroundFetch) {
      console.log('📱 Using app state sync only (no background fetch)');
      await AsyncStorage.setItem('currentUserId', this.userId);
      return;
    }

    try {
      await BackgroundFetch.registerTaskAsync(BACKGROUND_SYNC_TASK, {
        minimumInterval: 6 * 60 * 60, // 6 hours
        stopOnTerminate: false,
        startOnBoot: true,
      });

      // Store user ID for background access
      await AsyncStorage.setItem('currentUserId', this.userId);

      console.log('✅ Background sync scheduled (every 6 hours)');
    } catch (error) {
      console.error('Failed to start background sync:', error);
      // Fallback to app state sync only
      await AsyncStorage.setItem('currentUserId', this.userId);
    }
  }

  async stopBackgroundSync() {
    try {
      if (BackgroundFetch) {
        await BackgroundFetch.unregisterTaskAsync(BACKGROUND_SYNC_TASK);
      }
      await AsyncStorage.removeItem('currentUserId');
      console.log('🛑 Background sync stopped');
    } catch (error) {
      console.error('Failed to stop background sync:', error);
    }
  }

  async performBackgroundSync(userId) {
    try {
      console.log('🔄 Performing background sync for user:', userId);
      
      // Initialize IntegrationManager for background context
      await IntegrationManager.initialize(userId);
      
      // Check if enough time has passed since last sync
      const lastSyncTimes = await this.getLastSyncTimes();
      const now = Date.now();
      const minSyncInterval = 4 * 60 * 60 * 1000; // 4 hours minimum
      
      const needsOuraSync = !lastSyncTimes.oura || (now - lastSyncTimes.oura) > minSyncInterval;
      const needsWhoopSync = !lastSyncTimes.whoop || (now - lastSyncTimes.whoop) > minSyncInterval;
      
      if (!needsOuraSync && !needsWhoopSync) {
        console.log('⏭️ Skipping sync - too soon since last sync');
        return { success: true, skipped: true };
      }

      // Perform the sync
      const result = await IntegrationManager.syncAllIntegrations(userId);
      
      // Update sync timestamps
      await this.updateLastSyncTimes();
      
      return result;
    } catch (error) {
      console.error('Background sync error:', error);
      return { success: false, error: error.message };
    }
  }

  async performQuickSync() {
    if (!this.userId) return;
    
    try {
      console.log('⚡ Performing quick sync on app activation...');
      
      // Check if it's been more than 30 minutes since last sync
      const lastSyncTimes = await this.getLastSyncTimes();
      const now = Date.now();
      const quickSyncInterval = 30 * 60 * 1000; // 30 minutes
      
      const shouldSync = Object.values(lastSyncTimes).some(time => 
        !time || (now - time) > quickSyncInterval
      );
      
      if (shouldSync) {
        // Don't await - let it sync in background
        IntegrationManager.syncAllIntegrations(this.userId)
          .then(result => {
            if (result.success) {
              console.log('✅ Quick sync completed:', result.summary);
            }
          })
          .catch(error => {
            console.log('⚠️ Quick sync failed:', error.message);
          });
      }
    } catch (error) {
      console.error('Quick sync error:', error);
    }
  }

  async getLastSyncTimes() {
    try {
      const [ouraSync, whoopSync] = await Promise.all([
        AsyncStorage.getItem('oura_last_sync'),
        AsyncStorage.getItem('whoop_last_sync')
      ]);

      return {
        oura: ouraSync ? new Date(ouraSync).getTime() : null,
        whoop: whoopSync ? new Date(whoopSync).getTime() : null
      };
    } catch (error) {
      console.error('Error getting last sync times:', error);
      return { oura: null, whoop: null };
    }
  }

  async updateLastSyncTimes() {
    try {
      const now = new Date().toISOString();
      await Promise.all([
        AsyncStorage.setItem('oura_last_sync', now),
        AsyncStorage.setItem('whoop_last_sync', now)
      ]);
    } catch (error) {
      console.error('Error updating sync times:', error);
    }
  }

  // Manual trigger for immediate sync
  async syncNow(userId) {
    return await this.performBackgroundSync(userId || this.userId);
  }

  // Check if background sync is enabled
  async isBackgroundSyncEnabled() {
    if (!BackgroundFetch) {
      return false;
    }
    
    try {
      const status = await BackgroundFetch.getStatusAsync();
      return status === BackgroundFetch.BackgroundFetchStatus.Available;
    } catch (error) {
      console.error('Error checking background sync status:', error);
      return false;
    }
  }

  cleanup() {
    this.stopBackgroundSync();
    AppState.removeEventListener('change');
  }
}

export default new AutoSyncService();