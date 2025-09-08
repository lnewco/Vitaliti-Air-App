#!/usr/bin/env node

/**
 * Data Sync Verification Script
 * Validates OAuth data is properly synced and formatted
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
  blue: '\x1b[34m'
};

async function verifySyncData(userId) {
  console.log(`\n${colors.cyan}${colors.bright}=== Verifying Sync Data ===${colors.reset}`);
  
  if (userId) {
    console.log(`User ID: ${userId}\n`);
  }

  try {
    // Get health_metrics data
    let query = supabase
      .from('health_metrics')
      .select('*')
      .order('recorded_at', { ascending: false })
      .limit(50);
    
    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data: metrics, error } = await query;

    if (error) throw error;

    if (!metrics || metrics.length === 0) {
      console.log(`${colors.yellow}No health metrics found${colors.reset}`);
      return;
    }

    // Analyze data by vendor and type
    const analysis = {};
    const dataIssues = [];

    metrics.forEach(metric => {
      const key = `${metric.vendor}_${metric.metric_type}`;
      if (!analysis[key]) {
        analysis[key] = {
          count: 0,
          dates: new Set(),
          lastRecorded: null,
          hasValidData: true
        };
      }
      
      analysis[key].count++;
      analysis[key].dates.add(metric.recorded_at.split('T')[0]);
      
      if (!analysis[key].lastRecorded || metric.recorded_at > analysis[key].lastRecorded) {
        analysis[key].lastRecorded = metric.recorded_at;
      }

      // Validate data structure
      if (!metric.data || typeof metric.data !== 'object') {
        dataIssues.push(`Invalid data structure for ${key} at ${metric.recorded_at}`);
        analysis[key].hasValidData = false;
      }

      // Check for required fields based on vendor
      if (metric.vendor === 'whoop') {
        if (metric.metric_type === 'recovery' && !metric.data.score) {
          dataIssues.push(`Missing recovery score for Whoop at ${metric.recorded_at}`);
        }
        if (metric.metric_type === 'sleep' && !metric.data.id) {
          dataIssues.push(`Missing sleep ID for Whoop at ${metric.recorded_at}`);
        }
      }

      if (metric.vendor === 'oura') {
        if (metric.metric_type === 'readiness' && !metric.data.score) {
          dataIssues.push(`Missing readiness score for Oura at ${metric.recorded_at}`);
        }
        if (metric.metric_type === 'sleep' && !metric.data.id) {
          dataIssues.push(`Missing sleep ID for Oura at ${metric.recorded_at}`);
        }
      }
    });

    // Display analysis
    console.log(`${colors.green}✅ Found ${metrics.length} health metrics${colors.reset}\n`);
    
    Object.entries(analysis).forEach(([key, stats]) => {
      const [vendor, type] = key.split('_');
      console.log(`${colors.bright}${vendor.toUpperCase()} - ${type}:${colors.reset}`);
      console.log(`  Records: ${stats.count}`);
      console.log(`  Unique dates: ${stats.dates.size}`);
      console.log(`  Date range: ${Array.from(stats.dates).sort()[0]} to ${Array.from(stats.dates).sort().pop()}`);
      console.log(`  Last recorded: ${new Date(stats.lastRecorded).toLocaleString()}`);
      console.log(`  Data valid: ${stats.hasValidData ? '✅' : '❌'}`);
      console.log();
    });

    // Display any data issues
    if (dataIssues.length > 0) {
      console.log(`${colors.red}${colors.bright}Data Issues Found:${colors.reset}`);
      dataIssues.forEach(issue => {
        console.log(`  • ${issue}`);
      });
    } else {
      console.log(`${colors.green}✅ All data validation passed${colors.reset}`);
    }

    // Check for gaps in data
    console.log(`\n${colors.blue}${colors.bright}=== Checking for Data Gaps ===${colors.reset}`);
    
    Object.entries(analysis).forEach(([key, stats]) => {
      const dates = Array.from(stats.dates).sort();
      const gaps = [];
      
      for (let i = 1; i < dates.length; i++) {
        const current = new Date(dates[i]);
        const previous = new Date(dates[i-1]);
        const daysDiff = Math.floor((current - previous) / (1000 * 60 * 60 * 24));
        
        if (daysDiff > 1) {
          gaps.push({
            from: dates[i-1],
            to: dates[i],
            days: daysDiff - 1
          });
        }
      }
      
      const [vendor, type] = key.split('_');
      if (gaps.length > 0) {
        console.log(`\n${vendor.toUpperCase()} ${type}:`);
        gaps.forEach(gap => {
          console.log(`  ${colors.yellow}Gap: ${gap.days} days missing between ${gap.from} and ${gap.to}${colors.reset}`);
        });
      } else {
        console.log(`${vendor.toUpperCase()} ${type}: ${colors.green}No gaps (continuous data)${colors.reset}`);
      }
    });

  } catch (error) {
    console.error(`${colors.red}Error verifying sync:${colors.reset}`, error.message);
  }
}

async function checkProcessingStatus() {
  console.log(`\n${colors.cyan}${colors.bright}=== Processing Status ===${colors.reset}`);
  
  try {
    // Check if data has been processed to final tables
    const { data: whoopProcessed, error: whoopError } = await supabase
      .from('whoop_data')
      .select('date, user_id')
      .order('date', { ascending: false })
      .limit(5);

    if (whoopError) throw whoopError;

    const { data: ouraProcessed, error: ouraError } = await supabase
      .from('oura_data')
      .select('date, user_id')
      .order('date', { ascending: false })
      .limit(5);

    if (ouraError) throw ouraError;

    if (whoopProcessed && whoopProcessed.length > 0) {
      console.log(`\n${colors.green}Whoop Processing:${colors.reset}`);
      whoopProcessed.forEach(record => {
        console.log(`  • ${record.date} for user ${record.user_id.substring(0, 8)}...`);
      });
    } else {
      console.log(`${colors.yellow}No processed Whoop data found${colors.reset}`);
    }

    if (ouraProcessed && ouraProcessed.length > 0) {
      console.log(`\n${colors.green}Oura Processing:${colors.reset}`);
      ouraProcessed.forEach(record => {
        console.log(`  • ${record.date} for user ${record.user_id.substring(0, 8)}...`);
      });
    } else {
      console.log(`${colors.yellow}No processed Oura data found${colors.reset}`);
    }

  } catch (error) {
    console.error(`${colors.red}Error checking processing:${colors.reset}`, error.message);
  }
}

// Main execution
async function main() {
  const userId = process.argv[2]; // Optional user ID parameter
  
  console.clear();
  console.log(`${colors.bright}Data Sync Verification Tool${colors.reset}`);
  console.log('Usage: node verify-sync.js [userId]');
  
  await verifySyncData(userId);
  await checkProcessingStatus();
  
  console.log(`\n${colors.cyan}Verification complete${colors.reset}`);
}

main().catch(console.error);