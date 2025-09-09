# Services Architecture

## Overview
The services layer provides the core business logic and data management for the Vitaliti Air app. All services follow an offline-first architecture with cloud synchronization capabilities.

## Core Services

### 📱 BluetoothService
**Purpose:** Manages BLE connections to pulse oximeter devices  
**Location:** `BluetoothService.js`  
**Key Responsibilities:**
- Device discovery and connection management
- Real-time SpO2 and heart rate data streaming
- Support for multiple device protocols (Wellue, BCI)
- Connection resilience and auto-recovery

**Usage:**
```javascript
// Acquire reference before use
BluetoothService.acquireReference();

// Start scanning for devices
await BluetoothService.startScanning('pulse-ox');

// Connect to discovered device
await BluetoothService.connectToDevice(device);

// Get latest metrics
const metrics = BluetoothService.getLatestMetrics();
// Returns: { spo2: 95, heartRate: 72 }
```

### 🗄️ DatabaseService
**Purpose:** Local SQLite database for offline-first storage  
**Location:** `DatabaseService.js`  
**Key Responsibilities:**
- Session lifecycle management
- Readings and metrics storage
- Survey data persistence
- Adaptive system event tracking

**Usage:**
```javascript
// Initialize database
await DatabaseService.init();

// Create new session
const session = await DatabaseService.createSession(sessionId);

// Save survey data
await DatabaseService.savePreSessionSurvey(sessionId, clarity, energy, stress);

// End session with stats
await DatabaseService.endSession(sessionId, stats);
```

### ☁️ SupabaseService
**Purpose:** Cloud synchronization and data backup  
**Location:** `SupabaseService.js`  
**Key Responsibilities:**
- Session mapping (local ID ↔ cloud ID)
- Offline sync queue management
- Automatic retry with exponential backoff
- Batch data uploads

**Usage:**
```javascript
// Initialize service
await SupabaseService.initialize();

// Create cloud session
await SupabaseService.createSession(sessionData);

// Sync readings batch
await SupabaseService.addReadingsBatch(readings);

// Sync survey data
await SupabaseService.syncPostSessionSurvey(sessionId, ...surveyData);
```

### 🎯 EnhancedSessionManager
**Purpose:** Orchestrates training sessions and coordinates all services  
**Location:** `EnhancedSessionManager.js`  
**Key Responsibilities:**
- Session state management
- Phase and cycle tracking
- Adaptive altitude adjustments
- Real-time metrics processing

### 🧠 AdaptiveInstructionEngine
**Purpose:** Intelligent altitude adjustment based on physiological response  
**Location:** `AdaptiveInstructionEngine.js`  
**Key Responsibilities:**
- SpO2 pattern analysis
- Mask lift detection
- Altitude level recommendations
- Performance tracking

## Mock Services (Development)

### 🔧 MockBLEService
**Purpose:** Simulates pulse oximeter data for development  
**Location:** `MockBLEService.js`  
**Key Features:**
- Realistic SpO2 patterns by cycle
- Mask lift simulation
- Configurable test scenarios

### 🔧 MockBLEServiceWrapper
**Purpose:** Adapter between MockBLEService and BluetoothContext  
**Location:** `MockBLEServiceWrapper.js`  
**Key Features:**
- Auto-connection on init
- BluetoothService interface compatibility
- Reference counting support

**Usage:**
```javascript
// In BluetoothContext when USE_MOCK_BLE is true
import bluetoothService from './services/MockBLEServiceWrapper';
```

## Data Flow

```
Physical Device / Mock
        ↓
  BluetoothService
        ↓
 SessionManager ←→ AdaptiveEngine
        ↓
  DatabaseService
        ↓
  SupabaseService
        ↓
    Cloud DB
```

## Service Communication Patterns

### Event-Driven Updates
Services use callbacks for real-time updates:
```javascript
BluetoothService.setOnPulseOxDataReceived((data) => {
  // Process real-time SpO2 data
});
```

### Promise-Based Operations
All async operations return promises:
```javascript
const session = await DatabaseService.createSession(id);
```

### Reference Counting
Services requiring lifecycle management use reference counting:
```javascript
// Component mount
BluetoothService.acquireReference();

// Component unmount
BluetoothService.releaseReference();
```

## Offline-First Architecture

1. **Write Path:**
   - Data always written to local DB first
   - Queued for sync if online
   - Sync happens in background

2. **Read Path:**
   - Always read from local DB
   - Background sync updates local data
   - No direct cloud reads during sessions

3. **Sync Queue:**
   - Operations queued when offline
   - Automatic retry with backoff
   - Persisted across app restarts

## Error Handling

All services implement consistent error handling:
- Errors logged via centralized logger
- User-facing errors via Alert
- Automatic recovery where possible
- Graceful degradation when offline

## Testing

### Using Mock Services
Set `USE_MOCK_BLE = true` in BluetoothContext to use mock data:
- No physical device required
- Predictable test scenarios
- Faster development cycles

### Service Isolation
Each service can be tested independently:
- DatabaseService: Direct SQLite operations
- BluetoothService: Mock BLE manager
- SupabaseService: Mock network responses

## Best Practices

1. **Always initialize services** before use
2. **Use reference counting** for lifecycle management
3. **Handle offline scenarios** gracefully
4. **Log all errors** for debugging
5. **Batch operations** when possible
6. **Clean up resources** on unmount

## Future Improvements

- [ ] Add service health monitoring
- [ ] Implement data compression for sync
- [ ] Add conflict resolution for offline edits
- [ ] Create service test suite
- [ ] Add performance metrics tracking