import { Linking } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import AsyncStorage from '@react-native-async-storage/async-storage';
import OuraService from './OuraService';
import WhoopService from './WhoopService';
import WhoopAuthService from './WhoopAuthService';

class IntegrationManager {
  constructor() {
    this.setupDeepLinking();
    this.syncInterval = null;
    this.isInitialized = false;
  }

  async initialize(userId) {
    if (this.isInitialized) return;
    
    this.userId = userId;
    this.isInitialized = true;
    
    // Start automatic sync for connected integrations
    await this.startAutoSync();
    
    // Initialize auto-sync service
    try {
      const AutoSyncService = require('./AutoSyncService').default;
      await AutoSyncService.initialize(userId);
    } catch (error) {
      console.log('AutoSyncService not available:', error.message);
    }
    
    console.log('🔧 IntegrationManager initialized for user:', userId);
  }

  setupDeepLinking() {
    // Handle deep links for OAuth callbacks
    Linking.addEventListener('url', this.handleDeepLink);
    
    // Check if app was opened via deep link
    Linking.getInitialURL().then((url) => {
      if (url) {
        this.handleDeepLink({ url });
      }
    });
  }

  handleDeepLink = async ({ url }) => {
    console.log('🔗 Deep link received:', url);
    
    try {
      if (url.includes('oura-callback')) {
        await this.handleOuraCallback(url);
      } else if (url.includes('whoop-callback')) {
        await this.handleWhoopCallback(url);
      }
    } catch (error) {
      console.error('Deep link handling error:', error);
    }
  };

  async handleOuraCallback(url) {
    try {
      const parsedUrl = new URL(url);
      const code = parsedUrl.searchParams.get('code');
      const state = parsedUrl.searchParams.get('state'); // userId
      
      if (!code) {
        throw new Error('No authorization code received from Oura');
      }

      console.log('🟢 Oura callback received, exchanging code...');
      
      const result = await OuraService.handleCallback(code, state || this.userId);
      
      if (result.success) {
        console.log('✅ Oura integration successful');
        // Clear any pending connection state
        await AsyncStorage.removeItem('pendingOuraConnection');
        // Start data sync
        await this.syncOuraData(state || this.userId);
        // Notify UI
        this.notifyIntegrationComplete('oura', true);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Oura callback error:', error);
      this.notifyIntegrationComplete('oura', false, error.message);
    }
  }

  async handleWhoopCallback(url) {
    try {
      const parsedUrl = new URL(url);
      const code = parsedUrl.searchParams.get('code');
      const state = parsedUrl.searchParams.get('state'); // userId
      
      if (!code) {
        throw new Error('No authorization code received from Whoop');
      }

      console.log('🟠 Whoop callback received, exchanging code...');
      
      const result = await WhoopService.handleCallback(code, state || this.userId);
      
      if (result.success) {
        console.log('✅ Whoop integration successful');
        // Clear any pending connection state
        await AsyncStorage.removeItem('pendingWhoopConnection');
        // Start data sync
        await this.syncWhoopData(state || this.userId);
        // Notify UI
        this.notifyIntegrationComplete('whoop', true);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Whoop callback error:', error);
      this.notifyIntegrationComplete('whoop', false, error.message);
    }
  }

  // Start OAuth flow with proper deep linking
  async startOuraAuth(userId) {
    try {
      console.log('🚀 Starting Oura OAuth with deep linking...');
      
      // Mark connection as pending
      await AsyncStorage.setItem('pendingOuraConnection', 'true');
      
      const authUrl = OuraService.getAuthUrl(userId);
      console.log('Opening Oura auth URL:', authUrl);
      
      const supported = await Linking.canOpenURL(authUrl);
      if (supported) {
        await Linking.openURL(authUrl);
        return { success: true, message: 'Redirecting to Oura...' };
      } else {
        throw new Error('Cannot open Oura authentication URL');
      }
    } catch (error) {
      console.error('Oura auth start error:', error);
      await AsyncStorage.removeItem('pendingOuraConnection');
      return { success: false, error: error.message };
    }
  }

  async startWhoopAuth(userId) {
    try {
      console.log('🚀 Starting Whoop OAuth with deep linking...');
      
      // Mark connection as pending
      await AsyncStorage.setItem('pendingWhoopConnection', 'true');
      
      // Use simple URL opening approach for EAS builds (same as Oura)
      const authUrl = WhoopService.getAuthUrl(userId);
      console.log('Opening Whoop auth URL:', authUrl);
      
      const supported = await Linking.canOpenURL(authUrl);
      if (supported) {
        await Linking.openURL(authUrl);
        return { success: true, message: 'Redirecting to Whoop for authorization...' };
      } else {
        throw new Error('Cannot open Whoop authorization URL');
      }
    } catch (error) {
      console.error('Whoop auth start error:', error);
      await AsyncStorage.removeItem('pendingWhoopConnection');
      return { success: false, error: error.message };
    }
  }

  // Data synchronization methods
  async syncOuraData(userId, daysBack = 14) {
    try {
      console.log('🔄 Starting Oura data sync...');
      const result = await OuraService.syncAllData(userId, daysBack);
      
      if (result.success) {
        console.log('✅ Oura sync completed:', result.data);
        await AsyncStorage.setItem('oura_last_sync', new Date().toISOString());
      }
      
      return result;
    } catch (error) {
      console.error('Oura sync error:', error);
      return { success: false, error: error.message };
    }
  }

  async syncWhoopData(userId, daysBack = 7) {
    try {
      console.log('🔄 Starting Whoop data sync...');
      const result = await WhoopService.syncAllData(userId, daysBack);
      
      if (result.success) {
        console.log('✅ Whoop sync completed:', result.data);
        await AsyncStorage.setItem('whoop_last_sync', new Date().toISOString());
      }
      
      return result;
    } catch (error) {
      console.error('Whoop sync error:', error);
      return { success: false, error: error.message };
    }
  }

  // Automatic synchronization
  async startAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    // Sync every 6 hours
    this.syncInterval = setInterval(async () => {
      if (!this.userId) return;
      
      console.log('⏰ Running automatic sync...');
      
      try {
        // Check which integrations are active and sync them
        const [ouraActive, whoopActive] = await Promise.all([
          OuraService.hasActiveIntegration(this.userId),
          WhoopService.hasActiveIntegration(this.userId)
        ]);

        const syncPromises = [];
        
        if (ouraActive) {
          syncPromises.push(this.syncOuraData(this.userId));
        }
        
        if (whoopActive) {
          syncPromises.push(this.syncWhoopData(this.userId));
        }
        
        if (syncPromises.length > 0) {
          const results = await Promise.allSettled(syncPromises);
          console.log('⏰ Auto-sync completed:', results);
        }
      } catch (error) {
        console.error('Auto-sync error:', error);
      }
    }, 6 * 60 * 60 * 1000); // 6 hours

    console.log('⏰ Auto-sync started (every 6 hours)');
  }

  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('⏰ Auto-sync stopped');
    }
  }

  // Manual sync trigger
  async syncAllIntegrations(userId) {
    const results = {
      oura: { success: false, data: null, error: null },
      whoop: { success: false, data: null, error: null }
    };

    try {
      // Check which integrations are active
      const [ouraActive, whoopActive] = await Promise.all([
        OuraService.hasActiveIntegration(userId),
        WhoopService.hasActiveIntegration(userId)
      ]);

      // Sync active integrations in parallel
      const syncPromises = [];
      
      if (ouraActive) {
        syncPromises.push(
          this.syncOuraData(userId).then(result => ({ type: 'oura', result }))
        );
      }
      
      if (whoopActive) {
        syncPromises.push(
          this.syncWhoopData(userId).then(result => ({ type: 'whoop', result }))
        );
      }

      if (syncPromises.length === 0) {
        return { success: false, error: 'No active integrations to sync' };
      }

      const syncResults = await Promise.allSettled(syncPromises);
      
      // Process results
      for (const settlementResult of syncResults) {
        if (settlementResult.status === 'fulfilled') {
          const { type, result } = settlementResult.value;
          results[type] = result;
        } else {
          console.error('Sync settlement error:', settlementResult.reason);
        }
      }

      const totalRecords = (results.oura.data?.totalRecords || 0) + (results.whoop.data?.totalRecords || 0);
      
      return {
        success: true,
        results,
        summary: {
          totalRecords,
          ouraRecords: results.oura.data?.totalRecords || 0,
          whoopRecords: results.whoop.data?.totalRecords || 0
        }
      };
    } catch (error) {
      console.error('Manual sync error:', error);
      return { success: false, error: error.message };
    }
  }

  // Integration status checks
  async getIntegrationStatuses(userId) {
    try {
      const [ouraActive, whoopActive] = await Promise.all([
        OuraService.hasActiveIntegration(userId),
        WhoopService.hasActiveIntegration(userId)
      ]);

      const [ouraLastSync, whoopLastSync] = await Promise.all([
        AsyncStorage.getItem('oura_last_sync'),
        AsyncStorage.getItem('whoop_last_sync')
      ]);

      return {
        oura: {
          connected: ouraActive,
          lastSync: ouraLastSync ? new Date(ouraLastSync) : null
        },
        whoop: {
          connected: whoopActive,
          lastSync: whoopLastSync ? new Date(whoopLastSync) : null
        }
      };
    } catch (error) {
      console.error('Integration status check error:', error);
      return {
        oura: { connected: false, lastSync: null },
        whoop: { connected: false, lastSync: null }
      };
    }
  }

  // Disconnect integrations
  async disconnectIntegration(userId, vendor) {
    try {
      if (vendor === 'oura') {
        await OuraService.disconnect(userId);
        await AsyncStorage.removeItem('oura_last_sync');
        console.log('✅ Oura disconnected');
      } else if (vendor === 'whoop') {
        await WhoopService.disconnect(userId);
        await AsyncStorage.removeItem('whoop_last_sync');
        console.log('✅ Whoop disconnected');
      }
      
      return { success: true };
    } catch (error) {
      console.error(`${vendor} disconnect error:`, error);
      return { success: false, error: error.message };
    }
  }

  // Notification system for UI updates
  notifyIntegrationComplete(vendor, success, error = null) {
    // This could emit events to update UI components
    console.log(`📢 Integration ${vendor}: ${success ? 'SUCCESS' : 'FAILED'} ${error ? `- ${error}` : ''}`);
    
    // You can implement event emitters here to notify UI components
    // For now, just log the result
  }

  cleanup() {
    this.stopAutoSync();
    Linking.removeAllListeners('url');
    this.isInitialized = false;
  }
}

export default new IntegrationManager();