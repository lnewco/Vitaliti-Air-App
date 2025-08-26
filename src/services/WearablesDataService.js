import { supabase } from '../config/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getMockMetrics } from './MockWearablesData';

class WearablesDataService {
  constructor() {
    this.PREFERENCE_KEY = 'preferred_wearable';
    this.USE_MOCK_DATA = true; // Toggle this to false when backend is ready
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
      // Return mock available vendors if enabled (for testing)
      if (this.USE_MOCK_DATA) {
        console.log('📊 Using mock available vendors');
        return ['whoop', 'oura']; // Both available for testing toggle
      }
      
      const { data: integrations } = await supabase
        .from('customer_integrations')
        .select('vendor')
        .eq('user_id', userId)
        .eq('is_active', true)
        .in('vendor', ['whoop', 'oura']);

      return integrations?.map(i => i.vendor) || [];
    } catch (error) {
      console.error('Error getting available wearables:', error);
      return [];
    }
  }

  // Fetch latest metrics from database
  async getLatestMetrics(userId, vendor = null) {
    try {
      // Use preferred vendor if not specified
      const targetVendor = vendor || await this.getPreferredWearable(userId) || 'whoop';
      
      // Return mock data if enabled (for testing)
      if (this.USE_MOCK_DATA) {
        console.log('📊 Using mock data for vendor:', targetVendor);
        return await getMockMetrics(targetVendor);
      }
      
      if (!targetVendor) {
        console.log('No wearable configured');
        return null;
      }

      // Get latest daily summary from health_metrics
      const { data, error } = await supabase
        .from('health_metrics')
        .select('*')
        .eq('user_id', userId)
        .eq('vendor', targetVendor)
        .eq('metric_type', 'daily_summary')
        .order('recorded_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        console.error('Error fetching metrics:', error);
        return null;
      }

      if (!data) {
        console.log('No metrics found for', targetVendor);
        return null;
      }

      // Normalize the data structure
      const metrics = data.data;
      return {
        vendor: targetVendor,
        date: data.recorded_at,
        recovery: metrics.recovery || metrics.readiness || null,
        strain: metrics.strain || metrics.activity || null,
        sleepScore: metrics.sleep_score || null,
        restingHR: metrics.resting_hr || null,
        hrv: metrics.hrv || null,
        respRate: metrics.resp_rate || null,
        raw: metrics // Keep raw data for debugging
      };
    } catch (error) {
      console.error('Error getting latest metrics:', error);
      return null;
    }
  }

  // Subscribe to real-time updates
  subscribeToMetrics(userId, callback) {
    const subscription = supabase
      .channel(`metrics:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'health_metrics',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          console.log('New metrics received:', payload);
          callback(payload.new);
        }
      )
      .subscribe();

    return subscription;
  }

  // Unsubscribe from real-time updates
  unsubscribeFromMetrics(subscription) {
    if (subscription) {
      supabase.removeChannel(subscription);
    }
  }

  // Get metrics for date range (for charts/history)
  async getMetricsRange(userId, startDate, endDate, vendor = null) {
    try {
      const targetVendor = vendor || await this.getPreferredWearable(userId);
      
      if (!targetVendor) {
        return [];
      }

      const { data, error } = await supabase
        .from('health_metrics')
        .select('*')
        .eq('user_id', userId)
        .eq('vendor', targetVendor)
        .eq('metric_type', 'daily_summary')
        .gte('recorded_at', startDate)
        .lte('recorded_at', endDate)
        .order('recorded_at', { ascending: false });

      if (error) {
        console.error('Error fetching metrics range:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error getting metrics range:', error);
      return [];
    }
  }
}

export default new WearablesDataService();