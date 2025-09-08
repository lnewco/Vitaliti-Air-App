# IHHT Data Architecture & Sync Implementation Plan
**Date**: January 8, 2025  
**Branch**: `feature/IHHT-data-chat`  
**Author**: Implementation Plan for Data Storage Fixes

## Executive Summary

The IHHT system currently stores ALL data locally in SQLite on the mobile device with broken sync to Supabase. This causes data loss on app reinstall, no cross-device sync, and prevents the AI agent from accessing training data. This document outlines the complete fix.

## Current Architecture (AS-IS)

### Data Flow Problems
```
[Bluetooth Device] 
    ↓
[Mobile App] 
    ↓
[SQLite (Local)] ← All data stays here
    ✗ (broken sync)
[Supabase (Cloud)] ← Empty or duplicate/incomplete data
    ✗ (no access)
[Analytics Backend] ← Can't see data for AI/ML
```

### Where Data Lives Now

| Data Type | SQLite (Local) | Supabase (Cloud) | Status |
|-----------|---------------|------------------|--------|
| Sessions | ✅ Complete | ❌ Duplicates/Missing | BROKEN |
| Readings (SpO2/HR) | ✅ Complete | ⚠️ Partial (wrong session) | BROKEN |
| Pre-Session Surveys | ✅ Saved | ❌ Not synced | BROKEN |
| Inter-Session Surveys | ✅ Saved | ❌ Not synced | BROKEN |
| Post-Session Surveys | ✅ Saved | ⚠️ 16% success rate | BROKEN |
| Progression Data | ✅ Complete | ❌ Not synced | BROKEN |
| Adaptive Events | ✅ Complete | ❌ Not synced | BROKEN |

### Critical Issues Identified

1. **Duplicate Session Creation**
   - Every session creates 2 records (one "active" with readings, one "completed" without)
   - Root cause: Session created in both SQLite and Supabase independently
   
2. **Session ID Mapping Failure**
   - Local session ID format: `IHHT_${timestamp}_${random}`
   - Supabase session ID: UUID
   - Mapping exists but lookup fails during sync

3. **No Automatic Sync**
   - Data saves to SQLite successfully
   - No sync service calls after save
   - Manual sync not triggered

4. **Missing Backend Endpoints**
   - No real-time API endpoints (VIT-74)
   - No WebSocket/SSE for live data
   - Analytics can't pull data

## Target Architecture (TO-BE)

### Desired Data Flow
```
[Bluetooth Device]
    ↓
[Mobile App]
    ↓
[SQLite (Local)] ← Offline-first storage
    ↓ (auto-sync)
[Sync Service] ← Handles mapping & deduplication
    ↓
[Supabase (Cloud)] ← Single source of truth
    ↓ (real-time)
[Analytics Backend] ← Live access via API/WebSocket
    ↓
[AI Agent] ← Can analyze patterns
```

## Implementation Plan

### Phase 1: Fix Core Data Storage (Mobile App)

#### 1.1 Fix Duplicate Session Creation
**File**: `src/services/EnhancedSessionManager.js`

```javascript
// Add mutex to prevent duplicate creation
class EnhancedSessionManager {
  constructor() {
    this.sessionCreateLock = false;
  }
  
  async startSession() {
    if (this.sessionCreateLock) {
      console.warn('Session creation already in progress');
      return this.currentSession;
    }
    
    this.sessionCreateLock = true;
    try {
      // Create in SQLite first
      const localSession = await DatabaseService.createSession(localId);
      
      // Then sync to Supabase with same ID mapping
      const supabaseSession = await SupabaseService.createSession({
        ...sessionData,
        localSessionId: localId
      });
      
      // Store mapping
      this.sessionMapping.set(localId, supabaseSession.id);
      
      return supabaseSession;
    } finally {
      this.sessionCreateLock = false;
    }
  }
}
```

#### 1.2 Fix Session ID Mapping
**File**: `src/services/SupabaseService.js`

```javascript
// Ensure mapping persists and retrieves correctly
async addReadingsBatch(readings) {
  // Get the Supabase session ID from mapping
  const supabaseSessionId = this.sessionMapping.get(localSessionId);
  
  if (!supabaseSessionId) {
    // Try to recover from AsyncStorage
    const recovered = await this.recoverSessionMapping(localSessionId);
    if (!recovered) {
      throw new Error(`No Supabase session ID for local: ${localSessionId}`);
    }
  }
  
  // Use the mapped ID for insertion
  const supabaseReadings = readings.map(r => ({
    ...r,
    session_id: supabaseSessionId // Use Supabase UUID, not local ID
  }));
  
  return await this.batchInsert(supabaseReadings);
}
```

### Phase 2: Implement Sync Service

#### 2.1 Create SyncManager
**New File**: `src/services/SyncManager.js`

```javascript
class SyncManager {
  async syncSession(sessionId) {
    // Get local data
    const localSession = await DatabaseService.getSessionWithData(sessionId);
    
    // Check if already synced
    const syncStatus = await this.getSyncStatus(sessionId);
    if (syncStatus.completed) return;
    
    // Sync in order
    await this.syncSessionData(localSession);
    await this.syncReadings(localSession.readings);
    await this.syncSurveys(localSession.surveys);
    await this.syncProgressionData(localSession.progression);
    
    // Mark as synced
    await this.markSynced(sessionId);
  }
  
  async syncReadings(readings) {
    // Batch sync with retry logic
    const BATCH_SIZE = 100;
    for (let i = 0; i < readings.length; i += BATCH_SIZE) {
      const batch = readings.slice(i, i + BATCH_SIZE);
      await this.syncBatchWithRetry(batch, 'readings');
    }
  }
}
```

#### 2.2 Auto-Sync Triggers
**Update**: `src/services/DatabaseService.js`

```javascript
// After any local save, trigger sync
async savePostSessionSurvey(sessionId, data) {
  // Save locally first
  await this.db.runAsync(/* SQL */);
  
  // Trigger background sync
  SyncManager.enqueueSyncTask({
    type: 'survey',
    sessionId,
    data
  });
}
```

### Phase 3: Backend API Endpoints (Analytics)

#### 3.1 Real-time Endpoints
**New File**: `Vitaliti-Air-Analytics/pages/api/sessions/realtime.js`

```javascript
// WebSocket endpoint for real-time data
export default function handler(req, res) {
  if (req.method === 'GET') {
    // Upgrade to WebSocket
    const ws = new WebSocket.Server({ noServer: true });
    
    ws.on('connection', (socket) => {
      // Subscribe to Supabase realtime
      const subscription = supabase
        .from('readings')
        .on('INSERT', payload => {
          socket.send(JSON.stringify(payload));
        })
        .subscribe();
    });
  }
}
```

#### 3.2 Sync API Endpoints
**New File**: `Vitaliti-Air-Analytics/pages/api/sync/batch.js`

```javascript
export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { type, data, sessionId } = req.body;
    
    // Validate and deduplicate
    const existing = await checkExisting(sessionId);
    if (existing) {
      return res.status(200).json({ status: 'already_synced' });
    }
    
    // Insert batch data
    const result = await supabase
      .from(type)
      .upsert(data, { onConflict: 'session_id,timestamp' });
    
    return res.status(200).json({ synced: data.length });
  }
}
```

### Phase 4: Add Data Source Tracking

#### 4.1 Database Migration
```sql
-- Add to Supabase
ALTER TABLE sessions ADD COLUMN data_source TEXT 
  CHECK (data_source IN ('mock', 'bluetooth', 'manual'));
ALTER TABLE sessions ADD COLUMN sync_status TEXT 
  CHECK (sync_status IN ('pending', 'syncing', 'completed', 'failed'));
ALTER TABLE sessions ADD COLUMN sync_attempts INTEGER DEFAULT 0;
ALTER TABLE sessions ADD COLUMN last_sync_at TIMESTAMPTZ;
```

#### 4.2 Track Source in App
```javascript
// In MockBLEService.js
generateReading() {
  return {
    ...readingData,
    dataSource: 'mock'
  };
}

// In BluetoothService.js
parseRealData(characteristic) {
  return {
    ...parsedData,
    dataSource: 'bluetooth'
  };
}
```

## Critical Questions & Clarifications Needed

### 1. Sync Strategy
- **Question**: Should sync be immediate or batched?
- **Recommendation**: Batch every 30 seconds during session, immediate after session
- **Need confirmation**: Acceptable delay for real-time monitoring?

### 2. Offline Handling
- **Question**: How long to retain local data if sync fails?
- **Recommendation**: 30 days local retention, then archive
- **Need confirmation**: Storage limits on mobile devices?

### 3. Conflict Resolution
- **Question**: If local and cloud data conflict, which wins?
- **Recommendation**: Last-write-wins with timestamp comparison
- **Need confirmation**: Any regulatory requirements for data integrity?

### 4. Migration Strategy
- **Question**: How to handle existing sessions with broken data?
- **Recommendation**: One-time migration script to fix duplicates and sync
- **Need confirmation**: Can we modify historical data?

### 5. Real-time Requirements
- **Question**: Which data needs real-time updates vs batch?
- **Recommendation**: 
  - Real-time: SpO2/HR during active session
  - Batch: Surveys, progression calculations
- **Need confirmation**: Latency requirements for coaching dashboard?

### 6. Error Recovery
- **Question**: How to handle partial sync failures?
- **Recommendation**: Transactional sync with rollback capability
- **Need confirmation**: Alert thresholds for sync failures?

## Implementation Priority

1. **Week 1**: Fix duplicate sessions & ID mapping (Mobile)
2. **Week 1**: Implement basic sync service (Mobile)
3. **Week 2**: Create sync API endpoints (Analytics)
4. **Week 2**: Add data source tracking (Both)
5. **Week 3**: Implement real-time WebSocket (Analytics)
6. **Week 3**: Testing & migration scripts

## Success Metrics

- [ ] Zero duplicate sessions in new data
- [ ] 100% of sessions have readings in Supabase
- [ ] 100% of surveys sync within 1 minute
- [ ] Progression data available in cloud
- [ ] AI agent can access last 30 sessions
- [ ] Real-time monitoring shows live SpO2

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Sync floods server | HIGH | Rate limiting, batch processing |
| Data loss during migration | HIGH | Backup before migration, gradual rollout |
| Network costs increase | MEDIUM | Compress data, smart sync timing |
| Battery drain from sync | MEDIUM | Background sync, efficient batching |

## Testing Plan

1. **Unit Tests**: Each sync function
2. **Integration Tests**: Full data flow SQLite → Supabase
3. **Load Tests**: 1000 concurrent sessions
4. **Offline Tests**: Airplane mode scenarios
5. **Migration Tests**: Fix existing broken data

## Next Steps

1. Review and approve this plan
2. Answer clarification questions
3. Coordinate with other Claude instance on Stream Chat
4. Begin Phase 1 implementation
5. Daily sync on progress

---

**Note**: This plan ensures we "one-shot" the implementation correctly by addressing all identified issues systematically. Please review the clarification questions to ensure alignment before we begin coding.