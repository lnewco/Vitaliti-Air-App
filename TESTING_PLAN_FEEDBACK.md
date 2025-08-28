# AI-Powered Subjective Feedback Engine - Comprehensive Testing Plan

## Overview
This testing plan covers all aspects of the newly implemented feedback collection system including pre-session, intra-session, and post-session surveys.

## Testing Environment Setup

### Prerequisites
1. React Native development environment configured
2. iOS/Android simulator or physical device
3. Supabase database with migrations applied
4. Test user account (optional for authenticated testing)

### Database Preparation
```bash
# Apply migrations to Supabase
npx supabase db push
```

## 1. Pre-Session Survey Testing

### 1.1 Component Rendering
- [ ] Launch SimplifiedSessionSetup screen
- [ ] Click "Start Session" button
- [ ] Verify PreSessionSurvey modal appears with smooth animation
- [ ] Check dark theme styling is consistent
- [ ] Verify all three questions display correctly (Energy, Mental Clarity, Stress)

### 1.2 User Interaction
- [ ] Test tapping each option (1-5 scale) for Energy
- [ ] Test tapping each option for Mental Clarity
- [ ] Test tapping each option for Stress
- [ ] Verify selected options highlight correctly
- [ ] Test "Cancel" button dismisses modal
- [ ] Test "Continue" button is disabled until all questions answered
- [ ] Test "Continue" button enables when all questions answered

### 1.3 Data Flow
- [ ] Complete survey and verify session starts
- [ ] Check console logs for survey data submission
- [ ] Verify data saved to local database
- [ ] Check Supabase for survey data (if online)

### 1.4 Error Scenarios
- [ ] Test with network disconnected (offline mode)
- [ ] Test rapid button presses
- [ ] Test dismissing and reopening survey
- [ ] Test app backgrounding during survey

## 2. Intra-Session Feedback Testing

### 2.1 Trigger Timing
- [ ] Start IHHT session
- [ ] Complete first hypoxic phase (7 minutes)
- [ ] Enter recovery phase
- [ ] Verify feedback appears after 30 seconds of recovery
- [ ] Check auto-dismiss timer (20 seconds)

### 2.2 UI Components
- [ ] Verify slide-up animation is smooth
- [ ] Check blur background effect
- [ ] Test progress bar countdown animation
- [ ] Verify all 4 questions display correctly
- [ ] Test help tooltip for stress perception
- [ ] Check sensation tags display and selection

### 2.3 User Interactions
- [ ] Select stress perception (1-5 scale)
- [ ] Select energy level (1-5 scale)
- [ ] Select mental clarity (1-5 scale)
- [ ] Toggle multiple sensation tags
- [ ] Test "Skip" button functionality
- [ ] Test "Submit" button (requires first 3 questions)
- [ ] Test backdrop tap to dismiss

### 2.4 Sound/Haptic Feedback
- [ ] Verify gentle chime plays on appearance (if sound file present)
- [ ] Test haptic feedback fallback (if sound unavailable)
- [ ] Test with device on silent mode
- [ ] Test with haptics disabled in settings

### 2.5 Multiple Cycles
- [ ] Complete Cycle 1 and submit feedback
- [ ] Complete Cycle 2 and verify new feedback request
- [ ] Complete Cycle 3 and verify new feedback request
- [ ] Ensure no duplicate feedback for same cycle

### 2.6 Data Collection
- [ ] Verify cycleNumber is recorded correctly
- [ ] Check SpO2 and HR values are captured
- [ ] Verify sensations array is saved
- [ ] Confirm timestamp is recorded

## 3. Post-Session Survey Testing

### 3.1 Navigation
- [ ] Complete full IHHT session
- [ ] Verify automatic navigation to PostSessionSurveyScreen
- [ ] Check session summary data displays correctly

### 3.2 Survey Components
- [ ] Test Energy level selection (1-5)
- [ ] Test Mental Clarity selection (1-5)  
- [ ] Test Breathing Comfort selection (1-5)
- [ ] Test Session Satisfaction selection (1-5)
- [ ] Verify symptom tags display
- [ ] Test selecting multiple symptoms
- [ ] Test overall rating stars (1-5)
- [ ] Test notes text input

### 3.3 Comparison View
- [ ] Verify pre-session values display (if available)
- [ ] Check post-session values update in real-time
- [ ] Verify delta calculations are correct
- [ ] Test with no pre-session data

### 3.4 Submission
- [ ] Test "Submit" button with all fields filled
- [ ] Test "Submit" with minimal fields
- [ ] Verify navigation after submission
- [ ] Check data saved to database

## 4. Database Operations Testing

### 4.1 Local Database (SQLite)
```javascript
// Test queries to verify
DatabaseService.savePreSessionSurvey(sessionId, energy, clarity, stress)
DatabaseService.savePostSessionSurvey(sessionId, energy, clarity, breathing, satisfaction, symptoms, rating)
DatabaseService.saveIntraSessionResponse(sessionId, cycle, stress, energy, clarity, sensations, spo2, hr)
```

### 4.2 Supabase Sync
- [ ] Test online sync of pre-session survey
- [ ] Test online sync of intra-session responses
- [ ] Test online sync of post-session survey
- [ ] Verify sync queue for offline data
- [ ] Test sync queue processing on reconnection

### 4.3 RPC Functions
Check if these RPC functions exist in Supabase:
- [ ] `upsert_session_survey`
- [ ] `insert_pre_session_survey_with_device_id`
- [ ] `insert_post_session_survey_with_device_id`
- [ ] `insert_intra_session_response_with_device_id`

## 5. Error Handling Testing

### 5.1 Component Errors
- [ ] Test with missing required props
- [ ] Test with invalid data types
- [ ] Verify error boundary catches crashes
- [ ] Test error recovery/retry functionality

### 5.2 Network Errors
- [ ] Test with no internet connection
- [ ] Test with intermittent connection
- [ ] Test with slow connection
- [ ] Verify offline queue functionality

### 5.3 Database Errors
- [ ] Test with database lock
- [ ] Test with insufficient storage
- [ ] Test with corrupted data
- [ ] Verify error messages are user-friendly

## 6. Performance Testing

### 6.1 Animation Performance
- [ ] Test on low-end devices
- [ ] Monitor FPS during animations
- [ ] Check memory usage during surveys
- [ ] Verify no UI lag or jank

### 6.2 Data Performance
- [ ] Test with large number of sessions
- [ ] Test with many intra-session responses
- [ ] Monitor database query times
- [ ] Check sync queue processing speed

## 7. Accessibility Testing

### 7.1 Screen Reader
- [ ] Test with VoiceOver (iOS)
- [ ] Test with TalkBack (Android)
- [ ] Verify all buttons have labels
- [ ] Check focus order is logical

### 7.2 Visual
- [ ] Test with increased font size
- [ ] Verify color contrast ratios
- [ ] Test with reduced transparency
- [ ] Check touch target sizes (min 44x44)

## 8. Edge Cases

### 8.1 Session Interruptions
- [ ] Force quit app during pre-session survey
- [ ] Force quit during intra-session feedback
- [ ] Force quit during post-session survey
- [ ] Verify data recovery on restart

### 8.2 Timing Issues
- [ ] Change device time during session
- [ ] Test with very long sessions
- [ ] Test rapid session start/stop
- [ ] Test multiple overlapping feedbacks

### 8.3 Data Validation
- [ ] Test with maximum values (999)
- [ ] Test with minimum values (0)
- [ ] Test with null/undefined values
- [ ] Test with special characters in notes

## 9. Integration Testing

### 9.1 End-to-End Flow
1. Start app fresh
2. Navigate to session setup
3. Start session with pre-survey
4. Complete full session with intra-feedbacks
5. Complete post-session survey
6. Verify all data in database
7. Check Supabase sync

### 9.2 Multi-Session Testing
- [ ] Complete multiple sessions in sequence
- [ ] Verify data isolation between sessions
- [ ] Check historical data retrieval
- [ ] Test session comparison features

## 10. Regression Testing

### 10.1 Existing Features
- [ ] Verify normal session flow still works
- [ ] Check sensor connectivity unaffected
- [ ] Test existing navigation paths
- [ ] Verify existing database operations

### 10.2 UI Components
- [ ] Check existing screens render correctly
- [ ] Verify dark theme consistency
- [ ] Test existing animations
- [ ] Check existing modals/overlays

## Test Execution Checklist

### Phase 1: Unit Testing (Developer)
- [ ] Component rendering tests
- [ ] Function logic tests
- [ ] Database operation tests
- [ ] Error handling tests

### Phase 2: Integration Testing (QA)
- [ ] Full flow testing
- [ ] Database sync testing
- [ ] Performance testing
- [ ] Edge case testing

### Phase 3: User Acceptance Testing (UAT)
- [ ] Real device testing
- [ ] User experience validation
- [ ] Data accuracy verification
- [ ] Production readiness check

## Known Issues / Limitations

1. **Sound File**: `gentle-chime.mp3` needs to be added to assets/sounds/
2. **RPC Functions**: Supabase RPC functions need to be created/verified
3. **Offline Queue**: May grow large if offline for extended periods
4. **Haptic Feedback**: Only works on physical devices, not simulators

## Success Criteria

- [ ] All survey data correctly saved to database
- [ ] No crashes or ANRs during normal usage
- [ ] Smooth animations at 60 FPS
- [ ] Offline mode works seamlessly
- [ ] Data syncs correctly when online
- [ ] User can complete full session flow
- [ ] Error states handled gracefully
- [ ] Accessibility requirements met

## Testing Commands

```bash
# Run unit tests
npm test

# Run on iOS simulator
npx react-native run-ios

# Run on Android emulator
npx react-native run-android

# Check database
npx supabase db dump

# Monitor performance
npx react-native-performance

# Check bundle size
npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output ios/main.jsbundle
```

## Reporting Issues

When reporting issues, include:
1. Device/OS version
2. Steps to reproduce
3. Expected vs actual behavior
4. Screenshots/videos if applicable
5. Console logs
6. Database state

## Sign-off

- [ ] Developer Testing Complete
- [ ] QA Testing Complete
- [ ] UAT Complete
- [ ] Product Owner Approval
- [ ] Ready for Production

---

**Last Updated**: Today
**Version**: 1.0
**Author**: AI-Powered Subjective Feedback Engine Implementation Team