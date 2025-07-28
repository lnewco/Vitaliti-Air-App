// Session Cleanup Utility
// Handles stuck, incomplete, and orphaned sessions

import supabase from '../config/supabase';
import SupabaseService from '../services/SupabaseService';
import DatabaseService from '../services/DatabaseService';

// Find sessions that are stuck in "active" status
export const findStuckSessions = async () => {
  console.log('🔍 Searching for stuck active sessions...');
  
  try {
    // Find sessions that are active but old (older than 24 hours)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data: stuckSessions, error } = await supabase
      .from('sessions')
      .select('id, local_session_id, total_readings, start_time, device_id, user_id, created_at')
      .eq('status', 'active')
      .lt('start_time', twentyFourHoursAgo)
      .order('start_time', { ascending: false });

    if (error) {
      console.error('❌ Failed to find stuck sessions:', error);
      return { success: false, error };
    }

    // Also find any active sessions with 0 readings (likely incomplete)
    const { data: emptyActiveSessions, error: emptyError } = await supabase
      .from('sessions')
      .select('id, local_session_id, total_readings, start_time, device_id, user_id, created_at')
      .eq('status', 'active')
      .eq('total_readings', 0)
      .order('start_time', { ascending: false });

    if (emptyError) {
      console.error('❌ Failed to find empty active sessions:', emptyError);
      return { success: false, error: emptyError };
    }

    // Combine and deduplicate
    const allStuckSessions = [...(stuckSessions || []), ...(emptyActiveSessions || [])];
    const uniqueStuckSessions = allStuckSessions.filter((session, index, self) => 
      index === self.findIndex(s => s.id === session.id)
    );

    console.log(`🎯 Found ${uniqueStuckSessions.length} stuck sessions`);
    
    uniqueStuckSessions.forEach(session => {
      const age = Math.round((Date.now() - new Date(session.start_time).getTime()) / (1000 * 60 * 60));
      console.log(`  - ${session.id}: ${age}h old, ${session.total_readings} readings`);
    });

    return {
      success: true,
      stuckSessions: uniqueStuckSessions,
      totalFound: uniqueStuckSessions.length
    };

  } catch (error) {
    console.error('❌ Error finding stuck sessions:', error);
    return { success: false, error };
  }
};

// Cleanup stuck sessions by marking them as completed
export const cleanupStuckSessions = async (sessionIds = null) => {
  console.log('🧹 Cleaning up stuck sessions...');
  
  try {
    let sessionsToCleanup;
    
    if (sessionIds) {
      // Clean up specific sessions
      const { data, error } = await supabase
        .from('sessions')
        .select('id, local_session_id, total_readings')
        .in('id', sessionIds)
        .eq('status', 'active');
      
      if (error) throw error;
      sessionsToCleanup = data;
    } else {
      // Find all stuck sessions
      const result = await findStuckSessions();
      if (!result.success) throw result.error;
      sessionsToCleanup = result.stuckSessions;
    }

    console.log(`🔧 Processing ${sessionsToCleanup.length} sessions for cleanup...`);
    
    const results = [];
    for (const session of sessionsToCleanup) {
      try {
        // Calculate stats for sessions with readings
        let stats = {
          avg_spo2: null,
          min_spo2: null,
          max_spo2: null,
          avg_heart_rate: null,
          min_heart_rate: null,
          max_heart_rate: null
        };

        if (session.total_readings > 0) {
          // Get readings and calculate stats
          const { data: readings } = await supabase
            .from('readings')
            .select('spo2, heart_rate')
            .eq('session_id', session.id);

          if (readings && readings.length > 0) {
            const validSpo2 = readings
              .filter(r => r.spo2 !== null && r.spo2 > 0 && r.spo2 <= 100)
              .map(r => r.spo2);
            
            const validHeartRate = readings
              .filter(r => r.heart_rate !== null && r.heart_rate > 0 && r.heart_rate <= 200)
              .map(r => r.heart_rate);

            if (validSpo2.length > 0) {
              stats.avg_spo2 = Math.round((validSpo2.reduce((a, b) => a + b) / validSpo2.length) * 10) / 10;
              stats.min_spo2 = Math.min(...validSpo2);
              stats.max_spo2 = Math.max(...validSpo2);
            }

            if (validHeartRate.length > 0) {
              stats.avg_heart_rate = Math.round((validHeartRate.reduce((a, b) => a + b) / validHeartRate.length) * 10) / 10;
              stats.min_heart_rate = Math.min(...validHeartRate);
              stats.max_heart_rate = Math.max(...validHeartRate);
            }
          }
        }

        // Update session to completed
        const updates = {
          status: 'completed',
          end_time: new Date().toISOString(),
          ...stats,
          updated_at: new Date().toISOString()
        };

        const { data: updateData, error: updateError } = await supabase
          .from('sessions')
          .update(updates)
          .eq('id', session.id)
          .select();

        if (updateError) {
          console.error(`❌ Failed to cleanup session ${session.id}:`, updateError);
          results.push({ sessionId: session.id, success: false, error: updateError });
        } else {
          console.log(`✅ Cleaned up session ${session.id}`);
          results.push({ sessionId: session.id, success: true, stats });
        }

      } catch (sessionError) {
        console.error(`❌ Error cleaning up session ${session.id}:`, sessionError);
        results.push({ sessionId: session.id, success: false, error: sessionError });
      }
    }

    const successful = results.filter(r => r.success).length;
    console.log(`🎯 Successfully cleaned up ${successful}/${sessionsToCleanup.length} sessions`);

    return {
      success: true,
      results,
      totalProcessed: sessionsToCleanup.length,
      totalCleaned: successful
    };

  } catch (error) {
    console.error('❌ Cleanup operation failed:', error);
    return { success: false, error };
  }
};

// Delete incomplete sessions (sessions with 0 readings) - BATCH PROCESSING
export const deleteIncompleteSessions = async (sessionIds = null, batchSize = 50) => {
  console.log('🗑️ Deleting incomplete sessions...');
  
  try {
    let sessionsToDelete;
    
    if (sessionIds) {
      // Delete specific sessions
      const { data, error } = await supabase
        .from('sessions')
        .select('id, local_session_id, total_readings')
        .in('id', sessionIds);
      
      if (error) throw error;
      sessionsToDelete = data;
    } else {
      // Find sessions with 0 readings that are either active or completed
      // LIMIT to prevent overwhelming the system
      const { data, error } = await supabase
        .from('sessions')
        .select('id, local_session_id, total_readings, status')
        .eq('total_readings', 0)
        .order('start_time', { ascending: false })
        .limit(batchSize);
      
      if (error) throw error;
      sessionsToDelete = data;
    }

    console.log(`🗑️ Processing ${sessionsToDelete.length} sessions for deletion...`);
    
    const results = [];
    for (const session of sessionsToDelete) {
      try {
        // Delete readings first (should be none, but just in case)
        const { error: readingsError } = await supabase
          .from('readings')
          .delete()
          .eq('session_id', session.id);

        if (readingsError) {
          console.error(`❌ Failed to delete readings for session ${session.id}:`, readingsError);
        }

        // Delete session
        const { error: sessionError } = await supabase
          .from('sessions')
          .delete()
          .eq('id', session.id);

        if (sessionError) {
          console.error(`❌ Failed to delete session ${session.id}:`, sessionError);
          results.push({ sessionId: session.id, success: false, error: sessionError });
        } else {
          console.log(`✅ Deleted session ${session.id}`);
          results.push({ sessionId: session.id, success: true });
        }

      } catch (sessionError) {
        console.error(`❌ Error deleting session ${session.id}:`, sessionError);
        results.push({ sessionId: session.id, success: false, error: sessionError });
      }
    }

    const successful = results.filter(r => r.success).length;
    console.log(`🎯 Successfully deleted ${successful}/${sessionsToDelete.length} sessions`);

    return {
      success: true,
      results,
      totalProcessed: sessionsToDelete.length,
      totalDeleted: successful
    };

  } catch (error) {
    console.error('❌ Delete operation failed:', error);
    return { success: false, error };
  }
};

// Get summary of session issues
export const getSessionHealthSummary = async () => {
  console.log('📊 Analyzing session health...');
  
  try {
    // Get all active sessions
    const { data: activeSessions } = await supabase
      .from('sessions')
      .select('id, start_time, total_readings')
      .eq('status', 'active');

    // Get sessions with 0 readings
    const { data: emptyReadingSessions } = await supabase
      .from('sessions')
      .select('id, status')
      .eq('total_readings', 0);

    // Categorize active sessions by age
    const now = Date.now();
    const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;
    const oneHourAgo = now - 60 * 60 * 1000;

    const stuckSessions = activeSessions?.filter(s => 
      new Date(s.start_time).getTime() < twentyFourHoursAgo
    ) || [];

    const recentActiveSessions = activeSessions?.filter(s => 
      new Date(s.start_time).getTime() > oneHourAgo
    ) || [];

    const emptySessions = emptyReadingSessions?.length || 0;

    const summary = {
      totalActiveSessions: activeSessions?.length || 0,
      stuckSessions: stuckSessions.length,
      recentActiveSessions: recentActiveSessions.length,
      emptyReadingSessions: emptySessions,
      recommendations: []
    };

    // Add recommendations
    if (summary.stuckSessions > 0) {
      summary.recommendations.push(`${summary.stuckSessions} stuck sessions should be cleaned up`);
    }
    
    if (summary.emptyReadingSessions > 0) {
      summary.recommendations.push(`${summary.emptyReadingSessions} empty sessions can be deleted`);
    }

    if (summary.recentActiveSessions > 1) {
      summary.recommendations.push(`${summary.recentActiveSessions} recent active sessions may indicate app crashes`);
    }

    console.log('📊 Session Health Summary:', summary);
    return { success: true, summary };

  } catch (error) {
    console.error('❌ Failed to analyze session health:', error);
    return { success: false, error };
  }
}; 

// COMPREHENSIVE CLEANUP - Handle large numbers of stuck sessions safely
export const performFullCleanup = async (maxBatchSize = 100) => {
  console.log('🧹 Starting comprehensive session cleanup...');
  
  try {
    const results = {
      totalStuckFound: 0,
      totalEmptyFound: 0,
      stuckCleaned: 0,
      localCleaned: 0,
      emptyDeleted: 0,
      errors: []
    };

    // Step 1: Get summary first
    console.log('📊 Analyzing session health...');
    const healthCheck = await getSessionHealthSummary();
    
    if (!healthCheck.success) {
      throw healthCheck.error;
    }

    console.log(`📊 Health Summary:`, healthCheck.summary);
    
    // Step 2: Find stuck sessions (active, old)
    const stuckResults = await findStuckSessions();
    if (stuckResults.success) {
      results.totalStuckFound = stuckResults.totalFound;
      
      if (stuckResults.totalFound > 0) {
        // Process stuck sessions in batches
        const stuckBatches = Math.ceil(stuckResults.totalFound / maxBatchSize);
        console.log(`🔧 Processing ${stuckResults.totalFound} stuck sessions in ${stuckBatches} batches...`);
        
        for (let i = 0; i < stuckBatches; i++) {
          const batchStart = i * maxBatchSize;
          const batchSessions = stuckResults.stuckSessions.slice(batchStart, batchStart + maxBatchSize);
          const batchIds = batchSessions.map(s => s.id);
          
          console.log(`🔧 Processing batch ${i + 1}/${stuckBatches} (${batchSessions.length} sessions)...`);
          
          const cleanupResult = await cleanupStuckSessions(batchIds);
          if (cleanupResult.success) {
            results.stuckCleaned += cleanupResult.totalCleaned;
          } else {
            results.errors.push(`Batch ${i + 1} cleanup failed: ${cleanupResult.error.message}`);
          }
          
          // Small delay between batches to avoid overwhelming the database
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    // Step 2.5: Clean up local stuck sessions
    console.log('🗄️ Processing local stuck sessions...');
    const localResults = await cleanupLocalStuckSessions();
    if (localResults.success) {
      results.localCleaned = localResults.totalCleaned;
      console.log(`🗄️ Local cleanup: ${localResults.totalCleaned} sessions cleaned`);
    } else {
      results.errors.push(`Local cleanup failed: ${localResults.error?.message}`);
    }

    // Step 3: Delete empty sessions in batches
    console.log('🗑️ Processing empty sessions...');
    let totalEmptyDeleted = 0;
    let hasMoreEmpty = true;
    
    while (hasMoreEmpty) {
      const deleteResult = await deleteIncompleteSessions(null, maxBatchSize);
      
      if (deleteResult.success) {
        totalEmptyDeleted += deleteResult.totalDeleted;
        hasMoreEmpty = deleteResult.totalProcessed === maxBatchSize; // Continue if we hit the batch limit
        
        if (hasMoreEmpty) {
          console.log(`🗑️ Deleted ${deleteResult.totalDeleted} sessions, continuing...`);
          // Small delay between batches
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } else {
        results.errors.push(`Empty session deletion failed: ${deleteResult.error.message}`);
        hasMoreEmpty = false;
      }
    }
    
    results.emptyDeleted = totalEmptyDeleted;

    // Final summary
    console.log('🎯 CLEANUP COMPLETE:');
    console.log(`  • Stuck sessions found (Supabase): ${results.totalStuckFound}`);
    console.log(`  • Stuck sessions cleaned (Supabase): ${results.stuckCleaned}`);
    console.log(`  • Stuck sessions cleaned (Local): ${results.localCleaned}`);
    console.log(`  • Empty sessions deleted: ${results.emptyDeleted}`);
    console.log(`  • Errors: ${results.errors.length}`);
    
    if (results.errors.length > 0) {
      console.log('❌ Errors encountered:');
      results.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }

    return {
      success: true,
      results
    };

  } catch (error) {
    console.error('❌ Comprehensive cleanup failed:', error);
    return { success: false, error };
  }
}; 

// Check recent sessions for verification
export const getRecentSessions = async (limitHours = 1) => {
  console.log(`🔍 Checking sessions created in last ${limitHours} hour(s)...`);
  
  try {
    const cutoffTime = new Date(Date.now() - limitHours * 60 * 60 * 1000).toISOString();
    
    const { data: recentSessions, error } = await supabase
      .from('sessions')
      .select('id, local_session_id, total_readings, start_time, end_time, status, device_id, user_id, created_at')
      .gte('created_at', cutoffTime)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Failed to get recent sessions:', error);
      return { success: false, error };
    }

    console.log(`📊 Found ${recentSessions?.length || 0} recent sessions`);
    
    recentSessions?.forEach((session, index) => {
      const age = Math.round((Date.now() - new Date(session.created_at).getTime()) / (1000 * 60));
      console.log(`${index + 1}. ${session.local_session_id} - ${age}m ago - Status: ${session.status} - Readings: ${session.total_readings}`);
    });

    return { 
      success: true, 
      sessions: recentSessions || [],
      totalFound: recentSessions?.length || 0
    };
    
  } catch (error) {
    console.error('❌ Error checking recent sessions:', error);
    return { success: false, error };
  }
}; 

// Clean up stuck sessions from local SQLite database
export const cleanupLocalStuckSessions = async () => {
  console.log('🗄️ Cleaning up stuck sessions from local database...');
  
  try {
    // Initialize database service
    if (!DatabaseService.db) {
      await DatabaseService.init();
    }

    // Get all sessions from local database
    const localSessions = await DatabaseService.getAllSessions();
    console.log(`📊 Found ${localSessions.length} sessions in local database`);

    if (localSessions.length === 0) {
      return { success: true, totalCleaned: 0, details: 'No local sessions found' };
    }

    let cleanedCount = 0;
    const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);

    for (const session of localSessions) {
      const sessionAge = Date.now() - session.start_time;
      const isOld = session.start_time < twentyFourHoursAgo;
      const hasZeroReadings = session.total_readings === 0;
      const isActive = session.status === 'active';

      // Clean up if: active + (old OR zero readings)
      if (isActive && (isOld || hasZeroReadings)) {
        const ageHours = Math.round(sessionAge / (60 * 60 * 1000));
        console.log(`🧹 Cleaning local stuck session: ${session.id} (${ageHours}h old, ${session.total_readings || 0} readings)`);

        try {
          // End the session properly in local database
          await DatabaseService.endSession(session.id);
          cleanedCount++;
          console.log(`✅ Cleaned local session: ${session.id}`);
        } catch (cleanupError) {
          console.error(`❌ Failed to clean local session ${session.id}:`, cleanupError);
        }
      }
    }

    console.log(`🎯 Local cleanup complete: ${cleanedCount} sessions cleaned`);
    return { 
      success: true, 
      totalCleaned: cleanedCount,
      details: `Cleaned ${cleanedCount} stuck sessions from local database`
    };

  } catch (error) {
    console.error('❌ Local cleanup failed:', error);
    return { success: false, error, totalCleaned: 0 };
  }
};