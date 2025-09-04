# Vitaliti Air Integration Status & Implementation Guide

## Last Verified: December 4, 2024

## System Overview

The Vitaliti Air ecosystem consists of three interconnected components that work together to deliver IHHT training with comprehensive health monitoring:

1. **Mobile App** (React Native/Expo) - Training delivery and user interface
2. **Analytics Dashboard** (Next.js) - Data processing and team analytics
3. **Supabase Backend** - Shared database and authentication

This document provides the **accurate, verified status** of all integrations and features across the system.

## IHHT v2 Implementation Status (VERIFIED)

### ✅ COMPLETED Features

#### Mobile App - Fully Implemented

**Diamond UI Interface** ✅
- Location: `src/screens/IHHTSessionSimple.js`
- Real-time display with 4-point diamond layout:
  - Top: SpO2 value
  - Left: Altitude (feet/meters)
  - Right: Heart rate (BPM)
  - Bottom: Status (Adapting/Stressing)

**EKG Wave Visualization** ✅
- Heart rate-synced animation with trail effect
- Color coding: Green (safe) → Yellow (caution) → Red (alert)
- Smooth 60 FPS rendering

**Altitude Control System** ✅
- 12-level dial mapping (0-11) implemented
- FiO2 percentages mapped to altitude
- Visual mountain representation
- Conversion table in `ALTITUDE_CONVERSION` constant

**Safety Thresholds** ✅
- Emergency: SpO2 < 75% (full alert)
- Double breath: SpO2 < 80%
- Single breath: SpO2 < 83%
- Automatic alerts and vibration

**Feedback System** ✅
- `IntraSessionFeedback.js` - Mid-session surveys
- `FeedbackButton.js` - Quick feedback collection
- 1-10 scale ratings for:
  - Feeling
  - Breathlessness
  - Clarity
  - Energy

#### Wearables Integration - Fully Working

**WHOOP Integration** ✅
- OAuth 2.0 authentication working
- Token refresh IMPLEMENTED and working
- Fetches: Recovery, Strain, Sleep data
- 50-day historical on first connect
- 14-day rolling window on subsequent syncs

**Oura Integration** ✅
- OAuth 2.0 authentication working
- Token refresh IMPLEMENTED (not fully tested)
- Fetches: Readiness, Activity, Sleep data
- Similar sync windows as WHOOP

**Sync Mechanism** ✅
- **NOT using CRON** - No background scheduling
- Triggers on:
  - App open (dashboard mount)
  - App foreground (returning from background)
  - Manual refresh (pull-to-refresh)
  - Post-OAuth connection
- API endpoint: `POST /api/sync/manual`
- 60-second timeout for sync operations

#### Database Schema - Current State

**Existing Tables** ✅
```sql
-- Core tables (verified to exist)
sessions           -- Training sessions
readings           -- SpO2/HR time series
user_profiles      -- User data + OAuth tokens
survey_responses   -- Pre/post session surveys

-- Wearables tables (verified to exist)
health_metrics     -- Combined raw data
whoop_data        -- Processed WHOOP metrics
oura_data         -- Processed Oura metrics
customer_integrations -- Integration status
sync_history      -- Sync audit log

-- OAuth stored in user_profiles (not separate table)
whoop_access_token, whoop_refresh_token, whoop_token_expires_at
oura_access_token, oura_refresh_token, oura_token_expires_at
```

### 🚧 PARTIALLY Implemented

#### Session Data Upload
- **Working**: Batch upload of readings after session
- **Not Real-time**: No streaming during session
- **Delay**: Data arrives in chunks, not continuously
- **Location**: `SupabaseService.addReadingsBatch()`

#### Intrasession Feedback
- **UI Implemented**: Modal and survey components exist
- **Data Collection**: Works locally during session
- **NOT Persisted**: No database table for intrasession surveys
- **Missing Link**: Hypoxic phase context not preserved

### ❌ NOT Implemented

#### Progressive Overload Logic ❌
**Verification**: Searched entire codebase
- No `calculateDialPosition()` function
- No session history analysis for dial adjustment
- Hardcoded `defaultAltitudeLevel: 6` in `SimplifiedSessionSetup.js`
- No user progression tracking
- No automatic dial recommendations between sessions

#### IHHT v2 Database Tables ❌
**Not Created** (verified in migrations folder):
- `altitude_levels` - Does not exist
- `user_hypoxia_experience` - Does not exist
- `mask_lift_events` - Does not exist  
- `dial_adjustments` - Does not exist
- `phase_metrics` - Does not exist
- `intrasession_surveys` - Does not exist

#### Phase-Specific Metrics ❌
- Collecting in memory only
- No persistence to database
- No phase duration tracking
- No mask lift event recording
- No dial adjustment history

#### Real-time Session Streaming ❌
- No WebSocket implementation
- No live data feed to analytics
- Batch upload only (post-phase or post-session)
- Analytics sees data after delay

#### ML Data Pipeline ❌
- No feature extraction
- No pattern recognition
- No predictive modeling
- Raw data not structured for ML

#### Background Token Refresh ❌
**Critical Issue**: OAuth tokens expire without app usage
- Manual refresh works when app opened
- No background service to maintain tokens
- Users must re-authenticate after ~30 days inactive
- Impacts both WHOOP and Oura

## Integration Points - Detailed Status

### Mobile App ↔ Supabase ✅ WORKING

**What Works**:
```javascript
// Session creation
await supabase.from('sessions').insert({
  user_id, started_at, status: 'active'
})

// Batch reading upload (not real-time)
await supabase.from('readings').insert(readingsBatch)

// Survey responses
await supabase.from('survey_responses').insert(surveyData)

// OAuth token storage (in user_profiles)
await supabase.from('user_profiles').update({
  whoop_access_token, whoop_refresh_token, whoop_token_expires_at
})
```

**What's Missing**:
- Phase-specific metrics tables
- Intrasession survey storage
- Real-time streaming
- Progressive overload data

### Mobile App ↔ Analytics API ✅ WORKING

**Sync Trigger Flow**:
```javascript
// Mobile App (PremiumDashboard.js)
const triggerWearablesSync = async () => {
  const response = await fetch(
    'https://vitaliti-air-analytics.onrender.com/api/sync/manual',
    {
      method: 'POST',
      body: JSON.stringify({
        userId: user.id,
        vendor: 'all'
      })
    }
  )
}

// Analytics processes and stores in database
// Mobile app then fetches from database tables
```

### Analytics ↔ Wearables APIs ✅ WORKING

**WHOOP Data Flow**:
1. Get tokens from `user_profiles`
2. Check expiry, refresh if needed ✅
3. Fetch with pagination (50 records/call)
4. Transform raw → structured
5. Store in `whoop_data` table
6. Update `whoop_last_synced`

**Data Transformation Example**:
```javascript
// Raw from WHOOP
{
  "score": {
    "recovery_score": 67,
    "hrv_rmssd_milli": 45.2
  }
}

// Transformed in whoop_data
{
  recovery_score: 67,
  hrv_rmssd: 45.2,
  user_id: "uuid",
  date: "2024-09-04"
}
```

## Critical Issues & Workarounds

### Issue 1: No Progressive Overload
**Impact**: Users stay at same difficulty
**Current**: Fixed dial position 6
**Workaround**: Manual adjustment by user
**Fix Required**: Implement progression algorithm

### Issue 2: OAuth Token Expiration
**Impact**: Re-authentication needed after inactivity
**Current**: Tokens expire in ~30 days
**Workaround**: Re-connect when prompted
**Fix Required**: Background refresh service

### Issue 3: No Phase Metrics Persistence
**Impact**: Can't analyze performance by phase
**Current**: Data lost after session
**Workaround**: None
**Fix Required**: Create tables and storage logic

### Issue 4: No Real-time Monitoring
**Impact**: Can't watch sessions live
**Current**: Data arrives in batches
**Workaround**: Wait for session completion
**Fix Required**: WebSocket implementation

## Implementation Priorities

### Week 1: Database Foundation 🚨 CRITICAL
```sql
-- Must create these tables first
CREATE TABLE altitude_levels (
  dial_position INTEGER PRIMARY KEY,
  fio2_percentage DECIMAL(4,1),
  altitude_feet INTEGER,
  altitude_meters INTEGER
);

CREATE TABLE phase_metrics (
  id UUID PRIMARY KEY,
  session_id UUID REFERENCES sessions(id),
  cycle_number INTEGER,
  phase_type TEXT,
  dial_position INTEGER,
  avg_spo2 INTEGER,
  min_spo2 INTEGER,
  mask_lift_count INTEGER
);

CREATE TABLE user_hypoxia_experience (
  user_id UUID PRIMARY KEY,
  sessions_completed INTEGER,
  current_dial_position INTEGER,
  last_session_date TIMESTAMPTZ
);
```

### Week 2: Progressive Overload
```javascript
// Must implement in SimplifiedSessionSetup.js
const calculateDialPosition = async (userId) => {
  // Get user history
  const sessions = await DatabaseService.getUserSessions(userId)
  const lastSession = sessions[0]
  
  if (!lastSession) return 6 // Default for new users
  
  // Analyze performance
  const { avg_spo2, mask_lifts } = lastSession
  
  // Adjust based on performance
  if (avg_spo2 > 90 && mask_lifts < 2) {
    return Math.min(lastSession.dial + 1, 11)
  } else if (avg_spo2 < 80 || mask_lifts > 3) {
    return Math.max(lastSession.dial - 1, 0)
  }
  
  return lastSession.dial
}
```

### Week 3: Phase Metrics Storage
```javascript
// In EnhancedSessionManager.js
const savePhaseMetrics = async (phase) => {
  await supabase.from('phase_metrics').insert({
    session_id: this.sessionId,
    cycle_number: phase.cycle,
    phase_type: phase.type,
    dial_position: phase.dial,
    avg_spo2: phase.avgSpO2,
    min_spo2: phase.minSpO2,
    mask_lift_count: phase.maskLifts
  })
}
```

### Week 4: Background Token Refresh
- Option 1: Render Cron Job (when available)
- Option 2: AWS Lambda with EventBridge
- Option 3: Supabase Edge Function

## Testing Checklist

### Mobile App Tests
- [x] Diamond UI displays correctly
- [x] EKG animation syncs with HR
- [x] Safety alerts trigger at thresholds
- [x] Feedback modals work
- [ ] Progressive overload calculates correctly
- [ ] Phase metrics save to database
- [ ] Intrasession surveys persist

### Analytics Tests
- [x] Manual sync triggers work
- [x] WHOOP data fetches correctly
- [x] Oura data fetches correctly
- [x] Token refresh works (WHOOP)
- [ ] Token refresh works (Oura)
- [ ] Real-time session monitoring
- [ ] Phase-specific visualizations

### Integration Tests
- [x] App → Analytics API communication
- [x] Analytics → Supabase storage
- [x] App → Supabase data retrieval
- [ ] Real-time WebSocket streams
- [ ] Background token refresh
- [ ] ML pipeline data flow

## Configuration Files

### Mobile App Environment
```javascript
// src/config/supabase.js
const supabaseUrl = 'https://yhbywcawiothhoqaurgy.supabase.co'
const supabaseAnonKey = '[anon_key]'
```

### Analytics Environment
```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://yhbywcawiothhoqaurgy.supabase.co
SUPABASE_SERVICE_ROLE_KEY=[service_key]
WHOOP_CLIENT_ID=[client_id]
WHOOP_CLIENT_SECRET=[secret]
OURA_CLIENT_ID=[client_id]
OURA_CLIENT_SECRET=[secret]
```

## Migration Commands

### To Complete IHHT v2
```bash
# 1. Create migration files
cd supabase/migrations
touch 20240904_ihht_v2_tables.sql

# 2. Run migrations
supabase db push

# 3. Verify tables
supabase db dump | grep "CREATE TABLE"

# 4. Update RLS policies
supabase db reset --preserve-data
```

## API Documentation

### Mobile App Endpoints Used

#### Trigger Sync
```http
POST https://vitaliti-air-analytics.onrender.com/api/sync/manual
Content-Type: application/json

{
  "userId": "uuid",
  "vendor": "all"
}
```

#### Response
```json
{
  "success": true,
  "message": "Sync completed",
  "details": {
    "whoop": { "recordsCount": 45 },
    "oura": { "recordsCount": 30 }
  }
}
```

## Contact & Resources

- **Mobile App Repo**: Main branch (integration-branch for dev)
- **Analytics Repo**: ihht-v2 branch
- **Supabase Project**: yhbywcawiothhoqaurgy
- **Analytics URL**: https://vitaliti-air-analytics.onrender.com
- **Linear**: Configured for task creation

## Summary of Truth vs Fiction

### What Documentation Claims ❌ → Verified Reality ✅

1. **"Progressive overload implemented"** ❌
   - Reality: NO progression system exists at all
   - Hardcoded dial position 6 for everyone
   - No `AltitudeProgressionService.js` file

2. **"IHHT Progressive Overload (Aug 31)"** ❌
   - Reality: Never implemented
   - Gap analysis document was aspirational, not factual

3. **"CRON jobs for sync"** ❌
   - Reality: Manual triggers only
   - No background scheduling

4. **"Phase metrics persisted"** ❌
   - Reality: Collected in memory, not saved
   - No database tables for phase data

5. **"Real-time streaming"** ❌
   - Reality: Batch upload only
   - No WebSocket implementation

6. **"IHHT v2 tables migrated"** ❌
   - Reality: Tables don't exist in migrations
   - Only OAuth and survey tables created

7. **"Background token refresh"** ❌
   - Reality: Manual refresh only when app opened
   - Tokens expire after ~30 days inactive

8. **"Detraining detection"** ❌
   - Reality: No such feature exists
   - No session history analysis

### What Actually Works ✅

1. **Diamond UI** - Fully implemented
2. **Wearables sync** - Working with manual triggers
3. **Token refresh** - Works for WHOOP when triggered
4. **Data transformation** - Correctly processes wearables data
5. **Safety thresholds** - Properly implemented
6. **Feedback UI** - Components work (but don't persist)

This document represents the **verified, accurate state** of the Vitaliti Air system as of December 2024.