import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking } from 'react-native';
import { supabase } from '../../config/supabase';
import { OAuthConfig } from '../../config/oauthConfig';

class WhoopService {
  constructor() {
    this.baseUrl = 'https://api.prod.whoop.com';
    // Use the auth endpoint (not authorize) - Whoop uses auth then redirects to consent
    this.authUrl = 'https://api.prod.whoop.com/oauth/oauth2/auth';
    this.tokenUrl = 'https://api.prod.whoop.com/oauth/oauth2/token';
    this.apiUrl = 'https://api.prod.whoop.com/developer/v1';
    
    // Use environment variables for credentials (no hardcoded fallbacks in production!)
    this.clientId = process.env.EXPO_PUBLIC_WHOOP_CLIENT_ID;
    this.clientSecret = process.env.EXPO_PUBLIC_WHOOP_CLIENT_SECRET;
    
    // Warn if credentials are missing
    if (!this.clientId || !this.clientSecret) {
      console.warn('⚠️ Whoop OAuth credentials not configured. Integration disabled.');
    }
    // Use configuration-based redirect URI
    this.redirectUri = OAuthConfig.current.redirectUri;
    console.log('📱 Using OAuth config:', OAuthConfig.current.notes);
    
    console.log('🔧 Whoop Service initialized');
    console.log('📱 Redirect URI:', this.redirectUri);
  }

  // Generate OAuth URL for user authentication
  async getAuthUrl(userId) {
    const scope = 'read:recovery read:cycles read:sleep read:workout read:profile offline';
    
    // Generate a unique state token - WHOOP REQUIRES EXACTLY 8 CHARACTERS!
    const stateToken = Math.random().toString(36).substr(2, 8).toUpperCase();
    
    // Store state in AsyncStorage to validate on callback
    await AsyncStorage.setItem('whoop_oauth_state', JSON.stringify({
      state: stateToken,
      userId: userId,
      timestamp: Date.now()
    }));
    
    // Build URL with proper encoding based on redirect type
    const params = {
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: scope,
      state: stateToken
    };

    // Encoding strategy based on redirect URI type
    const isCustomScheme = this.redirectUri.startsWith('vitalitiair://');
    const isHttps = this.redirectUri.startsWith('https://');
    
    let queryString;
    if (isHttps) {
      // For HTTPS URLs, use standard encoding (works with web redirects)
      queryString = new URLSearchParams(params).toString();
      console.log('📝 Using standard encoding for HTTPS redirect');
    } else if (isCustomScheme) {
      // For custom schemes, try without encoding first
      queryString = Object.entries(params)
        .map(([key, value]) => {
          // Don't encode the custom scheme redirect_uri
          if (key === 'redirect_uri') {
            return `${key}=${value}`;
          }
          return `${key}=${encodeURIComponent(value)}`;
        })
        .join('&');
      console.log('📝 Using unencoded custom scheme');
    } else {
      // Fallback to standard encoding
      queryString = new URLSearchParams(params).toString();
    }

    // Remove /auth since authUrl already includes /authorize
    const authUrl = `${this.authUrl}?${queryString}`;
    console.log('🔐 OAuth URL generated:', authUrl);
    console.log('🔗 Redirect URI included:', this.redirectUri);
    return authUrl;
  }

  // Handle OAuth callback and exchange code for tokens
  async handleCallback(code, state) {
    try {
      console.log('🔄 Processing Whoop OAuth callback...');
      console.log('📝 Full callback params:', { 
        code: code?.substring(0, 10) + '...', 
        state,
        redirectUri: this.redirectUri 
      });
      
      // Retrieve and validate state
      const storedStateData = await AsyncStorage.getItem('whoop_oauth_state');
      if (!storedStateData) {
        console.error('❌ No OAuth state found in AsyncStorage');
        throw new Error('No OAuth state found - session may have expired');
      }
      
      const { state: storedState, userId, timestamp } = JSON.parse(storedStateData);
      console.log('📋 Retrieved stored state:', { storedState, userId, timestamp });
      
      // Check if state matches
      if (state !== storedState) {
        console.error('❌ State mismatch:', { provided: state, stored: storedState });
        throw new Error('Invalid OAuth state - possible CSRF attack');
      }
      
      // Check if state is not too old (5 minutes max)
      const stateAge = Date.now() - timestamp;
      if (stateAge > 5 * 60 * 1000) {
        console.error('❌ OAuth state expired:', { ageMs: stateAge });
        throw new Error('OAuth state expired - please try again');
      }
      
      console.log('✅ State validated, exchanging code for tokens...');
      
      // Clear the stored state
      await AsyncStorage.removeItem('whoop_oauth_state');
      
      const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: this.redirectUri,
        client_id: this.clientId,
        client_secret: this.clientSecret
      }).toString();
      
      console.log('🔐 Token exchange request:', {
        url: this.tokenUrl,
        clientId: this.clientId,
        redirectUri: this.redirectUri
      });
      
      const response = await fetch(this.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body
      });

      const responseText = await response.text();
      console.log('📨 Token exchange response status:', response.status);
      
      if (!response.ok) {
        console.error('❌ Token exchange failed:', {
          status: response.status,
          error: responseText
        });
        throw new Error(`Token exchange failed: ${response.status} - ${responseText}`);
      }

      let tokens;
      try {
        tokens = JSON.parse(responseText);
      } catch (e) {
        console.error('❌ Failed to parse token response:', responseText);
        throw new Error('Invalid token response format');
      }
      
      console.log('✅ Whoop tokens received:', {
        hasAccessToken: !!tokens.access_token,
        hasRefreshToken: !!tokens.refresh_token,
        expiresIn: tokens.expires_in
      });

      // Validate tokens are present
      if (!tokens.access_token) {
        console.error('❌ No access token in response:', tokens);
        throw new Error('No access token received from Whoop');
      }

      // Calculate token expiry (Whoop tokens typically last 1 hour)
      const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000);

      // Store tokens in database with all required fields
      const storeResult = await this.storeTokens(userId, tokens, expiresAt);
      console.log('💾 Token storage result:', { success: !!storeResult, userId });

      // IMPORTANT: Perform initial sync immediately after connection
      console.log('🔄 Starting initial data sync after OAuth success...');
      try {
        const syncResult = await this.performInitialSync(userId);
        console.log('✅ Initial sync completed:', { recordsCount: syncResult?.length || 0 });
      } catch (syncError) {
        console.error('⚠️ Initial sync failed (connection still valid):', syncError);
        // Don't throw - connection is still successful even if initial sync fails
      }

      return { success: true, tokens, userId };
    } catch (error) {
      console.error('❌ Whoop OAuth callback error:', error.message);
      console.error('Stack trace:', error.stack);
      throw error;
    }
  }

  // Store tokens securely in database
  async storeTokens(userId, tokens, expiresAt) {
    try {
      console.log('💾 Storing Whoop tokens for user:', userId);
      
      // Extract user ID from token if available (Whoop specific)
      let whoopUserId = null;
      if (tokens.user?.id) {
        whoopUserId = tokens.user.id;
      } else if (tokens.user_id) {
        whoopUserId = tokens.user_id;
      }
      
      const updateData = {
        whoop_access_token: tokens.access_token,
        whoop_refresh_token: tokens.refresh_token || null,
        whoop_token_expires_at: expiresAt.toISOString(),
        whoop_connected: true,
        updated_at: new Date().toISOString()
      };
      
      // Add Whoop user ID if available
      if (whoopUserId) {
        updateData.whoop_user_id = whoopUserId;
      }
      
      console.log('📝 Update data prepared:', {
        hasAccessToken: !!updateData.whoop_access_token,
        hasRefreshToken: !!updateData.whoop_refresh_token,
        expiresAt: updateData.whoop_token_expires_at,
        whoopUserId: whoopUserId
      });
      
      const { data, error } = await supabase
        .from('user_profiles')
        .update(updateData)
        .eq('user_id', userId)
        .select();

      if (error) {
        console.error('❌ Database update error:', error);
        throw error;
      }

      console.log('✅ Whoop tokens stored in database:', {
        userId,
        connected: data?.[0]?.whoop_connected,
        hasTokens: !!data?.[0]?.whoop_access_token
      });
      
      // Log sync history for successful connection
      await this.logSyncHistory(userId, 'connected', 0, null);
      
      return data;
    } catch (error) {
      console.error('❌ Error storing Whoop tokens:', error.message);
      throw error;
    }
  }

  // Get stored tokens from database
  async getStoredTokens(userId) {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('whoop_access_token, whoop_refresh_token, whoop_token_expires_at')
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('❌ Error retrieving tokens:', error);
      return null;
    }
  }

  // Refresh access token using refresh token
  async refreshAccessToken(userId) {
    try {
      const storedTokens = await this.getStoredTokens(userId);
      if (!storedTokens?.whoop_refresh_token) {
        throw new Error('No refresh token available');
      }

      console.log('🔄 Refreshing Whoop access token...');

      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: storedTokens.whoop_refresh_token,
        client_id: this.clientId,
        client_secret: this.clientSecret
      }).toString();

      const response = await fetch(this.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('Token refresh failed:', error);
        throw new Error(`Token refresh failed: ${response.status}`);
      }

      const tokens = await response.json();
      const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000);

      // Update tokens in database
      await this.storeTokens(userId, tokens, expiresAt);

      console.log('✅ Access token refreshed successfully');
      return tokens.access_token;
    } catch (error) {
      console.error('❌ Error refreshing token:', error);
      throw error;
    }
  }

  // Get valid access token (refresh if needed)
  async getValidAccessToken(userId) {
    try {
      const tokens = await this.getStoredTokens(userId);
      if (!tokens) {
        throw new Error('No tokens found - user needs to authenticate');
      }

      const expiresAt = new Date(tokens.whoop_token_expires_at);
      const now = new Date();
      
      // Refresh if token expires in less than 5 minutes
      if (expiresAt - now < 5 * 60 * 1000) {
        console.log('⚠️ Token expiring soon, refreshing...');
        return await this.refreshAccessToken(userId);
      }

      return tokens.whoop_access_token;
    } catch (error) {
      console.error('❌ Error getting valid token:', error);
      throw error;
    }
  }

  // Fetch data from Whoop API and store in health_metrics
  async fetchAndStoreData(userId, startDate, endDate) {
    try {
      const accessToken = await this.getValidAccessToken(userId);
      
      console.log(`📊 Fetching Whoop data from ${startDate} to ${endDate}`);

      // Fetch recovery data
      const recoveryData = await this.fetchRecoveryData(accessToken, startDate, endDate);
      
      // Fetch sleep data
      const sleepData = await this.fetchSleepData(accessToken, startDate, endDate);
      
      // Fetch cycle data
      const cycleData = await this.fetchCycleData(accessToken, startDate, endDate);

      // Store all data in health_metrics table
      const stored = await this.storeInHealthMetrics(userId, {
        recovery: recoveryData,
        sleep: sleepData,
        cycle: cycleData
      });

      console.log(`✅ Stored ${stored.length} Whoop metrics in health_metrics`);
      return stored;
    } catch (error) {
      console.error('❌ Error fetching Whoop data:', error);
      throw error;
    }
  }

  // Fetch recovery data from Whoop
  async fetchRecoveryData(accessToken, startDate, endDate) {
    try {
      const url = `${this.apiUrl}/recovery?start=${startDate}&end=${endDate}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error(`Recovery fetch failed: ${response.status}`);
      }

      const data = await response.json();
      return data.records || [];
    } catch (error) {
      console.error('❌ Error fetching recovery:', error);
      return [];
    }
  }

  // Fetch sleep data from Whoop
  async fetchSleepData(accessToken, startDate, endDate) {
    try {
      const url = `${this.apiUrl}/activity/sleep?start=${startDate}&end=${endDate}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error(`Sleep fetch failed: ${response.status}`);
      }

      const data = await response.json();
      return data.records || [];
    } catch (error) {
      console.error('❌ Error fetching sleep:', error);
      return [];
    }
  }

  // Fetch cycle (strain) data from Whoop
  async fetchCycleData(accessToken, startDate, endDate) {
    try {
      const url = `${this.apiUrl}/cycle?start=${startDate}&end=${endDate}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error(`Cycle fetch failed: ${response.status}`);
      }

      const data = await response.json();
      return data.records || [];
    } catch (error) {
      console.error('❌ Error fetching cycles:', error);
      return [];
    }
  }

  // Store data in health_metrics table for Analytics backend to process
  async storeInHealthMetrics(userId, data) {
    const records = [];

    // Process recovery data
    for (const recovery of (data.recovery || [])) {
      records.push({
        user_id: userId,
        recorded_at: recovery.created_at || recovery.date,
        vendor: 'whoop',
        metric_type: 'recovery',
        data: recovery,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }

    // Process sleep data
    for (const sleep of (data.sleep || [])) {
      records.push({
        user_id: userId,
        recorded_at: sleep.created_at || sleep.date,
        vendor: 'whoop',
        metric_type: 'sleep',
        data: sleep,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }

    // Process cycle data
    for (const cycle of (data.cycle || [])) {
      records.push({
        user_id: userId,
        recorded_at: cycle.created_at || cycle.start,
        vendor: 'whoop',
        metric_type: 'cycle',
        data: cycle,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }

    if (records.length === 0) {
      console.log('No Whoop data to store');
      return [];
    }

    try {
      const { data: stored, error } = await supabase
        .from('health_metrics')
        .insert(records)
        .select();

      if (error) throw error;

      console.log(`✅ Stored ${stored.length} records in health_metrics`);
      return stored;
    } catch (error) {
      console.error('❌ Error storing in health_metrics:', error);
      throw error;
    }
  }

  // Disconnect Whoop (remove tokens)
  async disconnect(userId) {
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          whoop_access_token: null,
          whoop_refresh_token: null,
          whoop_token_expires_at: null,
          whoop_connected: false,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (error) throw error;

      console.log('✅ Whoop disconnected');
      return true;
    } catch (error) {
      console.error('❌ Error disconnecting Whoop:', error);
      throw error;
    }
  }

  // Get last successful sync time
  async getLastSyncTime(userId) {
    try {
      const { data, error } = await supabase
        .from('sync_history')
        .select('sync_time, completed_at')
        .eq('user_id', userId)
        .eq('vendor', 'whoop')
        .eq('status', 'completed')
        .order('sync_time', { ascending: false })
        .limit(1);

      if (error) throw error;
      // Use completed_at if available, otherwise sync_time
      const syncTime = data?.[0]?.completed_at || data?.[0]?.sync_time;
      return syncTime ? new Date(syncTime) : null;
    } catch (error) {
      console.error('❌ Error getting last sync time:', error);
      return null;
    }
  }

  // Log sync attempt to sync_history table
  async logSyncHistory(userId, status, recordsCount, error) {
    try {
      const insertData = {
        user_id: userId,
        vendor: 'whoop',
        sync_time: new Date().toISOString(),
        status: status,
        sync_type: 'manual', // Default to manual, can be 'scheduled' for cron jobs
        records_synced: recordsCount || 0,
        error_message: error || null
      };
      
      // Add completed_at if status is completed
      if (status === 'completed') {
        insertData.completed_at = new Date().toISOString();
      }
      
      const { data, error: dbError } = await supabase
        .from('sync_history')
        .insert(insertData)
        .select();

      if (dbError) {
        console.error('❌ Error logging sync history:', dbError);
      } else {
        console.log('📝 Sync history logged:', { status, recordsCount });
      }
      return data;
    } catch (err) {
      console.error('❌ Failed to log sync history:', err);
    }
  }

  // Update last sync timestamp in user_profiles
  async updateLastSyncTime(userId) {
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          whoop_last_sync: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (error) throw error;
      console.log('🕒 Last sync time updated');
    } catch (error) {
      console.error('❌ Error updating last sync time:', error);
    }
  }

  // Main sync function - properly fetches and stores data
  async syncNow(userId) {
    console.log('🔄 Starting Whoop sync for user:', userId);
    
    try {
      // Get valid access token (will refresh if needed)
      console.log('🔐 Getting valid access token...');
      const accessToken = await this.getValidAccessToken(userId);
      
      // Determine sync range
      const lastSync = await this.getLastSyncTime(userId);
      const endDate = new Date().toISOString().split('T')[0];
      let startDate;
      
      if (lastSync) {
        // Sync from last sync date
        startDate = new Date(lastSync.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        console.log(`📅 Syncing from last sync: ${startDate} to ${endDate}`);
      } else {
        // No previous sync, get last 30 days
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        console.log(`📅 Initial sync: ${startDate} to ${endDate}`);
      }
      
      // Fetch and store data
      const data = await this.fetchAndStoreData(userId, startDate, endDate);
      
      // Update last sync timestamp
      await this.updateLastSyncTime(userId);
      
      // Log successful sync
      await this.logSyncHistory(userId, 'completed', data.length, null);
      
      console.log(`✅ Whoop sync completed: ${data.length} records`);
      return { 
        success: true, 
        recordsCount: data.length,
        startDate,
        endDate
      };
      
    } catch (error) {
      console.error('❌ Whoop sync failed:', error);
      
      // Log failed sync
      await this.logSyncHistory(userId, 'failed', 0, error.message);
      
      return { 
        success: false, 
        error: error.message,
        recordsCount: 0
      };
    }
  }

  // Initial sync - fetch last 30 days of data
  async performInitialSync(userId) {
    console.log('🆕 Performing initial Whoop sync...');
    return await this.syncNow(userId);
  }

  // Daily sync - uses smart sync logic
  async performDailySync(userId) {
    console.log('📅 Performing daily Whoop sync...');
    return await this.syncNow(userId);
  }
}

export default new WhoopService();