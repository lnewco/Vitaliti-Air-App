import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking } from 'react-native';
import { supabase } from '../../config/supabase';

class OuraService {
  constructor() {
    this.baseUrl = 'https://api.ouraring.com';
    this.authUrl = 'https://cloud.ouraring.com';
    // Use environment variables for credentials
    this.clientId = process.env.EXPO_PUBLIC_OURA_CLIENT_ID || '';
    this.clientSecret = process.env.EXPO_PUBLIC_OURA_CLIENT_SECRET || '';
    // Try a standard OAuth test redirect URI
    this.redirectUri = 'https://www.google.com';
    
    console.log('🔧 Oura Service initialized');
    console.log('🔗 Redirect URI:', this.redirectUri);
  }

  // Generate OAuth URL for user authentication
  getAuthUrl(userId) {
    // Use comprehensive scopes for Oura API v2
    const scope = 'email personal daily';
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: scope,
      state: userId
    });

    const authUrl = `${this.authUrl}/oauth/authorize?${params.toString()}`;
    console.log('🔗 Generated Oura auth URL:', authUrl);
    console.log('📋 Client ID:', this.clientId);
    console.log('📋 Redirect URI:', this.redirectUri);
    console.log('📋 Scope:', scope);
    
    return authUrl;
  }

  // Handle OAuth callback and exchange code for tokens
  async handleCallback(code, userId) {
    try {
      // Check if credentials are configured
      if (!this.clientId || !this.clientSecret) {
        throw new Error('Oura API credentials not configured. Please set EXPO_PUBLIC_OURA_CLIENT_ID and EXPO_PUBLIC_OURA_CLIENT_SECRET in your .env file');
      }
      
      console.log('🔄 Exchanging Oura code for tokens...');
      console.log('📝 Client ID:', this.clientId);
      console.log('📝 Redirect URI:', this.redirectUri);
      console.log('📝 Code length:', code?.length);
      
      const response = await fetch(`${this.authUrl}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          client_id: this.clientId,
          client_secret: this.clientSecret,
          redirect_uri: this.redirectUri
        }).toString()
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Oura token exchange failed:', response.status, errorText);
        throw new Error(`Failed to exchange code for tokens: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      // Store tokens in Supabase
      await this.saveIntegration(userId, {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString()
      });

      return { success: true, data };
    } catch (error) {
      console.error('Oura OAuth callback error:', error);
      return { success: false, error: error.message };
    }
  }

  // Save integration to Supabase
  async saveIntegration(userId, tokenData) {
    const { data, error } = await supabase
      .from('customer_integrations')
      .upsert({
        user_id: userId,
        vendor: 'oura',
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: tokenData.expires_at,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,vendor'
      });

    if (error) {
      console.error('Error saving Oura integration:', error);
      throw error;
    }

    return data;
  }

  // Get sleep data
  async getSleepData(accessToken, startDate, endDate) {
    try {
      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate
      });

      console.log('🔍 Fetching sleep data from:', `${this.baseUrl}/v2/usercollection/sleep?${params}`);
      console.log('🔍 Using access token:', accessToken?.substring(0, 10) + '...');
      
      const response = await fetch(`${this.baseUrl}/v2/usercollection/sleep?${params}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      console.log('🔍 Sleep API response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log('🔍 Sleep API error:', errorText);
        throw new Error(`Failed to fetch sleep data: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Error fetching Oura sleep data:', error);
      throw error;
    }
  }

  // Get daily activity
  async getDailyActivity(accessToken, startDate, endDate) {
    try {
      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate
      });

      const response = await fetch(`${this.baseUrl}/v2/usercollection/daily_activity?${params}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch activity data');
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Error fetching Oura activity data:', error);
      throw error;
    }
  }

  // Get readiness scores
  async getReadinessData(accessToken, startDate, endDate) {
    try {
      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate
      });

      const response = await fetch(`${this.baseUrl}/v2/usercollection/daily_readiness?${params}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch readiness data');
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Error fetching Oura readiness data:', error);
      throw error;
    }
  }

  // Get heart rate data (5-minute intervals)
  async getHeartRateData(accessToken, startDate, endDate) {
    try {
      const params = new URLSearchParams({
        start_datetime: `${startDate}T00:00:00+00:00`,
        end_datetime: `${endDate}T23:59:59+00:00`
      });

      const response = await fetch(`${this.baseUrl}/v2/usercollection/heartrate?${params}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch heart rate data');
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Error fetching Oura heart rate data:', error);
      throw error;
    }
  }

  // Get workout data
  async getWorkoutData(accessToken, startDate, endDate) {
    try {
      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate
      });

      const response = await fetch(`${this.baseUrl}/v2/usercollection/workout?${params}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch workout data');
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Error fetching Oura workout data:', error);
      throw error;
    }
  }

  // Get SpO2 data (blood oxygen)
  async getSpO2Data(accessToken, startDate, endDate) {
    try {
      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate
      });

      const response = await fetch(`${this.baseUrl}/v2/usercollection/spo2?${params}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch SpO2 data');
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Error fetching Oura SpO2 data:', error);
      throw error;
    }
  }

  // Get session data (meditation, breathing, etc.)
  async getSessionData(accessToken, startDate, endDate) {
    try {
      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate
      });

      const response = await fetch(`${this.baseUrl}/v2/usercollection/session?${params}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch session data');
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Error fetching Oura session data:', error);
      throw error;
    }
  }

  // Get personal info
  async getPersonalInfo(accessToken) {
    try {
      const response = await fetch(`${this.baseUrl}/v2/usercollection/personal_info`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch personal info');
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching Oura personal info:', error);
      throw error;
    }
  }

  // Get tag data (user-added tags)
  async getTagData(accessToken, startDate, endDate) {
    try {
      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate
      });

      const response = await fetch(`${this.baseUrl}/v2/usercollection/tag?${params}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch tag data');
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Error fetching Oura tag data:', error);
      throw error;
    }
  }

  // Check if user has active Oura integration
  async hasActiveIntegration(userId) {
    const { data, error } = await supabase
      .from('customer_integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('vendor', 'oura')
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error checking Oura integration:', error);
      return false;
    }

    if (!data) return false;

    // Check if token is expired
    const expiresAt = new Date(data.expires_at);
    return expiresAt > new Date();
  }

  // Disconnect Oura integration
  async disconnect(userId) {
    const { error } = await supabase
      .from('customer_integrations')
      .delete()
      .eq('user_id', userId)
      .eq('vendor', 'oura');

    if (error) {
      console.error('Error disconnecting Oura:', error);
      throw error;
    }

    return { success: true };
  }

  // Comprehensive sync of ALL Oura data
  async syncAllData(userId, daysBack = 14) {
    try {
      // Get user's integration
      const { data: integration, error } = await supabase
        .from('customer_integrations')
        .select('*')
        .eq('user_id', userId)
        .eq('vendor', 'oura')
        .single();

      if (error || !integration) {
        throw new Error('No Oura integration found');
      }

      // Check if token needs refresh
      const expiresAt = new Date(integration.expires_at);
      let accessToken = integration.access_token;

      if (expiresAt <= new Date() && integration.refresh_token) {
        console.log('🔄 Token expired, refreshing...');
        const refreshResult = await this.refreshToken(userId, integration.refresh_token);
        if (refreshResult.success) {
          accessToken = refreshResult.accessToken;
        } else {
          throw new Error('Failed to refresh token - please reconnect Oura');
        }
      } else if (expiresAt <= new Date()) {
        throw new Error('Token expired and no refresh token available - please reconnect Oura');
      }

      // Calculate date range
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      console.log(`📊 Syncing Oura data from ${startDate} to ${endDate}`);

      // Fetch data types one by one with error handling (like Whoop's stable approach)
      console.log('📊 Starting Oura data sync...');
      
      const sleep = await this.getSleepData(accessToken, startDate, endDate).catch(err => {
        console.log('⚠️ Sleep data failed:', err.message);
        return [];
      });
      console.log('📊 Sleep data received:', sleep.length, 'records');
      
      const activity = await this.getDailyActivity(accessToken, startDate, endDate).catch(err => {
        console.log('⚠️ Activity data failed:', err.message);
        return [];
      });
      console.log('📊 Activity data received:', activity.length, 'records');
      
      const readiness = await this.getReadinessData(accessToken, startDate, endDate).catch(err => {
        console.log('⚠️ Readiness data failed:', err.message);
        return [];
      });
      console.log('📊 Readiness data received:', readiness.length, 'records');
      
      // Skip advanced data types that might not be available or might fail
      console.log('📊 Fetched core Oura data: sleep=%d, activity=%d, readiness=%d', sleep.length, activity.length, readiness.length);

      // Store core metrics in database (only the ones we successfully fetched)
      const storePromises = [];

      // Store sleep data
      for (const item of sleep) {
        storePromises.push(
          supabase.from('health_metrics').insert({
            user_id: userId,
            vendor: 'oura',
            metric_type: 'sleep',
            data: item,
            recorded_at: item.day,
            created_at: new Date().toISOString()
          })
        );
      }

      // Store activity data
      for (const item of activity) {
        storePromises.push(
          supabase.from('health_metrics').insert({
            user_id: userId,
            vendor: 'oura',
            metric_type: 'activity',
            data: item,
            recorded_at: item.day,
            created_at: new Date().toISOString()
          })
        );
      }

      // Store readiness data
      for (const item of readiness) {
        storePromises.push(
          supabase.from('health_metrics').insert({
            user_id: userId,
            vendor: 'oura',
            metric_type: 'readiness',
            data: item,
            recorded_at: item.day,
            created_at: new Date().toISOString()
          })
        );
      }

      // Skip advanced data types for now - focus on core metrics

      // Execute all storage operations
      await Promise.all(storePromises);

      // Update last sync time
      await AsyncStorage.setItem('oura_last_sync', new Date().toISOString());

      return {
        success: true,
        data: {
          sleep: sleep.length,
          activity: activity.length,
          readiness: readiness.length,
          totalRecords: sleep.length + activity.length + readiness.length
        }
      };
    } catch (error) {
      console.error('Error syncing Oura data:', error);
      return { success: false, error: error.message };
    }
  }

  // Refresh expired access token
  async refreshToken(userId, refreshToken) {
    try {
      console.log('🔄 Refreshing Oura token...');
      
      // Check if credentials are configured
      if (!this.clientId || !this.clientSecret) {
        throw new Error('Oura API credentials not configured');
      }
      
      const response = await fetch(`${this.authUrl}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: this.clientId,
          client_secret: this.clientSecret
        }).toString()
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Token refresh failed:', errorText);
        throw new Error(`Failed to refresh token: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ Token refreshed successfully');
      
      // Update stored tokens
      const { error } = await supabase
        .from('customer_integrations')
        .update({
          access_token: data.access_token,
          refresh_token: data.refresh_token || refreshToken, // Some providers don't return new refresh token
          expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('vendor', 'oura');

      if (error) {
        console.error('Error updating tokens:', error);
        throw error;
      }

      return { success: true, accessToken: data.access_token };
    } catch (error) {
      console.error('Oura token refresh error:', error);
      return { success: false, error: error.message };
    }
  }
}

export default new OuraService();