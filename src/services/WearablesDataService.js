import { supabase } from '../config/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getMockMetrics } from './MockWearablesData';

class WearablesDataService {
  constructor() {
    this.PREFERENCE_KEY = 'preferred_wearable';
    this.USE_MOCK_DATA = false; // Now using real data from analytics backend
    this.ANALYTICS_BASE_URL = 'https://vitaliti-air-analytics.onrender.com';
  }

  // Get user's preferred wearable (whoop or oura)
  async getPreferredWearable(userId) {
    try {
      // First check AsyncStorage for preference
      const stored = await AsyncStorage.getItem(this.PREFERENCE_KEY);
      if (stored) {
        return stored;
      }

      // Otherwise check which integrations are active
      const { data: integrations } = await supabase
        .from('customer_integrations')
        .select('vendor, is_active')
        .eq('user_id', userId)
        .in('vendor', ['whoop', 'oura']);

      const activeIntegrations = integrations?.filter(i => i.is_active) || [];
      
      // Return first active integration or null
      if (activeIntegrations.length > 0) {
        const preferred = activeIntegrations[0].vendor;
        await this.setPreferredWearable(preferred);
        return preferred;
      }

      return null;
    } catch (error) {
      console.error('Error getting preferred wearable:', error);
      return null;
    }
  }

  // Set user's preferred wearable
  async setPreferredWearable(vendor) {
    try {
      await AsyncStorage.setItem(this.PREFERENCE_KEY, vendor);
      return true;
    } catch (error) {
      console.error('Error setting preferred wearable:', error);
      return false;
    }
  }

  // Get available wearables for user
  async getAvailableWearables(userId) {
    try {
      // Query the whoop_data and oura_data tables to see what data exists
      const [whoopCheck, ouraCheck] = await Promise.all([
        supabase
          .from('whoop_data')
          .select('id')
          .eq('user_id', userId)
          .limit(1),
        supabase
          .from('oura_data')
          .select('id')
          .eq('user_id', userId)
          .limit(1)
      ]);

      const available = [];
      if (whoopCheck.data && whoopCheck.data.length > 0) {
        available.push('whoop');
      }
      if (ouraCheck.data && ouraCheck.data.length > 0) {
        available.push('oura');
      }

      // Fallback to checking integrations if no data found
      if (available.length === 0) {
        const { data: integrations } = await supabase
          .from('customer_integrations')
          .select('vendor')
          .eq('user_id', userId)
          .eq('is_active', true)
          .in('vendor', ['whoop', 'oura']);

        return integrations?.map(i => i.vendor) || [];
      }

      return available;
    } catch (error) {
      console.error('Error getting available wearables:', error);
      return [];
    }
  }

  // Fetch latest metrics from analytics backend
  async getLatestMetrics(userId, vendor = null) {
    try {
      // Use preferred vendor if not specified
      const targetVendor = vendor || await this.getPreferredWearable(userId);
      
      // Return mock data if enabled (for testing)
      if (this.USE_MOCK_DATA) {
        console.log('📊 Using mock data for vendor:', targetVendor);
        return await getMockMetrics(targetVendor);
      }

      // Get the most recent date first
      const today = new Date().toISOString().split('T')[0];
      
      // Query both tables and combine results
      const [whoopData, ouraData] = await Promise.all([
        targetVendor === 'whoop' || !targetVendor ? 
          supabase
            .from('whoop_data')
            .select('*')
            .eq('user_id', userId)
            .order('date', { ascending: false })
            .limit(1) : Promise.resolve({ data: null }),
        targetVendor === 'oura' || !targetVendor ?
          supabase
            .from('oura_data')
            .select('*')
            .eq('user_id', userId)
            .order('date', { ascending: false })
            .limit(1) : Promise.resolve({ data: null })
      ]);

      // Determine which data to use based on preference and availability
      let selectedData = null;
      let selectedVendor = null;

      if (targetVendor === 'whoop' && whoopData.data && whoopData.data.length > 0) {
        selectedData = whoopData.data[0];
        selectedVendor = 'whoop';
      } else if (targetVendor === 'oura' && ouraData.data && ouraData.data.length > 0) {
        selectedData = ouraData.data[0];
        selectedVendor = 'oura';
      } else {
        // Fallback to any available data
        if (whoopData.data && whoopData.data.length > 0) {
          selectedData = whoopData.data[0];
          selectedVendor = 'whoop';
        } else if (ouraData.data && ouraData.data.length > 0) {
          selectedData = ouraData.data[0];
          selectedVendor = 'oura';
        }
      }

      if (!selectedData) {
        console.log('No metrics found for user:', userId);
        return null;
      }

      // Normalize the data structure for UI components
      return {
        vendor: selectedVendor,
        date: selectedData.date,
        recovery: selectedVendor === 'whoop' ? selectedData.recovery : null,
        readiness: selectedVendor === 'oura' ? selectedData.readiness : null,
        strain: selectedVendor === 'whoop' ? selectedData.strain : null,
        activity: selectedVendor === 'oura' ? selectedData.activity : null,
        sleepScore: selectedData.sleep_score,
        restingHR: selectedData.resting_hr,
        hrv: selectedData.hrv,
        respRate: selectedData.resp_rate,
        raw: selectedData // Keep raw data for debugging
      };
    } catch (error) {
      console.error('Error getting latest metrics:', error);
      return null;
    }
  }

  // Get combined metrics using analytics backend format
  async getCombinedMetrics(userId, date = null) {
    try {
      // Get both Whoop and Oura data
      const dateFilter = date || new Date().toISOString().split('T')[0];
      
      // Get the user's preferred vendor
      const preferredVendor = await this.getPreferredWearable(userId) || 'whoop';
      
      const [whoopData, ouraData] = await Promise.all([
        supabase
          .from('whoop_data')
          .select('*')
          .eq('user_id', userId)
          .eq('date', dateFilter)
          .limit(1),
        supabase
          .from('oura_data')
          .select('*')
          .eq('user_id', userId)
          .eq('date', dateFilter)
          .limit(1)
      ]);

      const whoop = whoopData.data && whoopData.data.length > 0 ? whoopData.data[0] : null;
      const oura = ouraData.data && ouraData.data.length > 0 ? ouraData.data[0] : null;

      if (!whoop && !oura) {
        return null;
      }

      // If both vendors have data, use the preferred vendor
      // This prevents mixing data from different vendors
      if (whoop && oura) {
        if (preferredVendor === 'oura') {
          // Return only Oura data
          return {
            recovery: null,
            readiness: oura.readiness,
            strain: null,
            activity: oura.activity,
            sleep_score: oura.sleep_score,
            hrv: oura.hrv,
            resting_hr: oura.resting_hr,
            resp_rate: oura.resp_rate,
            vendor: 'oura',
            date: dateFilter
          };
        } else {
          // Return only Whoop data (default)
          return {
            recovery: whoop.recovery,
            readiness: null,
            strain: whoop.strain,
            activity: null,
            sleep_score: whoop.sleep_score,
            hrv: whoop.hrv,
            resting_hr: whoop.resting_hr,
            resp_rate: whoop.resp_rate,
            vendor: 'whoop',
            date: dateFilter
          };
        }
      }

      // If only one vendor has data, return that
      if (whoop) {
        return {
          recovery: whoop.recovery,
          readiness: null,
          strain: whoop.strain,
          activity: null,
          sleep_score: whoop.sleep_score,
          hrv: whoop.hrv,
          resting_hr: whoop.resting_hr,
          resp_rate: whoop.resp_rate,
          vendor: 'whoop',
          date: dateFilter
        };
      } else {
        return {
          recovery: null,
          readiness: oura.readiness,
          strain: null,
          activity: oura.activity,
          sleep_score: oura.sleep_score,
          hrv: oura.hrv,
          resting_hr: oura.resting_hr,
          resp_rate: oura.resp_rate,
          vendor: 'oura',
          date: dateFilter
        };
      }
    } catch (error) {
      console.error('Error getting combined metrics:', error);
      return null;
    }
  }

  // Subscribe to real-time updates (now for both tables)
  subscribeToMetrics(userId, callback) {
    // Subscribe to both whoop_data and oura_data tables
    const whoopChannel = supabase
      .channel(`whoop:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'whoop_data',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          console.log('New Whoop metrics received:', payload);
          callback({ ...payload.new, vendor: 'whoop' });
        }
      );

    const ouraChannel = supabase
      .channel(`oura:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'oura_data',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          console.log('New Oura metrics received:', payload);
          callback({ ...payload.new, vendor: 'oura' });
        }
      );

    whoopChannel.subscribe();
    ouraChannel.subscribe();

    return { whoopChannel, ouraChannel };
  }

  // Unsubscribe from real-time updates
  unsubscribeFromMetrics(subscriptions) {
    if (subscriptions) {
      if (subscriptions.whoopChannel) {
        supabase.removeChannel(subscriptions.whoopChannel);
      }
      if (subscriptions.ouraChannel) {
        supabase.removeChannel(subscriptions.ouraChannel);
      }
    }
  }

  // Get metrics for date range (for charts/history)
  async getMetricsRange(userId, startDate, endDate, vendor = null) {
    try {
      const targetVendor = vendor || await this.getPreferredWearable(userId);
      
      // Query the appropriate table(s)
      const queries = [];
      
      if (!targetVendor || targetVendor === 'whoop') {
        queries.push(
          supabase
            .from('whoop_data')
            .select('*')
            .eq('user_id', userId)
            .gte('date', startDate)
            .lte('date', endDate)
            .order('date', { ascending: false })
        );
      }
      
      if (!targetVendor || targetVendor === 'oura') {
        queries.push(
          supabase
            .from('oura_data')
            .select('*')
            .eq('user_id', userId)
            .gte('date', startDate)
            .lte('date', endDate)
            .order('date', { ascending: false })
        );
      }

      const results = await Promise.all(queries);
      const allData = [];

      results.forEach((result, index) => {
        if (result.data) {
          const vendor = (!targetVendor && index === 0) || targetVendor === 'whoop' ? 'whoop' : 'oura';
          result.data.forEach(item => {
            allData.push({
              ...item,
              vendor,
              // Normalize field names
              recovery: vendor === 'whoop' ? item.recovery : null,
              readiness: vendor === 'oura' ? item.readiness : null,
              strain: vendor === 'whoop' ? item.strain : null,
              activity: vendor === 'oura' ? item.activity : null,
            });
          });
        }
      });

      // Sort by date
      allData.sort((a, b) => b.date.localeCompare(a.date));

      return allData;
    } catch (error) {
      console.error('Error getting metrics range:', error);
      return [];
    }
  }

  // Trigger manual sync with analytics backend
  async syncWearablesData(userId) {
    try {
      console.log('Triggering wearables sync for user:', userId);
      
      // Call the analytics backend sync endpoint
      const response = await fetch(`${this.ANALYTICS_BASE_URL}/api/sync-wearables`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          source: 'mobile_app'
        })
      });

      if (!response.ok) {
        throw new Error(`Sync failed: ${response.status}`);
      }

      const result = await response.json();
      console.log('Sync completed:', result);
      return result;
    } catch (error) {
      console.error('Error syncing wearables data:', error);
      throw error;
    }
  }
}

export default new WearablesDataService();