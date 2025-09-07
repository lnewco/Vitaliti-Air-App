/**
 * Sync Trigger Service
 * Triggers backend sync after OAuth connection or for manual refresh
 */

import ENV from '../../config/env';

const ANALYTICS_API_URL = ENV.EXPO_PUBLIC_ANALYTICS_API_URL;

class SyncTriggerService {
  /**
   * Trigger a manual sync for a user
   * Called after successful OAuth connection or manual refresh
   */
  static async triggerSync(userId, vendor = 'all') {
    try {
      console.log(`[SyncTrigger] Requesting backend sync for user ${userId}, vendor: ${vendor}`);
      
      const response = await fetch(`${ANALYTICS_API_URL}/api/sync/manual`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          vendor
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[SyncTrigger] Backend sync failed: ${response.status}`, errorText);
        return {
          success: false,
          error: `Backend sync failed: ${response.status}`
        };
      }
      
      const result = await response.json();
      console.log(`[SyncTrigger] Backend sync response:`, result);
      
      return {
        success: result.success,
        message: result.message,
        details: result.details
      };
    } catch (error) {
      console.error('[SyncTrigger] Error triggering backend sync:', error);
      // Don't fail the OAuth connection if sync trigger fails
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Check sync status for a user
   */
  static async checkSyncStatus(userId) {
    try {
      const response = await fetch(`${ANALYTICS_API_URL}/api/sync/manual?userId=${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (!response.ok) {
        console.error(`[SyncTrigger] Failed to check sync status: ${response.status}`);
        return null;
      }
      
      const result = await response.json();
      return result;
    } catch (error) {
      console.error('[SyncTrigger] Error checking sync status:', error);
      return null;
    }
  }
  
  /**
   * Trigger sync with retry logic
   */
  static async triggerSyncWithRetry(userId, vendor = 'all', maxRetries = 3) {
    let attempts = 0;
    let lastError = null;
    
    while (attempts < maxRetries) {
      attempts++;
      console.log(`[SyncTrigger] Sync attempt ${attempts}/${maxRetries}`);
      
      const result = await this.triggerSync(userId, vendor);
      
      if (result.success) {
        console.log(`[SyncTrigger] Sync successful on attempt ${attempts}`);
        return result;
      }
      
      lastError = result.error;
      
      // Wait before retrying (exponential backoff)
      if (attempts < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempts - 1), 10000); // Max 10 seconds
        console.log(`[SyncTrigger] Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    console.error(`[SyncTrigger] All sync attempts failed. Last error: ${lastError}`);
    return {
      success: false,
      error: lastError || 'All sync attempts failed'
    };
  }
}

export default SyncTriggerService;