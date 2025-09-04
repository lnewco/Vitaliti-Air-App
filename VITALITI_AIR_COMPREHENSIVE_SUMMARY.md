# Vitaliti Air Ecosystem - Comprehensive Technical Summary

## CRITICAL UPDATE (Dec 4, 2024)
**Important**: Previous documentation described features that DO NOT EXIST. After code verification:
- ❌ NO Progressive Overload System
- ❌ NO altitude progression logic  
- ❌ NO detraining detection
- ❌ NO phase metrics persistence
- ✅ Diamond UI works
- ✅ Wearables sync works
- ✅ Fixed altitude level 6 only

## 1. VITALITI AIR MOBILE APP

### Overview
The Vitaliti Air mobile app is a React Native (Expo) application designed for Intermittent Hypoxic-Hyperoxic Training (IHHT). It provides real-time biometric monitoring via Bluetooth pulse oximeters, guides users through breathing exercises at a FIXED altitude level (no progression), and tracks their physiological responses during training sessions.

### Core Technologies
- **Framework**: React Native with Expo SDK 53
- **Language**: JavaScript (ES6+)
- **State Management**: React Context API
- **Database**: Supabase (PostgreSQL) + Local SQLite
- **Bluetooth**: react-native-ble-plx for BLE communication
- **Navigation**: React Navigation v7
- **Charts**: Victory Native for data visualization
- **Authentication**: Supabase Auth with secure token storage

### Key Features

#### 1. Bluetooth Device Integration
- **Service**: `BluetoothService.js`
- Manages BLE connections to pulse oximeters
- Implements BCI Protocol for packet parsing
- Real-time SpO2 and heart rate monitoring
- Automatic device reconnection logic
- Multi-device support capability

#### 2. IHHT Session Management
- **Core**: `EnhancedSessionManager.js`
- Orchestrates 5-phase breathing cycles:
  - Pre-breathing preparation
  - Hypoxic phase (low oxygen)
  - Recovery phase
  - Hyperoxic phase (high oxygen)
  - Post-session recovery
- Dynamic phase duration adjustments
- Safety thresholds (SpO2 < 70%, HR limits)
- Audio/haptic feedback guidance
- Background session support

#### 3. Wearables Integration
- **Service**: `WearablesDataService.js`
- OAuth 2.0 integration with:
  - WHOOP (recovery, strain, sleep data)
  - Oura Ring (readiness, sleep, activity)
- Automatic daily sync at 8 AM
- 30-day historical data retrieval
- Token refresh management
- Data correlation with IHHT sessions

#### 4. User Experience Features
- Simplified session setup for new users
- Progressive difficulty adaptation
- Real-time biometric visualization
- Session history tracking
- Pre/post session surveys
- Personalized insights dashboard
- Export session data as PDF reports

#### 5. Background Services
- Aggressive background monitoring
- iOS HealthKit workout integration
- Android foreground service
- Session continuity across app states
- Automatic data sync when online

### Data Architecture
- **Local Storage**: SQLite for offline capability
- **Cloud Sync**: Supabase real-time sync
- **Data Models**:
  - Sessions (training records)
  - Readings (time-series biometrics)
  - Survey responses
  - OAuth tokens
  - Wearables data

### App Structure
```
src/
├── screens/          # UI screens (Dashboard, Training, History)
├── services/         # Business logic & API clients
├── components/       # Reusable UI components
├── context/         # Global state providers
├── config/          # App configuration
└── auth/            # Authentication logic
```

---

## 2. VITALITI AIR ANALYTICS DASHBOARD

### Overview
A Next.js 14 web application providing comprehensive analytics for the Vitaliti Air team to monitor user progress, analyze training patterns, and identify physiological responses across the user base.

### Core Technologies
- **Framework**: Next.js 14 with TypeScript
- **Database**: Supabase (shared with mobile app)
- **Charts**: Chart.js for data visualization
- **Styling**: Tailwind CSS
- **Deployment**: Render (vitaliti-analytics.render.com)
- **Authentication**: Password-protected for team access

### Key Features

#### 1. User Management
- Alpha user tracking and monitoring
- User search and filtering
- Session completion rates
- Engagement metrics
- Last activity tracking

#### 2. Session Analytics
- Detailed session visualization
- SpO2/HR timeline charts
- Phase transition analysis
- Safety event tracking
- Completion statistics
- Trend identification

#### 3. Data Visualization
- Interactive charts for:
  - SpO2 levels over time
  - Heart rate patterns
  - FiO2 (oxygen concentration) changes
  - Phase durations
  - Recovery patterns
- Comparative analysis across users
- Export capabilities for research

#### 4. Wearables Data Integration
- Display synced WHOOP metrics:
  - Recovery scores
  - Strain levels
  - Sleep performance
- Display Oura metrics:
  - Readiness scores
  - Sleep quality
  - Activity levels
- Correlation with IHHT sessions

#### 5. Administrative Tools
- Batch sync triggers
- Data integrity checks
- User profile management
- OAuth token monitoring
- System health dashboards

### AI Agent Service (Beta)
- **Location**: `ai-agent-service/`
- Experimental AI-driven insights
- Pattern recognition across users
- Predictive analytics for session outcomes
- Automated report generation
- Mock data testing framework

### Dashboard Structure
```
src/
├── app/              # Next.js app router pages
├── components/       # React components
├── lib/             # Utility functions
├── services/        # API services
└── types/           # TypeScript definitions

scripts/             # Database maintenance & sync scripts
```

---

## 3. INTEGRATION & INTERDEPENDENCIES

### Shared Infrastructure

#### Supabase Database
- **Central data repository** for both app and analytics
- **Real-time sync** between mobile app and web dashboard
- **Key tables**:
  - `users`: User profiles and settings
  - `sessions`: IHHT training records
  - `readings`: Time-series biometric data (SpO2, HR)
  - `oauth_tokens`: Wearables service authentication
  - `wearables_data`: Synced metrics from WHOOP/Oura
  - `survey_responses`: Pre/post session feedback
  - `sync_logs`: Integration tracking

#### Authentication Flow
1. Mobile app users authenticate via Supabase Auth
2. Auth tokens stored securely in device storage
3. Analytics dashboard uses separate team password
4. OAuth tokens for wearables stored encrypted

### Data Flow Architecture

#### Session Recording Pipeline
```
Mobile App → Bluetooth Device → Session Manager
    ↓
Local SQLite (offline storage)
    ↓
Supabase (when online)
    ↓
Analytics Dashboard (real-time updates)
```

#### Wearables Sync Pipeline
```
WHOOP/Oura APIs → Mobile App (OAuth)
    ↓
WearablesDataService (processing)
    ↓
Supabase (storage)
    ↓
Analytics Dashboard (visualization)
```

### Key Integration Points

#### 1. Real-time Session Monitoring
- Mobile app records session data
- Immediately syncs to Supabase
- Analytics dashboard updates live
- Team can monitor active sessions

#### 2. Wearables Data Correlation
- Daily sync triggered at 8 AM
- Mobile app fetches 30 days of data
- Stores in shared Supabase tables
- Analytics correlates with IHHT sessions
- Identifies recovery/training patterns

#### 3. User Journey Tracking
- Sign-up in mobile app
- Training sessions recorded
- Wearables connected (optional)
- Data visible in analytics
- Insights generated for optimization

#### 4. Feedback Loop
- Analytics identifies patterns
- Team adjusts protocols
- Updates pushed to mobile app
- Users receive personalized guidance
- Continuous improvement cycle

### API Endpoints & Services

#### Mobile App → Backend
- Session upload: `/api/sessions/create`
- Readings batch: `/api/readings/batch`
- Wearables sync: `/api/wearables/sync`
- Survey submit: `/api/surveys/submit`

#### Analytics → Backend
- User data: `/api/users/alpha`
- Session details: `/api/sessions/{id}`
- Aggregate stats: `/api/analytics/stats`
- Sync triggers: `/api/admin/sync`

### Security & Privacy
- End-to-end encryption for sensitive data
- OAuth tokens stored encrypted
- Row-level security in Supabase
- HIPAA-compliant data handling
- Regular security audits

### Deployment Architecture
- **Mobile App**: Distributed via App Store/Google Play
- **Analytics**: Hosted on Render with auto-scaling
- **Database**: Supabase cloud (US-East region)
- **CDN**: CloudFlare for static assets
- **Monitoring**: Error tracking and performance monitoring

---

## LINEAR INTEGRATION CAPABILITIES

### Setup Complete
Linear MCP server has been successfully configured in your Claude Code environment. You can now:

### Available Functions
1. **Create Issues**
   - Create tasks directly from this conversation
   - Assign to team members
   - Set priorities and statuses
   - Add labels and projects

2. **Manage Issues**
   - Update existing issues
   - Change status/priority
   - Add comments
   - Link related issues

3. **Search & Query**
   - Find issues by various criteria
   - View team workload
   - Track project progress
   - Generate reports

### How to Use
Simply ask me to create tasks in Linear, and I can:
- Create detailed issues with descriptions
- Assign them to specific team members
- Organize into projects
- Set appropriate priorities
- Add relevant labels

### Example Commands
- "Create a Linear issue for implementing X feature"
- "Add a bug report to Linear for the Y problem"
- "Create a task for updating the analytics dashboard"
- "Search for all open issues assigned to [team member]"

The Linear integration is now active and ready to use for task management across all three components of your Vitaliti Air ecosystem.

---

## NEXT STEPS

With this comprehensive context, you can now:
1. Create targeted Linear tasks for each component
2. Assign tasks to appropriate team members
3. Track progress across the entire ecosystem
4. Maintain consistency between app, analytics, and website

Would you like me to help you start creating specific tasks in Linear for any of these components?