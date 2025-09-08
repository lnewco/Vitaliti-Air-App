# Altitude Display & Data Sync Fix Plan
**Date**: January 9, 2025
**Current Issue**: Altitude shows dial 7 (18,500ft) when actually at dial 9-10

## 🔴 CRITICAL FIXES NEEDED

### Fix 1: Altitude Display Update Timing
**File**: `src/services/EnhancedSessionManager.js`
**Method**: `confirmDialAdjustment()`

#### Current Broken Behavior:
- All dial adjustments stored as `pendingAltitudeLevel`
- Only applied when transitioning TO altitude phase
- Multiple adjustments overwrite each other (only last one saved)

#### Required Fix:
```javascript
confirmDialAdjustment(newLevel) {
  const previousLevel = this.currentAltitudeLevel;
  
  // IMMEDIATE UPDATE: Apply right away if in altitude phase
  if (this.currentPhase === 'ALTITUDE') {
    this.currentAltitudeLevel = newLevel;
    console.log(`🏔️ Applied altitude level immediately: ${newLevel}`);
  } else {
    // Store as pending if in recovery/transition
    this.pendingAltitudeLevel = newLevel;
    console.log(`📌 Stored pending altitude level: ${newLevel}`);
  }
  
  // Rest of the method...
}
```

### Fix 2: SQLite to Supabase Sync

#### A. Add Sync After Each Save
**File**: `src/services/DatabaseService.js`

After each local save, trigger Supabase sync:
```javascript
async saveAdaptiveEvent(event) {
  // ... existing SQLite save ...
  
  // Trigger sync to Supabase
  if (SupabaseService) {
    await SupabaseService.syncAdaptiveEvent({
      ...event,
      id: generatedId
    });
  }
  
  return id;
}
```

#### B. Create Sync Methods in SupabaseService
**File**: `src/services/SupabaseService.js`

Add these missing methods:
```javascript
// Sync adaptive event immediately
async syncAdaptiveEvent(event) {
  try {
    // Map local session ID to Supabase ID
    const supabaseSessionId = this.sessionMapping.get(event.session_id) || event.session_id;
    
    const { error } = await supabase
      .from('session_adaptive_events')
      .upsert({
        session_id: supabaseSessionId,
        event_type: event.event_type,
        event_timestamp: event.event_timestamp,
        current_altitude_level: event.current_altitude_level,
        additional_data: event.additionalData || event.additional_data
      });
      
    if (error) throw error;
    return { success: true };
  } catch (error) {
    // Queue for later if fails
    this.queueForSync('saveAdaptiveEvent', event);
    return { success: false, queued: true };
  }
}

// Sync phase metrics
async syncPhaseMetrics(metrics) {
  // Similar implementation
}

// Update session altitude level
async updateSessionAltitude(sessionId, newLevel) {
  const supabaseId = this.sessionMapping.get(sessionId) || sessionId;
  
  const { error } = await supabase
    .from('sessions')
    .update({ 
      current_altitude_level: newLevel,
      total_altitude_adjustments: supabase.sql`total_altitude_adjustments + 1`
    })
    .eq('id', supabaseId);
    
  if (error) {
    this.queueForSync('updateAltitude', { sessionId, newLevel });
  }
}
```

### Fix 3: Process Sync Queue for New Operations

**File**: `src/services/SupabaseService.js`
**Method**: `processSyncQueue()`

Add cases for new operations:
```javascript
case 'saveAdaptiveEvent':
  success = await this.syncAdaptiveEvent(item.data);
  break;
  
case 'syncPhaseMetrics':
  success = await this.syncPhaseMetrics(item.data);
  break;
  
case 'updateAltitude':
  success = await this.updateSessionAltitude(item.data.sessionId, item.data.newLevel);
  break;
```

## 📊 Data Flow After Fix

### When You Adjust Dial (e.g., to level 10):
1. **Immediate**: 
   - If in altitude phase → `currentAltitudeLevel = 10` → Display updates to 26,500ft
   - If in recovery → `pendingAltitudeLevel = 10` → Will apply on next altitude
   
2. **SQLite Save**:
   - Adaptive event saved locally
   - Session altitude updated locally
   
3. **Supabase Sync** (NEW):
   - Adaptive event syncs immediately
   - Session altitude level updates in cloud
   - If offline, queued for later

### Phase Transitions:
- **Altitude → Recovery**: Display shows 0ft ✅
- **Recovery → Altitude**: Apply `pendingAltitudeLevel` if exists
- **During Altitude**: Dial changes apply immediately

## 🎯 Testing Your Current Session

After fixes, your session should show:
1. Current altitude: Level 10 (26,500ft) when in altitude phase
2. Supabase should have:
   - 4+ dial adjustment events
   - Current_altitude_level: 10
   - Phase metrics for each completed phase
   - Intra-session survey responses

## 🚀 Implementation Order

1. **Fix altitude display** (5 min)
   - Update `confirmDialAdjustment()` logic
   
2. **Add sync triggers** (10 min)
   - Update DatabaseService save methods
   - Add SupabaseService sync methods
   
3. **Test with your session** (5 min)
   - Verify altitude shows correctly
   - Check Supabase for synced events

## ⚠️ Edge Cases to Handle

1. **Multiple rapid adjustments**: Queue them properly
2. **Offline mode**: Ensure sync queue works
3. **Session mapping**: Handle unmapped sessions gracefully
4. **Duplicate events**: Use upsert to prevent duplicates

## 📝 Files to Modify

1. `src/services/EnhancedSessionManager.js` - Line 1706-1722
2. `src/services/DatabaseService.js` - Lines 796-839
3. `src/services/SupabaseService.js` - Add new sync methods
4. `src/services/SupabaseService.js` - Lines 913-959 (processSyncQueue)

## Success Metrics

- [ ] Altitude display matches current dial level
- [ ] All dial adjustments in Supabase
- [ ] Phase metrics syncing
- [ ] Session altitude level updating in real-time
- [ ] No data loss when offline