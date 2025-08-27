# Linear Technical Debt Tickets

## TICKET 1: Environment Configuration Management System

### Title
Implement proper environment configuration management for feature flags and API endpoints

### Priority
P1 - Critical

### Description
Currently, feature flags like Bluetooth requirements are hardcoded with runtime detection. This creates issues for testing across different environments and makes it difficult to control feature behavior without code changes.

### Current State
```javascript
// File: src/screens/SimplifiedSessionSetup.js (Line 39-41)
const ALLOW_DEMO_MODE = __DEV__ && Constants.appOwnership === 'expo';

// Used in multiple places:
// Line 55: if (!ALLOW_DEMO_MODE && !isPulseOxConnected)
// Line 269: disabled={!ALLOW_DEMO_MODE && !isPulseOxConnected || isStartingSession}
// Line 251: ALLOW_DEMO_MODE ? 'Training in demo mode' : 'Connect pulse oximeter'
```

### Problems
1. Cannot test production behavior in Expo Go
2. Cannot enable demo mode in development builds
3. No way to toggle features without deploying new code
4. Environment-specific configs are scattered throughout codebase
5. Supabase keys and API URLs are hardcoded in multiple files

### Acceptance Criteria
- [ ] Create `.env.development`, `.env.staging`, `.env.production`, `.env.expo` files
- [ ] Implement react-native-config or expo-constants configuration
- [ ] Move all feature flags to environment config
- [ ] Create config service to centralize access
- [ ] Document all available environment variables
- [ ] Ensure configs are properly loaded based on build type

### Implementation Details
1. Install and configure react-native-config
2. Create config structure:
```javascript
// src/config/environment.js
export default {
  ALLOW_DEMO_MODE: Config.ALLOW_DEMO_MODE === 'true',
  REQUIRE_BLUETOOTH: Config.REQUIRE_BLUETOOTH === 'true',
  API_URL: Config.API_URL,
  SUPABASE_URL: Config.SUPABASE_URL,
  SUPABASE_ANON_KEY: Config.SUPABASE_ANON_KEY,
  ENABLE_ADAPTIVE_TRAINING: Config.ENABLE_ADAPTIVE_TRAINING === 'true',
  SPO2_LOWER_THRESHOLD: parseInt(Config.SPO2_LOWER_THRESHOLD || '85'),
  SPO2_UPPER_THRESHOLD: parseInt(Config.SPO2_UPPER_THRESHOLD || '90'),
}
```
3. Update all hardcoded values to use config
4. Add build scripts for each environment

### Affected Files
- `src/screens/SimplifiedSessionSetup.js`
- `src/services/SupabaseService.js`
- `src/services/AdaptiveInstructionEngine.js`
- `src/auth/AuthService.js`
- `app.json` (needs environment-specific builds)

### Estimation
5-8 days

---

## TICKET 2: Standardize Navigation Route Names and Structure

### Title
Fix navigation route naming inconsistencies and implement type-safe navigation

### Priority
P1 - Critical

### Description
Navigation routes are inconsistently named across the app, causing runtime errors. The same screen is referenced by different names (IHHTTraining vs AirSession), leading to navigation failures.

### Current State
```javascript
// File: src/screens/MainAppContent.js (Lines 95-157)
<Stack.Screen name="SessionSetup" component={SimplifiedSessionSetup} />
<Stack.Screen name="AirSession" component={IHHTTrainingScreen} />

// File: src/screens/PremiumDashboard.js (Line 525) - REMOVED but was:
onPress={() => navigation.navigate('IHHTTraining')} // This route doesn't exist!

// File: src/screens/SimplifiedSessionSetup.js (Line 94)
navigation.navigate('AirSession', { sessionId, protocolConfig });

// File: src/screens/DashboardScreen.js (Line 449)
navigation.navigate('SessionSetup');
```

### Problems
1. Route 'IHHTTraining' doesn't exist, but code tries to navigate to it
2. Same screen (IHHTTrainingScreen) is registered as 'AirSession'
3. No centralized route definitions
4. No TypeScript support for route parameters
5. Difficult to refactor navigation without breaking the app

### Acceptance Criteria
- [ ] Create centralized routes configuration file
- [ missing content. Replace all string route names with constants
- [ ] Add TypeScript types for navigation (if migrating to TS)
- [ ] Validate all navigation calls work correctly
- [ ] Add navigation tests
- [ ] Document navigation flow in README

### Implementation Details
```javascript
// src/navigation/routes.js
export const ROUTES = {
  // Auth Stack
  AUTH: 'Auth',
  PREMIUM_OTP: 'PremiumOTP',
  
  // Main Stack
  MAIN_TABS: 'MainTabs',
  SESSION_SETUP: 'SessionSetup',
  TRAINING_SESSION: 'TrainingSession', // Renamed from AirSession
  POST_SESSION_SURVEY: 'PostSessionSurvey',
  
  // Tab Routes
  DASHBOARD: 'Dashboard',
  PREMIUM_DASHBOARD: 'PremiumDashboard',
  SESSION_HISTORY: 'SessionHistory',
  PROFILE: 'Profile',
};

// src/navigation/navigationTypes.js
export const RouteParams = {
  [ROUTES.TRAINING_SESSION]: {
    sessionId: string,
    protocolConfig: object,
  },
  [ROUTES.POST_SESSION_SURVEY]: {
    sessionId: string,
    sessionData: object,
  },
};
```

### Affected Files
- All screen files with navigation.navigate calls (15+ files)
- `src/screens/MainAppContent.js`
- `src/navigation/AppNavigator.js`
- All components using navigation

### Estimation
3-5 days

---

## TICKET 3: Add Comprehensive Test Coverage for Adaptive Training Engine

### Title
Implement unit and integration tests for AdaptiveInstructionEngine

### Priority
P1 - Critical

### Description
The AdaptiveInstructionEngine contains critical business logic for real-time SpO2 monitoring and altitude adjustments, but has zero test coverage. This creates high risk for regression bugs.

### Current State
```javascript
// File: src/services/AdaptiveInstructionEngine.js
// Complex logic without tests:
- Line 67-89: processSpO2Reading() with threshold logic
- Line 91-120: calculateAltitudeAdjustment() with complex calculations
- Line 156-187: checkMaskLiftNeeded() with multiple conditions
- Line 287-336: handlePhaseTransition() with state management
```

### Problems
1. No unit tests for threshold calculations
2. No integration tests for state transitions
3. Cannot safely refactor altitude adjustment logic
4. No tests for edge cases (SpO2 = 0, > 100)
5. Mock data generation is untested
6. Phase transition timing logic is untested

### Acceptance Criteria
- [ ] 90%+ code coverage for AdaptiveInstructionEngine
- [ ] Unit tests for all public methods
- [ ] Integration tests for full session flow
- [ ] Mock service for testing
- [ ] Performance tests for real-time processing
- [ ] Document test scenarios

### Test Scenarios to Cover
```javascript
// Test file structure needed:
describe('AdaptiveInstructionEngine', () => {
  describe('SpO2 Processing', () => {
    test('triggers mask lift when SpO2 < 85 for calibration session')
    test('triggers mask lift when SpO2 < 82 for training session')
    test('ignores invalid SpO2 readings (null, undefined, < 0, > 100)')
    test('calculates rolling average correctly')
    test('detects rapid SpO2 drop (> 5% in 30 seconds)')
  });
  
  describe('Altitude Adjustments', () => {
    test('increases altitude when SpO2 consistently > target')
    test('decreases altitude when SpO2 consistently < target')
    test('respects min/max altitude limits (1-11)')
    test('applies adjustment cooldown period')
  });
  
  describe('Phase Transitions', () => {
    test('transitions from hypoxic to recovery at cycle end')
    test('extends recovery until SpO2 >= 95 for 60 seconds')
    test('completes session after final cycle')
    test('handles early session termination')
  });
  
  describe('Instruction Generation', () => {
    test('generates correct mask lift instructions')
    test('provides altitude change recommendations')
    test('issues safety warnings for critical SpO2')
    test('clears instructions when conditions normalize')
  });
});
```

### Implementation Details
1. Set up Jest testing framework
2. Create test fixtures for session data
3. Mock Bluetooth and database services
4. Implement time-travel testing for phase transitions
5. Add continuous integration testing

### Affected Files
- `src/services/AdaptiveInstructionEngine.js` (main file)
- `src/services/__tests__/AdaptiveInstructionEngine.test.js` (new)
- `src/services/__mocks__/BluetoothService.js` (new)
- `package.json` (add testing dependencies)

### Estimation
8-10 days

---

## TICKET 4: Refactor Dashboard Code Duplication

### Title
Extract shared dashboard components and eliminate code duplication

### Priority
P2 - Important

### Description
DashboardScreen.js (1000+ lines) and PremiumDashboard.js (800+ lines) contain significant code duplication. Both implement similar layouts, metrics displays, and navigation patterns with only styling differences.

### Current State
```javascript
// Duplicated code examples:

// File: src/screens/DashboardScreen.js (Lines 350-400)
const renderDatePicker = () => { /* Similar logic */ }
const renderMetrics = () => { /* Similar structure */ }
const renderHeader = () => { /* Almost identical */ }

// File: src/screens/PremiumDashboard.js (Lines 340-395)
const renderDatePicker = () => { /* Same logic, different styles */ }
const renderMetrics = () => { /* Same structure, premium styling */ }
const renderHeader = () => { /* Almost identical */ }

// Both files have:
- Animated scroll handling (90% same)
- Date navigation logic (100% same)
- Wearables integration (95% same)
- Session info display (90% same)
```

### Problems
1. Same bug fixes needed in multiple places
2. Feature additions require updating both files
3. Inconsistent behavior between dashboards
4. 1800+ lines of code for what should be ~800
5. Different styling approaches make theming difficult

### Acceptance Criteria
- [ ] Create BaseDashboard component with shared logic
- [ ] Extract shared hooks (useScrollAnimation, useDateNavigation)
- [ ] Create composable metric components
- [ ] Implement theme variants instead of separate files
- [ ] Reduce total LOC by 40%+
- [ ] Maintain all existing functionality

### Implementation Plan
```javascript
// src/screens/BaseDashboard.js
export const BaseDashboard = ({ variant = 'standard' }) => {
  // All shared logic here
  const theme = useThemeVariant(variant);
  return <DashboardLayout theme={theme} />;
};

// src/hooks/useDashboardLogic.js
export const useDateNavigation = () => { /* shared */ };
export const useScrollAnimation = () => { /* shared */ };
export const useWearablesData = () => { /* shared */ };

// src/components/dashboard/
- MetricsGrid.js
- DatePicker.js
- SessionCard.js
- WearablesCard.js
```

### Affected Files
- `src/screens/DashboardScreen.js` (major refactor)
- `src/screens/PremiumDashboard.js` (major refactor)
- `src/components/dashboard/*` (new folder)
- `src/hooks/dashboard/*` (new hooks)

### Estimation
5-8 days

---

## TICKET 5: Create Proper Mock Service Architecture for Expo Go

### Title
Implement factory pattern for service creation with proper mocking strategy

### Priority
P2 - Important

### Description
Bluetooth and other native services have scattered mock implementations for Expo Go. This creates inconsistent behavior and makes testing difficult.

### Current State
```javascript
// Scattered mocking examples:

// File: src/context/BluetoothContext.js (Line 18)
const isExpoGo = Constants.appOwnership === 'expo';
if (isExpoGo) {
  console.log('📱 Expo Go detected - using mock Bluetooth service');
  // Inline mock implementation
}

// File: src/services/bluetooth/BluetoothService.js
// Mix of real and mock logic throughout

// File: src/components/OptimizedConnectionManager.js
// Different mock approach, inconsistent with context
```

### Problems
1. Mock logic scattered across 10+ files
2. Inconsistent mock behavior
3. Difficult to test mock scenarios
4. No centralized mock data generation
5. Can't easily switch between mock and real services

### Acceptance Criteria
- [ ] Create ServiceFactory with environment detection
- [ ] Implement complete MockBluetoothService
- [ ] Create MockDataGenerator for realistic data
- [ ] Centralize all Expo Go detection
- [ ] Add mock service configuration options
- [ ] Document mock service capabilities

### Implementation Design
```javascript
// src/services/factory/ServiceFactory.js
class ServiceFactory {
  static createBluetoothService() {
    if (this.shouldUseMock()) {
      return new MockBluetoothService(mockConfig);
    }
    return new BluetoothService();
  }
  
  static shouldUseMock() {
    return Constants.appOwnership === 'expo' || Config.FORCE_MOCK;
  }
}

// src/services/mock/MockBluetoothService.js
export class MockBluetoothService {
  constructor(config) {
    this.dataGenerator = new MockDataGenerator(config);
    this.connectionState = 'disconnected';
  }
  
  async connect() {
    await delay(1000);
    this.connectionState = 'connected';
    this.startDataStream();
  }
  
  startDataStream() {
    this.interval = setInterval(() => {
      const data = this.dataGenerator.generateSpO2Reading();
      this.emit('data', data);
    }, 1000);
  }
}

// src/services/mock/MockDataGenerator.js
export class MockDataGenerator {
  generateSpO2Reading() {
    // Realistic SpO2 patterns based on session phase
    return {
      spo2: this.generateRealisticSpO2(),
      heartRate: this.generateRealisticHR(),
      timestamp: Date.now(),
    };
  }
}
```

### Affected Files
- All files with Bluetooth imports (15+ files)
- `src/context/BluetoothContext.js`
- `src/services/bluetooth/*`
- Create new `src/services/mock/*` directory
- Create new `src/services/factory/*` directory

### Estimation
5-7 days

---

## TICKET 6: Implement Comprehensive Error Handling System

### Title
Create global error handling service with proper logging and user feedback

### Priority
P2 - Important

### Description
Error handling is inconsistent across the app with a mix of try-catch, alerts, console.error, and unhandled promises. This creates poor UX and makes debugging production issues nearly impossible.

### Current State
```javascript
// Various error handling approaches:

// File: src/auth/AuthService.js (Line 45)
} catch (error) {
  console.error('❌ [AuthService] Initialization error:', error);
  throw error;
}

// File: src/services/SupabaseService.js (Line 123)
} catch (error) {
  Alert.alert('Error', 'Failed to save session');
}

// File: src/screens/IHHTTrainingScreen.js (Line 234)
.catch(error => {
  // Silent failure - no user feedback
  console.log('Session save failed');
});

// File: src/services/WearablesDataService.js
// No error handling for API failures
```

### Problems
1. Users see technical error messages
2. Silent failures hide critical issues
3. No error reporting to backend
4. Inconsistent error recovery strategies
5. No way to track error frequency in production
6. Memory leaks from unhandled promise rejections

### Acceptance Criteria
- [ ] Implement global error boundary component
- [ ] Create ErrorService for centralized handling
- [ ] Add Sentry or Bugsnag integration
- [ ] Implement user-friendly error messages
- [ ] Add error recovery strategies
- [ ] Create error logging middleware
- [ ] Document error handling patterns

### Implementation Plan
```javascript
// src/services/ErrorService.js
class ErrorService {
  static init() {
    this.setupGlobalHandlers();
    this.initSentry();
  }
  
  static handle(error, context, severity = 'error') {
    // Log to console in dev
    if (__DEV__) console.error(context, error);
    
    // Report to Sentry
    Sentry.captureException(error, {
      level: severity,
      extra: context,
    });
    
    // Show user feedback
    this.showUserMessage(error, context);
    
    // Attempt recovery
    this.attemptRecovery(error, context);
  }
  
  static showUserMessage(error, context) {
    const message = this.getUserMessage(error);
    if (context.silent) return;
    
    Toast.show({
      type: 'error',
      text1: 'Something went wrong',
      text2: message,
      position: 'top',
    });
  }
  
  static getUserMessage(error) {
    // Map technical errors to user-friendly messages
    const errorMap = {
      'BLUETOOTH_CONNECTION_FAILED': 'Unable to connect to device',
      'SESSION_SAVE_FAILED': 'Session data saved locally',
      'NETWORK_ERROR': 'Check your internet connection',
    };
    return errorMap[error.code] || 'Please try again';
  }
}

// src/components/ErrorBoundary.js
class ErrorBoundary extends React.Component {
  componentDidCatch(error, info) {
    ErrorService.handle(error, {
      component: info.componentStack,
      severity: 'critical',
    });
  }
  
  render() {
    if (this.state.hasError) {
      return <ErrorFallback onRetry={this.retry} />;
    }
    return this.props.children;
  }
}
```

### Affected Files
- Every file with try-catch blocks (30+ files)
- Every file with Promise chains (20+ files)
- Root App.js for error boundary
- All service files need error handling updates

### Estimation
5-7 days

---

## TICKET 7: Implement Database Migration System

### Title
Create versioned database migration system with rollback support

### Priority
P2 - Important

### Description
Database schema changes are handled ad-hoc with direct SQL execution. There's no version control, migration history, or rollback capability, creating risk of data loss during updates.

### Current State
```javascript
// File: src/services/DatabaseService.js
// Direct SQL execution without versioning:
await db.executeSql(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    // ... schema definition inline
  )
`);

// File: src/services/SupabaseService.js (Line 234)
// Direct Supabase operations without migration tracking
const { data, error } = await supabase
  .from('sessions')
  .insert([sessionData]);
```

### Problems
1. No way to track schema version
2. Cannot rollback failed migrations
3. No migration history
4. Schema changes not documented
5. Risk of data loss during updates
6. Different schemas between SQLite and Supabase

### Acceptance Criteria
- [ ] Create migration system with up/down methods
- [ ] Implement version tracking table
- [ ] Add migration CLI commands
- [ ] Create rollback functionality
- [ ] Document all existing schema
- [ ] Sync SQLite and Supabase schemas
- [ ] Add migration tests

### Implementation Design
```javascript
// src/database/migrations/Migration.js
export class Migration {
  constructor(version, description) {
    this.version = version;
    this.description = description;
  }
  
  async up(db) {
    throw new Error('Must implement up method');
  }
  
  async down(db) {
    throw new Error('Must implement down method');
  }
}

// src/database/migrations/001_create_sessions_table.js
export default class extends Migration {
  constructor() {
    super('001', 'Create sessions table');
  }
  
  async up(db) {
    await db.executeSql(`
      CREATE TABLE sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        protocol_config TEXT NOT NULL,
        status TEXT DEFAULT 'active'
      )
    `);
    
    await db.executeSql(`
      CREATE INDEX idx_sessions_user_id ON sessions(user_id)
    `);
  }
  
  async down(db) {
    await db.executeSql('DROP TABLE sessions');
  }
}

// src/database/MigrationRunner.js
export class MigrationRunner {
  async run() {
    const currentVersion = await this.getCurrentVersion();
    const migrations = await this.getPendingMigrations(currentVersion);
    
    for (const migration of migrations) {
      try {
        await this.runMigration(migration);
      } catch (error) {
        await this.rollback(migration);
        throw error;
      }
    }
  }
}
```

### Affected Files
- `src/services/DatabaseService.js`
- `src/services/SupabaseService.js`
- New directory: `src/database/migrations/`
- App initialization code

### Estimation
5-7 days

---

## TICKET 8: Dashboard Performance Optimization

### Title
Optimize dashboard rendering performance and reduce battery consumption

### Priority
P3 - Nice to Have

### Description
Dashboard screens have heavy re-renders causing UI lag and battery drain, especially on older devices. Complex animations and unoptimized components trigger unnecessary updates.

### Current State
```javascript
// File: src/screens/PremiumDashboard.js
// Performance issues:
// Line 234-267: Animated.event on every scroll
// Line 340-395: Complex calculations in render
// Line 450-523: Heavy metrics rendering without memoization

// File: src/components/WearablesMetricsCard.js
// Re-renders on every state change
// No React.memo or useMemo usage
```

### Problems
1. Scroll handler triggers on every pixel (60+ times/second)
2. Date calculations run on every render
3. Metrics animate continuously even when not visible
4. No component memoization
5. Large lists without virtualization
6. Battery drain from constant re-renders

### Acceptance Criteria
- [ ] Reduce re-renders by 70%
- [ ] Implement React.memo for all pure components
- [ ] Add useMemo for expensive calculations
- [ ] Optimize animation frame rates
- [ ] Add performance monitoring
- [ ] Document performance best practices

### Optimization Plan
```javascript
// Before:
const renderMetrics = () => {
  const calculations = performExpensiveCalculations(data);
  return <MetricsDisplay data={calculations} />;
};

// After:
const renderMetrics = useMemo(() => {
  const calculations = performExpensiveCalculations(data);
  return <MetricsDisplay data={calculations} />;
}, [data]);

// Optimized scroll handler:
const scrollHandler = useAnimatedScrollHandler({
  onScroll: (event) => {
    'worklet';
    // Use Reanimated 2 worklets
    scrollY.value = event.contentOffset.y;
  },
}, []);

// Memoized components:
export const MetricRing = React.memo(({ value, maxValue, ...props }) => {
  // Component implementation
}, (prevProps, nextProps) => {
  return prevProps.value === nextProps.value;
});
```

### Affected Files
- All dashboard screens
- All metric display components
- Animation handlers
- List components

### Estimation
5-7 days

---

## TICKET 9: TypeScript Migration Foundation

### Title
Begin gradual TypeScript migration starting with critical services

### Priority
P3 - Nice to Have

### Description
The codebase lacks type safety, leading to runtime errors and difficult refactoring. A gradual TypeScript migration would improve code quality and developer experience.

### Current State
```javascript
// Current untyped code prone to errors:
// File: src/services/AdaptiveInstructionEngine.js
processSpO2Reading(reading) {
  // What's the shape of reading?
  // What if reading.value is undefined?
  if (reading.value < this.thresholds.lower) {
    // ...
  }
}

// File: src/navigation/AppNavigator.js
// Navigation params are untyped
navigation.navigate('AirSession', { sessionId, config });
// No compile-time checking of route names or params
```

### Problems
1. Runtime type errors in production
2. Difficult refactoring without type safety
3. No IntelliSense for complex objects
4. API response shapes undocumented
5. Navigation params unchecked
6. Props validation only at runtime

### Acceptance Criteria
- [ ] Set up TypeScript configuration
- [ ] Create type definitions for core services
- [ ] Type navigation system
- [ ] Type API responses
- [ ] Add types for Bluetooth data
- [ ] Create migration guide for team

### Migration Strategy
```typescript
// Phase 1: Core type definitions
// src/types/index.ts
export interface SpO2Reading {
  value: number;
  timestamp: number;
  confidence: number;
  isValid: boolean;
}

export interface SessionConfig {
  totalCycles: number;
  hypoxicDuration: number;
  hyperoxicDuration: number;
  defaultAltitudeLevel: number;
}

export interface UserProfile {
  id: string;
  phoneNumber: string;
  isPremium: boolean;
  createdAt: Date;
}

// Phase 2: Service interfaces
// src/services/AdaptiveInstructionEngine.ts
class AdaptiveInstructionEngine {
  private thresholds: SpO2Thresholds;
  private currentPhase: SessionPhase;
  
  processSpO2Reading(reading: SpO2Reading): Instruction | null {
    if (!reading.isValid) return null;
    // Type-safe implementation
  }
}

// Phase 3: Navigation types
// src/navigation/types.ts
export type RootStackParamList = {
  MainTabs: undefined;
  SessionSetup: undefined;
  AirSession: {
    sessionId: string;
    protocolConfig: SessionConfig;
  };
  PostSessionSurvey: {
    sessionId: string;
  };
};
```

### Affected Files (Phase 1)
- `tsconfig.json` (new)
- `src/types/` (new directory)
- `src/services/AdaptiveInstructionEngine.ts` (rename)
- `src/services/BluetoothService.ts` (rename)
- Navigation files

### Estimation
10-15 days (for initial setup and critical services)

---

## TICKET 10: Implement Accessibility Support

### Title
Add comprehensive accessibility support for screen readers and keyboard navigation

### Priority
P3 - Nice to Have

### Description
The app lacks proper accessibility support, making it unusable for users with disabilities. No screen reader labels, keyboard navigation, or accessibility hints are implemented.

### Current State
```javascript
// Missing accessibility:
// File: src/components/PremiumButton.js
<TouchableOpacity onPress={onPress}>
  <Text>{title}</Text>
</TouchableOpacity>
// No accessibilityLabel, accessibilityHint, or role

// File: src/screens/IHHTTrainingScreen.js
<View style={styles.metric}>
  <Text>{spo2Value}%</Text>  // Screen reader just says "95 percent"
</View>
// No context about what this number means
```

### Problems
1. No screen reader support
2. Interactive elements lack labels
3. No keyboard navigation
4. Missing accessibility hints
5. Color contrast issues
6. No focus indicators
7. Animations not respecting reduced motion

### Acceptance Criteria
- [ ] All interactive elements have accessibility labels
- [ ] Add accessibility hints for complex interactions
- [ ] Implement keyboard navigation
- [ ] Ensure color contrast meets WCAG AA
- [ ] Add focus indicators
- [ ] Test with screen readers (iOS VoiceOver, Android TalkBack)
- [ ] Document accessibility guidelines

### Implementation Examples
```javascript
// Properly accessible button:
<TouchableOpacity
  onPress={onPress}
  accessible={true}
  accessibilityRole="button"
  accessibilityLabel="Start training session"
  accessibilityHint="Begins a new IHHT training session with adaptive monitoring"
  accessibilityState={{ disabled: isDisabled }}
>
  <Text>{title}</Text>
</TouchableOpacity>

// Accessible metric display:
<View 
  accessible={true}
  accessibilityLabel={`Blood oxygen level: ${spo2Value} percent`}
  accessibilityHint="Current SpO2 reading from pulse oximeter"
  accessibilityLiveRegion="polite"  // Announces changes
>
  <Text>{spo2Value}%</Text>
</View>

// Accessible navigation:
const navigation = useNavigation();
navigation.setOptions({
  headerLeft: () => (
    <TouchableOpacity
      onPress={() => navigation.goBack()}
      accessibilityRole="button"
      accessibilityLabel="Go back"
      accessibilityHint="Returns to previous screen"
    >
      <Icon name="arrow-back" />
    </TouchableOpacity>
  ),
});
```

### Affected Files
- Every component file (50+ files)
- All screen files
- Navigation configuration
- Custom components need major updates

### Estimation
8-10 days

---

## TICKET 11: Create Component Library Documentation

### Title
Set up Storybook for design system documentation and testing

### Priority
P3 - Nice to Have

### Description
The design system components lack documentation, making it difficult for developers to use them correctly and consistently.

### Current State
```javascript
// File: src/design-system/components/PremiumButton.js
// No documentation on props, variants, or usage
export const PremiumButton = ({ title, onPress, variant, size, ...props }) => {
  // Implementation without prop documentation
};

// Developers have to read source code to understand:
// - Available variants: 'primary', 'secondary', 'outline'
// - Available sizes: 'small', 'medium', 'large'
// - Other props and their effects
```

### Problems
1. No component documentation
2. No visual component preview
3. Inconsistent component usage
4. No prop validation documentation
5. Difficult onboarding for new developers
6. No playground for testing components

### Acceptance Criteria
- [ ] Set up Storybook for React Native
- [ ] Document all design system components
- [ ] Create interactive examples
- [ ] Add prop documentation
- [ ] Include usage guidelines
- [ ] Create theme switcher for testing
- [ ] Deploy Storybook to web

### Storybook Implementation
```javascript
// src/design-system/components/PremiumButton.stories.js
export default {
  title: 'Components/PremiumButton',
  component: PremiumButton,
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['primary', 'secondary', 'outline'],
      description: 'Visual style variant',
      defaultValue: 'primary',
    },
    size: {
      control: { type: 'select' },
      options: ['small', 'medium', 'large'],
      description: 'Button size',
      defaultValue: 'medium',
    },
    disabled: {
      control: 'boolean',
      description: 'Disable button interaction',
      defaultValue: false,
    },
  },
};

export const Default = {
  args: {
    title: 'Start Training',
    variant: 'primary',
    size: 'medium',
  },
};

export const AllVariants = () => (
  <View>
    <PremiumButton title="Primary" variant="primary" />
    <PremiumButton title="Secondary" variant="secondary" />
    <PremiumButton title="Outline" variant="outline" />
  </View>
);

export const AllSizes = () => (
  <View>
    <PremiumButton title="Small" size="small" />
    <PremiumButton title="Medium" size="medium" />
    <PremiumButton title="Large" size="large" />
  </View>
);
```

### Components to Document
- PremiumButton
- PremiumCard
- MetricRing
- FloatingTabBar
- All typography components
- All color tokens
- Spacing system
- Animation presets

### Estimation
5-7 days

---

## TICKET 12: Centralize Session State Management

### Title
Implement Redux or Zustand for centralized session state management

### Priority
P2 - Important

### Description
Session state is scattered across multiple contexts and local states, causing synchronization issues and complex debugging scenarios.

### Current State
```javascript
// State scattered across multiple places:

// File: src/context/BluetoothContext.js
const [spo2Data, setSpo2Data] = useState(null);
const [isConnected, setIsConnected] = useState(false);

// File: src/screens/IHHTTrainingScreen.js
const [sessionActive, setSessionActive] = useState(false);
const [currentPhase, setCurrentPhase] = useState('preparing');
const [altitude, setAltitude] = useState(6);
const [elapsedTime, setElapsedTime] = useState(0);
// 10+ more local states

// File: src/services/SessionManager.js
this.currentSession = null;
this.sessionData = [];
this.isRecording = false;
```

### Problems
1. State synchronization issues
2. Props drilling through multiple levels
3. Difficult to debug state changes
4. No time-travel debugging
5. State updates cause unnecessary re-renders
6. Session state lost on screen navigation

### Acceptance Criteria
- [ ] Implement Zustand for state management
- [ ] Create centralized session store
- [ ] Migrate all session state to store
- [ ] Add persistence for critical state
- [ ] Implement state debugging tools
- [ ] Document state management patterns

### Zustand Implementation
```javascript
// src/stores/sessionStore.js
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { devtools } from 'zustand/middleware';

export const useSessionStore = create(
  devtools(
    persist(
      (set, get) => ({
        // Session state
        sessionId: null,
        sessionStatus: 'idle', // idle | preparing | active | paused | completed
        sessionStartTime: null,
        sessionConfig: null,
        
        // Training state
        currentPhase: 'preparing',
        currentCycle: 0,
        phaseStartTime: null,
        elapsedTime: 0,
        
        // Device state
        isBluetoothConnected: false,
        currentSpO2: null,
        currentHeartRate: null,
        altitude: 6,
        
        // Adaptive state
        adaptiveInstructions: [],
        maskLiftActive: false,
        targetSpO2Range: { min: 85, max: 90 },
        
        // Actions
        startSession: (config) => set((state) => ({
          sessionId: generateSessionId(),
          sessionStatus: 'preparing',
          sessionStartTime: Date.now(),
          sessionConfig: config,
          currentCycle: 0,
          currentPhase: 'preparing',
        })),
        
        updateSpO2: (value) => set((state) => ({
          currentSpO2: value,
          sessionData: [...state.sessionData, {
            timestamp: Date.now(),
            spo2: value,
            phase: state.currentPhase,
          }],
        })),
        
        transitionPhase: (newPhase) => set((state) => ({
          currentPhase: newPhase,
          phaseStartTime: Date.now(),
          currentCycle: newPhase === 'hypoxic' 
            ? state.currentCycle + 1 
            : state.currentCycle,
        })),
        
        completeSession: () => set((state) => ({
          sessionStatus: 'completed',
          sessionEndTime: Date.now(),
        })),
        
        resetSession: () => set(() => ({
          sessionId: null,
          sessionStatus: 'idle',
          currentPhase: 'preparing',
          currentCycle: 0,
          // ... reset all state
        })),
      }),
      {
        name: 'session-storage',
        partialize: (state) => ({
          // Only persist critical state
          sessionId: state.sessionId,
          sessionConfig: state.sessionConfig,
        }),
      }
    )
  )
);

// Usage in components:
const IHHTTrainingScreen = () => {
  const {
    sessionStatus,
    currentPhase,
    currentSpO2,
    startSession,
    updateSpO2,
  } = useSessionStore();
  
  // Clean component with no local state management
};
```

### Affected Files
- All session-related screens (5+ files)
- Context providers
- Service classes
- Components displaying session data

### Estimation
7-10 days

---

## TICKET 13: Remove Unused Dependencies

### Title
Audit and remove unused npm packages to reduce bundle size

### Priority
P3 - Quick Win

### Description
Package.json contains many unused dependencies from removed features, increasing bundle size and creating security vulnerabilities.

### Current State
```json
// File: package.json
// Suspected unused packages:
"react-native-background-timer": "^2.4.1",  // Replaced by expo-background-fetch
"react-native-sqlite-storage": "^6.0.1",    // Using expo-sqlite
"buffer": "^6.0.3",                         // Not found in codebase
"react-native-chart-kit": "^6.12.0",        // Using custom charts
```

### Problems
1. Bundle size 30% larger than necessary
2. Security vulnerabilities in unused packages
3. Confusing for developers
4. Slower install times
5. Potential version conflicts

### Acceptance Criteria
- [ ] Run dependency audit
- [ ] Identify all unused packages
- [ ] Remove unused dependencies
- [ ] Update remaining packages
- [ ] Document why each package is needed
- [ ] Reduce bundle size by 20%+

### Audit Process
```bash
# Tools to use:
npm-check
depcheck
bundle-analyzer

# Expected removals:
- react-native-background-timer (not used)
- react-native-sqlite-storage (using expo-sqlite)
- buffer (no usage found)
- react-native-chart-kit (custom implementation)
- Multiple @react-native-community packages (outdated)
```

### Estimation
2-3 days

---

## TICKET 14: Production Console Log Cleanup

### Title
Remove or properly guard all console statements for production

### Priority
P3 - Quick Win

### Description
Console.log statements throughout the codebase leak information and impact performance in production builds.

### Current State
```javascript
// Found 200+ console.log statements:
grep -r "console.log" src/ | wc -l  // 187
grep -r "console.error" src/ | wc -l  // 43
grep -r "console.warn" src/ | wc -l  // 28

// Examples:
// File: src/services/SupabaseService.js (Line 67)
console.log('✅ [SupabaseService] User authenticated:', userId);
// Leaks user IDs

// File: src/services/AdaptiveInstructionEngine.js (Line 123)
console.log('SpO2 Data:', readings);
// Leaks health data
```

### Problems
1. Information leakage in production
2. Performance impact
3. Log spam making debugging difficult
4. Sensitive data exposure
5. No structured logging

### Acceptance Criteria
- [ ] Wrap all logs in __DEV__ checks
- [ ] Remove unnecessary logs
- [ ] Implement proper logging service
- [ ] Add log levels (debug, info, warn, error)
- [ ] No console statements in production build
- [ ] Document logging standards

### Implementation
```javascript
// src/utils/Logger.js
class Logger {
  static log(message, data) {
    if (__DEV__) {
      console.log(message, data);
    }
  }
  
  static error(message, error) {
    if (__DEV__) {
      console.error(message, error);
    }
    // Send to error service in production
    ErrorService.report(error);
  }
}

// Replace all console.log with Logger
Logger.log('[SupabaseService] User authenticated', { userId });
```

### Estimation
2-3 days

---

## TICKET 15: Extract Magic Numbers to Constants

### Title
Replace all hardcoded values with named constants for maintainability

### Priority
P3 - Quick Win

### Description
Hardcoded numbers and strings throughout make the code difficult to maintain and configure.

### Current State
```javascript
// Magic numbers found:

// File: src/services/AdaptiveInstructionEngine.js
if (spo2 < 85) {  // What is 85?
  // trigger mask lift
}
if (spo2 > 90) {  // What is 90?
  // altitude adjustment
}

// File: src/screens/SimplifiedSessionSetup.js
const protocolConfig = {
  totalCycles: 5,  // Why 5?
  hypoxicDuration: 7,  // Why 7 minutes?
  hyperoxicDuration: 3,  // Why 3 minutes?
  defaultAltitudeLevel: 6  // Why level 6?
};

// File: src/screens/IHHTTrainingScreen.js
setTimeout(() => {
  checkPhaseTransition();
}, 1000);  // Check every 1000ms - why?
```

### Problems
1. Unclear what numbers represent
2. Difficult to change configurations
3. Same values duplicated in multiple places
4. No central configuration
5. Hard to understand business logic

### Acceptance Criteria
- [ ] Create constants files by domain
- [ ] Replace all magic numbers
- [ ] Replace all magic strings
- [ ] Document what each constant represents
- [ ] Make configurable values environment-specific
- [ ] Add validation for constant ranges

### Constants Structure
```javascript
// src/constants/training.js
export const TRAINING_CONSTANTS = {
  // SpO2 Thresholds
  SPO2_CRITICAL_LOW: 80,
  SPO2_WARNING_LOW: 85,
  SPO2_TARGET_MIN: 85,
  SPO2_TARGET_MAX: 90,
  SPO2_NORMAL_MIN: 95,
  SPO2_MAX_VALID: 100,
  
  // Session Configuration
  DEFAULT_TOTAL_CYCLES: 5,
  DEFAULT_HYPOXIC_DURATION_MIN: 7,
  DEFAULT_RECOVERY_DURATION_MIN: 3,
  DEFAULT_ALTITUDE_LEVEL: 6,
  MIN_ALTITUDE_LEVEL: 1,
  MAX_ALTITUDE_LEVEL: 11,
  
  // Timing
  PHASE_CHECK_INTERVAL_MS: 1000,
  SPO2_READING_INTERVAL_MS: 1000,
  MASK_LIFT_DURATION_MS: 30000,
  RECOVERY_STABLE_DURATION_MS: 60000,
  
  // Adaptive Thresholds
  RAPID_DROP_THRESHOLD: 5,  // 5% drop in 30 seconds
  RAPID_DROP_WINDOW_MS: 30000,
  ALTITUDE_ADJUST_COOLDOWN_MS: 120000,
};

// src/constants/navigation.js
export const NAVIGATION = {
  ANIMATION_DURATION: 300,
  HEADER_HEIGHT: 56,
  TAB_BAR_HEIGHT: 49,
};

// src/constants/ui.js
export const UI_CONSTANTS = {
  TOAST_DURATION_MS: 3000,
  DEBOUNCE_DELAY_MS: 300,
  MAX_RETRY_ATTEMPTS: 3,
  LOADING_DELAY_MS: 500,
};
```

### Affected Files
- All service files
- All screen files
- Animation handlers
- Timer implementations

### Estimation
3-4 days

---

## Summary for Linear Import

These 15 tickets represent comprehensive technical debt that should be addressed systematically. They are ordered by priority with clear implementation details, affected files, and time estimates.

**Total Estimated Effort**: 85-115 days
**Recommended Team Size**: 2-3 developers
**Suggested Timeline**: 3-4 months

Start with P1 Critical tickets (1-3) as they directly impact production readiness, then address P2 Important tickets (4-7) for maintainability, and finally tackle P3 Nice to Have tickets (8-12) and Quick Wins (13-15) as time permits or during regular development.