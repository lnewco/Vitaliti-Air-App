# Data Flow

## Bluetooth Pipeline

1. Device broadcasts → `BluetoothService.startNotifications()`
2. Raw packet → `parsePacket()` extracts SpO2/HR
3. Parsed data → `BluetoothContext.updateReadings()`
4. Context update → UI components re-render

## Session Lifecycle

1. User starts → `SessionManager.startSession()`
2. Phase timer → Cycles hypoxic/hyperoxic phases
3. Each reading → Stored in readings array
4. Safety check → Pauses if threshold exceeded
5. Session ends → Saves locally then syncs to Supabase

## Wearables Sync

1. App launch → `WearablesDataService.syncData()`
2. Check tokens → Query oauth_tokens table
3. Fetch data → Call service-specific API
4. Store results → Insert into wearables_data
5. Display → Dashboard queries latest metrics

## Authentication Flow

1. Phone input → `AuthService.signInWithOtp()`
2. OTP verify → Supabase validates
3. Success → `AuthContext.setUser()`
4. Navigation → Redirects to MainAppContent

## Data Persistence

**Local Storage:**
- Session data → SQLite via DatabaseService
- User prefs → AsyncStorage
- Auth tokens → Secure storage

**Cloud Sync:**
- Sessions → Supabase tables
- Readings → Batch upload
- Wearables → Daily sync

## Error Handling

All services follow:
```
try {
  // Operation
} catch (error) {
  console.error('❌ Context:', error)
  // User-friendly fallback
}
```