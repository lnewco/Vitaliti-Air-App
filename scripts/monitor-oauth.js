#!/usr/bin/env node

/**
 * OAuth Integration Monitor for Vitaliti Air App
 * Tracks connection status, token validity, and data sync
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

async function monitorOAuthConnections() {
  console.log(`\n${colors.cyan}${colors.bright}=== OAuth Connection Monitor ===${colors.reset}`);
  console.log(`Timestamp: ${new Date().toLocaleString()}\n`);

  try {
    // Check for connected accounts
    const { data: profiles, error: profileError } = await supabase
      .from('user_profiles')
      .select('user_id, whoop_connected, oura_connected, whoop_token_expires_at, oura_token_expires_at')
      .or('whoop_connected.eq.true,oura_connected.eq.true');

    if (profileError) throw profileError;

    if (!profiles || profiles.length === 0) {
      console.log(`${colors.yellow}⚠️  No OAuth connections found${colors.reset}`);
      console.log('Waiting for users to connect Whoop or Oura...\n');
    } else {
      console.log(`${colors.green}✅ Found ${profiles.length} connected account(s)${colors.reset}\n`);
      
      for (const profile of profiles) {
        console.log(`${colors.bright}User: ${profile.user_id}${colors.reset}`);
        
        // Check Whoop connection
        if (profile.whoop_connected) {
          const whoopExpiry = new Date(profile.whoop_token_expires_at);
          const isExpired = whoopExpiry < new Date();
          const timeLeft = Math.floor((whoopExpiry - new Date()) / (1000 * 60 * 60));
          
          console.log(`  ${colors.green}✓ Whoop Connected${colors.reset}`);
          console.log(`    Token expires: ${whoopExpiry.toLocaleString()}`);
          if (isExpired) {
            console.log(`    ${colors.red}⚠️  Token EXPIRED - needs refresh${colors.reset}`);
          } else {
            console.log(`    Time left: ${timeLeft} hours`);
          }
        }
        
        // Check Oura connection
        if (profile.oura_connected) {
          const ouraExpiry = new Date(profile.oura_token_expires_at);
          const isExpired = ouraExpiry < new Date();
          const timeLeft = Math.floor((ouraExpiry - new Date()) / (1000 * 60 * 60));
          
          console.log(`  ${colors.green}✓ Oura Connected${colors.reset}`);
          console.log(`    Token expires: ${ouraExpiry.toLocaleString()}`);
          if (isExpired) {
            console.log(`    ${colors.red}⚠️  Token EXPIRED - needs refresh${colors.reset}`);
          } else {
            console.log(`    Time left: ${timeLeft} hours`);
          }
        }
        console.log();
      }
    }

    // Check recent data syncs
    console.log(`${colors.cyan}${colors.bright}=== Recent Data Syncs ===${colors.reset}`);
    
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    
    const { data: recentMetrics, error: metricsError } = await supabase
      .from('health_metrics')
      .select('vendor, metric_type, recorded_at, created_at')
      .gte('created_at', oneDayAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(10);

    if (metricsError) throw metricsError;

    if (!recentMetrics || recentMetrics.length === 0) {
      console.log(`${colors.yellow}No data synced in last 24 hours${colors.reset}\n`);
    } else {
      console.log(`${colors.green}Found ${recentMetrics.length} recent sync(s):${colors.reset}`);
      
      const vendorCounts = {};
      recentMetrics.forEach(metric => {
        const key = `${metric.vendor}_${metric.metric_type}`;
        vendorCounts[key] = (vendorCounts[key] || 0) + 1;
      });
      
      Object.entries(vendorCounts).forEach(([key, count]) => {
        const [vendor, type] = key.split('_');
        console.log(`  • ${vendor.toUpperCase()} ${type}: ${count} records`);
      });
      
      const latestSync = new Date(recentMetrics[0].created_at);
      console.log(`\n  Last sync: ${latestSync.toLocaleString()}`);
    }

  } catch (error) {
    console.error(`${colors.red}Error monitoring OAuth:${colors.reset}`, error.message);
  }
}

async function checkDataFlow() {
  console.log(`\n${colors.magenta}${colors.bright}=== Data Flow Check ===${colors.reset}`);
  
  try {
    // Check if Analytics backend has processed recent data
    const { data: processedData, error } = await supabase
      .from('whoop_data')
      .select('date')
      .order('date', { ascending: false })
      .limit(1);

    if (error) throw error;

    if (processedData && processedData.length > 0) {
      const lastProcessed = new Date(processedData[0].date);
      console.log(`${colors.green}✅ Analytics backend last processed: ${lastProcessed.toLocaleDateString()}${colors.reset}`);
    } else {
      console.log(`${colors.yellow}⚠️  No processed data found in whoop_data table${colors.reset}`);
    }

    // Check Oura processing
    const { data: ouraData, error: ouraError } = await supabase
      .from('oura_data')
      .select('date')
      .order('date', { ascending: false })
      .limit(1);

    if (ouraError) throw ouraError;

    if (ouraData && ouraData.length > 0) {
      const lastProcessed = new Date(ouraData[0].date);
      console.log(`${colors.green}✅ Analytics backend last processed Oura: ${lastProcessed.toLocaleDateString()}${colors.reset}`);
    }

  } catch (error) {
    console.error(`${colors.red}Error checking data flow:${colors.reset}`, error.message);
  }
}

// Run monitoring
async function monitor() {
  console.clear();
  await monitorOAuthConnections();
  await checkDataFlow();
  console.log(`\n${colors.cyan}Monitoring... (refreshes every 30 seconds)${colors.reset}`);
}

// Initial run
monitor();

// Refresh every 30 seconds
setInterval(monitor, 30000);

console.log(`${colors.bright}Press Ctrl+C to stop monitoring${colors.reset}`);