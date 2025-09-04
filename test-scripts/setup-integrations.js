#!/usr/bin/env node

/**
 * Integration Setup Helper Script
 * This script helps you configure the Whoop and Oura integrations
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (prompt) => new Promise((resolve) => rl.question(prompt, resolve));

async function setupIntegrations() {
  console.log('\n🔧 Vitaliti Air - Wearables Integration Setup\n');
  console.log('This script will help you configure your Whoop and Oura integrations.\n');
  
  // Check if .env.local exists
  const envPath = path.join(__dirname, '.env.local');
  let envContent = '';
  
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
    console.log('✅ Found existing .env.local file\n');
  } else {
    console.log('📝 Creating new .env.local file\n');
  }
  
  console.log('Please enter your API credentials (or press Enter to skip):\n');
  
  // Collect credentials
  const whoopClientId = await question('Whoop Client ID: ');
  const whoopClientSecret = await question('Whoop Client Secret: ');
  const ouraClientId = await question('Oura Client ID: ');
  const ouraClientSecret = await question('Oura Client Secret: ');
  
  // Update or create .env.local content
  const updatedEnv = `# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=https://ptkdctnbtfojabdqvqkn.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0a2RjdG5idGZvamFiZHF2cWtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjUxODk5OTMsImV4cCI6MjA0MDc2NTk5M30.HgwqhCBQlGQk4HEHXiP25qm_JV7zOdOqvH7KkGMzEDE

# Whoop API Configuration
EXPO_PUBLIC_WHOOP_CLIENT_ID=${whoopClientId || 'your_whoop_client_id_here'}
EXPO_PUBLIC_WHOOP_CLIENT_SECRET=${whoopClientSecret || 'your_whoop_client_secret_here'}

# Oura API Configuration  
EXPO_PUBLIC_OURA_CLIENT_ID=${ouraClientId || 'your_oura_client_id_here'}
EXPO_PUBLIC_OURA_CLIENT_SECRET=${ouraClientSecret || 'your_oura_client_secret_here'}

# OAuth Redirect Configuration
EXPO_PUBLIC_APP_SCHEME=vitalitiair
EXPO_PUBLIC_REDIRECT_BASE_URL=vitalitiair://integrations
`;
  
  // Write the file
  fs.writeFileSync(envPath, updatedEnv);
  console.log('\n✅ Environment configuration updated!\n');
  
  // Show summary
  console.log('📋 Configuration Summary:');
  console.log('------------------------');
  if (whoopClientId && whoopClientSecret) {
    console.log('✅ Whoop: Configured');
  } else {
    console.log('⚠️  Whoop: Not configured (using placeholders)');
  }
  
  if (ouraClientId && ouraClientSecret) {
    console.log('✅ Oura: Configured');
  } else {
    console.log('⚠️  Oura: Not configured (using placeholders)');
  }
  
  console.log('\n📱 Next Steps:');
  console.log('1. Stop the Metro bundler (Ctrl+C in the terminal running it)');
  console.log('2. Clear Metro cache: npx expo start -c');
  console.log('3. Restart the app: npx expo start');
  console.log('4. Navigate to Profile → Manage Integrations in the app');
  console.log('5. Connect your wearables and sync data\n');
  
  rl.close();
}

// Run the setup
setupIntegrations().catch(console.error);