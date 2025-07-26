# Vitaliti Air App

A React Native mobile application for Intermittent Hypoxia-Hyperoxia Training (IHHT) that connects to Bluetooth pulse oximeters to provide real-time biometric monitoring during training sessions.

## Overview

Vitaliti Air is a smart training companion that guides users through IHHT sessions using real-time SpO2 and heart rate feedback from Bluetooth-enabled pulse oximeters. The app implements the BCI Protocol V1.4 for medical device communication and provides safety monitoring throughout training sessions.

## Technology Stack

- **Frontend**: React Native 0.79.5 with Expo ~53.0.20
- **Backend**: Supabase (PostgreSQL, Authentication)
- **Bluetooth**: react-native-ble-plx with BCI Protocol V1.4
- **Navigation**: React Navigation 7.x (Stack + Bottom Tabs)
- **State Management**: React Context API + AsyncStorage
- **Charts**: react-native-chart-kit
- **Platform**: iOS 16.2+, Android

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   UI Screens    │    │    Services      │    │    Database     │
│                 │    │                  │    │                 │
│ • Dashboard     │    │ • BluetoothService│    │ • Supabase      │
│ • Training      │◄──►│ • SessionManager │◄──►│ • Local SQLite  │
│ • History       │    │ • AuthService    │    │ • AsyncStorage  │
│ • Auth          │    │ • DatabaseService│    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         ▲                       ▲
         └───────────────────────┘
              Context Providers
         (BluetoothContext, AuthContext)
```

## Project Structure

```
src/
├── auth/                      # Authentication system
│   ├── AuthContext.js         # Auth state management
│   ├── AuthService.js         # Supabase auth integration
│   └── screens/               # Login & OTP screens
├── components/                # Reusable UI components
│   ├── ConnectionManager.js   # Bluetooth connection UI
│   ├── HeartRateDisplay.js    # Heart rate visualization
│   ├── SafetyIndicator.js     # Safety status & alerts
│   ├── SpO2Display.js         # SpO2 visualization
│   └── StepIndicator.js       # Multi-step UI component
├── config/
│   └── supabase.js           # Supabase client configuration
├── context/
│   └── BluetoothContext.js   # Bluetooth state management
├── navigation/               # App navigation structure
│   ├── AppNavigator.js       # Root navigator
│   └── AuthNavigator.js      # Auth flow navigation
├── screens/                  # Main application screens
│   ├── DashboardScreen.js    # Home dashboard
│   ├── IHHTTrainingScreen.js # Live training session
│   ├── MainAppContent.js     # Authenticated app shell
│   ├── SessionHistoryScreen.js # Past sessions
│   └── SessionSetupScreen.js # Pre-training setup
└── services/                 # Core business logic
    ├── BluetoothService.js   # BLE device communication
    ├── DatabaseService.js    # Local data persistence
    ├── EnhancedSessionManager.js # Advanced session logic
    ├── SessionManager.js     # Basic session management
    └── SupabaseService.js    # Cloud data sync
```

## Getting Started

### Prerequisites

- Node.js 18+ 
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator (Xcode) or Android Emulator
- Supabase account and project

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Vitaliti-Air-App
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Supabase**
   - Update `src/config/supabase.js` with your Supabase URL and anon key
   - Run the database schema: `supabase-schema.sql`

4. **Start the development server**
   ```bash
   npm start
   # or
   expo start
   ```

5. **Run on device**
   ```bash
   # iOS
   npm run ios
   
   # Android  
   npm run android
   ```

### Environment Setup

The app requires Supabase configuration in `src/config/supabase.js`:

```javascript
const supabaseUrl = 'https://your-project.supabase.co';
const supabaseAnonKey = 'your-anon-key';
```

## Core Features

### Authentication System

**Phone Number Authentication**
- Users sign up/login using phone numbers
- SMS OTP verification via Supabase Auth
- Automatic user profile creation
- Persistent authentication state

**Implementation**: `src/auth/AuthService.js`, `src/auth/AuthContext.js`

### Bluetooth Integration

**BCI Protocol V1.4 Support**
- Connects to BCI-compatible pulse oximeters
- Real-time SpO2 and heart rate monitoring
- Automatic device discovery and pairing
- Connection status management

**Key UUIDs**:
- Service: `49535343-FE7D-4AE5-8FA9-9FAFD205E455`
- Data: `49535343-1E4D-4BD9-BA61-23C647249616`
- Command: `49535343-8841-43F4-A8D4-ECBE34729BB3`

**Implementation**: `src/services/BluetoothService.js`, `src/context/BluetoothContext.js`

### IHHT Training Sessions

**Session Structure**
- Fixed 5-cycle training protocol
- Hypoxic phases: 5 minutes each
- Hyperoxic (recovery) phases: 2 minutes each  
- Total session duration: 35 minutes
- Adjustable hypoxia intensity (0-10 scale)

**Safety Features**
- Continuous SpO2 monitoring
- Critical alerts when SpO2 < 80%
- Automatic session termination on device disconnect
- Finger detection monitoring

**Session Controls**
- Start/pause/resume functionality
- Manual phase skipping
- Emergency session termination
- Real-time progress tracking

**Implementation**: `src/screens/IHHTTrainingScreen.js`, `src/services/EnhancedSessionManager.js`

### Data Management

**Local Storage**
- Session data cached in SQLite
- User preferences in AsyncStorage
- Offline-capable data collection

**Cloud Sync**
- Session metadata stored in Supabase
- User profiles and preferences
- Session history and statistics

**Database Schema**:
- `sessions`: Session metadata and statistics
- `readings`: Individual SpO2/HR data points
- `user_profiles`: User account information

**Implementation**: `src/services/DatabaseService.js`, `src/services/SupabaseService.js`

### User Interface

**Dashboard Screen**
- Today/This Week session views
- Quick access to new sessions
- Session history overview

**Training Screen**
- Real-time biometric displays
- Phase timing and progress
- Safety status indicators
- Session controls

**History Screen**
- Past session summaries
- Detailed session data
- Export functionality

## Development Guidelines

### Code Style

- **Components**: Functional components with hooks
- **Naming**: camelCase for variables/functions, PascalCase for components
- **Imports**: Relative imports from `/src`, absolute for packages
- **Styling**: StyleSheet objects at component bottom
- **Error Handling**: Console logging with emoji prefixes (❌, ✅, 🎯, 📱)

### State Management

- **Global State**: Context API for Bluetooth and Auth
- **Local State**: useState for component-specific state
- **Persistence**: AsyncStorage for user preferences, SQLite for session data

### Bluetooth Implementation

**Connection Flow**:
1. Request permissions (Android location, Bluetooth)
2. Scan for BCI service UUID
3. Connect and discover characteristics
4. Set up data notifications
5. Parse incoming 5-byte BCI packets

**Data Parsing**:
```javascript
// BCI Protocol V1.4 - 5-byte packet structure
const signalStrength = byte1 & 0x0F;
const isFingerDetected = (byte3 & 0x10) === 0;
const pulseRate = ((byte3 & 0x40) << 1) | (byte4 & 0x7F);
const spo2 = byte5 & 0x7F;
```

### Safety Implementation

**Critical Safety Checks**:
- SpO2 < 80%: Full-screen alert + vibration
- Device disconnection: Automatic session pause
- Invalid readings: Visual indicators
- Finger detection: Connection status

## Database Schema

### Sessions Table
```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY,
  device_id TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  status TEXT DEFAULT 'active',
  total_readings INTEGER DEFAULT 0,
  avg_spo2 REAL,
  min_spo2 INTEGER,
  max_spo2 INTEGER,
  avg_heart_rate REAL,
  min_heart_rate INTEGER,
  max_heart_rate INTEGER
);
```

### Readings Table
```sql
CREATE TABLE readings (
  id BIGSERIAL PRIMARY KEY,
  session_id UUID REFERENCES sessions(id),
  timestamp TIMESTAMPTZ NOT NULL,
  spo2 INTEGER,
  heart_rate INTEGER,
  signal_strength INTEGER,
  is_valid BOOLEAN DEFAULT TRUE
);
```

## iOS Live Activities

The app includes iOS Live Activity support for displaying session progress on the lock screen:

- **Target**: `targets/widget/`
- **Configuration**: App Groups entitlement
- **Module**: Custom live activity module in `modules/live-activity/`

## Build Configuration

### Expo Configuration (`app.json`)

**iOS**:
- Deployment target: iOS 16.2+
- Background modes: Bluetooth, processing
- Live Activities support
- App Groups entitlement

**Android**:
- Bluetooth permissions
- Location permissions (required for BLE scanning)
- Edge-to-edge display

### Dependencies

**Core**:
- `react-native-ble-plx`: Bluetooth Low Energy
- `@supabase/supabase-js`: Backend services
- `@react-navigation/native`: Navigation
- `react-native-chart-kit`: Data visualization

**Storage**:
- `@react-native-async-storage/async-storage`: Preferences
- `react-native-sqlite-storage`: Session data

## Troubleshooting

### Bluetooth Issues

**Android Permission Problems**:
- Ensure location permission is granted
- Check Bluetooth is enabled
- Verify app has Bluetooth permissions in settings

**iOS Connection Issues**:
- Reset network settings if needed
- Ensure Bluetooth is enabled in Privacy settings
- Check app permissions in Settings > Privacy > Bluetooth

**Device Discovery**:
- Ensure pulse oximeter is in pairing mode
- Check device compatibility (BCI Protocol V1.4)
- Try restarting Bluetooth on phone

### Supabase Configuration

**Authentication Errors**:
- Verify Supabase URL and anon key
- Check phone number format (+1XXXXXXXXXX)
- Ensure SMS is configured in Supabase Auth

**Database Connection**:
- Verify RLS policies are configured
- Check network connectivity
- Ensure database schema is up to date

### Performance

**Memory Usage**:
- Bluetooth connections are properly cleaned up
- SQLite connections are managed efficiently
- Image assets are optimized

**Battery Optimization**:
- Background tasks are minimal
- Bluetooth scanning stops when not needed
- UI updates are throttled during sessions

## Contributing

1. Create a feature branch from `main`
2. Follow the established code style
3. Add appropriate error handling and logging
4. Test on both iOS and Android
5. Update documentation as needed

## Security Considerations

- Supabase RLS policies protect user data
- Phone numbers are validated before OTP send
- Session data is encrypted at rest
- Bluetooth communication uses secure pairing

## Medical Device Compliance

- Implements BCI Protocol V1.4 specification
- Follows medical device data handling best practices
- Includes appropriate safety warnings and alerts
- Maintains data integrity throughout transmission

---

**Note**: This application is designed for training purposes and should not be used as a medical diagnostic tool. Always consult healthcare professionals for medical advice. 