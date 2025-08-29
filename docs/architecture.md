# Architecture

## Core Services

**BluetoothService** (`src/services/BluetoothService.js`)
- BLE device connection management
- BCI Protocol packet parsing
- See SERVICE_UUID and DATA_UUID constants in file

**EnhancedSessionManager** (`src/services/EnhancedSessionManager.js`)
- IHHT session orchestration
- Phase timing (see PHASE_DURATIONS in file)
- Safety monitoring (see SAFETY_THRESHOLDS in file)

**WearablesDataService** (`src/services/WearablesDataService.js`)
- Coordinates Whoop/Oura data sync
- OAuth token management
- Delegates to integration services:
  - `WhoopService.js` - Whoop API client
  - `OuraService.js` - Oura API client

## State Management

**BluetoothContext** (`src/context/BluetoothContext.js`)
- Provides: device, isConnected, currentReading
- Consumed by: all screens showing biometrics

**AuthContext** (`src/auth/AuthContext.js`)  
- Provides: user, signIn, signOut
- Consumed by: navigation & protected screens

## Navigation Structure

`MainAppContent.js` defines:
- Bottom tabs: Dashboard, History, Profile
- Stack screens: Training, Setup, PostSurvey
- Integration screens: Wearables management

## Database Schema

See `supabase/migrations/` for table definitions:
- `sessions` - Training session records
- `readings` - Time-series SpO2/HR data
- `oauth_tokens` - Wearable service tokens
- `wearables_data` - Synced metrics
- `survey_responses` - Pre/post session surveys

## Service Dependencies

```
SessionManager → BluetoothService (for readings)
              → DatabaseService (local storage)
              → SupabaseService (cloud sync)

WearablesDataService → WhoopService
                    → OuraService
                    → SupabaseService (token storage)
```