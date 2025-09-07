// Test script to verify ihht-v2 branch connection
// Run with: node test-branch-connection.js

import { createClient } from '@supabase/supabase-js';

// Replace with your actual branch credentials
const BRANCH_URL = 'https://YOUR_BRANCH_ID.supabase.co';
const BRANCH_ANON_KEY = 'YOUR_BRANCH_ANON_KEY';

const supabase = createClient(BRANCH_URL, BRANCH_ANON_KEY);

async function testBranchConnection() {
  console.log('🔄 Testing IHHT v2 branch connection...\n');

  // Test 1: Check altitude_levels table
  console.log('1️⃣ Testing altitude_levels table:');
  const { data: altitudes, error: altError } = await supabase
    .from('altitude_levels')
    .select('*')
    .order('dial_position');
  
  if (altError) {
    console.error('❌ Error:', altError);
  } else {
    console.log('✅ Found', altitudes.length, 'altitude levels');
    console.log('   Dial 6:', altitudes.find(a => a.dial_position === 6)?.description);
  }

  // Test 2: Check table structure
  console.log('\n2️⃣ Checking new IHHT tables:');
  const tables = [
    'phase_metrics',
    'mask_lift_events', 
    'dial_adjustments',
    'intrasession_surveys',
    'user_hypoxia_experience'
  ];

  for (const table of tables) {
    const { error } = await supabase
      .from(table)
      .select('*')
      .limit(1);
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows (expected)
      console.log(`❌ ${table}: Error - ${error.message}`);
    } else {
      console.log(`✅ ${table}: Ready`);
    }
  }

  // Test 3: Test inserting a test session
  console.log('\n3️⃣ Testing session creation:');
  const testSession = {
    session_id: `TEST_IHHT_${Date.now()}`,
    session_type: 'IHHT',
    starting_dial_position: 6,
    session_data: { test: true }
  };

  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .insert(testSession)
    .select()
    .single();

  if (sessionError) {
    console.error('❌ Session creation failed:', sessionError.message);
  } else {
    console.log('✅ Test session created:', session.session_id);
    
    // Clean up test session
    await supabase
      .from('sessions')
      .delete()
      .eq('id', session.id);
    console.log('🧹 Test session cleaned up');
  }

  console.log('\n✨ Branch connection test complete!');
}

testBranchConnection().catch(console.error);