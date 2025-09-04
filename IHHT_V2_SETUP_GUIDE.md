# IHHT v2 Complete Setup & Testing Guide

## 🔧 Part 1: Supabase Configuration

### Step 1: Verify Tables Creation
Run this query in your IHHT v2 branch SQL editor to verify all tables exist:

```sql
SELECT table_name, 
       (SELECT COUNT(*) FROM information_schema.columns 
        WHERE columns.table_name = tables.table_name) as column_count
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'sessions', 'readings', 'altitude_levels', 'user_hypoxia_experience',
  'phase_metrics', 'mask_lift_events', 'dial_adjustments', 
  'intrasession_surveys', 'session_instructions', 'surveys',
  'customer_integrations', 'whoop_data', 'oura_data'
)
ORDER BY table_name;
```

Expected result: 13 tables should be listed.

### Step 2: Enable Realtime
In Supabase Dashboard (IHHT v2 branch):

1. Go to **Database → Replication**
2. Enable replication for these tables:
   - `sessions`
   - `readings`
   - `phase_metrics`
   - `mask_lift_events`

### Step 3: Configure Authentication
In **Authentication → Settings**:

```
Site URL: http://localhost:3000
Redirect URLs:
- com.vitaliti.air://
- http://localhost:3000/**
- exp://localhost:19000

Email Auth:
✅ Enable Email/Password
✅ Enable Email OTP
OTP Expiry: 3600
```

### Step 4: Storage Buckets (if needed)
Run in SQL editor:

```sql
INSERT INTO storage.buckets (id, name, public) VALUES 
  ('session-exports', 'session-exports', false)
ON CONFLICT DO NOTHING;
```

## 🧪 Part 2: Integration Testing

### Test 1: Database Connectivity
Run this Node.js script to test connection:

```javascript
// test-connection.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pkabhnqarbmzfkcvnbud.supabase.co';
const supabaseKey = 'YOUR_ANON_KEY';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  console.log('Testing IHHT v2 Branch Connection...\n');
  
  // Test 1: Altitude Levels
  const { data: altitudes, error: altError } = await supabase
    .from('altitude_levels')
    .select('*')
    .order('dial_position');
  
  if (altError) {
    console.error('❌ Error:', altError);
  } else {
    console.log('✅ Found', altitudes.length, 'altitude levels');
    console.log('Sample:', altitudes[6]);
  }
  
  // Test 2: Create Test Session
  const testSession = {
    session_id: `TEST_${Date.now()}`,
    session_type: 'IHHT_TEST',
    starting_dial_position: 6,
  };
  
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .insert(testSession)
    .select()
    .single();
  
  if (session) {
    console.log('\n✅ Test session created:', session.id);
    
    // Clean up
    await supabase.from('sessions').delete().eq('id', session.id);
    console.log('🧹 Cleaned up test session');
  } else {
    console.error('❌ Session error:', sessionError);
  }
}

testConnection();
```

### Test 2: Authentication Flow
Test user creation and authentication:

```javascript
async function testAuth() {
  // Sign up test user
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: 'test@ihhtv2.com',
    password: 'TestPassword123!',
  });
  
  if (signUpData?.user) {
    console.log('✅ User created:', signUpData.user.id);
    
    // Test user experience creation
    const { error: expError } = await supabase
      .from('user_hypoxia_experience')
      .insert({
        user_id: signUpData.user.id,
        has_prior_experience: false,
        initial_dial_position: 6,
        sessions_completed: 0,
      });
    
    console.log(expError ? '❌ Experience error' : '✅ User experience created');
  }
}
```

### Test 3: Session Flow Simulation
Complete session flow test:

```javascript
async function testSessionFlow() {
  const userId = 'YOUR_TEST_USER_ID';
  const sessionId = `IHHT_TEST_${Date.now()}`;
  
  console.log('Starting Session Flow Test...\n');
  
  // 1. Create Session
  const { data: session } = await supabase
    .from('sessions')
    .insert({
      user_id: userId,
      session_id: sessionId,
      session_type: 'IHHT',
      starting_dial_position: 6,
    })
    .select()
    .single();
  
  console.log('✅ Session created:', session.id);
  
  // 2. Simulate Readings
  for (let i = 0; i < 5; i++) {
    await supabase.from('readings').insert({
      session_id: session.id,
      spo2: 85 + Math.random() * 10,
      heart_rate: 70 + Math.random() * 20,
    });
  }
  console.log('✅ Readings inserted');
  
  // 3. Add Phase Metrics
  await supabase.from('phase_metrics').insert({
    session_id: session.id,
    cycle_number: 1,
    phase_type: 'altitude',
    dial_position: 6,
    start_time: new Date(),
    end_time: new Date(Date.now() + 420000),
    duration_seconds: 420,
    avg_spo2: 87,
    min_spo2: 83,
    avg_heart_rate: 75,
    mask_lift_count: 2,
  });
  console.log('✅ Phase metrics added');
  
  // 4. Add Mask Lift Event
  await supabase.from('mask_lift_events').insert({
    session_id: session.id,
    cycle_number: 1,
    phase_type: 'altitude',
    timestamp: new Date(),
    spo2_at_lift: 82,
    heart_rate_at_lift: 78,
    lift_type: '1_breath',
  });
  console.log('✅ Mask lift recorded');
  
  // 5. Complete Session
  await supabase
    .from('sessions')
    .update({
      ended_at: new Date(),
      ending_dial_position: 7,
      total_mask_lifts: 2,
    })
    .eq('id', session.id);
  
  console.log('✅ Session completed');
  console.log('\n✨ Session flow test successful!');
}
```

## 📱 Part 3: Mobile App Testing

### Step 1: Update Environment Variables
In `Vitaliti-Air-App/.env.ihht-v2`:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://pkabhnqarbmzfkcvnbud.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR_ACTUAL_ANON_KEY
EXPO_PUBLIC_BRANCH=ihht-v2
```

### Step 2: Run the App
```bash
cd Vitaliti-Air-App
npm install
npx expo start
```

### Step 3: Test Checklist
- [ ] Launch app and navigate to IHHT setup
- [ ] Complete hypoxia experience assessment
- [ ] Verify dial position recommendation (6 or 7)
- [ ] Complete 4-step setup flow
- [ ] Start training session
- [ ] Verify diamond UI displays correctly
- [ ] Test in demo mode (without pulse ox)
- [ ] Trigger mask lift (simulate low SpO2)
- [ ] Complete one cycle
- [ ] Verify dial adjustment prompt
- [ ] Check intrasession survey appears
- [ ] End session and verify data saved

## 📊 Part 4: Analytics Dashboard Testing

### Step 1: Update Environment Variables
In `Vitaliti-Air-Analytics/.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://pkabhnqarbmzfkcvnbud.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ACTUAL_ANON_KEY
```

### Step 2: Run the Dashboard
```bash
cd Vitaliti-Air-Analytics
npm install
npm run dev
```

### Step 3: Test Checklist
- [ ] Navigate to http://localhost:3000/ihht
- [ ] Verify SessionMonitor shows active sessions
- [ ] Check DialProgressionChart loads user data
- [ ] Verify SpO2HeatMap displays correctly
- [ ] Check MLReadinessIndicator calculations
- [ ] Test user selector dropdown
- [ ] Verify real-time updates work

## 🔐 Part 5: Security & RLS Testing

### Test RLS Policies
```sql
-- Test as authenticated user
SET LOCAL role TO authenticated;
SET LOCAL auth.uid TO 'test-user-id';

-- Should only see own sessions
SELECT * FROM sessions;

-- Should not be able to see other users' data
SELECT * FROM sessions WHERE user_id = 'other-user-id';
```

## 🚨 Part 6: Safety Features Testing

### Emergency Protocol Test
1. Start a session in the app
2. Use developer tools to set SpO2 to 74
3. Verify emergency overlay appears
4. Verify vibration alert triggers
5. Test "I'm OK" continuation
6. Test emergency session end

### Mask Lift Test
1. Set SpO2 to 82 (should trigger 1 breath)
2. Verify instruction appears
3. Set SpO2 to 79 (should trigger 2 breaths)
4. Verify correct instruction
5. Check mask lift is logged in database

## 📋 Final Deployment Checklist

### Pre-Deployment
- [ ] All tables created and verified
- [ ] RLS policies enabled
- [ ] Realtime subscriptions configured
- [ ] Authentication settings complete
- [ ] Environment variables set correctly

### Testing Complete
- [ ] Database connectivity confirmed
- [ ] Session flow works end-to-end
- [ ] Mobile app functions correctly
- [ ] Analytics dashboard displays data
- [ ] Safety features trigger properly
- [ ] Data syncs between app and dashboard

### Ready for Production
- [ ] Remove test data
- [ ] Update to production Supabase URLs
- [ ] Enable additional security measures
- [ ] Set up monitoring/alerts
- [ ] Document any custom configurations

## 🎯 Quick Test Commands

```bash
# Test database connection
node test-connection.js

# Run mobile app
cd Vitaliti-Air-App && npx expo start

# Run analytics dashboard  
cd Vitaliti-Air-Analytics && npm run dev

# Test with demo data
node src/utils/testIHHTSetup.js
```

## ⚠️ Common Issues & Solutions

### Issue: Tables not found
**Solution:** Re-run the complete schema SQL from ihht_v2_complete_schema.sql

### Issue: Authentication not working
**Solution:** Check Supabase Auth settings and ensure email provider is enabled

### Issue: Real-time not updating
**Solution:** Enable replication for required tables in Supabase dashboard

### Issue: RLS blocking access
**Solution:** Verify user is authenticated and RLS policies are correct

### Issue: App can't connect to branch
**Solution:** Verify branch URL and anon key in environment variables