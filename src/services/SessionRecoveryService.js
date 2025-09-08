/**
 * SessionRecoveryService - Handles detection and cleanup of orphaned sessions
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import SupabaseService from './SupabaseService';
import { supabase } from './supabaseClient';
import authService from './AuthService';

class SessionRecoveryService {
  constructor() {
    this.hasCheckedOrphans = false;
  }

  /**
   * Check for and handle orphaned sessions on app startup
   * Returns true if there's an active session that can be resumed
   */
  async checkForOrphanedSessions() {
    try {
      console.log('🔍 Checking for orphaned sessions...');
      
      // Only check once per app launch
      if (this.hasCheckedOrphans) {
        console.log('Already checked for orphaned sessions this launch');
        return null;
      }
      
      this.hasCheckedOrphans = true;
      
      // Get current user
      const currentUser = authService.getCurrentUser();
      if (!currentUser) {
        console.log('No authenticated user, skipping orphaned session check');
        return null;
      }
      
      // Get device ID
      const deviceId = await SupabaseService.getDeviceId();
      
      // Query for active sessions from this device or user
      const { data: activeSessions, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('status', 'active')
        .or(`user_id.eq.${currentUser.id},device_id.eq.${deviceId}`)
        .order('start_time', { ascending: false });
      
      if (error) {
        console.error('Error checking for orphaned sessions:', error);
        return null;
      }
      
      if (!activeSessions || activeSessions.length === 0) {
        console.log('✅ No orphaned sessions found');
        return null;
      }
      
      console.log(`⚠️ Found ${activeSessions.length} orphaned active session(s)`);
      
      // Get the most recent session
      const mostRecentSession = activeSessions[0];
      const sessionAge = Date.now() - new Date(mostRecentSession.start_time).getTime();
      const ageInMinutes = Math.floor(sessionAge / 60000);
      
      console.log(`Most recent session: ${mostRecentSession.local_session_id}, age: ${ageInMinutes} minutes`);
      
      // If session is less than 30 minutes old, offer to resume
      if (ageInMinutes < 30) {
        // Check if it has readings
        const { data: readingCount } = await supabase
          .from('readings')
          .select('id', { count: 'exact', head: true })
          .eq('session_id', mostRecentSession.id);
        
        console.log(`Session has ${readingCount} readings`);
        
        // Clean up other orphaned sessions (keeping the most recent)
        await this.cleanupOldSessions(activeSessions.slice(1));
        
        return {
          sessionId: mostRecentSession.id,
          localSessionId: mostRecentSession.local_session_id,
          startTime: mostRecentSession.start_time,
          ageInMinutes,
          readingCount: readingCount || 0
        };
      }
      
      // Session is too old, clean up all orphaned sessions
      console.log('Sessions are too old to resume, cleaning up...');
      await this.cleanupOldSessions(activeSessions);
      
      return null;
    } catch (error) {
      console.error('Error in checkForOrphanedSessions:', error);
      return null;
    }
  }
  
  /**
   * Clean up old/orphaned sessions
   */
  async cleanupOldSessions(sessions) {
    if (!sessions || sessions.length === 0) return;
    
    console.log(`🧹 Cleaning up ${sessions.length} orphaned session(s)`);
    
    for (const session of sessions) {
      try {
        // Mark session as ended
        const { error } = await supabase
          .from('sessions')
          .update({
            status: 'abandoned',
            end_time: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', session.id);
        
        if (error) {
          console.error(`Failed to clean up session ${session.id}:`, error);
        } else {
          console.log(`✅ Cleaned up session ${session.local_session_id}`);
        }
      } catch (error) {
        console.error(`Error cleaning up session ${session.id}:`, error);
      }
    }
  }
  
  /**
   * Force end all active sessions for the current user/device
   * Use this when starting a new session to ensure clean state
   */
  async forceEndAllActiveSessions() {
    try {
      const currentUser = authService.getCurrentUser();
      const deviceId = await SupabaseService.getDeviceId();
      
      const { data: sessions, error } = await supabase
        .from('sessions')
        .update({
          status: 'force_ended',
          end_time: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('status', 'active')
        .or(`user_id.eq.${currentUser?.id || 'null'},device_id.eq.${deviceId}`)
        .select();
      
      if (error) {
        console.error('Error force ending sessions:', error);
        return false;
      }
      
      if (sessions && sessions.length > 0) {
        console.log(`⚠️ Force ended ${sessions.length} active session(s)`);
      }
      
      return true;
    } catch (error) {
      console.error('Error in forceEndAllActiveSessions:', error);
      return false;
    }
  }
  
  /**
   * Resume a session
   */
  async resumeSession(sessionId) {
    try {
      console.log(`📱 Attempting to resume session ${sessionId}`);
      
      // Update session status to indicate it was resumed
      const { error } = await supabase
        .from('sessions')
        .update({
          status: 'active',
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId);
      
      if (error) {
        console.error('Error resuming session:', error);
        return false;
      }
      
      console.log('✅ Session resumed successfully');
      return true;
    } catch (error) {
      console.error('Error in resumeSession:', error);
      return false;
    }
  }
}

export default new SessionRecoveryService();