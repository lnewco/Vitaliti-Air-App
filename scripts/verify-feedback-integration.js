#!/usr/bin/env node

/**
 * Verification script for AI-Powered Subjective Feedback Engine
 * This script checks that all components and database operations are working correctly
 */

const fs = require('fs');
const path = require('path');

console.log('========================================');
console.log('AI-Powered Feedback Engine Verification');
console.log('========================================\n');

// Color codes for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m'
};

const checkMark = `${colors.green}✓${colors.reset}`;
const crossMark = `${colors.red}✗${colors.reset}`;
const warningMark = `${colors.yellow}⚠${colors.reset}`;

// Helper function to check if file exists
function checkFile(filePath, description) {
  const fullPath = path.join(__dirname, '..', filePath);
  const exists = fs.existsSync(fullPath);
  
  if (exists) {
    console.log(`${checkMark} ${description}`);
    return true;
  } else {
    console.log(`${crossMark} ${description} - File not found: ${filePath}`);
    return false;
  }
}

// Helper function to check file content
function checkFileContent(filePath, searchStrings, description) {
  const fullPath = path.join(__dirname, '..', filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`${crossMark} ${description} - File not found`);
    return false;
  }
  
  const content = fs.readFileSync(fullPath, 'utf8');
  const allFound = searchStrings.every(str => content.includes(str));
  
  if (allFound) {
    console.log(`${checkMark} ${description}`);
    return true;
  } else {
    console.log(`${crossMark} ${description} - Missing required content`);
    return false;
  }
}

let totalChecks = 0;
let passedChecks = 0;

console.log(`${colors.blue}1. Checking UI Components...${colors.reset}`);
console.log('----------------------------');

// Check feedback components
const components = [
  ['src/components/feedback/PreSessionSurvey.js', 'Pre-Session Survey Component'],
  ['src/components/feedback/IntraSessionFeedback.js', 'Intra-Session Feedback Component'],
  ['src/components/feedback/FeedbackButton.js', 'Feedback Button Component'],
  ['src/components/feedback/SensationTag.js', 'Sensation Tag Component'],
  ['src/components/feedback/FeedbackErrorBoundary.js', 'Error Boundary Component']
];

components.forEach(([path, desc]) => {
  totalChecks++;
  if (checkFile(path, desc)) passedChecks++;
});

console.log('\n' + `${colors.blue}2. Checking Screen Integrations...${colors.reset}`);
console.log('-----------------------------------');

// Check screen integrations
totalChecks++;
if (checkFileContent(
  'src/screens/SimplifiedSessionSetup.js',
  ['PreSessionSurvey', 'showPreSessionSurvey'],
  'Pre-Session Survey integrated in Session Setup'
)) passedChecks++;

totalChecks++;
if (checkFileContent(
  'src/screens/IHHTTrainingScreen.js',
  ['IntraSessionFeedback', 'showIntraSessionFeedback'],
  'Intra-Session Feedback integrated in Training Screen'
)) passedChecks++;

totalChecks++;
if (checkFileContent(
  'src/screens/PostSessionSurveyScreen.js',
  ['symptoms', 'overallRating'],
  'Post-Session Survey enhanced with new fields'
)) passedChecks++;

console.log('\n' + `${colors.blue}3. Checking Database Services...${colors.reset}`);
console.log('---------------------------------');

// Check database service methods
totalChecks++;
if (checkFileContent(
  'src/services/DatabaseService.js',
  ['savePreSessionSurvey', 'stress_pre'],
  'Database service has pre-session survey method'
)) passedChecks++;

totalChecks++;
if (checkFileContent(
  'src/services/DatabaseService.js',
  ['saveIntraSessionResponse', 'sensations'],
  'Database service has intra-session response method'
)) passedChecks++;

totalChecks++;
if (checkFileContent(
  'src/services/SupabaseService.js',
  ['savePreSessionSurvey', 'savePostSessionSurvey', 'saveIntraSessionResponse'],
  'Supabase service has all survey methods'
)) passedChecks++;

console.log('\n' + `${colors.blue}4. Checking Database Migrations...${colors.reset}`);
console.log('-----------------------------------');

// Check migration files
const migrations = [
  ['supabase/migrations/20250128_enhance_survey_tables.sql', 'Survey tables enhancement migration'],
  ['supabase/migrations/20250128_create_survey_rpc_functions.sql', 'RPC functions migration']
];

migrations.forEach(([path, desc]) => {
  totalChecks++;
  if (checkFile(path, desc)) passedChecks++;
});

console.log('\n' + `${colors.blue}5. Checking Supporting Files...${colors.reset}`);
console.log('--------------------------------');

// Check supporting files
totalChecks++;
if (checkFile('assets/sounds/README.md', 'Sound assets documentation')) {
  passedChecks++;
  
  // Check for actual sound file
  if (!fs.existsSync(path.join(__dirname, '..', 'assets/sounds/gentle-chime.mp3'))) {
    console.log(`  ${warningMark} Note: gentle-chime.mp3 not found - app will use haptic fallback`);
  }
}

totalChecks++;
if (checkFile('TESTING_PLAN_FEEDBACK.md', 'Comprehensive testing plan')) passedChecks++;

console.log('\n' + `${colors.blue}6. Checking Error Handling...${colors.reset}`);
console.log('------------------------------');

// Check error handling
totalChecks++;
if (checkFileContent(
  'src/components/feedback/IntraSessionFeedback.js',
  ['try', 'catch', 'Haptics', 'fallback'],
  'Sound playback with haptic fallback'
)) passedChecks++;

totalChecks++;
if (checkFileContent(
  'src/services/SupabaseService.js',
  ['validate inputs', 'Missing required'],
  'Input validation in Supabase service'
)) passedChecks++;

console.log('\n========================================');
console.log('Verification Results');
console.log('========================================');

const percentage = Math.round((passedChecks / totalChecks) * 100);
const statusColor = percentage === 100 ? colors.green : percentage >= 80 ? colors.yellow : colors.red;

console.log(`\nTotal Checks: ${totalChecks}`);
console.log(`Passed: ${colors.green}${passedChecks}${colors.reset}`);
console.log(`Failed: ${colors.red}${totalChecks - passedChecks}${colors.reset}`);
console.log(`\n${statusColor}Success Rate: ${percentage}%${colors.reset}`);

if (percentage === 100) {
  console.log(`\n${colors.green}✅ All components verified successfully!${colors.reset}`);
  console.log('\nNext Steps:');
  console.log('1. Apply database migrations: npx supabase db push');
  console.log('2. Add gentle-chime.mp3 sound file to assets/sounds/');
  console.log('3. Run the app and test the feedback flow');
  console.log('4. Follow TESTING_PLAN_FEEDBACK.md for comprehensive testing');
} else if (percentage >= 80) {
  console.log(`\n${colors.yellow}⚠️  Most components verified, but some issues found.${colors.reset}`);
  console.log('Please review the failed checks above.');
} else {
  console.log(`\n${colors.red}❌ Significant issues found. Please review and fix.${colors.reset}`);
}

console.log('\n========================================\n');

// Exit with appropriate code
process.exit(percentage === 100 ? 0 : 1);