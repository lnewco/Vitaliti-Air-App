# IHHT v2 Implementation Plan

## Overview
Complete redesign of IHHT (Intermittent Hypoxic-Hyperoxic Training) session delivery system with adaptive dial control, real-time SpO2 monitoring, and ML-ready data pipeline.

## Phase 1: Database Architecture
### 1.1 New Tables Required

```sql
-- Altitude/FiO2 mapping for dial positions
CREATE TABLE altitude_levels (
  dial_position INTEGER PRIMARY KEY,
  fio2_percentage DECIMAL(4,1) NOT NULL,
  altitude_feet INTEGER NOT NULL,
  altitude_meters INTEGER NOT NULL,
  description TEXT
);

-- User hypoxia experience tracking
CREATE TABLE user_hypoxia_experience (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  has_prior_experience BOOLEAN NOT NULL,
  sessions_completed INTEGER DEFAULT 0,
  initial_dial_position INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mask lift events tracking
CREATE TABLE mask_lift_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  cycle_number INTEGER NOT NULL,
  phase_type TEXT NOT NULL, -- 'altitude' or 'recovery'
  timestamp TIMESTAMPTZ NOT NULL,
  spo2_at_lift INTEGER NOT NULL,
  lift_type TEXT NOT NULL, -- '1_breath' or '2_breath'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dial adjustment tracking
CREATE TABLE dial_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  cycle_number INTEGER NOT NULL,
  from_dial INTEGER NOT NULL,
  to_dial INTEGER NOT NULL,
  reason TEXT NOT NULL, -- 'spo2_high', 'too_many_lifts', 'optimal'
  avg_spo2 INTEGER,
  mask_lift_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Phase-specific metrics tracking
CREATE TABLE phase_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  cycle_number INTEGER NOT NULL,
  phase_type TEXT NOT NULL, -- 'altitude' or 'recovery'
  dial_position INTEGER NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  duration_seconds INTEGER NOT NULL,
  avg_spo2 INTEGER,
  min_spo2 INTEGER,
  max_spo2 INTEGER,
  avg_heart_rate INTEGER,
  mask_lift_count INTEGER DEFAULT 0,
  time_below_83 INTEGER DEFAULT 0, -- seconds
  time_below_80 INTEGER DEFAULT 0, -- seconds
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Intra-session survey responses with hypoxic phase context
CREATE TABLE intrasession_surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  cycle_number INTEGER NOT NULL,
  survey_time TIMESTAMPTZ NOT NULL,
  -- Previous hypoxic phase data
  previous_hypoxic_dial INTEGER NOT NULL,
  previous_hypoxic_avg_spo2 INTEGER,
  previous_hypoxic_min_spo2 INTEGER,
  previous_hypoxic_mask_lifts INTEGER,
  previous_hypoxic_duration INTEGER,
  -- Current recovery phase data
  current_recovery_spo2 INTEGER,
  current_recovery_heart_rate INTEGER,
  -- Survey responses
  feeling_score INTEGER, -- 1-10
  breathlessness_score INTEGER, -- 1-10
  clarity_score INTEGER, -- 1-10
  energy_score INTEGER, -- 1-10
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 1.2 Sessions Table Updates

```sql
ALTER TABLE sessions 
ADD COLUMN starting_dial_position INTEGER,
ADD COLUMN ending_dial_position INTEGER,
ADD COLUMN total_mask_lifts INTEGER DEFAULT 0,
ADD COLUMN dial_adjustments JSONB,
ADD COLUMN phase_metrics JSONB; -- Detailed metrics per phase
```

### 1.3 Altitude Levels Data

```sql
INSERT INTO altitude_levels (dial_position, fio2_percentage, altitude_feet, altitude_meters, description) VALUES
(0, 18.0, 4000, 1219, 'Minimal altitude'),
(1, 17.1, 5500, 1676, 'Light altitude'),
(2, 16.2, 7500, 2286, 'Low altitude'),
(3, 15.3, 9500, 2896, 'Moderate-low altitude'),
(4, 14.4, 11500, 3505, 'Moderate altitude'),
(5, 13.5, 13500, 4115, 'Moderate-high altitude'),
(6, 12.5, 16000, 4877, 'High altitude - Default start'),
(7, 11.6, 18500, 5639, 'Very high altitude - Experienced start'),
(8, 10.7, 21000, 6401, 'Extreme altitude'),
(9, 9.8, 23500, 7163, 'Very extreme altitude'),
(10, 8.9, 26500, 8077, 'Near maximum altitude'),
(11, 8.0, 27000, 8230, 'Maximum altitude');
```

## Phase 2: Vitaliti-Air-App Changes

### 2.1 New Components Structure

```
src/
├── screens/
│   ├── IHHTSessionSetupScreen.js (NEW - replaces SimplifiedSessionSetup)
│   ├── IHHTTrainingScreenV2.js (NEW - diamond UI)
│   └── IHHTExperienceAssessment.js (NEW - first-time modal)
├── components/
│   ├── ihht/
│   │   ├── DiamondMetricsDisplay.js
│   │   ├── DialAdjustmentModal.js
│   │   ├── MaskLiftInstruction.js
│   │   ├── SessionProgressBar.js
│   │   └── PulseAnimation.js
│   └── animations/
│       ├── HeartbeatPulse.js
│       ├── EKGWave.js
│       └── AltitudeMountain.js
├── services/
│   ├── IHHTAdaptiveService.js (NEW)
│   ├── DialControlService.js (NEW)
│   ├── MaskLiftTracker.js (NEW)
│   └── PhaseMetricsTracker.js (NEW)
└── utils/
    └── ihhtCalculations.js (NEW)
```

### 2.2 Session Flow Implementation

#### A. Pre-Session Setup Flow
```javascript
// IHHTSessionSetupScreen.js
const sessionSetupFlow = {
  step1: "Turn on your machine",
  step2: "Set dial to {calculatedDialPosition}",
  step3: "Place pulse oximeter on left thumb",
  step4: "Select your device from list",
  step5: "Countdown with mask instruction"
};
```

#### B. Diamond UI Layout
```javascript
// DiamondMetricsDisplay.js
const DiamondLayout = {
  top: "SpO2 Value",
  left: "Altitude Display",
  right: "Heart Rate",
  bottom: "Adapting/Stressing Status"
};
```

#### C. Adaptive Logic
```javascript
// IHHTAdaptiveService.js
function calculateDialAdjustment(phaseData) {
  const { avgSpO2, maskLiftCount, currentDial } = phaseData;
  
  if (avgSpO2 > 90) {
    return { 
      nextDial: Math.min(currentDial + 1, 11), 
      reason: 'spo2_high',
      instruction: `Increase dial to ${currentDial + 1}`
    };
  } else if (maskLiftCount >= 3) {
    return { 
      nextDial: Math.max(currentDial - 1, 0), 
      reason: 'too_many_lifts',
      instruction: `Decrease dial to ${currentDial - 1}`
    };
  } else {
    return { 
      nextDial: currentDial, 
      reason: 'optimal',
      instruction: null
    };
  }
}
```

### 2.3 Phase Metrics Tracking

#### A. Hypoxic Phase Data Collection
```javascript
// PhaseMetricsTracker.js
class PhaseMetricsTracker {
  constructor() {
    this.currentPhase = null;
    this.previousHypoxicPhase = null;
    this.phaseHistory = [];
  }

  startHypoxicPhase(cycleNumber, dialPosition) {
    this.currentPhase = {
      type: 'altitude',
      cycleNumber,
      dialPosition,
      startTime: Date.now(),
      spo2Readings: [],
      heartRateReadings: [],
      maskLifts: [],
      minSpO2: 100,
      timeBelow83: 0,
      timeBelow80: 0
    };
  }

  endHypoxicPhase() {
    const phaseData = {
      ...this.currentPhase,
      endTime: Date.now(),
      duration: Date.now() - this.currentPhase.startTime,
      avgSpO2: this.calculateAverage(this.currentPhase.spo2Readings),
      avgHeartRate: this.calculateAverage(this.currentPhase.heartRateReadings),
      maskLiftCount: this.currentPhase.maskLifts.length
    };
    
    // Store as previous hypoxic phase for intrasession survey
    this.previousHypoxicPhase = phaseData;
    this.phaseHistory.push(phaseData);
    return phaseData;
  }

  getPreviousHypoxicData() {
    return this.previousHypoxicPhase;
  }
}
```

#### B. Intrasession Survey with Context
```javascript
// IntrasessionSurvey.js
function collectIntrasessionSurvey(phaseMetricsTracker) {
  const previousHypoxic = phaseMetricsTracker.getPreviousHypoxicData();
  const currentRecovery = phaseMetricsTracker.getCurrentPhaseData();
  
  return {
    // Previous hypoxic phase context
    previous_hypoxic_dial: previousHypoxic.dialPosition,
    previous_hypoxic_avg_spo2: previousHypoxic.avgSpO2,
    previous_hypoxic_min_spo2: previousHypoxic.minSpO2,
    previous_hypoxic_mask_lifts: previousHypoxic.maskLiftCount,
    previous_hypoxic_duration: previousHypoxic.duration,
    
    // Current recovery phase data
    current_recovery_spo2: currentRecovery.currentSpO2,
    current_recovery_heart_rate: currentRecovery.currentHeartRate,
    
    // Survey questions
    feeling_score: null, // User input 1-10
    breathlessness_score: null, // User input 1-10
    clarity_score: null, // User input 1-10
    energy_score: null // User input 1-10
  };
}
```

### 2.4 Real-Time Monitoring Features

#### A. Mask Lift Detection
```javascript
// MaskLiftTracker.js
const MaskLiftThresholds = {
  SINGLE_BREATH: 83,  // SpO2 < 83%
  DOUBLE_BREATH: 80,  // SpO2 < 80%
  EMERGENCY: 75       // SpO2 < 75% - Remove mask completely
};
```

#### B. Phase Transition Management
```javascript
// Between altitude and recovery phases
const phaseTransition = {
  showInstruction: "Switch masks",
  dialAdjustment: calculateDialAdjustment(lastPhaseData),
  duration: 3000, // 3 second transition display
  captureHypoxicMetrics: true // Store complete hypoxic phase data
};
```

## Phase 3: Analytics Dashboard Updates

### 3.1 New Analytics Views

```typescript
// Vitaliti-Air-Analytics components
components/
├── ihht/
│   ├── SessionMonitor.tsx (Real-time session tracking)
│   ├── DialProgressionChart.tsx (User's dial advancement over time)
│   ├── MaskLiftAnalytics.tsx (Patterns and frequencies)
│   ├── SpO2HeatMap.tsx (SpO2 ranges by dial position)
│   ├── HypoxicResponseAnalysis.tsx (Phase-specific performance)
│   └── MLReadinessIndicator.tsx (Data quality for ML)
```

### 3.2 Analytics Queries

```sql
-- Hypoxic phase performance analysis
SELECT 
  pm.dial_position,
  pm.cycle_number,
  pm.avg_spo2,
  pm.min_spo2,
  pm.mask_lift_count,
  pm.time_below_83,
  iss.feeling_score,
  iss.breathlessness_score,
  iss.clarity_score,
  iss.energy_score
FROM phase_metrics pm
LEFT JOIN intrasession_surveys iss 
  ON pm.session_id = iss.session_id 
  AND pm.cycle_number = iss.cycle_number
WHERE pm.phase_type = 'altitude'
ORDER BY pm.created_at;

-- Correlation between hypoxic stress and recovery
SELECT 
  iss.previous_hypoxic_dial,
  AVG(iss.previous_hypoxic_avg_spo2) as avg_hypoxic_spo2,
  AVG(iss.previous_hypoxic_mask_lifts) as avg_mask_lifts,
  AVG(iss.feeling_score) as avg_feeling,
  AVG(iss.clarity_score) as avg_clarity,
  COUNT(*) as sample_size
FROM intrasession_surveys iss
GROUP BY iss.previous_hypoxic_dial
ORDER BY iss.previous_hypoxic_dial;
```

## Phase 4: Data Pipeline for ML

### 4.1 Enhanced Data Collection Schema

```javascript
// Phase-aware SpO2 reading
const enhancedSpo2Reading = {
  session_id: uuid,
  timestamp: Date,
  spo2: number,
  heart_rate: number,
  current_dial: number,
  phase_type: 'altitude' | 'recovery',
  cycle_number: number,
  time_in_phase: seconds,
  phase_context: {
    is_post_mask_lift: boolean,
    seconds_since_mask_lift: number,
    current_instruction: string
  }
};

// Intrasession survey with full context
const contextualSurvey = {
  session_id: uuid,
  cycle_number: number,
  hypoxic_phase_summary: {
    dial: number,
    duration: seconds,
    avg_spo2: number,
    min_spo2: number,
    mask_lifts: number,
    time_in_stress: seconds // time below 83%
  },
  recovery_phase_status: {
    current_spo2: number,
    current_hr: number,
    recovery_rate: number // SpO2 increase per minute
  },
  subjective_scores: {
    feeling: number,
    breathlessness: number,
    clarity: number,
    energy: number
  }
};

// Session summary for ML training
const mlReadySessionData = {
  session_id: uuid,
  user_id: uuid,
  phases: [{
    cycle: number,
    hypoxic: phaseMetrics,
    recovery: phaseMetrics,
    dial_adjustment: adjustmentData,
    survey: surveyData
  }],
  outcomes: {
    completion_rate: percentage,
    total_mask_lifts: number,
    dial_progression: number[],
    subjective_satisfaction: number
  }
};
```

## Phase 5: Implementation Timeline

### Week 1: Database & Backend
- [ ] Create development Supabase instance
- [ ] Run migration scripts for new tables
- [ ] Implement phase metrics tracking
- [ ] Set up RLS policies
- [ ] Create database functions for analytics

### Week 2: Core App Features
- [ ] Build experience assessment flow
- [ ] Implement diamond UI layout
- [ ] Create pulse-synced animations
- [ ] Add dial instruction system
- [ ] Build phase metrics tracker

### Week 3: Adaptive Logic & Tracking
- [ ] Implement mask lift detection
- [ ] Build dial adjustment calculator
- [ ] Create phase transition manager
- [ ] Add hypoxic phase data capture
- [ ] Implement contextual intrasession surveys
- [ ] Add safety protocols

### Week 4: Analytics & Testing
- [ ] Update analytics dashboard
- [ ] Create phase-specific monitoring views
- [ ] Build hypoxic response analysis
- [ ] Implement data pipeline
- [ ] End-to-end testing

## Phase 6: Testing Strategy

### 6.1 Unit Tests
- Dial adjustment logic
- SpO2 threshold calculations
- Mask lift detection
- Phase metrics calculation
- Survey correlation with hypoxic data

### 6.2 Integration Tests
- Bluetooth connection flow
- Session state management
- Phase data persistence
- Database sync
- Analytics pipeline

### 6.3 Safety Tests
- Emergency SpO2 levels
- Session abort scenarios
- Data recovery after crashes
- Offline mode handling
- Phase data integrity

## Phase 7: Migration Rollback Plan

### 7.1 Rollback Scripts
```sql
-- Rollback new tables
DROP TABLE IF EXISTS intrasession_surveys CASCADE;
DROP TABLE IF EXISTS phase_metrics CASCADE;
DROP TABLE IF EXISTS mask_lift_events CASCADE;
DROP TABLE IF EXISTS dial_adjustments CASCADE;
DROP TABLE IF EXISTS altitude_levels CASCADE;
DROP TABLE IF EXISTS user_hypoxia_experience CASCADE;

-- Rollback session alterations
ALTER TABLE sessions 
DROP COLUMN IF EXISTS starting_dial_position,
DROP COLUMN IF EXISTS ending_dial_position,
DROP COLUMN IF EXISTS total_mask_lifts,
DROP COLUMN IF EXISTS dial_adjustments,
DROP COLUMN IF EXISTS phase_metrics;
```

## Critical Success Factors

1. **User Safety**: Emergency protocols for SpO2 < 75%
2. **Data Integrity**: Complete phase data capture, especially hypoxic metrics
3. **Context Preservation**: Link intrasession surveys to previous hypoxic phase
4. **User Experience**: Smooth, intuitive dial guidance
5. **ML Readiness**: Rich contextual data for predicting optimal settings
6. **Performance**: Real-time SpO2 monitoring without lag

## Next Steps

1. Review and approve implementation plan
2. Set up development database
3. Begin Phase 1 database migrations
4. Start building core components in parallel
5. Implement phase metrics tracking system