#!/usr/bin/env node

/**
 * Quick Connection Status Checker
 * Run this to instantly check OAuth connection status
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
  cyan: '\x1b[36m'
};

async function checkConnection(userId) {
  console.log(`\n${colors.cyan}${colors.bright}=== OAuth Connection Status ===${colors.reset}`);
  console.log(`Timestamp: ${new Date().toLocaleString()}\n`);

  try {
    // Build query
    let query = supabase
      .from('user_profiles')
      .select('user_id, email, whoop_connected, oura_connected, whoop_token_expires_at, oura_token_expires_at');
    
    if (userId) {
      query = query.eq('user_id', userId);
    } else {
      query = query.or('whoop_connected.eq.true,oura_connected.eq.true');
    }

    const { data: profiles, error } = await query;

    if (error) throw error;

    if (!profiles || profiles.length === 0) {
      console.log(`${colors.yellow}⚠️  No OAuth connections found${colors.reset}`);
      
      if (userId) {
        console.log(`User ${userId} has not connected any wearables yet.`);
      } else {
        console.log('No users have connected Whoop or Oura yet.');
      }
      return;
    }

    // Display connection status for each profile
    profiles.forEach(profile => {
      console.log(`${colors.bright}User: ${profile.email || profile.user_id}${colors.reset}`);
      console.log(`ID: ${profile.user_id}\n`);

      // Whoop status
      if (profile.whoop_connected) {
        const expiry = new Date(profile.whoop_token_expires_at);
        const now = new Date();
        const isExpired = expiry < now;
        const hoursLeft = Math.floor((expiry - now) / (1000 * 60 * 60));
        
        console.log(`${colors.green}✅ WHOOP CONNECTED${colors.reset}`);
        console.log(`   Token expires: ${expiry.toLocaleString()}`);
        
        if (isExpired) {
          console.log(`   ${colors.red}⚠️  TOKEN EXPIRED - Needs refresh!${colors.reset}`);
        } else if (hoursLeft < 24) {
          console.log(`   ${colors.yellow}⚠️  Token expires soon: ${hoursLeft} hours left${colors.reset}`);
        } else {
          console.log(`   ${colors.green}✓ Token valid for ${hoursLeft} hours${colors.reset}`);
        }
      } else {
        console.log(`${colors.red}❌ WHOOP NOT CONNECTED${colors.reset}`);
      }

      console.log();

      // Oura status
      if (profile.oura_connected) {
        const expiry = new Date(profile.oura_token_expires_at);
        const now = new Date();
        const isExpired = expiry < now;
        const hoursLeft = Math.floor((expiry - now) / (1000 * 60 * 60));
        
        console.log(`${colors.green}✅ OURA CONNECTED${colors.reset}`);
        console.log(`   Token expires: ${expiry.toLocaleString()}`);
        
        if (isExpired) {
          console.log(`   ${colors.red}⚠️  TOKEN EXPIRED - Needs refresh!${colors.reset}`);
        } else if (hoursLeft < 24) {
          console.log(`   ${colors.yellow}⚠️  Token expires soon: ${hoursLeft} hours left${colors.reset}`);
        } else {
          console.log(`   ${colors.green}✓ Token valid for ${hoursLeft} hours${colors.reset}`);
        }
      } else {
        console.log(`${colors.red}❌ OURA NOT CONNECTED${colors.reset}`);
      }

      console.log('\n' + '─'.repeat(50) + '\n');
    });

    // Quick stats
    const whoopCount = profiles.filter(p => p.whoop_connected).length;
    const ouraCount = profiles.filter(p => p.oura_connected).length;
    
    console.log(`${colors.bright}Summary:${colors.reset}`);
    console.log(`• Total profiles checked: ${profiles.length}`);
    console.log(`• Whoop connections: ${whoopCount}`);
    console.log(`• Oura connections: ${ouraCount}`);

  } catch (error) {
    console.error(`${colors.red}Error checking connections:${colors.reset}`, error.message);
  }
}

// Main execution
const userId = process.argv[2];

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
${colors.bright}OAuth Connection Status Checker${colors.reset}

Usage:
  node check-connection.js [userId]

Examples:
  node check-connection.js                    # Check all connected users
  node check-connection.js abc-123-def        # Check specific user

Options:
  --help, -h    Show this help message
  `);
  process.exit(0);
}

checkConnection(userId).catch(console.error);