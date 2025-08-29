import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking } from 'react-native';
import { supabase } from '../../config/supabase';
import { OAuthConfig } from '../../config/oauthConfig';

class OuraService {
  constructor() {
    this.authUrl = 'https://cloud.ouraring.com/oauth/authorize';
    this.tokenUrl = 'https://api.ouraring.com/oauth/token';
    this.apiUrl = 'https://api.ouraring.com/v2';
    
    // Use environment variables for credentials (no hardcoded fallbacks in production!)
    this.clientId = process.env.EXPO_PUBLIC_OURA_CLIENT_ID;
    this.clientSecret = process.env.EXPO_PUBLIC_OURA_CLIENT_SECRET;
    
    console.log('🔍 Oura Environment check:');
    console.log('  - EXPO_PUBLIC_OURA_CLIENT_ID:', this.clientId ? '✅ Set' : '❌ Missing');
    console.log('  - EXPO_PUBLIC_OURA_CLIENT_SECRET:', this.clientSecret ? '✅ Set' : '❌ Missing');
    
    // Warn if credentials are missing
    if (!this.clientId || !this.clientSecret) {
      console.warn('⚠️ Oura OAuth credentials not configured. Integration disabled.');
      console.warn('⚠️ Make sure EXPO_PUBLIC_OURA_CLIENT_ID and EXPO_PUBLIC_OURA_CLIENT_SECRET are set in your .env file');
    }
    // Use configuration-based redirect URI
    this.redirectUri = OAuthConfig.current.redirectUri;
    console.log('💍 Using OAuth config:', OAuthConfig.current.notes);
    
    console.log('💍 Oura Service initialized');
  }

  // Generate OAuth URL for user authentication
  async getAuthUrl(userId) {
    if (!this.clientId || !this.clientSecret) {
      console.error('❌ Cannot generate auth URL: Missing OAuth credentials');
      return null;
    }
    
    const scope = 'daily readiness sleep activity';
    
    // Generate a unique state token and store it with userId
    const stateToken = `${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Store state in AsyncStorage to validate on callback
    await AsyncStorage.setItem('oura_oauth_state', JSON.stringify({
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

    // Oura requires encoded URLs per their documentation
    // This works for both HTTPS and custom schemes
    const queryString = new URLSearchParams(params).toString();
    console.log('📝 Using standard encoding for Oura');

    const authUrl = `${this.authUrl}?${queryString}`;
    console.log('🔐 Oura OAuth URL generated:', authUrl);
    return authUrl;
  }

  // Handle OAuth callback and exchange code for tokens
  async handleCallback(code, state) {
    try {
      console.log('🔄 Processing Oura OAuth callback...');
      console.log('📝 Full callback params:', { 
        code: code?.substring(0, 10) + '...', 
        state,
        redirectUri: this.redirectUri 
      });
      
      // Retrieve and validate state
      const storedStateData = await AsyncStorage.getItem('oura_oauth_state');
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
      await AsyncStorage.removeItem('oura_oauth_state');
      
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
      
      console.log('✅ Oura tokens received:', {
        hasAccessToken: !!tokens.access_token,
        hasRefreshToken: !!tokens.refresh_token,
        expiresIn: tokens.expires_in
      });

      // Validate tokens are present
      if (!tokens.access_token) {
        console.error('❌ No access token in response:', tokens);
        throw new Error('No access token received from Oura');
      }

      // Calculate token expiry (Oura tokens typically last longer)
      const expiresAt = new Date(Date.now() + (tokens.expires_in || 86400) * 1000);

      // Store tokens in database with all required fields
      const storeResult = await this.storeTokens(userId, tokens, expiresAt);
      console.log('💾 Token storage result:', { success: !!storeResult, userId });

      // IMPORTANT: Perform initial sync immediately after connection
      console.log('🔄 Starting initial data sync after OAuth success...');
      try {
        const syncResult = await this.performInitialSync(userId);
        if (syncResult.success) {
          console.log('✅ Initial sync completed:', {
            recordsCount: syncResult.recordsCount,
            dateRange: `${syncResult.startDate} to ${syncResult.endDate}`
          });
          // Show success with data count
          return {
            success: true,
            tokens,
            userId,
            initialSyncRecords: syncResult.recordsCount
          };
        } else {
          console.error('⚠️ Initial sync failed:', syncResult.error);
          // Connection successful but sync failed
          return {
            success: true,
            tokens,
            userId,
            syncError: syncResult.error,
            message: 'Connected successfully. Please use Sync Now to fetch data.'
          };
        }
      } catch (syncError) {
        console.error('❌ Initial sync exception:', syncError);
        // Don't fail the whole connection
        return {
          success: true,
          tokens,
          userId,
          syncError: syncError.message
        };
      }
    } catch (error) {
      console.error('❌ Oura OAuth callback error:', error.message);
      console.error('Stack trace:', error.stack);
      throw error;
    }
  }

  // Store tokens securely in database
  async storeTokens(userId, tokens, expiresAt) {
    try {
      console.log('💾 Storing Oura tokens for user:', userId);
      
      // Extract user ID from token if available (Oura specific)
      let ouraUserId = null;
      if (tokens.user_id) {
        ouraUserId = tokens.user_id;
      }
      
      const updateData = {
        oura_access_token: tokens.access_token,
        oura_refresh_token: tokens.refresh_token || null,
        oura_token_expires_at: expiresAt.toISOString(),
        oura_connected: true,
        updated_at: new Date().toISOString()
      };
      
      // Add Oura user ID if available
      if (ouraUserId) {
        updateData.oura_user_id = ouraUserId;
      }
      
      console.log('📝 Update data prepared:', {
        hasAccessToken: !!updateData.oura_access_token,
        hasRefreshToken: !!updateData.oura_refresh_token,
        expiresAt: updateData.oura_token_expires_at,
        ouraUserId: ouraUserId
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

      console.log('✅ Oura tokens stored in database:', {
        userId,
        connected: data?.[0]?.oura_connected,
        hasTokens: !!data?.[0]?.oura_access_token
      });
      
      // Log sync history for successful connection
      await this.logSyncHistory(userId, 'connected', 0, null);
      
      return data;
    } catch (error) {
      console.error('❌ Error storing Oura tokens:', error.message);
      throw error;
    }
  }

  // Get stored tokens from database
  async getStoredTokens(userId) {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('oura_access_token, oura_refresh_token, oura_token_expires_at')
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('❌ Error retrieving Oura tokens:', error);
      return null;
    }
  }

  // Refresh access token using refresh token
  async refreshAccessToken(userId) {
    try {
      const storedTokens = await this.getStoredTokens(userId);
      if (!storedTokens?.oura_refresh_token) {
        throw new Error('No Oura refresh token available');
      }

      console.log('🔄 Refreshing Oura access token...');

      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: storedTokens.oura_refresh_token,
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
      const expiresAt = new Date(Date.now() + (tokens.expires_in || 86400) * 1000);

      // Update tokens in database
      await this.storeTokens(userId, tokens, expiresAt);

      console.log('✅ Oura access token refreshed successfully');
      return tokens.access_token;
    } catch (error) {
      console.error('❌ Error refreshing Oura token:', error);
      throw error;
    }
  }

  // Get valid access token (refresh if needed)
  async getValidAccessToken(userId) {
    try {
      const tokens = await this.getStoredTokens(userId);
      if (!tokens) {
        throw new Error('No Oura tokens found - user needs to authenticate');
      }

      const expiresAt = new Date(tokens.oura_token_expires_at);
      const now = new Date();
      
      // Refresh if token expires in less than 1 hour
      if (expiresAt - now < 60 * 60 * 1000) {
        console.log('⚠️ Oura token expiring soon, refreshing...');
        return await this.refreshAccessToken(userId);
      }

      return tokens.oura_access_token;
    } catch (error) {
      console.error('❌ Error getting valid Oura token:', error);
      throw error;
    }
  }

  // Fetch data from Oura API and store in health_metrics
  async fetchAndStoreData(userId, startDate, endDate) {
    try {
      console.log('📊 fetchAndStoreData called with:', { userId, startDate, endDate });
      
      const accessToken = await this.getValidAccessToken(userId);
      console.log('🔐 Got access token:', accessToken ? 'Yes' : 'No');
      
      console.log(`💍 Fetching Oura data from ${startDate} to ${endDate}`);

      // Fetch readiness data
      console.log(`📡 Fetching readiness from: ${this.apiUrl}/usercollection/daily_readiness?start_date=${startDate}&end_date=${endDate}`);
      const readinessData = await this.fetchReadinessData(accessToken, startDate, endDate);
      console.log(`✅ Readiness data: ${readinessData.length} records`);
      
      // Fetch sleep data
      console.log(`📡 Fetching sleep from: ${this.apiUrl}/usercollection/daily_sleep?start_date=${startDate}&end_date=${endDate}`);
      const sleepData = await this.fetchSleepData(accessToken, startDate, endDate);
      console.log(`✅ Sleep data: ${sleepData.length} records`);
      
      // Fetch activity data
      console.log(`📡 Fetching activity from: ${this.apiUrl}/usercollection/daily_activity?start_date=${startDate}&end_date=${endDate}`);
      const activityData = await this.fetchActivityData(accessToken, startDate, endDate);
      console.log(`✅ Activity data: ${activityData.length} records`);

      // Store all data in health_metrics table
      console.log('💾 Preparing to store in health_metrics...');
      const stored = await this.storeInHealthMetrics(userId, {
        readiness: readinessData,
        sleep: sleepData,
        activity: activityData
      });

      console.log(`✅ Successfully stored ${stored.length} records in health_metrics`);
      return stored;
    } catch (error) {
      console.error('❌ fetchAndStoreData failed:', error);
      console.error('Stack:', error.stack);
      throw error;
    }
  }

  // Fetch readiness data from Oura
  async fetchReadinessData(accessToken, startDate, endDate) {
    try {
      const url = `${this.apiUrl}/usercollection/daily_readiness?start_date=${startDate}&end_date=${endDate}`;
      console.log('🔄 Fetching readiness data from:', url);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      console.log('📨 Readiness response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Readiness API error:', errorText);
        throw new Error(`Readiness fetch failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('✅ Readiness data received:', data.data ? data.data.length : 0, 'records');
      return data.data || [];
    } catch (error) {
      console.error('❌ Error fetching Oura readiness:', error.message);
      console.error('Stack:', error.stack);
      return [];
    }
  }

  // Fetch sleep data from Oura
  async fetchSleepData(accessToken, startDate, endDate) {
    try {
      const url = `${this.apiUrl}/usercollection/daily_sleep?start_date=${startDate}&end_date=${endDate}`;
      console.log('🔄 Fetching sleep data from:', url);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      console.log('📨 Sleep response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Sleep API error:', errorText);
        throw new Error(`Sleep fetch failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('✅ Sleep data received:', data.data ? data.data.length : 0, 'records');
      return data.data || [];
    } catch (error) {
      console.error('❌ Error fetching Oura sleep:', error.message);
      console.error('Stack:', error.stack);
      return [];
    }
  }

  // Fetch activity data from Oura
  async fetchActivityData(accessToken, startDate, endDate) {
    try {
      const url = `${this.apiUrl}/usercollection/daily_activity?start_date=${startDate}&end_date=${endDate}`;
      console.log('🔄 Fetching activity data from:', url);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      console.log('📨 Activity response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Activity API error:', errorText);
        throw new Error(`Activity fetch failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('✅ Activity data received:', data.data ? data.data.length : 0, 'records');
      return data.data || [];
    } catch (error) {
      console.error('❌ Error fetching Oura activity:', error.message);
      console.error('Stack:', error.stack);
      return [];
    }
  }

  // Store data in health_metrics table for Analytics backend to process
  async storeInHealthMetrics(userId, data) {
    console.log('💾 storeInHealthMetrics called with:', {
      userId,
      readinessCount: data.readiness?.length || 0,
      sleepCount: data.sleep?.length || 0,
      activityCount: data.activity?.length || 0
    });
    
    const records = [];

    // Process readiness data
    for (const readiness of (data.readiness || [])) {
      records.push({
        user_id: userId,
        recorded_at: readiness.day || readiness.timestamp,
        vendor: 'oura',  // Must be 'vendor' not 'provider'
        metric_type: 'readiness',
        data: readiness,
        created_at: new Date().toISOString()
        // NO updated_at field - it doesn't exist in the table!
      });
    }

    // Process sleep data
    for (const sleep of (data.sleep || [])) {
      records.push({
        user_id: userId,
        recorded_at: sleep.day || sleep.timestamp,
        vendor: 'oura',  // Must be 'vendor' not 'provider'
        metric_type: 'sleep',
        data: sleep,
        created_at: new Date().toISOString()
        // NO updated_at field - it doesn't exist in the table!
      });
    }

    // Process activity data
    for (const activity of (data.activity || [])) {
      records.push({
        user_id: userId,
        recorded_at: activity.day || activity.timestamp,
        vendor: 'oura',  // Must be 'vendor' not 'provider'
        metric_type: 'activity',
        data: activity,
        created_at: new Date().toISOString()
        // NO updated_at field - it doesn't exist in the table!
      });
    }

    if (records.length === 0) {
      console.log('No Oura data to store');
      return [];
    }

    console.log(`💾 About to insert ${records.length} records into health_metrics`);
    console.log('📝 Sample record structure:', JSON.stringify(records[0], null, 2));
    
    try {
      const { data: stored, error } = await supabase
        .from('health_metrics')
        .insert(records)
        .select();

      if (error) {
        console.error('❌ Database insert error:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
        throw error;
      }

      console.log(`✅ Successfully stored ${stored?.length || 0} records in health_metrics`);
      return stored || [];
    } catch (error) {
      console.error('❌ Error storing Oura data in health_metrics:', error.message);
      console.error('Full error:', error);
      throw error;
    }
  }

  // Disconnect Oura (remove tokens)
  async disconnect(userId) {
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          oura_access_token: null,
          oura_refresh_token: null,
          oura_token_expires_at: null,
          oura_connected: false,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (error) throw error;

      console.log('✅ Oura disconnected');
      return true;
    } catch (error) {
      console.error('❌ Error disconnecting Oura:', error);
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
        .eq('vendor', 'oura')
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
        vendor: 'oura',
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
          oura_last_sync: new Date().toISOString(),
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
    console.log('🔄 Starting Oura sync for user:', userId);
    
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
      
      console.log(`✅ Oura sync completed: ${data.length} records`);
      return { 
        success: true, 
        recordsCount: data.length,
        startDate,
        endDate
      };
      
    } catch (error) {
      console.error('❌ Oura sync failed:', error);
      
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
    console.log('🆕 Performing initial Oura sync...');
    return await this.syncNow(userId);
  }

  // Daily sync - uses smart sync logic
  async performDailySync(userId) {
    console.log('📅 Performing daily Oura sync...');
    return await this.syncNow(userId);
  }
}

export default new OuraService();