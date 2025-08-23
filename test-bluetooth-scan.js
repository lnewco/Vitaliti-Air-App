#!/usr/bin/env node

/**
 * Test script to verify Bluetooth scanning is working correctly
 * Run with: node test-bluetooth-scan.js
 */

console.log('==========================================');
console.log('Wellue/Checkme O2 Bluetooth Scanner Test');
console.log('==========================================\n');

console.log('Expected device name patterns:');
console.log('- "Checkme O2 xxxx" (where xxxx is last 4 digits of serial)');
console.log('- Any device containing: checkme, wellue, o2ring, viatom, oximeter, spo2\n');

console.log('Service UUID to look for:');
console.log('- 14839ac4-7d7e-415c-9a42-167340cf2339\n');

console.log('To test scanning in the app:');
console.log('1. Make sure your Wellue O2 ring is powered on');
console.log('2. Open the app and go to the Bluetooth settings');
console.log('3. Tap "Scan for Devices"');
console.log('4. Check the console logs for discovered devices');
console.log('5. Look for devices matching the patterns above\n');

console.log('Debug tips:');
console.log('- All discovered devices will be logged with "🔍 DEVICE DISCOVERED"');
console.log('- Matching devices will show "✅ WELLUE/CHECKME O2 DEVICE FOUND"');
console.log('- Non-matching devices will show "❌ Non-matching device"');
console.log('- The device name used for matching will be shown in quotes\n');

console.log('If your device is not appearing:');
console.log('1. Check that Bluetooth is enabled on your phone');
console.log('2. Make sure the Wellue device is in pairing mode');
console.log('3. Try turning the Wellue device off and on again');
console.log('4. Check if the device appears in your phone\'s Bluetooth settings');
console.log('5. Look at ALL logged devices to see if it has a different name\n');

console.log('==========================================');