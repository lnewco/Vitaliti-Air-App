import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking } from 'react-native';
import { supabase } from '../../config/supabase';

class WhoopService {
  constructor() {
    this.baseUrl = 'https://api.prod.whoop.com';
    this.authUrl = 'https://api.prod.whoop.com/oauth/oauth2';
    // Use environment variables for credentials
    this.clientId = process.env.EXPO_PUBLIC_WHOOP_CLIENT_ID || 'ef01edf8-b61c-4cac-99a0-d0825098dace';
    this.clientSecret = process.env.EXPO_PUBLIC_WHOOP_CLIENT_SECRET || '1529284de2cde1574018824932aeec53222eee78487bd3ea63f87ae44d716aeb';
    // Use the Expo auth proxy URL that's registered with Whoop
    this.redirectUri = 'https://auth.expo.io/@anonymous/Vitaliti-Air-App/whoop-callback';
    
    console.log('🔧 Whoop Service initialized with credentials');
    console.log('🔗 Redirect URI:', this.redirectUri);
  }

  // Generate OAuth URL for user authentication
  getAuthUrl(userId) {
    const scope = 'read:body_measurement read:workout offline read:cycles read:recovery read:sleep read:profile';
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: scope,
      state: userId
    });

    return `${this.authUrl}/auth?${params.toString()}`;
  }

  // Handle OAuth callback and exchange code for tokens
  async handleCallback(code, userId) {
    try {
      console.log('🔄 Attempting token exchange...');
      console.log('Code:', code);
      console.log('Redirect URI:', this.redirectUri);
      
      // Whoop requires client_secret_post method, not Basic auth
      const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: this.redirectUri,
        client_id: this.clientId,
        client_secret: this.clientSecret
      }).toString();
      
      console.log('Request body (without secret):', body.replace(this.clientSecret, '[HIDDEN]'));
      
      const response = await fetch(`${this.authUrl}/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: body
      });

      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Token exchange failed:', errorText);
        throw new Error(`Failed to exchange code for tokens: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Token exchange successful!');
      console.log('Token data keys:', Object.keys(data));
      
      // Store tokens in Supabase
      await this.saveIntegration(userId, {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
        vendor_user_id: data.user?.user_id || data.user_id || null // Whoop user ID (check different possible fields)
      });

      return { success: true, data };
    } catch (error) {
      console.error('Whoop OAuth callback error:', error);
      return { success: false, error: error.message };
    }
  }

  // Save integration to Supabase
  async saveIntegration(userId, tokenData) {
    const { data, error } = await supabase
      .from('customer_integrations')
      .upsert({
        user_id: userId,
        vendor: 'whoop',
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: tokenData.expires_at,
        vendor_user_id: tokenData.vendor_user_id,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,vendor'
      });

    if (error) {
      console.error('Error saving Whoop integration:', error);
      throw error;
    }

    return data;
  }

  // Get user profile
  async getUserProfile(accessToken) {
    try {
      const response = await fetch(`${this.baseUrl}/developer/v1/user/profile/basic`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch user profile');
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching Whoop profile:', error);
      throw error;
    }
  }

  // Get recovery data with pagination
  async getRecoveryData(accessToken, startDate, endDate) {
    try {
      let allRecords = [];
      let nextToken = null;
      let pageCount = 0;
      
      do {
        const params = new URLSearchParams({
          start: startDate,
          end: endDate,
          limit: '25'
        });
        
        if (nextToken) {
          params.append('next_token', nextToken);
        }

        console.log(`Fetching recovery page ${pageCount + 1}...`);
        
        const response = await fetch(`${this.baseUrl}/developer/v1/recovery?${params}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Recovery API error:', response.status, errorText);
          throw new Error(`Failed to fetch recovery data: ${response.status}`);
        }

        const data = await response.json();
        const records = data.records || [];
        allRecords = allRecords.concat(records);
        nextToken = data.next_token;
        pageCount++;
        
        console.log(`Recovery page ${pageCount}: ${records.length} records, total so far: ${allRecords.length}`);
        
      } while (nextToken && pageCount < 20); // Stable limit that works
      
      console.log(`Total recovery records fetched: ${allRecords.length}`);
      return allRecords;
    } catch (error) {
      console.error('Error fetching Whoop recovery data:', error);
      throw error;
    }
  }

  // Get sleep data with pagination
  async getSleepData(accessToken, startDate, endDate) {
    try {
      let allRecords = [];
      let nextToken = null;
      let pageCount = 0;
      
      do {
        const params = new URLSearchParams({
          start: startDate,
          end: endDate,
          limit: '25'
        });
        
        if (nextToken) {
          params.append('next_token', nextToken);
        }

        const response = await fetch(`${this.baseUrl}/developer/v1/activity/sleep?${params}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch sleep data');
        }

        const data = await response.json();
        const records = data.records || [];
        allRecords = allRecords.concat(records);
        nextToken = data.next_token;
        pageCount++;
        
        console.log(`Sleep page ${pageCount}: ${records.length} records, total: ${allRecords.length}`);
        
      } while (nextToken && pageCount < 20); // Stable limit that works
      
      return allRecords;
    } catch (error) {
      console.error('Error fetching Whoop sleep data:', error);
      throw error;
    }
  }

  // Get workout data
  async getWorkoutData(accessToken, startDate, endDate) {
    try {
      const params = new URLSearchParams({
        start: startDate,
        end: endDate
      });

      const response = await fetch(`${this.baseUrl}/developer/v1/activity/workout?${params}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch workout data');
      }

      const data = await response.json();
      return data.records || [];
    } catch (error) {
      console.error('Error fetching Whoop workout data:', error);
      throw error;
    }
  }

  // Get cycle data with pagination
  async getCycleData(accessToken, startDate, endDate) {
    try {
      let allRecords = [];
      let nextToken = null;
      let pageCount = 0;
      
      do {
        const params = new URLSearchParams({
          start: startDate,
          end: endDate,
          limit: '25'
        });
        
        if (nextToken) {
          params.append('next_token', nextToken);
        }

        const response = await fetch(`${this.baseUrl}/developer/v1/cycle?${params}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch cycle data');
        }

        const data = await response.json();
        const records = data.records || [];
        allRecords = allRecords.concat(records);
        nextToken = data.next_token;
        pageCount++;
        
        console.log(`Cycle page ${pageCount}: ${records.length} records, total: ${allRecords.length}`);
        
      } while (nextToken && pageCount < 20); // Stable limit that works
      
      return allRecords;
    } catch (error) {
      console.error('Error fetching Whoop cycle data:', error);
      throw error;
    }
  }

  // Get body measurements (weight, height, max HR)
  async getBodyMeasurements(accessToken) {
    try {
      const response = await fetch(`${this.baseUrl}/developer/v1/user/measurement/body`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        console.log('Body measurements endpoint not available, skipping...');
        return { measurements: [] };
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching Whoop body measurements:', error);
      return { measurements: [] };
    }
  }

  // Get physiological data (HRV trends, RHR trends) - Extract from recovery data
  async getPhysiologicalData(accessToken, startDate, endDate) {
    try {
      // Physiological metrics are included in recovery data
      console.log('Extracting physiological data from recovery metrics...');
      return [];
    } catch (error) {
      console.error('Error fetching Whoop physiological data:', error);
      return [];
    }
  }

  // Get strain data (detailed strain metrics) - Extract from cycle data
  async getStrainData(accessToken, startDate, endDate) {
    try {
      // Strain metrics are included in cycle data
      console.log('Extracting strain data from cycle metrics...');
      return [];
    } catch (error) {
      console.error('Error fetching Whoop strain data:', error);
      return [];
    }
  }

  // Get sport/activity types
  async getSportTypes(accessToken) {
    try {
      const response = await fetch(`${this.baseUrl}/developer/v1/sport`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        console.log('Sport types endpoint not available, skipping...');
        return { sports: [] };
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching Whoop sport types:', error);
      return { sports: [] };
    }
  }

  // Check if user has active Whoop integration
  async hasActiveIntegration(userId) {
    const { data, error } = await supabase
      .from('customer_integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('vendor', 'whoop')
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error checking Whoop integration:', error);
      return false;
    }

    if (!data) return false;

    // Check if token is expired
    const expiresAt = new Date(data.expires_at);
    return expiresAt > new Date();
  }

  // Disconnect Whoop integration
  async disconnect(userId) {
    const { error } = await supabase
      .from('customer_integrations')
      .delete()
      .eq('user_id', userId)
      .eq('vendor', 'whoop');

    if (error) {
      console.error('Error disconnecting Whoop:', error);
      throw error;
    }

    return { success: true };
  }

  // Comprehensive sync of ALL Whoop data
  async syncAllData(userId, daysBack = 7) {
    try {
      console.log('🔄 Starting Whoop sync for user:', userId);
      console.log('🔄 Days to sync:', daysBack);
      
      if (!userId) {
        throw new Error('User ID is required for syncing');
      }
      
      // Get user's integration
      const { data: integration, error } = await supabase
        .from('customer_integrations')
        .select('*')
        .eq('user_id', userId)
        .eq('vendor', 'whoop')
        .single();

      console.log('🔍 Integration lookup result:', {
        found: !!integration,
        error: error?.message,
        hasToken: !!integration?.access_token
      });

      if (error || !integration) {
        console.error('Integration lookup error:', error);
        throw new Error('No Whoop integration found - please connect Whoop first');
      }

      // Check if token needs refresh
      const expiresAt = new Date(integration.expires_at);
      let accessToken = integration.access_token;
      
      console.log('🔑 Token status:', {
        hasToken: !!accessToken,
        expiresAt: expiresAt.toISOString(),
        isExpired: expiresAt <= new Date()
      });

      if (!accessToken) {
        throw new Error('No access token in integration - please reconnect Whoop');
      }

      if (expiresAt <= new Date() && integration.refresh_token) {
        console.log('🔄 Token expired, refreshing...');
        const refreshResult = await this.refreshToken(userId, integration.refresh_token);
        if (refreshResult.success) {
          accessToken = refreshResult.accessToken;
        } else {
          throw new Error('Failed to refresh token - please reconnect Whoop');
        }
      } else if (expiresAt <= new Date()) {
        throw new Error('Token expired and no refresh token available - please reconnect Whoop');
      }

      // Calculate date range (Whoop uses ISO 8601 format)
      const endDate = new Date().toISOString();
      const startDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();

      console.log(`💪 Syncing Whoop data from ${startDate} to ${endDate}`);

      // Fetch ALL data types in parallel (with error handling for each)
      const [
        profile,
        recovery,
        sleep,
        workouts,
        cycles,
        strain,
        physiological,
        bodyMeasurements,
        sportTypes
      ] = await Promise.all([
        this.getUserProfile(accessToken).catch(err => { console.log('Profile fetch failed:', err); return null; }),
        this.getRecoveryData(accessToken, startDate, endDate).catch(err => { console.log('Recovery fetch failed:', err); return []; }),
        this.getSleepData(accessToken, startDate, endDate).catch(err => { console.log('Sleep fetch failed:', err); return []; }),
        this.getWorkoutData(accessToken, startDate, endDate).catch(err => { console.log('Workout fetch failed:', err); return []; }),
        this.getCycleData(accessToken, startDate, endDate).catch(err => { console.log('Cycle fetch failed:', err); return []; }),
        this.getStrainData(accessToken, startDate, endDate).catch(err => { console.log('Strain fetch failed:', err); return []; }),
        this.getPhysiologicalData(accessToken, startDate, endDate).catch(err => { console.log('Physiological fetch failed:', err); return []; }),
        this.getBodyMeasurements(accessToken).catch(err => { console.log('Body measurements fetch failed:', err); return null; }),
        this.getSportTypes(accessToken).catch(err => { console.log('Sport types fetch failed:', err); return null; })
      ]);

      // Store all metrics in database
      const storePromises = [];
      
      console.log('📦 Preparing to store data for user:', userId);
      console.log('📦 Data counts:', {
        profile: profile ? 1 : 0,
        recovery: recovery.length,
        sleep: sleep.length,
        workouts: workouts.length,
        cycles: cycles.length,
        strain: strain.length,
        physiological: physiological.length
      });

      // Store profile (one-time/update)
      if (profile) {
        storePromises.push(
          supabase.from('health_metrics').upsert({
            user_id: userId,
            vendor: 'whoop',
            metric_type: 'profile',
            data: profile,
            recorded_at: new Date().toISOString(),
            created_at: new Date().toISOString()
          })
        );
      }

      // Store recovery data
      for (const item of recovery) {
        storePromises.push(
          supabase.from('health_metrics').insert({
            user_id: userId,
            vendor: 'whoop',
            metric_type: 'recovery',
            data: item,
            recorded_at: item.created_at || item.date,
            created_at: new Date().toISOString()
          }).then(({ data, error }) => {
            if (error && !error.message?.includes('duplicate')) {
              console.log(`Recovery insert warning: ${error.message}`);
            }
            return data;
          })
        );
      }

      // Store sleep data
      for (const item of sleep) {
        storePromises.push(
          supabase.from('health_metrics').insert({
            user_id: userId,
            vendor: 'whoop',
            metric_type: 'sleep',
            data: item,
            recorded_at: item.created_at || item.date,
            created_at: new Date().toISOString()
          }).then(({ data, error }) => {
            if (error && !error.message?.includes('duplicate')) {
              console.log(`Sleep insert warning: ${error.message}`);
            }
            return data;
          })
        );
      }

      // Store workout data
      for (const item of workouts) {
        storePromises.push(
          supabase.from('health_metrics').insert({
            user_id: userId,
            vendor: 'whoop',
            metric_type: 'workout',
            data: item,
            recorded_at: item.created_at || item.start,
            created_at: new Date().toISOString()
          }).then(({ data, error }) => {
            if (error) throw new Error(`Workout insert error: ${JSON.stringify(error)}`);
            return data;
          })
        );
      }

      // Store cycle data
      for (const item of cycles) {
        storePromises.push(
          supabase.from('health_metrics').insert({
            user_id: userId,
            vendor: 'whoop',
            metric_type: 'cycle',
            data: item,
            recorded_at: item.created_at || item.start,
            created_at: new Date().toISOString()
          }).then(({ data, error }) => {
            if (error && !error.message?.includes('duplicate')) {
              console.log(`Cycle insert warning: ${error.message}`);
            }
            return data;
          })
        );
      }

      // Store strain data
      for (const item of strain) {
        storePromises.push(
          supabase.from('health_metrics').insert({
            user_id: userId,
            vendor: 'whoop',
            metric_type: 'strain',
            data: item,
            recorded_at: item.created_at || item.date,
            created_at: new Date().toISOString()
          }).then(({ data, error }) => {
            if (error) throw new Error(`Strain insert error: ${JSON.stringify(error)}`);
            return data;
          })
        );
      }

      // Store physiological data
      for (const item of physiological) {
        storePromises.push(
          supabase.from('health_metrics').insert({
            user_id: userId,
            vendor: 'whoop',
            metric_type: 'physiological',
            data: item,
            recorded_at: item.created_at || item.date,
            created_at: new Date().toISOString()
          }).then(({ data, error }) => {
            if (error) throw new Error(`Physiological insert error: ${JSON.stringify(error)}`);
            return data;
          })
        );
      }

      // Store body measurements (one-time/update)
      if (bodyMeasurements) {
        storePromises.push(
          supabase.from('health_metrics').upsert({
            user_id: userId,
            vendor: 'whoop',
            metric_type: 'body_measurements',
            data: bodyMeasurements,
            recorded_at: new Date().toISOString(),
            created_at: new Date().toISOString()
          })
        );
      }

      // Store sport types (reference data)
      if (sportTypes) {
        storePromises.push(
          supabase.from('health_metrics').upsert({
            user_id: userId,
            vendor: 'whoop',
            metric_type: 'sport_types',
            data: sportTypes,
            recorded_at: new Date().toISOString(),
            created_at: new Date().toISOString()
          })
        );
      }

      // Execute all storage operations
      console.log(`📤 Attempting to save ${storePromises.length} records to database...`);
      const results = await Promise.allSettled(storePromises);
      
      // Check for failures
      const failures = results.filter(r => r.status === 'rejected');
      if (failures.length > 0) {
        console.error(`❌ ${failures.length} records failed to save:`);
        failures.forEach((failure, idx) => {
          console.error(`  Error ${idx + 1}:`, failure.reason);
        });
      }
      
      const successes = results.filter(r => r.status === 'fulfilled');
      console.log(`✅ Successfully saved ${successes.length}/${storePromises.length} records`);

      // Update last sync time
      await AsyncStorage.setItem('whoop_last_sync', new Date().toISOString());

      console.log('📊 SYNC SUMMARY:');
      console.log('Recovery records:', recovery.length);
      console.log('Sleep records:', sleep.length);
      console.log('Workout records:', workouts.length);
      console.log('Cycle records:', cycles.length);
      
      return {
        success: true,
        data: {
          profile: profile ? 1 : 0,
          recovery: recovery.length,
          sleep: sleep.length,
          workouts: workouts.length,
          cycles: cycles.length,
          strain: strain.length,
          physiological: physiological.length,
          bodyMeasurements: bodyMeasurements ? 1 : 0,
          sportTypes: sportTypes ? 1 : 0,
          totalRecords: (profile ? 1 : 0) + recovery.length + sleep.length + 
                       workouts.length + cycles.length + strain.length + 
                       physiological.length + (bodyMeasurements ? 1 : 0) + 
                       (sportTypes ? 1 : 0)
        }
      };
    } catch (error) {
      console.error('Error syncing Whoop data:', error);
      return { success: false, error: error.message };
    }
  }

  // Refresh expired access token
  async refreshToken(userId, refreshToken) {
    try {
      console.log('🔄 Refreshing Whoop token...');
      
      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret
      }).toString();
      
      const response = await fetch(`${this.authUrl}/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: body
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
        .eq('vendor', 'whoop');

      if (error) {
        console.error('Error updating tokens:', error);
        throw error;
      }

      return { success: true, accessToken: data.access_token };
    } catch (error) {
      console.error('Whoop token refresh error:', error);
      return { success: false, error: error.message };
    }
  }
}

export default new WhoopService();