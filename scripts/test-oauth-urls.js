#!/usr/bin/env node

/**
 * Test OAuth URL Generation
 * Diagnose what URLs are being generated for OAuth
 */

require('dotenv').config({ path: '.env.local' });

// Mock the environment for testing
process.env.EXPO_PUBLIC_WHOOP_CLIENT_ID = process.env.EXPO_PUBLIC_WHOOP_CLIENT_ID || 'ef01edf8-b61c-4cac-99a0-d0825098dace';
process.env.EXPO_PUBLIC_WHOOP_CLIENT_SECRET = process.env.EXPO_PUBLIC_WHOOP_CLIENT_SECRET || '1529284de2cde1574018824932aeec53222eee78487bd3ea63f87ae44d716aeb';
process.env.EXPO_PUBLIC_OURA_CLIENT_ID = process.env.EXPO_PUBLIC_OURA_CLIENT_ID || 'your-oura-client-id';
process.env.EXPO_PUBLIC_OURA_CLIENT_SECRET = process.env.EXPO_PUBLIC_OURA_CLIENT_SECRET || 'your-oura-client-secret';

console.log('🧪 Testing OAuth URL Generation\n');
console.log('=' .repeat(50));

// Test Whoop URL generation
console.log('\n📱 WHOOP OAuth URL:\n');

const whoopAuthUrl = 'https://api.prod.whoop.com/oauth/oauth2/authorize';
const whoopClientId = process.env.EXPO_PUBLIC_WHOOP_CLIENT_ID;
const whoopRedirectUri = 'vitalitiair://whoop-callback';
const whoopScope = 'read:recovery read:cycles read:sleep read:workout read:profile offline';
const whoopState = 'test_user_123_timestamp_abc123';

// Method 1: URLSearchParams (what was causing the problem)
const whoopParams1 = new URLSearchParams({
  response_type: 'code',
  client_id: whoopClientId,
  redirect_uri: whoopRedirectUri,
  scope: whoopScope,
  state: whoopState
});

console.log('❌ Using URLSearchParams (WRONG):');
console.log(`${whoopAuthUrl}?${whoopParams1.toString()}`);
console.log('\nNotice redirect_uri is encoded: redirect_uri=vitalitiair%3A%2F%2Fwhoop-callback\n');

// Method 2: Manual construction (the fix)
const whoopParams2 = {
  response_type: 'code',
  client_id: whoopClientId,
  redirect_uri: whoopRedirectUri,
  scope: whoopScope,
  state: whoopState
};

const whoopQueryString = Object.entries(whoopParams2)
  .map(([key, value]) => {
    if (key === 'redirect_uri') {
      return `${key}=${value}`;
    }
    return `${key}=${encodeURIComponent(value)}`;
  })
  .join('&');

console.log('✅ Using manual construction (CORRECT):');
console.log(`${whoopAuthUrl}?${whoopQueryString}`);
console.log('\nNotice redirect_uri is NOT encoded: redirect_uri=vitalitiair://whoop-callback\n');

// Test Oura URL generation
console.log('=' .repeat(50));
console.log('\n💍 OURA OAuth URL:\n');

const ouraAuthUrl = 'https://cloud.ouraring.com/oauth/authorize';
const ouraClientId = process.env.EXPO_PUBLIC_OURA_CLIENT_ID;
const ouraRedirectUri = 'vitalitiair://oura-callback';
const ouraScope = 'daily readiness sleep activity';
const ouraState = 'test_user_123_timestamp_xyz789';

const ouraParams = {
  response_type: 'code',
  client_id: ouraClientId,
  redirect_uri: ouraRedirectUri,
  scope: ouraScope,
  state: ouraState
};

const ouraQueryString = Object.entries(ouraParams)
  .map(([key, value]) => {
    if (key === 'redirect_uri') {
      return `${key}=${value}`;
    }
    return `${key}=${encodeURIComponent(value)}`;
  })
  .join('&');

console.log('✅ Using manual construction:');
console.log(`${ouraAuthUrl}?${ouraQueryString}`);

console.log('\n' + '=' .repeat(50));
console.log('\n⚠️  IMPORTANT: The redirect_uri MUST be registered in your OAuth app settings!');
console.log('   Whoop: vitalitiair://whoop-callback');
console.log('   Oura:  vitalitiair://oura-callback');
console.log('\n' + '=' .repeat(50));