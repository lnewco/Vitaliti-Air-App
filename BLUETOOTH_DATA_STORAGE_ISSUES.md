# Bluetooth Data Storage Critical Issues Report
**Date: September 5, 2025**  
**Author: Investigation conducted for Danyal Panjwani**  
**Severity: CRITICAL - Production Blocker**

## Executive Summary
The Vitaliti Air IHHT training app is experiencing critical data storage failures where Bluetooth pulse oximeter data is successfully streaming to the mobile app but **failing to persist to the Supabase database**. This affects all real-world usage with actual hardware devices in EAS builds.

## Current System Architecture

### Data Flow Overview
1. **Bluetooth Connection**: Wellue pulse oximeter connects via BLE (BluetoothService.js)
2. **Data Reception**: Real-time SpO2, heart rate, and signal strength received
3. **Session Management**: EnhancedSessionManager buffers readings
4. **Database Storage**: SupabaseService.addReadingsBatch() should save to cloud
5. **Analytics**: Vitaliti-Air-Analytics repository provides dashboards

### Key Components
- **Vitaliti-Air-App**: React Native mobile application
- **BluetoothService.js**: Handles BLE connection and data parsing
- **EnhancedSessionManager.js**: Manages IHHT sessions and reading buffers
- **SupabaseService.js**: Handles all database operations
- **Database**: Supabase PostgreSQL with `sessions` and `readings` tables

## Critical Issues Identified

### Issue #1: Bluetooth Readings Not Being Stored
**Severity**: CRITICAL  
**Impact**: All real device testing data is lost

#### Evidence
On September 4, 2025, user "Test App" (Steven) conducted IHHT sessions with real Bluetooth hardware:
- Session `93be334b-6a81-4e51-a31b-9eae2636a0ff` at 3:40 PM Pacific
  - Duration: 6 seconds
  - Expected readings: ~6-10
  - **Actual readings stored: 5** ⚠️
  
- Session `2e62ce68-5c23-46a2-b525-da0012fbad26` at 3:38 PM Pacific
  - Duration: 9 seconds
  - Expected readings: ~9-15
  - **Actual readings stored: 8** ⚠️

- Multiple other sessions show **0 readings stored** despite completion status

#### SQL Query to Verify
```sql
-- Check for sessions with missing readings
SELECT 
    s.id as session_id,
    s.device_id,
    s.start_time,
    s.end_time,
    s.status,
    s.total_readings as expected_readings,
    COUNT(r.id) as actual_readings_stored,
    CASE 
        WHEN COUNT(r.id) = 0 AND s.status = 'completed' THEN 'DATA LOSS'
        WHEN COUNT(r.id) < s.total_readings * 0.5 THEN 'PARTIAL LOSS'
        ELSE 'OK'
    END as data_integrity
FROM sessions s
LEFT JOIN readings r ON s.id = r.session_id
WHERE s.start_time >= NOW() - INTERVAL '7 days'
GROUP BY s.id
ORDER BY s.start_time DESC;
```

### Issue #2: Cannot Distinguish Mock vs Real Data
**Severity**: HIGH  
**Impact**: Historical data validity unknown

Currently, there is **no field** in the database to identify whether readings came from:
- Mock data (Expo Go testing)
- Real Bluetooth device (EAS builds)

#### Mock Data Characteristics (MockBLEService.js)
```javascript
// Mock data generation pattern
generateMockData() {
    const time = Date.now() / 1000;
    const waveform = Math.sin(time * 2);
    
    if (this.currentPhase === 'altitude') {
        spo2 = Math.round(this.baseSpO2 - 8 + waveform * 2); // 86-90 range
        heartRate = Math.round(this.baseHR + 15 + waveform * 5); // 87-92 range
    }
    
    // Mock data constraints:
    // - SpO2: Floor at 80, ceiling at 100
    // - Signal strength: Always 95-100
    // - Predictable sinusoidal patterns
}
```

#### Real Data Characteristics
- SpO2 can drop below 80 (seen as low as 66-69)
- Signal strength varies widely (0-132 range)
- Higher variability (stddev > 4)
- More unique values per session

### Issue #3: Session Duplication
**Severity**: MEDIUM  
**Impact**: Database pollution, confusing analytics

Every session attempt creates **two records**:
1. One with status "active" (never completed)
2. One with status "completed" (actual session)

Example from September 4:
- `0649a3f3-8847-4bec-87d5-628111c2be2f` - Status: active, 0 readings
- `93be334b-6a81-4e51-a31b-9eae2636a0ff` - Status: completed, 5 readings
(Both created at exactly 22:40:04 UTC)

### Issue #4: Authentication/User Profile Issues
**Severity**: MEDIUM  
**Impact**: Sessions not properly attributed to users

The user with phone `16504409055` (ID: `99f349da-4bf2-45c3-ba35-881b8e754a64`):
- Has auth.users record ✅
- Has NO user_profiles record ❌
- Shows as NULL name in queries
- May indicate users skipping onboarding

## Root Cause Analysis

### Suspected Primary Cause: Session ID Mapping Failure

The most likely cause is a breakdown in the session ID mapping between local and Supabase IDs:

1. **Local Session Created**: `IHHT_${timestamp}_${random}`
2. **Supabase Session Created**: Returns UUID
3. **Mapping Should Be Stored**: `sessionMapping.set(localId, supabaseId)`
4. **Readings Reference Local ID**: But mapping lookup fails
5. **Result**: Readings can't find Supabase session ID, inserts fail silently

#### Code Location (SupabaseService.js:192-197)
```javascript
// Store the mapping between local and Supabase session IDs
this.sessionMapping.set(sessionData.id, data[0].id);
log.info('✅ Added session mapping:', sessionData.id, '→', data[0].id);

// Persist the mapping to AsyncStorage for recovery after app restart
await this.persistSessionMapping();
```

### Suspected Secondary Cause: Batch Processing Failure

The `addReadingsBatch` function may be failing due to:
1. Invalid session ID references
2. RLS (Row Level Security) policy violations
3. Network timeouts on large batches
4. Silent error handling masking failures

#### Code Location (SupabaseService.js - addReadingsBatch method)
The function queues data for sync but may not be retrying properly.

## Verification Steps for New Claude Instance

To verify these findings, execute the following checks:

### 1. Check Recent Session Data Integrity
```sql
-- Sessions from last 48 hours with reading counts
SELECT 
    DATE(start_time) as date,
    COUNT(DISTINCT s.id) as total_sessions,
    COUNT(DISTINCT CASE WHEN r.id IS NOT NULL THEN s.id END) as sessions_with_readings,
    COUNT(r.id) as total_readings,
    AVG(COUNT(r.id)) OVER (PARTITION BY s.id) as avg_readings_per_session
FROM sessions s
LEFT JOIN readings r ON s.id = r.session_id
WHERE s.start_time >= NOW() - INTERVAL '48 hours'
GROUP BY DATE(start_time), s.id;
```

### 2. Identify Mock vs Real Data Patterns
```sql
-- Analyze data patterns to identify likely mock data
SELECT 
    s.id,
    COUNT(DISTINCT r.spo2) as unique_spo2,
    STDDEV(r.spo2) as spo2_stddev,
    MIN(r.signal_strength) as min_signal,
    MAX(r.signal_strength) as max_signal,
    CASE 
        WHEN MAX(r.signal_strength) > 100 THEN 'REAL'
        WHEN MIN(r.signal_strength) < 90 THEN 'REAL'
        WHEN COUNT(DISTINCT r.spo2) < 5 THEN 'LIKELY_MOCK'
        ELSE 'UNKNOWN'
    END as data_source_guess
FROM sessions s
JOIN readings r ON s.id = r.session_id
GROUP BY s.id
HAVING COUNT(r.id) > 10;
```

### 3. Check for Duplicate Sessions
```sql
-- Find duplicate sessions created at same time
SELECT 
    DATE(start_time) as date,
    EXTRACT(HOUR FROM start_time) as hour,
    EXTRACT(MINUTE FROM start_time) as minute,
    COUNT(*) as duplicate_count,
    STRING_AGG(status, ', ') as statuses,
    STRING_AGG(id::text, ', ') as session_ids
FROM sessions
WHERE start_time >= NOW() - INTERVAL '7 days'
GROUP BY DATE(start_time), EXTRACT(HOUR FROM start_time), EXTRACT(MINUTE FROM start_time)
HAVING COUNT(*) > 1;
```

## Proposed Solutions

### Solution 1: Add Data Source Tracking
```sql
-- Add data_source column to track mock vs real
ALTER TABLE sessions ADD COLUMN data_source TEXT 
    CHECK (data_source IN ('mock', 'bluetooth', 'unknown'))
    DEFAULT 'unknown';

ALTER TABLE sessions ADD COLUMN runtime_environment TEXT;
ALTER TABLE sessions ADD COLUMN app_version TEXT;
```

### Solution 2: Fix Session ID Mapping
```javascript
// In EnhancedSessionManager.js - ensure session ID is passed correctly
async addReading(reading) {
    if (!this.isActive || !this.currentSession) {
        console.error('Cannot add reading - no active session');
        return;
    }
    
    const enhancedReading = {
        ...reading,
        session_id: this.currentSession.id, // Ensure this is Supabase UUID
        local_session_id: this.localSessionId, // Keep for debugging
        timestamp: new Date().toISOString(),
        phase: this.currentPhase,
        cycle: this.currentCycle,
        data_source: Constants.appOwnership === 'expo' ? 'mock' : 'bluetooth'
    };
    
    this.readingBuffer.push(enhancedReading);
}
```

### Solution 3: Add Robust Error Handling
```javascript
// In SupabaseService.js - add visibility to failures
async addReadingsBatch(readings) {
    try {
        const result = await supabase.rpc('insert_batch_readings_with_device_id', {
            device_id_value: deviceIdToUse,
            readings_data: supabaseReadings
        });
        
        if (result.error) {
            console.error('❌ CRITICAL: Batch insert failed:', result.error);
            // Send error to monitoring service
            await this.reportCriticalError('batch_insert_failed', result.error);
            
            // Attempt recovery
            if (result.error.code === 'session_not_found') {
                await this.recoverSessionMapping(localSessionId);
            }
        }
        
        return result;
    } catch (error) {
        console.error('❌ CRITICAL: Unexpected batch insert error:', error);
        throw error; // Don't silently fail
    }
}
```

### Solution 4: Prevent Duplicate Sessions
```javascript
// In EnhancedSessionManager.js - add mutex/lock
async startSession(config) {
    if (this.sessionStartInProgress) {
        console.warn('Session start already in progress, ignoring duplicate call');
        return this.currentSession;
    }
    
    this.sessionStartInProgress = true;
    try {
        // Create session logic here
    } finally {
        this.sessionStartInProgress = false;
    }
}
```

## Testing Plan

### Phase 1: Local Testing
1. Add extensive logging to `addReadingsBatch`
2. Test with MockBLEService in Expo Go
3. Verify readings are saved with `data_source: 'mock'`

### Phase 2: EAS Build Testing
1. Create development build with fixes
2. Test with real Wellue oximeter
3. Monitor logs for session ID mapping
4. Verify readings saved with `data_source: 'bluetooth'`

### Phase 3: Data Validation
```sql
-- After testing, verify data integrity
SELECT 
    data_source,
    COUNT(DISTINCT session_id) as sessions,
    COUNT(*) as total_readings,
    AVG(spo2) as avg_spo2,
    STDDEV(spo2) as spo2_variability
FROM readings
WHERE created_at >= NOW() - INTERVAL '1 day'
GROUP BY data_source;
```

## Immediate Action Items

1. **CRITICAL**: Add comprehensive logging to `addReadingsBatch` function
2. **CRITICAL**: Verify session ID mapping is working correctly
3. **HIGH**: Add `data_source` field to database schema
4. **HIGH**: Implement error reporting for failed batch inserts
5. **MEDIUM**: Fix duplicate session creation
6. **MEDIUM**: Add monitoring dashboard for data integrity

## Long-term Recommendations

1. Implement structured logging with correlation IDs
2. Add Sentry or similar error tracking
3. Create data integrity monitoring alerts
4. Implement automatic session recovery mechanisms
5. Add integration tests for the complete data flow
6. Consider using Supabase Realtime for live data streaming

## Contact for Questions

- **Primary Developer**: Danyal Panjwani
- **Test User**: Steven (Test App account)
- **Test Device**: Wellue O2Ring Pulse Oximeter
- **Test Environment**: EAS Build (not Expo Go)

---

*This document should be updated as fixes are implemented and tested.*