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
    
    // Warn if credentials are missing
    if (!this.clientId || !this.clientSecret) {
      console.warn('⚠️ Oura OAuth credentials not configured. Integration disabled.');
    }
    // Use configuration-based redirect URI
    this.redirectUri = OAuthConfig.current.redirectUri;
    console.log('💍 Using OAuth config:', OAuthConfig.current.notes);
    
    console.log('💍 Oura Service initialized');
  }

  // Generate OAuth URL for user authentication
  async getAuthUrl(userId) {
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
      
      // Retrieve and validate state
      const storedStateData = await AsyncStorage.getItem('oura_oauth_state');
      if (!storedStateData) {
        throw new Error('No OAuth state found - session may have expired');
      }
      
      const { state: storedState, userId, timestamp } = JSON.parse(storedStateData);
      
      // Check if state matches
      if (state !== storedState) {
        console.error('State mismatch:', { provided: state, stored: storedState });
        throw new Error('Invalid OAuth state - possible CSRF attack');
      }
      
      // Check if state is not too old (5 minutes max)
      const stateAge = Date.now() - timestamp;
      if (stateAge > 5 * 60 * 1000) {
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
      
      const response = await fetch(this.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('Token exchange failed:', error);
        throw new Error(`Token exchange failed: ${response.status}`);
      }

      const tokens = await response.json();
      console.log('✅ Oura tokens received successfully');

      // Calculate token expiry (Oura tokens typically last longer)
      const expiresAt = new Date(Date.now() + (tokens.expires_in || 86400) * 1000);

      // Store tokens in database
      await this.storeTokens(userId, tokens, expiresAt);

      return { success: true, tokens };
    } catch (error) {
      console.error('❌ Oura OAuth callback error:', error);
      throw error;
    }
  }

  // Store tokens securely in database
  async storeTokens(userId, tokens, expiresAt) {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .update({
          oura_access_token: tokens.access_token,
          oura_refresh_token: tokens.refresh_token,
          oura_token_expires_at: expiresAt.toISOString(),
          oura_connected: true,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (error) throw error;

      console.log('✅ Oura tokens stored in database');
      return data;
    } catch (error) {
      console.error('❌ Error storing Oura tokens:', error);
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
      const accessToken = await this.getValidAccessToken(userId);
      
      console.log(`💍 Fetching Oura data from ${startDate} to ${endDate}`);

      // Fetch readiness data
      const readinessData = await this.fetchReadinessData(accessToken, startDate, endDate);
      
      // Fetch sleep data
      const sleepData = await this.fetchSleepData(accessToken, startDate, endDate);
      
      // Fetch activity data
      const activityData = await this.fetchActivityData(accessToken, startDate, endDate);

      // Store all data in health_metrics table
      const stored = await this.storeInHealthMetrics(userId, {
        readiness: readinessData,
        sleep: sleepData,
        activity: activityData
      });

      console.log(`✅ Stored ${stored.length} Oura metrics in health_metrics`);
      return stored;
    } catch (error) {
      console.error('❌ Error fetching Oura data:', error);
      throw error;
    }
  }

  // Fetch readiness data from Oura
  async fetchReadinessData(accessToken, startDate, endDate) {
    try {
      const url = `${this.apiUrl}/usercollection/daily_readiness?start_date=${startDate}&end_date=${endDate}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error(`Readiness fetch failed: ${response.status}`);
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('❌ Error fetching Oura readiness:', error);
      return [];
    }
  }

  // Fetch sleep data from Oura
  async fetchSleepData(accessToken, startDate, endDate) {
    try {
      const url = `${this.apiUrl}/usercollection/daily_sleep?start_date=${startDate}&end_date=${endDate}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error(`Sleep fetch failed: ${response.status}`);
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('❌ Error fetching Oura sleep:', error);
      return [];
    }
  }

  // Fetch activity data from Oura
  async fetchActivityData(accessToken, startDate, endDate) {
    try {
      const url = `${this.apiUrl}/usercollection/daily_activity?start_date=${startDate}&end_date=${endDate}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error(`Activity fetch failed: ${response.status}`);
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('❌ Error fetching Oura activity:', error);
      return [];
    }
  }

  // Store data in health_metrics table for Analytics backend to process
  async storeInHealthMetrics(userId, data) {
    const records = [];

    // Process readiness data
    for (const readiness of (data.readiness || [])) {
      records.push({
        user_id: userId,
        recorded_at: readiness.day || readiness.timestamp,
        vendor: 'oura',
        metric_type: 'readiness',
        data: readiness,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }

    // Process sleep data
    for (const sleep of (data.sleep || [])) {
      records.push({
        user_id: userId,
        recorded_at: sleep.day || sleep.timestamp,
        vendor: 'oura',
        metric_type: 'sleep',
        data: sleep,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }

    // Process activity data
    for (const activity of (data.activity || [])) {
      records.push({
        user_id: userId,
        recorded_at: activity.day || activity.timestamp,
        vendor: 'oura',
        metric_type: 'activity',
        data: activity,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }

    if (records.length === 0) {
      console.log('No Oura data to store');
      return [];
    }

    try {
      const { data: stored, error } = await supabase
        .from('health_metrics')
        .insert(records)
        .select();

      if (error) throw error;

      console.log(`✅ Stored ${stored.length} Oura records in health_metrics`);
      return stored;
    } catch (error) {
      console.error('❌ Error storing Oura data in health_metrics:', error);
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

  // Initial sync - fetch last 30 days of data
  async performInitialSync(userId) {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    console.log(`📅 Performing initial Oura sync from ${startDate} to ${endDate}`);
    return await this.fetchAndStoreData(userId, startDate, endDate);
  }

  // Daily sync - fetch yesterday's data
  async performDailySync(userId) {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    console.log(`📅 Performing daily Oura sync from ${startDate} to ${endDate}`);
    return await this.fetchAndStoreData(userId, startDate, endDate);
  }
}

export default new OuraService();