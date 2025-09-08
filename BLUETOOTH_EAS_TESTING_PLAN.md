# Bluetooth EAS Build Testing Plan
**Date: September 8, 2025**  
**Purpose: Comprehensive testing guide for Bluetooth functionality in EAS builds**

## Quick Start Commands

```bash
# Navigate to parent directory containing both repositories
cd "/Users/danyalpanjwani/Desktop/Vitaliti_Air/Vitaliti Code/Air"

# For monitoring database in real-time (run in separate terminal)
cd Vitaliti-Air-Analytics
npm run dev

# For checking logs and database directly
npx supabase db remote commit
```

## Critical Issues to Verify

### 🔴 PRIORITY 1: Data Storage (CRITICAL)
**Previous Issue**: Bluetooth readings not being saved to database
- Sessions show 0 readings despite completion
- Session ID mapping failure between local and Supabase

**Test Focus**:
1. Every reading from Bluetooth must be saved
2. Session ID must correctly map to database
3. No data loss during phase transitions

### 🟡 PRIORITY 2: Session Management
**Previous Issues**:
- Duplicate sessions created (one active, one completed)
- Sessions not properly attributed to users
- Background service losing session state

**Test Focus**:
1. Only one session record per training
2. Session properly linked to user profile
3. Background service maintains state

### 🟢 PRIORITY 3: Progressive Overload Features
**New Features to Test**:
- Mask lift notifications (≤83% and ≤80%)
- Dial adjustment recommendations
- Altitude animation with 3 flashes
- Switch Masks transition notifications

## Pre-Test Checklist

### 1. Device Setup
- [ ] Wellue O2Ring charged and ready
- [ ] Phone Bluetooth enabled
- [ ] Location services enabled (required for BLE)
- [ ] EAS build installed on device
- [ ] User logged in with profile created

### 2. Database Monitoring Setup
```sql
-- Run this query to monitor sessions in real-time
SELECT 
    s.id,
    s.device_id,
    s.start_time,
    s.status,
    COUNT(r.id) as reading_count,
    MAX(r.created_at) as last_reading
FROM sessions s
LEFT JOIN readings r ON s.id = r.session_id
WHERE s.start_time >= NOW() - INTERVAL '1 hour'
GROUP BY s.id
ORDER BY s.start_time DESC;
```

### 3. Analytics Dashboard
- Open `http://localhost:3000` after running `npm run dev` in Analytics folder
- Navigate to Sessions tab to see real-time updates

## Testing Procedure

### Phase 1: Bluetooth Connection (5 min)

#### Test 1.1: Device Discovery
1. Navigate to Training screen
2. Tap "Connect Pulse Oximeter"
3. **Verify**:
   - [ ] Scanning animation appears
   - [ ] Wellue device appears in list within 10 seconds
   - [ ] Device shows RSSI signal strength

#### Test 1.2: Connection
1. Tap on Wellue device
2. **Verify**:
   - [ ] "Connecting..." status shown
   - [ ] Connection successful within 5 seconds
   - [ ] Real-time SpO2 and HR data appears
   - [ ] Signal strength indicator shows

#### Test 1.3: Data Stream Quality
1. Put device on finger
2. Wait for stable reading
3. **Verify**:
   - [ ] SpO2 updates every 1-2 seconds
   - [ ] Heart rate updates smoothly
   - [ ] Signal strength > 50
   - [ ] "Finger Detected" indicator shows

**Log Check**:
```bash
# Check for these log entries:
"✅ Connected to Wellue"
"📊 BLE Data:"
"Signal Strength:"
```

### Phase 2: Session Start & Data Storage (10 min)

#### Test 2.1: Session Creation
1. Start IHHT session with connected device
2. **Immediately check database**:
```sql
-- Should return exactly 1 row with status 'active'
SELECT id, status, device_id, start_time 
FROM sessions 
WHERE user_id = 'YOUR_USER_ID' 
AND start_time >= NOW() - INTERVAL '1 minute';
```

3. **Verify**:
   - [ ] Only ONE session created (not duplicate)
   - [ ] Session has correct device_id
   - [ ] Status is 'active'
   - [ ] Session ID logged in app console

#### Test 2.2: Initial Readings Storage
1. Let session run for 30 seconds
2. **Check readings are being saved**:
```sql
-- Should show increasing count
SELECT COUNT(*) as readings_saved
FROM readings 
WHERE session_id = 'SESSION_ID_FROM_ABOVE';
```

3. **Verify**:
   - [ ] Reading count increases every second
   - [ ] SpO2 values match app display
   - [ ] Heart rate values match app display
   - [ ] Phase and cycle fields populated

**Critical Check**: If reading count is 0 after 30 seconds, STOP - data storage is broken!

### Phase 3: Progressive Overload Features (15 min)

#### Test 3.1: Mask Lift Notifications
1. Continue session until SpO2 drops below 83%
2. **Verify First Notification**:
   - [ ] "Mask Lift Required" appears
   - [ ] Double haptic buzz occurs
   - [ ] Notification fades in over 0.5 seconds
   - [ ] Auto-dismisses after 10 seconds
   - [ ] 15-second cooldown starts

3. If SpO2 drops below 80% within cooldown:
   - [ ] Second mask lift notification appears
   - [ ] Different message shown
   - [ ] New 15-second cooldown starts

#### Test 3.2: Dial Adjustments
1. Complete first altitude phase
2. **Verify at phase end**:
   - [ ] "Switch Masks" notification appears first
   - [ ] Dial adjustment calculates based on average SpO2
   - [ ] If avg > 90%: "Increase dial" instruction
   - [ ] If avg < 85%: "Decrease dial" instruction
   - [ ] User must tap "Got it" to confirm

#### Test 3.3: Altitude Animation
1. After dial adjustment confirmed
2. **Verify animation**:
   - [ ] Altitude number flashes 3 times
   - [ ] Each flash takes 1 second
   - [ ] Number changes after animation completes
   - [ ] No overlap with other notifications

### Phase 4: Background Operation (10 min)

#### Test 4.1: App Backgrounding
1. During active session, minimize app
2. Wait 30 seconds
3. Return to app
4. **Verify**:
   - [ ] Timer continued running
   - [ ] Phase transitions occurred if expected
   - [ ] All readings were saved during background
   - [ ] No duplicate sessions created

#### Test 4.2: Bluetooth Reconnection
1. Turn off Wellue device mid-session
2. Wait for disconnection notice
3. Turn device back on
4. **Verify**:
   - [ ] Auto-reconnection attempt
   - [ ] Session continues after reconnection
   - [ ] No data loss during disconnect
   - [ ] Readings resume saving

### Phase 5: Session Completion (5 min)

#### Test 5.1: Normal Completion
1. Complete full session (or stop early)
2. **Check database immediately**:
```sql
-- Verify session completed properly
SELECT 
    status,
    end_time,
    total_readings,
    altitude_changes,
    mask_lift_count
FROM sessions 
WHERE id = 'YOUR_SESSION_ID';
```

3. **Verify**:
   - [ ] Status changed to 'completed'
   - [ ] End time is set
   - [ ] Total readings matches actual count
   - [ ] Altitude changes saved
   - [ ] Mask lift count accurate

#### Test 5.2: Data Integrity
```sql
-- Final data check
SELECT 
    COUNT(*) as total_readings,
    AVG(spo2) as avg_spo2,
    MIN(spo2) as min_spo2,
    MAX(spo2) as max_spo2,
    COUNT(DISTINCT phase) as phases,
    COUNT(DISTINCT cycle_number) as cycles
FROM readings 
WHERE session_id = 'YOUR_SESSION_ID';
```

**Verify**:
- [ ] All readings present (no gaps)
- [ ] SpO2 range realistic (not mock data pattern)
- [ ] Phases and cycles tracked correctly

## Post-Test Analysis

### Success Criteria
✅ **PASS** if:
- All Bluetooth readings saved to database
- No duplicate sessions
- Progressive overload features work
- Background operation maintains data
- Session completes with full data

❌ **FAIL** if:
- Any readings missing from database
- Duplicate sessions created
- Session ID mapping fails
- Background operation loses data
- Crashes or freezes occur

### Data Validation Queries

```sql
-- 1. Check for data loss
WITH expected AS (
    SELECT 
        id,
        EXTRACT(EPOCH FROM (end_time - start_time)) as duration_seconds
    FROM sessions 
    WHERE id = 'YOUR_SESSION_ID'
)
SELECT 
    s.id,
    e.duration_seconds as expected_readings,
    COUNT(r.id) as actual_readings,
    CASE 
        WHEN COUNT(r.id) < e.duration_seconds * 0.8 THEN 'DATA LOSS'
        ELSE 'OK'
    END as status
FROM sessions s
JOIN expected e ON s.id = e.id
LEFT JOIN readings r ON s.id = r.session_id
GROUP BY s.id, e.duration_seconds;

-- 2. Verify no mock data patterns
SELECT 
    STDDEV(spo2) as variability,
    COUNT(DISTINCT spo2) as unique_values,
    CASE 
        WHEN STDDEV(spo2) < 2 THEN 'LIKELY MOCK'
        WHEN COUNT(DISTINCT spo2) < 5 THEN 'LIKELY MOCK'
        ELSE 'REAL DATA'
    END as data_type
FROM readings 
WHERE session_id = 'YOUR_SESSION_ID';
```

## Troubleshooting Guide

### Issue: No Bluetooth devices found
- Check location services enabled
- Ensure device is in pairing mode
- Try manual phone Bluetooth settings first
- Kill and restart app

### Issue: Readings not saving
- Check session ID in console logs
- Verify session exists in database
- Look for "addReadingsBatch" errors in logs
- Check network connectivity

### Issue: Duplicate sessions
- Note exact time of session start
- Check for multiple "Creating session" logs
- Verify only one active session in database
- Look for race conditions in logs

### Issue: Background data loss
- Check background service logs
- Verify session state persistence
- Look for "Session resumed" messages
- Check for memory warnings

## Required Log Monitoring

Enable verbose logging by shaking device and enabling "Debug Mode", then monitor for:

```javascript
// Critical success indicators
"✅ Session created with ID:"
"✅ Added session mapping:"
"✅ Batch saved successfully:"
"✅ Session completed:"

// Critical failure indicators
"❌ Failed to create session:"
"❌ Session mapping not found:"
"❌ Batch insert failed:"
"❌ RLS policy violation:"
```

## Report Template

After testing, document results:

```markdown
## Bluetooth EAS Test Report
**Date**: [DATE]
**Build Version**: [VERSION]
**Device**: [iPhone/Android Model]
**Pulse Oximeter**: Wellue O2Ring

### Connection Test
- Discovery: ✅/❌
- Connection: ✅/❌
- Data Stream: ✅/❌

### Data Storage Test
- Session Creation: ✅/❌
- Readings Saved: [X]/[Expected]
- No Duplicates: ✅/❌

### Features Test
- Mask Lift: ✅/❌
- Dial Adjust: ✅/❌
- Animations: ✅/❌

### Issues Found
1. [Issue description]
2. [Issue description]

### Database Verification
- Total Sessions: X
- Total Readings: X
- Data Integrity: ✅/❌
```

## Contact & Escalation

**Primary Developer**: Danyal Panjwani  
**Test Device**: Wellue O2Ring  
**Database**: Supabase (check dashboard for real-time data)  
**Analytics**: Vitaliti-Air-Analytics repository

---

**Remember**: The #1 priority is verifying that ALL Bluetooth data is being saved to the database. Without this, the app cannot function properly for real users.