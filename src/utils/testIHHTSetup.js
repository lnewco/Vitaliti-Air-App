import { supabase } from '../services/SupabaseService';

/**
 * Test utility to verify IHHT v2 setup
 * Run this to check if all components are properly configured
 */

export async function testIHHTSetup() {
  const results = {
    database: false,
    altitudeLevels: false,
    authentication: false,
    sessionCreation: false,
    phaseMetrics: false,
    errors: [],
  };

  console.log('🔍 Testing IHHT v2 Setup...\n');

  try {
    // Test 1: Database Connection
    console.log('1. Testing database connection...');
    const { data: testConnection, error: connError } = await supabase
      .from('altitude_levels')
      .select('count')
      .single();
    
    if (!connError) {
      results.database = true;
      console.log('✅ Database connected');
    } else {
      results.errors.push(`Database: ${connError.message}`);
      console.log('❌ Database connection failed');
    }

    // Test 2: Altitude Levels Data
    console.log('\n2. Checking altitude levels...');
    const { data: altitudes, error: altError } = await supabase
      .from('altitude_levels')
      .select('*')
      .order('dial_position');
    
    if (altitudes && altitudes.length === 12) {
      results.altitudeLevels = true;
      console.log(`✅ Found ${altitudes.length} altitude levels`);
      console.log('   Dial 6:', altitudes[6]?.description);
      console.log('   Dial 7:', altitudes[7]?.description);
    } else {
      results.errors.push('Altitude levels not properly configured');
      console.log('❌ Altitude levels missing or incomplete');
    }

    // Test 3: Authentication
    console.log('\n3. Testing authentication...');
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (user) {
      results.authentication = true;
      console.log('✅ User authenticated:', user.email || user.phone);
    } else {
      console.log('⚠️  No user authenticated (expected for initial setup)');
    }

    // Test 4: Session Creation Test
    console.log('\n4. Testing session creation...');
    const testSessionId = `TEST_${Date.now()}`;
    
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .insert({
        session_id: testSessionId,
        session_type: 'IHHT_TEST',
        starting_dial_position: 6,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (session) {
      results.sessionCreation = true;
      console.log('✅ Test session created:', session.session_id);
      
      // Clean up test session
      await supabase
        .from('sessions')
        .delete()
        .eq('id', session.id);
      console.log('   Test session cleaned up');
    } else {
      results.errors.push(`Session creation: ${sessionError?.message}`);
      console.log('❌ Session creation failed');
    }

    // Test 5: Phase Metrics Table
    console.log('\n5. Checking phase metrics table...');
    const { error: phaseError } = await supabase
      .from('phase_metrics')
      .select('*')
      .limit(1);
    
    if (!phaseError) {
      results.phaseMetrics = true;
      console.log('✅ Phase metrics table accessible');
    } else {
      results.errors.push(`Phase metrics: ${phaseError.message}`);
      console.log('❌ Phase metrics table error');
    }

    // Test 6: Check all required tables
    console.log('\n6. Verifying all required tables...');
    const requiredTables = [
      'sessions',
      'readings',
      'altitude_levels',
      'user_hypoxia_experience',
      'phase_metrics',
      'mask_lift_events',
      'dial_adjustments',
      'intrasession_surveys',
      'session_instructions',
    ];

    for (const table of requiredTables) {
      const { error } = await supabase
        .from(table)
        .select('*')
        .limit(1);
      
      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows (OK)
        console.log(`❌ Table '${table}' has issues:`, error.message);
        results.errors.push(`Table ${table}: ${error.message}`);
      } else {
        console.log(`✅ Table '${table}' is ready`);
      }
    }

  } catch (error) {
    console.error('Unexpected error during testing:', error);
    results.errors.push(`Unexpected: ${error.message}`);
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(50));
  
  const passed = Object.values(results).filter(v => v === true).length;
  const total = Object.keys(results).length - 1; // Exclude errors array
  
  console.log(`Tests Passed: ${passed}/${total}`);
  
  if (results.errors.length > 0) {
    console.log('\n⚠️  Issues found:');
    results.errors.forEach(err => console.log(`   - ${err}`));
  } else {
    console.log('\n🎉 All tests passed! IHHT v2 is ready to use.');
  }

  return results;
}

/**
 * Test data simulation for development
 */
export function generateMockMetrics() {
  // Simulate realistic SpO2 and HR patterns
  const baseSpO2 = 88;
  const baseHR = 75;
  
  return {
    spo2: Math.max(75, Math.min(100, baseSpO2 + Math.random() * 10 - 5)),
    heartRate: Math.max(60, Math.min(120, baseHR + Math.random() * 20 - 10)),
  };
}

/**
 * Simulate a complete session for testing
 */
export async function simulateSession(userId) {
  console.log('🎮 Simulating IHHT session...\n');
  
  const sessionId = `SIM_${Date.now()}`;
  const startingDial = 6;
  let currentDial = startingDial;
  
  try {
    // Create session
    await supabase.from('sessions').insert({
      user_id: userId,
      session_id: sessionId,
      session_type: 'IHHT_SIMULATION',
      starting_dial_position: startingDial,
    });
    
    console.log('Session created:', sessionId);
    
    // Simulate 2 cycles
    for (let cycle = 1; cycle <= 2; cycle++) {
      console.log(`\nCycle ${cycle}:`);
      
      // Altitude phase
      const altitudeMetrics = {
        session_id: sessionId,
        cycle_number: cycle,
        phase_type: 'altitude',
        dial_position: currentDial,
        start_time: new Date().toISOString(),
        end_time: new Date(Date.now() + 420000).toISOString(), // +7 min
        duration_seconds: 420,
        avg_spo2: 86 + Math.random() * 4,
        min_spo2: 82 + Math.random() * 3,
        avg_heart_rate: 75 + Math.random() * 10,
        mask_lift_count: Math.floor(Math.random() * 3),
      };
      
      await supabase.from('phase_metrics').insert(altitudeMetrics);
      console.log('  Altitude phase: SpO2 avg', Math.round(altitudeMetrics.avg_spo2));
      
      // Recovery phase
      const recoveryMetrics = {
        session_id: sessionId,
        cycle_number: cycle,
        phase_type: 'recovery',
        dial_position: currentDial,
        start_time: new Date().toISOString(),
        end_time: new Date(Date.now() + 180000).toISOString(), // +3 min
        duration_seconds: 180,
        avg_spo2: 94 + Math.random() * 4,
        min_spo2: 92 + Math.random() * 3,
        avg_heart_rate: 70 + Math.random() * 10,
        mask_lift_count: 0,
      };
      
      await supabase.from('phase_metrics').insert(recoveryMetrics);
      console.log('  Recovery phase: SpO2 avg', Math.round(recoveryMetrics.avg_spo2));
      
      // Adjust dial if needed
      if (altitudeMetrics.avg_spo2 > 90) {
        currentDial = Math.min(currentDial + 1, 11);
        console.log('  Dial increased to', currentDial);
      }
    }
    
    // Complete session
    await supabase
      .from('sessions')
      .update({
        ended_at: new Date().toISOString(),
        ending_dial_position: currentDial,
        total_mask_lifts: 3,
      })
      .eq('session_id', sessionId);
    
    console.log('\n✅ Simulation complete!');
    console.log('Session ID:', sessionId);
    
    return sessionId;
    
  } catch (error) {
    console.error('Simulation error:', error);
    return null;
  }
}

// Export for use in components
export default {
  testIHHTSetup,
  generateMockMetrics,
  simulateSession,
};