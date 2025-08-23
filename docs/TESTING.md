# Testing Guide for Vitaliti Air App

## Overview

This guide provides comprehensive testing procedures for the Vitaliti Air App, with special emphasis on safety-critical features and medical device integration.

## Test Environment Setup

### Prerequisites
- Physical iOS device (iOS 16.2+) for Bluetooth and Live Activities testing
- Physical Android device for Android testing
- Wellue O2Ring or Checkme O2 pulse oximeter
- Supabase project with test database
- EAS CLI for building test versions

### Build Types for Testing

| Build Type | Command | Use Case |
|------------|---------|----------|
| **Development** | `eas build --profile development --platform ios` | Debugging with Metro |
| **Preview** | `eas build --profile preview --platform ios` | Background testing |
| **Production** | `eas build --profile production --platform ios` | Final testing |

## Critical Safety Testing

### 1. Health Screening Validation

**Test Procedure**:
1. Start onboarding flow
2. Select each contraindication one by one
3. Verify user cannot proceed with any contraindication selected
4. Verify clear warning messages are displayed

**Expected Results**:
- ✅ Users with heart disease are blocked
- ✅ Pregnant users are blocked
- ✅ Users with COPD are blocked
- ✅ Clear safety warnings displayed
- ✅ Cannot bypass screening

### 2. SpO2 Critical Alert Testing

**Test Procedure**:
1. Start IHHT session with pulse oximeter
2. Remove finger to simulate low SpO2
3. Wait for SpO2 to drop below 80%
4. Verify alert triggers

**Expected Results**:
- ✅ Full-screen alert appears within 5 seconds
- ✅ Device vibrates (if supported)
- ✅ Alert cannot be dismissed until SpO2 recovers
- ✅ Session automatically pauses if needed

### 3. Session Recovery Testing

**Test Procedure**:
1. Start IHHT session
2. Complete at least one cycle
3. Force quit the app (swipe up and remove)
4. Wait 2 minutes
5. Reopen the app

**Expected Results**:
- ✅ Recovery prompt appears
- ✅ Session state correctly restored
- ✅ Timers continue from correct position
- ✅ Bluetooth reconnects automatically
- ✅ No data loss

## Bluetooth Device Testing

### 1. Device Discovery

**Test Procedure**:
```bash
# iOS Testing
1. Enable Bluetooth on phone
2. Turn on Wellue device
3. Open app and navigate to device connection
4. Tap "Scan for Devices"
```

**Expected Results**:
- ✅ Device appears with name "Checkme O2 xxxx"
- ✅ Signal strength indicator shows
- ✅ Can select and connect

### 2. Data Integrity Testing

**Test Procedure**:
1. Connect to pulse oximeter
2. Start monitoring
3. Compare app readings with device display
4. Test for 5 minutes continuously

**Expected Results**:
- ✅ SpO2 matches device ±1%
- ✅ Heart rate matches exactly
- ✅ No data gaps or freezes
- ✅ Perfusion index displays correctly

### 3. Disconnection Handling

**Test Procedure**:
1. Start session with connected device
2. Turn off pulse oximeter
3. Observe app behavior
4. Turn device back on

**Expected Results**:
- ✅ Disconnection detected within 10 seconds
- ✅ User notified of disconnection
- ✅ Session pauses automatically
- ✅ Reconnection attempted when device available

## Background Processing Testing (iOS)

### 1. Basic Background Test

**Test Procedure**:
```bash
# Build preview version for testing
eas build --profile preview --platform ios

# Install and test
1. Start IHHT session
2. Press home button to background app
3. Wait 10 minutes
4. Return to app
```

**Expected Results**:
- ✅ Session continues running
- ✅ Phase transitions occur on schedule
- ✅ Less than 5% data loss
- ✅ Bluetooth maintains connection

### 2. Live Activities Testing

**Test Procedure**:
1. Start session on iOS 16.2+ device
2. Lock phone screen
3. Observe lock screen and Dynamic Island

**Expected Results**:
- ✅ Live Activity appears on lock screen
- ✅ Shows current phase and progress
- ✅ Updates in real-time
- ✅ SpO2 and HR display correctly
- ✅ Dynamic Island shows compact view

### 3. Extended Background Test

**Test Procedure**:
1. Start 50-minute full session
2. Background app after 5 minutes
3. Use other apps normally
4. Return after session completes

**Expected Results**:
- ✅ Full session completes
- ✅ All 5 cycles recorded
- ✅ Survey prompt appears on return
- ✅ Data synced to Supabase

## Database & Sync Testing

### 1. Offline Mode Testing

**Test Procedure**:
```bash
1. Enable airplane mode
2. Complete full IHHT session
3. Check local data storage
4. Re-enable network
5. Verify sync
```

**Expected Results**:
- ✅ Session saves locally
- ✅ Can view in history offline
- ✅ Syncs when network returns
- ✅ No data duplication

### 2. Data Migration Testing

**Test Procedure**:
```sql
-- Run migrations in order
1. Execute 001_initial_schema.sql
2. Execute 002_auth_and_profiles.sql
3. Continue through 010_add_perfusion_index.sql
4. Verify schema
```

**Expected Results**:
- ✅ All migrations run without errors
- ✅ Tables created correctly
- ✅ RLS policies active
- ✅ Indexes created

## User Interface Testing

### 1. Theme Testing

**Test Procedure**:
```javascript
// Test both themes
1. Navigate to Settings
2. Toggle dark mode
3. Check all screens
4. Verify medical colors unchanged
```

**Expected Results**:
- ✅ All text readable in both themes
- ✅ Medical colors (SpO2, HR) stay consistent
- ✅ No contrast issues
- ✅ Charts visible in both themes

### 2. Accessibility Testing

**Test Procedure**:
1. Enable VoiceOver (iOS) / TalkBack (Android)
2. Navigate through app
3. Test with large text size
4. Test with reduced motion

**Expected Results**:
- ✅ All buttons have labels
- ✅ Navigation possible with screen reader
- ✅ Text scales appropriately
- ✅ Animations respect reduced motion

## Performance Testing

### 1. Memory Usage

**Test Procedure**:
```bash
# Monitor with Xcode Instruments
1. Start session
2. Run for 30 minutes
3. Monitor memory usage
4. Check for leaks
```

**Expected Results**:
- ✅ Memory usage < 150MB
- ✅ No memory leaks
- ✅ Stable memory over time

### 2. Battery Impact

**Test Procedure**:
1. Note battery percentage
2. Run 50-minute session
3. Check battery drain

**Expected Results**:
- ✅ Battery drain < 10% per session
- ✅ Device doesn't overheat
- ✅ Background usage optimized

## Automated Testing Setup (Future)

### Recommended Test Framework

```json
// package.json additions needed
{
  "devDependencies": {
    "@testing-library/react-native": "^12.0.0",
    "jest": "^29.0.0",
    "detox": "^20.0.0"
  }
}
```

### Critical Tests to Automate

1. **Safety Validations**
   - Health screening logic
   - SpO2 threshold alerts
   - Session safety checks

2. **Data Integrity**
   - Bluetooth packet parsing
   - Session state management
   - Database operations

3. **Business Logic**
   - Phase timing calculations
   - Recovery eligibility
   - Survey validation

## Testing Checklist

### Pre-Release Checklist

- [ ] All health screening blocks working
- [ ] Critical SpO2 alerts trigger < 80%
- [ ] Session recovery works after crash
- [ ] Bluetooth reconnection successful
- [ ] Background processing maintains session
- [ ] Live Activities display correctly
- [ ] Data syncs to Supabase
- [ ] Both themes display correctly
- [ ] No memory leaks detected
- [ ] Battery usage acceptable

### Device Compatibility

- [ ] iPhone 12 or newer (iOS 16.2+)
- [ ] iPhone SE 2nd gen (small screen)
- [ ] iPad (tablet layout)
- [ ] Android 10+ devices
- [ ] Wellue O2Ring
- [ ] Checkme O2

## Troubleshooting Test Failures

### Common Issues

**Bluetooth Won't Connect**:
- Verify device is Wellue/Viatom compatible
- Check iOS Bluetooth permissions
- Reset network settings if needed

**Background Testing Fails**:
- Use Preview build, not Development
- Enable Background App Refresh
- Check battery optimization settings

**Live Activities Don't Appear**:
- Requires iOS 16.2+
- Must use Preview or Production build
- Check notification permissions

## Reporting Issues

When reporting test failures, include:

1. **Device Information**
   - Model and OS version
   - Build type (dev/preview/production)
   - Pulse oximeter model

2. **Steps to Reproduce**
   - Exact sequence of actions
   - Screen recordings if possible
   - Error messages or logs

3. **Expected vs Actual**
   - What should happen
   - What actually happened
   - Any workarounds found

## Security Testing

### Critical Security Checks

- [ ] API keys not exposed in code
- [ ] Environment variables properly configured
- [ ] Supabase RLS policies enforced
- [ ] No sensitive data in logs
- [ ] Phone numbers validated before OTP
- [ ] Session tokens expire appropriately

## Compliance Testing

### Medical Device Integration

- [ ] CRC8 validation on all packets
- [ ] Data accuracy within specifications
- [ ] Wear detection functioning
- [ ] Battery level reporting accurate
- [ ] All safety warnings visible
- [ ] Disclaimer text present

---

**Note**: This testing guide should be updated as new features are added or testing procedures change. Always prioritize safety-critical testing for this medical application.