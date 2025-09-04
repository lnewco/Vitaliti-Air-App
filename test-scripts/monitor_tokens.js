const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL || 'https://khfssanwzvzlqhrbejjw.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtoZnNzYW53enZ6bHFocmJlamp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjQzNjI1NjcsImV4cCI6MjAzOTkzODU2N30.s1BF2NpJNIKXGR-yFLSM33rTnKxtJvGEfxQXcu7TKVU';

const supabase = createClient(supabaseUrl, supabaseKey);

// Track the last check time
let lastCheckTime = new Date();

async function checkForNewTokens() {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`\n🔍 [${timestamp}] Checking for OAuth tokens...`);
  
  try {
    // Check customer_integrations table
    const { data, error } = await supabase
      .from('customer_integrations')
      .select('vendor, created_at, updated_at, user_id')
      .in('vendor', ['oura', 'whoop'])
      .gte('created_at', lastCheckTime.toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error querying database:', error.message);
      return;
    }

    if (data && data.length > 0) {
      console.log('🎉 NEW TOKENS DETECTED!');
      data.forEach(token => {
        console.log(`  ✅ ${token.vendor.toUpperCase()} token`);
        console.log(`     - Created: ${new Date(token.created_at).toLocaleString()}`);
        console.log(`     - User ID: ${token.user_id}`);
      });
      lastCheckTime = new Date();
    } else {
      console.log('  No new tokens yet...');
    }

    // Also check total token count
    const { data: allTokens, error: countError } = await supabase
      .from('customer_integrations')
      .select('vendor', { count: 'exact' })
      .in('vendor', ['oura', 'whoop']);

    if (!countError && allTokens) {
      const ouraCount = allTokens.filter(t => t.vendor === 'oura').length;
      const whoopCount = allTokens.filter(t => t.vendor === 'whoop').length;
      console.log(`  📊 Total tokens: Oura=${ouraCount}, Whoop=${whoopCount}`);
    }

  } catch (err) {
    console.error('❌ Unexpected error:', err);
  }
}

// Initial check
console.log('🚀 Starting OAuth token monitor...');
console.log('📱 Watching for new Oura and Whoop tokens');
console.log('⏰ Checking every 5 seconds\n');

checkForNewTokens();

// Check every 5 seconds
setInterval(checkForNewTokens, 5000);

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Stopping token monitor...');
  process.exit(0);
});