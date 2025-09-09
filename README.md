# Vitaliti Air App

A React Native mobile application for Intermittent Hypoxia-Hyperoxia Training (IHHT) that connects to Bluetooth pulse oximeters to provide real-time biometric monitoring during training sessions.

## Overview

Vitaliti Air is a streamlined training companion that guides users through IHHT sessions using real-time SpO2 and pulse rate feedback from Bluetooth-enabled pulse oximeters. The app implements the BCI Protocol V1.4 for medical device communication and provides safety monitoring throughout training sessions with a simplified, focused user experience.

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
├── design-system/            # Design system and theme components
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

**BCI Protocol V1.4 Support**
- Connects to BCI-compatible pulse oximeters
- Real-time SpO2 and pulse rate monitoring
- Automatic device discovery and pairing
- Simplified connection management (pulse oximeter only)

**Key UUIDs**:
- Service: `49535343-FE7D-4AE5-8FA9-9FAFD205E455`
- Data: `49535343-1E4D-4BD9-BA61-23C647249616`
- Command: `49535343-8841-43F4-A8D4-ECBE34729BB3`

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

Note: The deprecated `SessionManager.js` has been removed. All session management is now handled by `EnhancedSessionManager.js`.

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

### 📚 Design System
For detailed information about the app's design system, theme implementation, and component library, see:
- **[Design System Guide](docs/DESIGN_SYSTEM.md)** - Complete guide to the theme system, base components, and migration patterns

### Additional Documentation
- **Design System** - Theme tokens, components, patterns
- **Architecture** - App structure and data flow
- **Development** - Setup and debugging guides
- **API** - Backend integration details

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

The database schema is managed through migrations located in `database/migrations/`. Run migrations in order:

1. **001_initial_schema.sql** - Base tables (sessions, readings)
2. **002_auth_and_profiles.sql** - User authentication and profiles
3. **003_onboarding_data.sql** - Onboarding flow data
4. **004_surveys.sql** - Pre/post session surveys
5. **005_protocol_config.sql** - IHHT protocol configuration (deprecated - now hardcoded)
6. **006_security_policies.sql** - Row Level Security policies

Key tables include:
- `sessions` - Training session metadata
- `readings` - Individual sensor readings
- `user_profiles` - User account information
- `survey_responses` - Session survey data
- `protocol_templates` - IHHT protocol configurations

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
- Verify BCI Protocol V1.4 compatibility

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