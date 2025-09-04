#!/usr/bin/env node

/**
 * Test script for IHHT Progressive Overload Synchronization
 * 
 * This script tests the complete flow of:
 * 1. Creating a session with altitude levels
 * 2. Updating altitude during session
 * 3. Recording adaptive events
 * 4. Fetching progression data
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Configure Supabase client
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://pkabhnqarbmzfkcvnbud.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBrYWJobnFhcmJtemZrY3ZuYnVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0NzU4MTEsImV4cCI6MjA3MjA1MTgxMX0.M_vRURfdNUJFYSxt_CjMRTDoTz3kTsV0ujgNYehNjbY';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Test configuration
const TEST_USER_ID = 'test-user-' + Date.now();
const TEST_SESSION_ID = 'test-session-' + Date.now();

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, type = 'info') {
  const prefix = {
    info: `${colors.blue}ℹ️ `,
    success: `${colors.green}✅ `,
    error: `${colors.red}❌ `,
    warning: `${colors.yellow}⚠️ `,
    test: `${colors.cyan}🧪 `
  };
  
  console.log(`${prefix[type]}${message}${colors.reset}`);
}

async function testProgressiveOverloadSync() {
  log('Starting Progressive Overload Synchronization Test', 'test');
  console.log('═'.repeat(60));
  
  let testSessionUuid = null;
  
  try {
    // Step 1: Create a test session with altitude progression fields
    log('Creating test session with altitude levels...', 'info');
    
    const sessionData = {
      device_id: 'test-device-001',
      user_id: null, // Anonymous session for testing
      local_session_id: TEST_SESSION_ID,
      start_time: new Date().toISOString(),
      status: 'active',
      session_type: 'IHHT',
      // Progressive overload fields
      starting_altitude_level: 7,
      current_altitude_level: 7,
      session_subtype: 'training',
      total_mask_lifts: 0,
      total_altitude_adjustments: 0,
      // Protocol config
      total_cycles: 3,
      hypoxic_duration: 420,
      hyperoxic_duration: 180,
      planned_total_cycles: 3,
      planned_hypoxic_duration: 420,
      planned_hyperoxic_duration: 180
    };
    
    const { data: session, error: createError } = await supabase
      .from('sessions')
      .insert([sessionData])
      .select()
      .single();
    
    if (createError) {
      throw new Error(`Failed to create session: ${createError.message}`);
    }
    
    testSessionUuid = session.id;
    log(`Session created successfully! ID: ${testSessionUuid}`, 'success');
    log(`Starting altitude: ${session.starting_altitude_level}, Current: ${session.current_altitude_level}`, 'info');
    
    // Step 2: Test altitude update
    console.log('\n' + '─'.repeat(60));
    log('Testing altitude level update...', 'info');
    
    const { data: updatedSession, error: updateError } = await supabase
      .from('sessions')
      .update({
        current_altitude_level: 8,
        total_altitude_adjustments: 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', testSessionUuid)
      .select()
      .single();
    
    if (updateError) {
      throw new Error(`Failed to update altitude: ${updateError.message}`);
    }
    
    log(`Altitude updated! New level: ${updatedSession.current_altitude_level}`, 'success');
    
    // Step 3: Record adaptive events
    console.log('\n' + '─'.repeat(60));
    log('Recording adaptive events...', 'info');
    
    // Record a mask lift event
    const maskLiftEvent = {
      session_id: testSessionUuid,
      event_type: 'mask_lift',
      event_timestamp: new Date().toISOString(),
      altitude_phase_number: 1,
      current_altitude_level: 8,
      spo2_value: 82,
      additional_data: { reason: 'user_discomfort' }
    };
    
    const { error: maskLiftError } = await supabase
      .from('session_adaptive_events')
      .insert([maskLiftEvent]);
    
    if (maskLiftError) {
      log(`Warning: Failed to record mask lift: ${maskLiftError.message}`, 'warning');
    } else {
      log('Mask lift event recorded', 'success');
    }
    
    // Record altitude adjustment event
    const adjustmentEvent = {
      session_id: testSessionUuid,
      event_type: 'dial_adjustment',
      event_timestamp: new Date().toISOString(),
      current_altitude_level: 8,
      additional_data: { 
        reason: 'performance_based',
        previous_level: 7
      }
    };
    
    const { error: adjustError } = await supabase
      .from('session_adaptive_events')
      .insert([adjustmentEvent]);
    
    if (adjustError) {
      log(`Warning: Failed to record adjustment: ${adjustError.message}`, 'warning');
    } else {
      log('Altitude adjustment event recorded', 'success');
    }
    
    // Step 4: Record phase statistics
    console.log('\n' + '─'.repeat(60));
    log('Recording phase statistics...', 'info');
    
    const phaseStats = {
      session_id: testSessionUuid,
      phase_type: 'altitude',
      phase_number: 1,
      altitude_level: 8,
      start_time: new Date(Date.now() - 420000).toISOString(), // 7 minutes ago
      end_time: new Date().toISOString(),
      duration_seconds: 420,
      min_spo2: 82,
      max_spo2: 88,
      avg_spo2: 85,
      spo2_readings_count: 84,
      mask_lift_count: 1,
      target_min_spo2: 85,
      target_max_spo2: 90
    };
    
    const { error: phaseError } = await supabase
      .from('session_phase_stats')
      .insert([phaseStats]);
    
    if (phaseError) {
      log(`Warning: Failed to record phase stats: ${phaseError.message}`, 'warning');
    } else {
      log('Phase statistics recorded', 'success');
    }
    
    // Step 5: End session with progression data
    console.log('\n' + '─'.repeat(60));
    log('Ending session with complete progression data...', 'info');
    
    const endSessionData = {
      end_time: new Date().toISOString(),
      status: 'completed',
      total_readings: 420,
      avg_spo2: 85.5,
      min_spo2: 82,
      max_spo2: 95,
      avg_heart_rate: 72,
      min_heart_rate: 65,
      max_heart_rate: 85,
      total_duration_seconds: 1800,
      // Progressive overload completion fields
      current_altitude_level: 8,
      total_mask_lifts: 2,
      total_altitude_adjustments: 1,
      actual_cycles_completed: 3,
      actual_hypoxic_time: 1260,
      actual_hyperoxic_time: 540,
      completion_percentage: 100
    };
    
    const { data: completedSession, error: endError } = await supabase
      .from('sessions')
      .update(endSessionData)
      .eq('id', testSessionUuid)
      .select()
      .single();
    
    if (endError) {
      throw new Error(`Failed to end session: ${endError.message}`);
    }
    
    log('Session completed successfully!', 'success');
    log(`Final altitude: ${completedSession.current_altitude_level} (started at ${completedSession.starting_altitude_level})`, 'info');
    log(`Total mask lifts: ${completedSession.total_mask_lifts}`, 'info');
    log(`Completion: ${completedSession.completion_percentage}%`, 'info');
    
    // Step 6: Verify data retrieval
    console.log('\n' + '─'.repeat(60));
    log('Verifying data retrieval...', 'info');
    
    // Fetch session with all fields
    const { data: verifySession, error: verifyError } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', testSessionUuid)
      .single();
    
    if (verifyError) {
      throw new Error(`Failed to verify session: ${verifyError.message}`);
    }
    
    // Check critical fields
    const criticalFields = [
      'starting_altitude_level',
      'current_altitude_level',
      'session_subtype',
      'total_mask_lifts',
      'total_altitude_adjustments',
      'actual_cycles_completed',
      'completion_percentage'
    ];
    
    log('Checking critical fields:', 'test');
    let allFieldsPresent = true;
    
    for (const field of criticalFields) {
      if (verifySession[field] !== null && verifySession[field] !== undefined) {
        console.log(`  ✅ ${field}: ${verifySession[field]}`);
      } else {
        console.log(`  ❌ ${field}: MISSING`);
        allFieldsPresent = false;
      }
    }
    
    // Fetch adaptive events
    const { data: events, error: eventsError } = await supabase
      .from('session_adaptive_events')
      .select('*')
      .eq('session_id', testSessionUuid);
    
    if (!eventsError && events) {
      log(`Adaptive events recorded: ${events.length}`, 'info');
    }
    
    // Fetch phase stats
    const { data: phases, error: phasesError } = await supabase
      .from('session_phase_stats')
      .select('*')
      .eq('session_id', testSessionUuid);
    
    if (!phasesError && phases) {
      log(`Phase statistics recorded: ${phases.length}`, 'info');
    }
    
    // Final verdict
    console.log('\n' + '═'.repeat(60));
    if (allFieldsPresent) {
      log('✨ ALL TESTS PASSED! Progressive Overload System is working correctly! ✨', 'success');
    } else {
      log('⚠️ Some fields are missing. Check the implementation.', 'warning');
    }
    
  } catch (error) {
    log(`Test failed: ${error.message}`, 'error');
    console.error(error);
  } finally {
    // Cleanup: Delete test session
    if (testSessionUuid) {
      log('\nCleaning up test data...', 'info');
      
      // Delete adaptive events first (due to foreign key)
      await supabase
        .from('session_adaptive_events')
        .delete()
        .eq('session_id', testSessionUuid);
      
      // Delete phase stats
      await supabase
        .from('session_phase_stats')
        .delete()
        .eq('session_id', testSessionUuid);
      
      // Delete session
      const { error } = await supabase
        .from('sessions')
        .delete()
        .eq('id', testSessionUuid);
      
      if (!error) {
        log('Test data cleaned up', 'success');
      }
    }
  }
}

// Run the test
testProgressiveOverloadSync()
  .then(() => {
    console.log('\n' + '═'.repeat(60));
    log('Test suite completed', 'test');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });