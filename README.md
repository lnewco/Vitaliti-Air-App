# Vitaliti Air App

A React Native mobile application for Intermittent Hypoxia-Hyperoxia Training (IHHT) that connects to Bluetooth pulse oximeters to provide real-time biometric monitoring during training sessions.

## Overview

Vitaliti Air is a streamlined training companion that guides users through IHHT sessions using real-time SpO2 and pulse rate feedback from Bluetooth-enabled pulse oximeters. The app supports Wellue O2Ring and Checkme O2 devices for medical device communication and provides safety monitoring throughout training sessions with a simplified, focused user experience.

## Technology Stack

- **Frontend**: React Native 0.79.5 with Expo ~53.0.20
- **Backend**: Supabase (PostgreSQL, Authentication)
- **Bluetooth**: react-native-ble-plx with Wellue/Viatom protocol
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
│   ├── base/                  # Design system components
│   │   ├── Button.js          # Theme-aware button
│   │   ├── Card.js            # Container component
│   │   ├── Badge.js           # Status indicators
│   │   ├── Typography.js      # Text components
│   │   └── MetricDisplay.js   # Metric visualization
│   ├── onboarding/            # Onboarding flow components
│   ├── ErrorBoundary.js       # Error handling wrapper
│   ├── HeartRateDisplay.js    # Heart rate visualization
│   ├── OptimizedConnectionManager.js # Bluetooth connection UI
│   ├── SafetyIndicator.js     # Safety status & alerts
│   └── SpO2Display.js         # SpO2 visualization
├── config/
│   └── supabase.js           # Supabase client configuration
├── theme/                    # Design system theme
│   ├── colors/               # Color palette & themes
│   ├── typography.js         # Typography scales
│   ├── spacing.js            # Spacing system
│   └── ThemeContext.js       # Theme provider
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
│   ├── SimplifiedSessionSetup.js # Streamlined session setup
│   └── PostSessionSurveyScreen.js # Post-session feedback
├── services/                 # Core business logic
│   ├── BluetoothService.js   # BLE device communication
│   ├── DatabaseService.js    # Local data persistence
│   ├── EnhancedSessionManager.js # Unified session management
│   └── SupabaseService.js    # Cloud data sync
└── utils/                    # Utility functions
    ├── logger.js             # Centralized logging system
    ├── sessionIdGenerator.js  # Session ID generation
    └── surveyValidation.js   # Survey form validation
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
   - Run database migrations in order from `database/migrations/` folder

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

**Wellue/Viatom Device Support**
- Connects to Wellue O2Ring and Checkme O2 pulse oximeters
- Real-time SpO2, pulse rate, and perfusion index monitoring
- Automatic device discovery and pairing
- Smart reconnection after disconnects
- Battery level monitoring

**Supported Devices**:
- Wellue O2Ring (ring-style continuous monitor)
- Checkme O2 (fingertip pulse oximeter)
- Other Viatom-compatible devices

**Key UUIDs**:
- Service: `14839ac4-7d7e-415c-9a42-167340cf2339`
- TX (Read/Notify): `0734594a-a8e7-4b1a-a6b1-cd5243059a57`
- RX (Write): `8b00ace7-eb0b-49b0-bbe9-9aee0a26e1a3`

**Implementation**: `src/services/BluetoothService.js`, `src/context/BluetoothContext.js`

### IHHT Training Sessions

**Session Structure**
- Fixed protocol: 5 cycles
- Phase durations: 7-minute hypoxic, 3-minute hyperoxic
- Total session duration: ~50 minutes
- Default altitude level: 6 (adjustable in code)
- Simplified single-screen setup

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
- Post-session survey for feedback

**Implementation**: `src/screens/IHHTTrainingScreen.js`, `src/services/EnhancedSessionManager.js`

### Session Recovery System

**Automatic Recovery Features**
- Sessions automatically recover after app crashes or force quits
- Recovery available for sessions less than 10 minutes old
- Phase timers and progress continue even when app is killed
- Smart recovery prompts when reopening the app
- Automatic Bluetooth reconnection to previously paired devices

**Recovery Flow**:
1. App detects interrupted session on launch
2. User prompted to continue or start new session
3. Session state restored including phase, cycle, and timings
4. Bluetooth reconnection attempted automatically
5. Data continuity maintained across interruption

**Implementation**: `src/services/EnhancedSessionManager.js`

### Health Screening & Safety System

**Medical Contraindication Screening**
The app includes comprehensive health screening to ensure user safety:

**Automatic Exclusions**:
- Heart disease or cardiovascular conditions
- Pregnancy
- Chronic Obstructive Pulmonary Disease (COPD)
- Uncontrolled hypertension
- Recent stroke or TIA
- Severe asthma
- Active cancer treatment
- Epilepsy or seizure disorders

**Safety Features**:
- Users with contraindications cannot proceed with training
- Legal liability waiver required before first session
- Research consent optional for data collection
- Age verification (18+ requirement)
- Emergency contact information collection

**Implementation**: `src/components/onboarding/`, `src/utils/surveyValidation.js`

### Advanced Background Processing (iOS)

**Aggressive Background Service**
The app uses multiple iOS background techniques to maintain session continuity:

**Background Modes**:
1. **Bluetooth Central** - Maintains device connection
2. **Background Processing** - Continues session timing
3. **Background Fetch** - Periodic data sync
4. **Silent Push Notifications** - Remote wake capability
5. **Audio Session** - Silent audio for extended runtime
6. **Location Updates** - Minimal power location tracking
7. **Network Keepalive** - Maintains server connection
8. **State Restoration** - Recovers after termination

**Background Behavior**:
- Sessions continue for full duration when backgrounded
- Phase transitions occur automatically
- Critical SpO2 alerts delivered within 5 seconds
- Bluetooth reconnection within 10 seconds of foregrounding
- Less than 5% data loss during background operation

**Live Activities Support**:
- Real-time session progress on lock screen
- Dynamic Island integration (iOS 16.2+)
- Phase tracking and timers
- SpO2 and heart rate display
- Compact, minimal, and expanded views

**Implementation**: `src/services/AggressiveBackgroundService.js`, `modules/live-activity/`

### Survey System

**Comprehensive Feedback Collection**
- Post-session surveys with validation
- Multi-step survey flow with progress tracking
- Scale inputs (1-10) for subjective metrics
- Free-text notes for qualitative feedback
- Real-time validation with error messages
- Data persistence to Supabase

**Survey Components**:
- `SurveyModal.js` - Main survey container
- `SurveyScaleInput.js` - Numeric scale inputs
- `SurveyNotesInput.js` - Text feedback collection
- `surveyValidation.js` - Validation logic

**Implementation**: `src/components/survey/`, `src/utils/surveyValidation.js`

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
- Simplified session overview
- Quick access to start training
- Recent session summary
- Profile access

**Training Screen**
- Real-time biometric displays
- Phase timing and progress
- Safety status indicators
- Session controls

**History Screen**
- Past session summaries
- Detailed session data
- Export functionality

## Documentation

### 📚 Core Documentation
- **[Design System Guide](docs/DESIGN_SYSTEM.md)** - Theme system, base components, and UI patterns
- **[Testing Guide](docs/TESTING.md)** - Comprehensive testing procedures and safety validation
- **[Environment Setup](docs/ENVIRONMENT_SETUP.md)** - Configuration and API key management
- **[Wellue Integration](docs/bluetooth_specs/WELLUE_INTEGRATION.md)** - Bluetooth protocol documentation

### Quick Links
- **Design System** - Theme tokens, components, patterns
- **Testing** - Safety testing, device testing, background testing
- **Bluetooth** - Device integration and troubleshooting
- **Database** - Schema and migrations

## Development Guidelines

### Code Style

- **Components**: Functional components with hooks
- **Naming**: camelCase for variables/functions, PascalCase for components
- **Imports**: Relative imports from `/src`, absolute for packages
- **Styling**: Use theme-aware base components from design system
- **Theming**: Access theme via `useAppTheme()` hook
- **Error Handling**: Console logging with emoji prefixes (❌, ✅, 🎯, 📱)

### State Management

- **Global State**: Context API for Bluetooth and Auth
- **Local State**: useState for component-specific state
- **Persistence**: AsyncStorage for user preferences, SQLite for session data

### Bluetooth Implementation

**Connection Flow**:
1. Request permissions (Android location, Bluetooth)
2. Scan for Wellue/Viatom devices by name pattern
3. Connect and discover characteristics
4. Enable notifications on TX characteristic
5. Send periodic GET_RT_DATA commands
6. Parse 13-byte response packets

**Data Format**:
```javascript
// Wellue Protocol - 13-byte real-time data structure
const spo2 = data[0];              // SpO2 percentage
const heartRate = data[1] | (data[2] << 8); // Heart rate BPM
const battery = data[7];            // Battery percentage
const perfusionIndex = data[10] / 10; // PI value
const isWearing = (data[11] & 0x01) === 1; // Wear status
```

### Safety Implementation

**Critical Safety Checks**:
- SpO2 < 80%: Full-screen alert + vibration
- Device disconnection: Automatic session pause
- Invalid readings: Visual indicators
- Finger detection: Connection status

## Database Schema

The database schema is managed through migrations located in `database/migrations/`. Run migrations in order:

1. **001_initial_schema.sql** - Base tables (sessions, readings)
2. **002_auth_and_profiles.sql** - User authentication and profiles
3. **003_onboarding_data.sql** - Onboarding flow data
4. **004_surveys.sql** - Pre/post session surveys
5. **005_protocol_config.sql** - IHHT protocol configuration (deprecated - now hardcoded)
6. **006_security_policies.sql** - Row Level Security policies
7. **008_add_hrv_to_readings.sql** - Heart Rate Variability support
8. **009_calibration_sessions.sql** - Device calibration sessions
9. **010_add_perfusion_index.sql** - Perfusion index tracking

Key tables include:
- `sessions` - Training session metadata
- `readings` - Individual sensor readings (includes HRV and PI)
- `user_profiles` - User account information
- `survey_responses` - Session survey data
- `calibration_sessions` - Device calibration data

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

## Background Functionality

### iOS Background Modes
The app is configured with the following background modes for continuous operation:
- **Bluetooth Central**: Maintains pulse oximeter connection when app is backgrounded
- **Background Processing**: Continues session timing and safety monitoring
- **Expected Duration**: iOS allows ~30 seconds of background processing with periodic execution windows

### Background Behavior
- **Session Continuity**: IHHT sessions continue running when app is backgrounded
- **Bluetooth Persistence**: Maintains connection to pulse oximeter devices
- **Safety Monitoring**: Critical SpO2 alerts (< 80%) delivered as notifications
- **Data Integrity**: Session progress and readings preserved during background operation
- **Automatic Recovery**: Seamless sync when returning to foreground

### iOS Limitations
- **Background Execution**: Limited to 30-second windows by iOS
- **Bluetooth Suspension**: May suspend after ~10 seconds, with rapid reconnection
- **Battery Impact**: Background BLE operations consume additional power
- **User Settings**: Requires Background App Refresh enabled for optimal performance

## Build Types & Testing

### Build Profiles

| Build Type | Use Case | Background Testing | Installation |
|------------|----------|-------------------|--------------|
| **Development** | Debugging with dev server | Limited | Requires `npx expo start --dev-client` |
| **Preview** | Realistic background testing | ✅ **Recommended** | Direct install via QR/link |
| **Production** | App Store/TestFlight | Full capability | App Store distribution |

### Creating Builds

```bash
# Development build (debugging)
eas build --profile development --platform ios

# Preview build (background testing) - RECOMMENDED
eas build --profile preview --platform ios

# Production build (App Store)
eas build --profile production --platform ios
```

## Background Testing Instructions

### Setup for Background Testing

1. **Use Preview Build**: Create and install a preview build for realistic testing
   ```bash
   eas build --profile preview --platform ios
   ```

2. **Device Configuration**:
   - Enable Background App Refresh: Settings → General → Background App Refresh → Vitaliti Air
   - Ensure Bluetooth is enabled and permissions granted
   - Connect pulse oximeter before starting session

### Testing Procedure

1. **Start IHHT Session**:
   - Connect to pulse oximeter
   - Begin training session
   - Verify readings are coming through

2. **Background Testing**:
   - Press home button or swipe up to background the app
   - Wait 5-10 minutes while doing other activities
   - Monitor for any critical alerts/notifications

3. **Return to App**:
   - Re-open Vitaliti Air app
   - Verify session continued running
   - Check data integrity and timing accuracy
   - Confirm Bluetooth reconnection

### Expected Results

✅ **Session continues** for full 35-minute duration when backgrounded  
✅ **Phase transitions** occur automatically (Hypoxic ↔ Hyperoxic)  
✅ **Critical alerts** delivered within 5 seconds of SpO2 < 80%  
✅ **Bluetooth reconnection** within 10 seconds of app foregrounding  
✅ **Data preservation** with < 5% reading loss during background operation  

### Troubleshooting Background Issues

**Session Pauses When Backgrounded**:
- Check Background App Refresh is enabled
- Verify app has Bluetooth permissions
- Ensure device has sufficient battery

**Bluetooth Disconnects**:
- Normal behavior - should reconnect automatically
- Check pulse oximeter battery level
- Verify Wellue/Viatom device compatibility

**Missing Notifications**:
- Check notification permissions
- Verify Do Not Disturb settings
- Critical alerts should bypass DND when enabled

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
- Device name should start with "Checkme O2" or "Wellue"
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

- Implements Wellue/Viatom communication protocol
- Follows medical device data handling best practices
- Includes comprehensive health screening and contraindication checks
- Maintains data integrity with CRC8 validation
- Automatic safety exclusions for high-risk conditions

---

**Note**: This application is designed for training purposes and should not be used as a medical diagnostic tool. Always consult healthcare professionals for medical advice. 