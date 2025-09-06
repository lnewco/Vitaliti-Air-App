# Changelog

## [2025-09-06] - Critical Bluetooth & Data Storage Fixes

### 🔧 Critical Fixes

#### Session Management
- **Fixed**: Session ID mapping - Resolved null `supabaseId` causing "unknown" session IDs in sync queue
- **Fixed**: Duplicate session prevention - Added mutex lock to prevent creating 2+ sessions per start
- **Fixed**: Session cleanup - Properly stops data collection when ending sessions

#### Data Storage
- **Fixed**: Reading storage bug - Corrected `flushReadingBuffer()` parameter order
- **Impact**: Readings now successfully store in database (confirmed 528 readings in test)
- **Fixed**: Queue overflow - Prevented invalid session IDs from flooding sync queue

#### Navigation & UI
- **Fixed**: Navigation crashes - Replaced `goBack()` with `replace()` for safer navigation
- **Improved**: Home screen arrows - Moved day navigation into card for better visual hierarchy

### 🚀 New Features

#### Mock Bluetooth Service
- **Added**: `MockBLEServiceWrapper` for Expo Go development
- Auto-connects after 1 second delay
- Generates realistic biometric data:
  - SpO2: 85-98% with natural variations
  - Heart Rate: 60-100 bpm with realistic patterns
- Enables full app testing without physical Bluetooth device

### 📊 Testing Results
- ✅ 528 readings successfully stored per session
- ✅ Consistent 1Hz data collection rate
- ✅ 5-second batch insert intervals working
- ✅ Average SpO2: 88%, Average HR: 87 bpm in tests

### 📝 Documentation
- Created `VITALITI_AIR_COMPREHENSIVE_SUMMARY.md` with complete project overview
- Updated `app_readme.md` with Bluetooth fixes and testing results
- Added detailed data flow architecture documentation

## [2024-12-06] - Premium UI Overhaul & Database Updates

### 🎨 UI/UX Improvements

#### Glass Morphism Implementation
- **Navigation Headers**: Implemented true glass morphism with BlurView (intensity 85) for all headers
- **Cards**: Added blur effects (intensity 20) to all interactive cards
- **Sticky Headers**: Fixed positioning with proper z-index management
- **Consistent Spacing**: Standardized spacing system (12px headers, 16px cards, 20px padding)

#### Screen Updates

##### SimplifiedSessionSetup.js
- Added premium glass morphism navigation bar with blur effects
- Implemented progress steps (1→2→3) with active state indicators
- Fixed duplicate header issue by disabling React Navigation header
- Adjusted spacing: paddingTop: 138px, marginBottom: 12px
- Added smooth spring animations for transitions
- Improved card shadows with opacity 0.3, radius 30

##### PostSessionSurveyScreen.js
- Redesigned to match Session Setup's premium design
- Integrated progress bar into sticky glass header
- Fixed spacing to match Session Setup exactly (paddingTop: 125px)
- Added glass morphism to all survey cards
- Improved overall rating display with premium styling

##### IHHTSessionSimple.js (Diamond UI)
- Enhanced visual effects with premium animations
- Improved biometric displays with glass effects
- Added spring animations for phase transitions
- Updated color scheme for better contrast

#### Component Updates

##### StarRating.js
- Fixed visual artifacts by removing LinearGradient backgrounds
- Simplified implementation using just Ionicons
- Improved touch targets and visual feedback
- Better color contrast for selected/unselected states

##### PreSessionSurvey.js
- Updated scale labels:
  - Energy: "Low" → "High" (removed "Very")
  - Mental Clarity: "Foggy" → "Sharp" (removed "Very")
  - Stress: Flipped scale - "Relaxed" (1) to "Stressed" (5)
- Improved visual consistency with other surveys

##### IntraSessionFeedback.js
- Increased panel height to 80% of screen for better accessibility
- Added ScrollView for long content
- Updated sensation options to match database schema
- Improved touch targets and spacing

##### FeedbackButton.js
- Migrated from SafeIcon to Ionicons for consistency
- Improved button styling with glass effects
- Better animation on press

### 📊 Database Updates

#### New Sensation Schema (20250906_update_sensations_schema.sql)
- Added new sensation options:
  - Positive: zen, euphoria
  - Physical: neck_tension, muscle_fatigue, trembling
  - Neurological: tingling, lightheaded, sleepy
- Created validation function `validate_sensations()`
- Added check constraints for data integrity
- Created GIN index for improved query performance
- Updated `save_intra_session_response()` function

### 🔧 Technical Improvements

#### Navigation Configuration
- Disabled default headers in MainAppContent.js for custom implementations
- Fixed navigation flash issue with `navigation.reset()`
- Improved screen transition animations

#### Icon System
- Completed migration from SafeIcon to Ionicons
- Consistent icon usage across all components
- Better icon scaling and alignment

#### Performance
- Optimized blur rendering with proper intensity values
- Reduced unnecessary re-renders in feedback components
- Improved scroll performance with proper list optimizations

### 🐛 Bug Fixes
- Fixed duplicate headers in SimplifiedSessionSetup and PostSessionSurvey
- Resolved excessive spacing issues throughout the app
- Fixed star rating visual artifacts (circular backgrounds)
- Corrected content cutoff in sticky headers
- Fixed syntax error in SimplifiedSessionSetup.js (missing closing brace)

### 📱 Design System Updates
- Apple-style typography: 34pt titles, 17pt navigation
- Deep shadows for premium depth perception
- Gradient backgrounds: Black (#000) → Dark (#0A0B0F) → Darker (#14161B)
- Consistent blur intensities: 85 for headers, 20 for cards
- Spring animations using React Native Reanimated

### 🗂️ File Changes

#### Modified Files
- src/screens/SimplifiedSessionSetup.js
- src/screens/PostSessionSurveyScreen.js
- src/screens/IHHTSessionSimple.js
- src/screens/MainAppContent.js
- src/components/feedback/StarRating.js
- src/components/feedback/PreSessionSurvey.js
- src/components/feedback/IntraSessionFeedback.js
- src/components/feedback/FeedbackButton.js
- src/services/EnhancedSessionManager.js

#### New Files
- supabase/migrations/20250906_update_sensations_schema.sql
- IHHT_V2_IMPLEMENTATION_PLAN.md
- IHHT_V2_SETUP_GUIDE.md

#### Documentation Updates
- app_readme.md - Added premium UI section
- air_comprehensive_summary.md - Updated with latest changes
- README.md - Updated with new features

### 📝 Notes
- All changes maintain backward compatibility
- No breaking changes to existing APIs
- Database migration is non-destructive
- UI changes enhance but don't break existing functionality

---

## Previous Releases

[Earlier releases documented in previous commits]