# Services Architecture

This directory contains the core service layer for the Vitaliti Air App, managing data persistence, Bluetooth connectivity, and cloud synchronization.

## Service Overview

### 🗄️ DatabaseService
**Purpose:** Local SQLite database management for offline-first storage
**Location:** `DatabaseService.js`

- Manages all local data persistence (sessions, readings, surveys, metrics)
- Handles database initialization and migrations
- Provides CRUD operations for all data entities
- Works in conjunction with SupabaseService for cloud sync

**Key Methods:**
- `createSession()` - Creates new training sessions
- `endSession()` - Finalizes sessions with statistics
- `savePhaseStats()` - Stores altitude/recovery phase metrics
- `saveCycleMetrics()` - Records per-cycle data
- `saveAdaptiveEvent()` - Logs mask lifts and adjustments

### 📡 BluetoothService
**Purpose:** Manages BLE connections for pulse oximeter devices
**Location:** `BluetoothService.js`

- Handles device scanning and connection management
- Parses real-time data from Wellue and BerryMed devices
- Implements device-specific protocols
- Manages connection resilience and auto-reconnection

**Key Methods:**
- `startScanning()` - Discovers BLE devices
- `connectToDevice()` - Establishes connection to pulse oximeter
- `disconnect()` - Cleanly disconnects from devices
- `setOnPulseOxDataReceived()` - Registers data callback

### ☁️ SupabaseService
**Purpose:** Cloud synchronization and authentication management
**Location:** `SupabaseService.js`

- Syncs local sessions to Supabase backend
- Manages online/offline state transitions
- Handles user authentication state
- Maintains session ID mapping (local ↔ cloud)

**Key Methods:**
- `createSession()` - Creates cloud session record
- `endSession()` - Syncs final session data
- `syncPreSessionSurvey()` - Uploads pre-session surveys
- `syncPostSessionSurvey()` - Uploads post-session surveys

### 🎭 Mock Services
**Purpose:** Development and testing without hardware
**Location:** `MockBLEService.js`, `MockBLEServiceWrapper.js`

- **MockBLEService:** Core mock data generation
  - Simulates realistic SpO2/HR patterns
  - Cycle-specific behaviors for testing
  - Mask lift scenarios

- **MockBLEServiceWrapper:** Interface adapter
  - Wraps MockBLEService for BluetoothContext compatibility
  - Auto-connects for easier development
  - Implements full BluetoothService interface

## Service Dependencies

```
BluetoothContext
    ├── BluetoothService (Production)
    └── MockBLEServiceWrapper → MockBLEService (Development)

SessionManager
    ├── DatabaseService (Local Storage)
    └── SupabaseService (Cloud Sync)
```

## Background Services

### 🔄 BackgroundService Architecture
**Location:** `BackgroundService.js`, `ServiceFactory.js`

The app uses a factory pattern to select the appropriate background service based on the runtime environment:

- **ExpoBackgroundService:** Expo-specific implementation
- **NativeBackgroundService:** React Native bare workflow
- **AggressiveBackgroundService:** Enhanced background processing
- **BaseBackgroundService:** Abstract base class

**ServiceFactory** automatically selects the correct implementation based on:
- Platform (iOS/Android)
- Expo vs bare React Native
- Available APIs

## Data Flow

1. **Session Creation:**
   - SessionManager → DatabaseService (local) → SupabaseService (cloud)

2. **Real-time Data:**
   - Pulse Oximeter → BluetoothService → SessionManager → DatabaseService

3. **Synchronization:**
   - DatabaseService → SupabaseService (when online)
   - Queue-based sync for offline-to-online transitions

## Error Handling

All services implement comprehensive error handling:
- Logging via centralized logger utility
- Graceful degradation for offline scenarios
- Automatic retry mechanisms for transient failures
- User-friendly error messages bubbled to UI

## Testing

Mock services enable testing without hardware:
- Set `USE_MOCK_BLE=true` in environment
- MockBLEService generates realistic training patterns
- Supports all session phases and scenarios

## Future Improvements

- [ ] Implement comprehensive test coverage
- [ ] Add request/response interceptors for API logging
- [ ] Standardize error response formats
- [ ] Implement migration system for database updates
- [ ] Add performance monitoring and analytics