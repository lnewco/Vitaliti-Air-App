# IHHT Progressive Overload System - Gap Analysis Report

## Executive Summary
**CRITICAL FINDING**: After thorough code verification (Dec 4, 2024), the Progressive Overload System described in this document **DOES NOT EXIST** in the codebase. The `AltitudeProgressionService.js` file referenced here was never created. The app currently uses a **hardcoded altitude level of 6** with no progression logic whatsoever. This document now serves as a **requirements specification** for what NEEDS to be built, not what exists.

## Actual Implementation Status (Verified Dec 4, 2024)

### ✅ What Actually Exists:
- **Diamond UI** in `IHHTSessionSimple.js`
- **Fixed altitude level 6** in `SimplifiedSessionSetup.js`
- **Safety thresholds** for SpO2 monitoring
- **Basic session management** without progression
- **Feedback UI components** (not persisted to database)

### ❌ What Does NOT Exist (But This Document Describes):
- **NO** `AltitudeProgressionService.js` file
- **NO** progressive overload logic
- **NO** detraining detection
- **NO** plateau breaking
- **NO** getUserProgressionData methods
- **NO** altitude adjustment algorithms
- **NO** session-to-session memory

## Required Features to Implement (Currently Non-Existent)

### 1. Progressive Overload Core System
**TO BE CREATED**: `src/services/AltitudeProgressionService.js`
**Current Reality**: This file does not exist. The app uses hardcoded `defaultAltitudeLevel: 6`
- **Smart altitude progression** based on session history
- **Detraining detection** for breaks (3-60+ days):
  - 0-3 days: No change
  - 4-7 days: -1 level  
  - 8-14 days: -2 levels
  - 15-30 days: -3 levels
  - 60+ days: Reset to baseline (level 6)
- **Safety bounds** on altitude changes (max ±2 levels per session)
- **Performance-based adjustments** (mask lifts, SpO2 stability)
- **Plateau detection** and breaking after 5 sessions at same level

### 2. Database Schema Updates
**REQUIRED ADDITIONS** to `src/services/DatabaseService.js`

Methods that NEED to be created (currently don't exist):
- `getUserProgressionData(userId, limit)` - Retrieves historical progression data
- `getLastCompletedSession(userId)` - Quick lookup of last session
- `updateSessionAltitudeLevel(sessionId, newAltitudeLevel)` - Real-time altitude updates

New/Updated fields in local SQLite:
- `starting_altitude_level` - Initial altitude for session
- `current_altitude_level` - Current/ending altitude level
- `total_mask_lifts` - Count of mask lift events
- `total_altitude_adjustments` - Count of altitude changes
- `session_subtype` - 'calibration' or 'training'
- `adaptive_system_enabled` - Boolean for adaptive features

### 3. Altitude Levels Reference Table
**Current Status**: Exists as hardcoded constant `ALTITUDE_CONVERSION` in `IHHTSessionSimple.js`
**Required**: Move to database table for dynamic updates
- 11 altitude levels (0-10) with oxygen percentages
- Equivalent altitude in feet and meters
- Display names for UI

## Implementation Requirements for Complete System

### 1. App-Side Implementation Required
**FIRST**: Need to build the progression logic in the app before any sync can happen:

#### In `createSession()` method:
- ❌ `starting_altitude_level`
- ❌ `current_altitude_level` 
- ❌ `session_subtype`
- ❌ `adaptive_system_enabled`

#### In `endSession()` method:
- ❌ `current_altitude_level` (ending level)
- ❌ `total_mask_lifts`
- ❌ `total_altitude_adjustments`
- ❌ `actual_cycles_completed`
- ❌ `actual_hypoxic_time`
- ❌ `actual_hyperoxic_time`
- ❌ `completion_percentage`

### 2. Missing API Endpoints in Analytics

#### Required New Endpoints:
1. **GET /api/sessions/progression/{userId}**
   - Return user's progression data
   - Last 10-20 sessions with altitude levels
   - Calculate days since last session
   - Determine progression trend

2. **POST /api/sessions/{id}/altitude**
   - Update session's current altitude level
   - Track altitude adjustments in real-time
   - Record adjustment reasons

3. **POST /api/sessions/{id}/adaptive-events**
   - Record mask lift events
   - Track altitude adjustments
   - Store recovery phase completions

4. **GET /api/altitude-agent/progressive-recommendation**
   - Calculate optimal starting altitude using progression algorithm
   - Consider detraining periods
   - Apply performance-based adjustments
   - Return reasoning and confidence

### 3. Database Schema Gaps in Supabase

While the Supabase tables have the columns, they're NOT being populated:

#### Sessions table - Unused columns:
- `starting_altitude_level` (default 6, never updated)
- `current_altitude_level` (default 6, never updated)
- `session_subtype` (default 'calibration', never updated)
- `adaptive_system_enabled` (default true, never updated)
- `total_mask_lifts` (default 0, never updated)
- `total_altitude_adjustments` (default 0, never updated)

#### Adaptive Events tables - Completely unused:
- `session_adaptive_events` - 0 rows
- `session_phase_stats` - 0 rows

### 4. Analytics Dashboard Gaps

The current IHHT Dashboard (`src/components/ihht/IHHTDashboard.tsx`) lacks:
- Progressive overload visualization
- Altitude level progression charts
- Detraining detection indicators
- Performance trend analysis
- Mask lift statistics
- Session-to-session comparisons

## Implementation Priority

### Phase 1: Critical Data Sync (IMMEDIATE)
1. Update `SupabaseService.js` in App to sync altitude fields
2. Add altitude level updates during session
3. Sync adaptive events (mask lifts, adjustments)

### Phase 2: Backend API Development (HIGH)
1. Create progression data endpoint
2. Implement progressive recommendation endpoint
3. Add adaptive events recording endpoint

### Phase 3: Analytics Enhancement (MEDIUM)
1. Update dashboard to show progression
2. Add altitude level charts
3. Implement detraining indicators
4. Create performance analytics

## Technical Requirements

### 1. SupabaseService.js Updates Needed

```javascript
// In createSession() - Add these fields:
session.starting_altitude_level = sessionData.startingAltitudeLevel || 6;
session.current_altitude_level = sessionData.startingAltitudeLevel || 6;
session.session_subtype = sessionData.sessionSubtype || 'training';
session.adaptive_system_enabled = sessionData.adaptiveEnabled ?? true;

// In endSession() - Add these fields:
updates.current_altitude_level = stats.currentAltitudeLevel || stats.startingAltitudeLevel;
updates.total_mask_lifts = stats.totalMaskLifts || 0;
updates.total_altitude_adjustments = stats.totalAltitudeAdjustments || 0;
updates.actual_cycles_completed = stats.actualCyclesCompleted || 0;
updates.actual_hypoxic_time = stats.actualHypoxicTime || 0;
updates.actual_hyperoxic_time = stats.actualHyperoxicTime || 0;
updates.completion_percentage = stats.completionPercentage || 0;
```

### 2. New API Endpoint Specifications

#### GET /api/sessions/progression/{userId}
```typescript
Response: {
  sessions: SessionData[],
  lastSession: SessionData | null,
  averageEndingAltitude: number,
  trend: 'improving' | 'declining' | 'stable',
  daysSinceLastSession: number | null,
  totalSessions: number,
  recommendations: {
    nextAltitudeLevel: number,
    reasoning: string[],
    confidence: number
  }
}
```

#### POST /api/sessions/{id}/altitude
```typescript
Request: {
  newAltitudeLevel: number,
  reason: string,
  timestamp: string
}
```

### 3. Migration Script Needed

Since the App has been collecting this data locally but not syncing:
1. Query all local SQLite sessions with altitude data
2. Match with Supabase sessions via `local_session_id`
3. Batch update Supabase with missing altitude fields
4. Backfill adaptive events if stored locally

## Current System Limitations (Without Progressive Overload)

### Critical Issues:
1. **No Progression**: All users stuck at altitude level 6 forever
2. **No Adaptation**: System doesn't learn from user performance
3. **Safety Risk**: No detraining detection after breaks
4. **Poor UX**: Users must manually guess appropriate difficulty
5. **No Analytics**: Cannot track user improvement over time

### Medium Risk Issues:
1. Dashboard shows incorrect/default altitude levels
2. ML recommendations cannot use progression data
3. Customer success team lacks progression insights

## Recommended Action Plan

### Immediate (Today):
1. ✅ Review this gap analysis
2. Update SupabaseService.js to sync critical fields
3. Deploy App update to start collecting data

### Short-term (This Week):
1. Implement progression API endpoint
2. Add altitude update endpoint
3. Create migration script for historical data
4. Update Analytics dashboard basics

### Medium-term (Next 2 Weeks):
1. Full adaptive events system
2. Advanced analytics features
3. ML integration for recommendations
4. Complete dashboard overhaul

## Testing Requirements

### App-side Testing:
1. Verify altitude fields sync on session creation
2. Confirm end session updates altitude levels
3. Test adaptive events recording
4. Validate offline queue for sync

### Backend Testing:
1. API endpoint unit tests
2. Data integrity validation
3. Progression calculation accuracy
4. Detraining detection logic

### Integration Testing:
1. End-to-end session with altitude changes
2. Multi-session progression tracking
3. Cross-device synchronization
4. Historical data migration

## Conclusion

The IHHT Progressive Overload System described in this document **does not exist** in the current codebase. This gap analysis has revealed that what was thought to be implemented is actually a complete specification for what needs to be built. The app currently operates with a fixed altitude level and no progression capability whatsoever.

**Immediate action is required** to prevent data loss and enable the full benefits of this system. The highest priority is updating the SupabaseService.js sync methods, followed by implementing the core API endpoints for progression tracking.

---

*Report Updated: December 4, 2024*
*Verification Status: Code thoroughly checked - features DO NOT EXIST*
*Document Purpose: Changed from gap analysis to requirements specification*
*Repositories Analyzed: Vitaliti-Air-App (ihht-progressive-overload branch), Vitaliti-Air-Analytics (ihht-v2 branch)*