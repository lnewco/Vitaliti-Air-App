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
      console.log('🔄 Processing OAuth callback...');
      
      // Retrieve and validate state
      const storedStateData = await AsyncStorage.getItem('whoop_oauth_state');
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
      await AsyncStorage.removeItem('whoop_oauth_state');
      
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
      console.log('✅ Tokens received successfully');

      // Calculate token expiry (Whoop tokens typically last 1 hour)
      const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000);

      // Store tokens in database
      await this.storeTokens(userId, tokens, expiresAt);

      return { success: true, tokens };
    } catch (error) {
      console.error('❌ OAuth callback error:', error);
      throw error;
    }
  }

  // Store tokens securely in database
  async storeTokens(userId, tokens, expiresAt) {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .update({
          whoop_access_token: tokens.access_token,
          whoop_refresh_token: tokens.refresh_token,
          whoop_token_expires_at: expiresAt.toISOString(),
          whoop_connected: true,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (error) throw error;

      console.log('✅ Tokens stored in database');
      return data;
    } catch (error) {
      console.error('❌ Error storing tokens:', error);
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

  // Initial sync - fetch last 30 days of data
  async performInitialSync(userId) {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    console.log(`📅 Performing initial sync from ${startDate} to ${endDate}`);
    return await this.fetchAndStoreData(userId, startDate, endDate);
  }

  // Daily sync - fetch yesterday's data
  async performDailySync(userId) {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    console.log(`📅 Performing daily sync from ${startDate} to ${endDate}`);
    return await this.fetchAndStoreData(userId, startDate, endDate);
  }
}

export default new WhoopService();