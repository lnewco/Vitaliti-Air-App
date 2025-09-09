# Components Directory Structure

## Overview
This directory contains all React Native components organized by functionality and usage patterns.

## Directory Structure

```
components/
├── base/               # Core UI components (Button, Typography, etc.)
├── ihht/               # IHHT training specific components
├── feedback/           # User feedback and survey components
├── animations/         # Animation components (pulse ox, EKG, etc.)
├── navigation/         # Navigation-related components
├── integrations/       # Third-party integration components
├── common/             # Shared/common components
└── altitude/           # Altitude-specific components
```

## Component Categories

### 📦 Base Components (`/base`)
Core reusable UI components that form the foundation of the app's design system.
- `Button.js` - Standard button component
- `Typography.js` - Text components (H1-H6, Body, Label, etc.)
- `Card.js` - Card container component
- `SafeIcon.js` - Unified icon component
- `Badge.js` - Badge display component
- `MetricDisplay.js` - Metric visualization component

### 🏔️ IHHT Components (`/ihht`)
Components specific to IHHT (Intermittent Hypoxic-Hyperoxic Training) sessions.
- `SessionProgressBar.js` - Progress indicator for active sessions
- `ContinuousEKG.js` - EKG animation display
- `AppleMetricsDisplay.js` - Apple Watch-style metrics display
- `IntrasessionSurvey.js` - Survey during training
- `CycleVisualizer.js` - Visual representation of training cycles

### 💬 Feedback Components (`/feedback`)
User feedback collection and display components.
- `IntraSessionFeedback.js` - Real-time session feedback
- `PostSessionFeedback.js` - Post-session survey feedback
- `FeedbackErrorBoundary.js` - Error handling for feedback components

### 🎨 Animation Components (`/animations`)
Visual animation components for enhanced user experience.
- `PulseOxRingAnimation.js` - Pulse oximeter ring animation
- `EKGAnimation.js` - Electrocardiogram animation

### 🧭 Navigation Components (`/navigation`)
Components related to app navigation and progress tracking.
- `OnboardingProgressIndicator.js` - Onboarding flow progress

### 🔗 Integration Components (`/integrations`)
Third-party service integration components.
- `IntegrationCard.js` - Card for displaying integration status
- `WearablesMetricsCard.js` - Wearable device metrics display

### 🔧 Common Components (`/common`)
Shared components used across multiple screens.
- `CapabilityBanner.js` - Feature capability banner
- `ErrorBoundary.js` - Global error boundary
- `VitalitiLogo.js` - App logo component
- `SessionDetailsModal.js` - Session details modal
- `SessionRecoveryModal.js` - Session recovery UI

### ⛰️ Altitude Components (`/altitude`)
Altitude-related UI components.
- `AltitudeLevelSelector.js` - Altitude level selection UI

## Root Level Components
These components are in the root `/components` directory and may need future reorganization:
- `AltitudeSlotMachine.js` - Altitude display animation
- `DeviceSelectionModal.js` - Bluetooth device selection
- `InlineDeviceScanner.js` - Inline Bluetooth scanner
- `PhoneVerificationScreen.js` - Phone verification UI
- `SessionRecoveryManager.js` - Session recovery logic
- `SurveyModal.js` - Survey modal container
- `SurveyNotesInput.js` - Survey notes input field
- `SurveyScaleInput.js` - Survey scale input component

## Component Guidelines

### Import Pattern
```javascript
// Base components
import { Button, Card } from '../components/base';

// Specific components
import SessionProgressBar from '../components/ihht/SessionProgressBar';
```

### Component Creation
1. Place components in the appropriate category folder
2. Use PascalCase for component names
3. Export as default for single components
4. Add JSDoc comments for documentation
5. Keep components focused on a single responsibility

### Future Improvements
- [ ] Move remaining root-level components to appropriate folders
- [ ] Add TypeScript definitions
- [ ] Create component storybook
- [ ] Add unit tests for each component
- [ ] Document component props with PropTypes or TypeScript