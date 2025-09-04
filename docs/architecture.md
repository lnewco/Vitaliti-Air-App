# Architecture

## Core Services

**BluetoothService** (`src/services/BluetoothService.js`)
- Multi-device BLE connection management
- BCI Protocol packet parsing
- Real-time SpO2/HR data streaming
- Automatic reconnection logic
- See SERVICE_UUID and DATA_UUID constants in file

**EnhancedSessionManager** (`src/services/EnhancedSessionManager.js`)
- IHHT session orchestration with adaptive control
- 5-phase cycle management (prep, hypoxic, recovery, hyperoxic, post)
- Dynamic phase timing based on user response
- Safety monitoring with multi-tier thresholds:
  - Emergency: SpO2 < 75%
  - Double breath: SpO2 < 80%
  - Single breath: SpO2 < 83%
- Progressive overload tracking

**AdaptiveInstructionEngine** (`src/services/AdaptiveInstructionEngine.js`)
- Real-time instruction generation
- Context-aware guidance based on:
  - Current SpO2/HR values
  - Phase progression
  - User experience level
  - Mask lift events
- Audio and haptic feedback coordination

**WearablesDataService** (`src/services/WearablesDataService.js`)
- Orchestrates WHOOP/Oura data synchronization
- OAuth 2.0 token management with automatic refresh
- Daily sync scheduling (8 AM default)
- 30-day historical data retrieval
- Delegates to specialized services:
  - `WhoopService.js` - WHOOP API client (recovery, strain, sleep)
  - `OuraService.js` - Oura API client (readiness, activity, sleep)
  - `SyncTriggerService.js` - Manual sync coordination

## State Management

**BluetoothContext** (`src/context/BluetoothContext.js`)
- Provides: device, isConnected, currentReading, connectionQuality
- Real-time SpO2/HR updates at 1Hz
- Connection state management
- Consumed by: all screens showing biometrics

**AuthContext** (`src/auth/AuthContext.js`)  
- Provides: user, signIn, signOut, sessionToken
- Supabase authentication integration
- Secure token storage
- Consumed by: navigation & protected screens

**SessionContext** (implicit in EnhancedSessionManager)
- Phase state management
- Dial position tracking
- Mask lift event monitoring
- Safety threshold enforcement

## Navigation Structure

`MainAppContent.js` defines:
- Bottom tabs: 
  - Dashboard (PremiumDashboard)
  - History (SessionHistoryScreen)
  - Profile (PremiumProfileScreen)
- Stack screens:
  - Training flows:
    - SimplifiedSessionSetup (progressive overload)
    - IHHTSessionSimple (diamond UI training)
    - PostSessionSurveyScreen
  - Integration screens:
    - IntegrationsScreen (wearables management)
    - SettingsScreen (app configuration)
- Modal overlays:
  - IntraSessionFeedback (mid-session surveys)
  - FeedbackButton (quick feedback)

## Database Schema (IHHT v2)

Core tables in Supabase:
- `sessions` - Training session records with dial progression
- `readings` - Time-series SpO2/HR data (1Hz sampling)
- `oauth_tokens` - Wearable service authentication
- `wearables_data` - WHOOP/Oura synced metrics
- `survey_responses` - Pre/post/intra session feedback

New IHHT v2 tables (planned):
- `altitude_levels` - Dial position to FiO2/altitude mapping
- `user_hypoxia_experience` - User progression tracking
- `mask_lift_events` - Safety event logging
- `dial_adjustments` - Progressive overload history
- `phase_metrics` - Per-phase performance data
- `intrasession_surveys` - Mid-session subjective scores

## Service Dependencies

```
EnhancedSessionManager → BluetoothService (real-time readings)
                      → AdaptiveInstructionEngine (guidance)
                      → DatabaseService (local storage)
                      → SupabaseService (cloud sync)
                      → AudioService (feedback)
                      → HapticService (vibration)

WearablesDataService → WhoopService (recovery/strain/sleep)
                    → OuraService (readiness/activity)
                    → SyncTriggerService (manual sync)
                    → SupabaseService (token & data storage)

AdaptiveInstructionEngine → BluetoothContext (current metrics)
                         → SessionManager (phase state)
                         → UserExperience (progression)
```

## Component Hierarchy

```
IHHTSessionSimple (Main Training Screen)
├── DiamondMetricsDisplay
│   ├── SpO2Display (top)
│   ├── AltitudeDisplay (left)
│   ├── HeartRateDisplay (right)
│   └── StatusDisplay (bottom)
├── EKGWave (animated heartbeat)
├── MountainVisualization (altitude)
├── SessionProgressBar
├── IntraSessionFeedback (modal)
└── FeedbackButton (floating)

SimplifiedSessionSetup
├── DeviceSelection
├── DialPositionGuide
├── ExperienceAssessment
└── PreSessionCountdown
```