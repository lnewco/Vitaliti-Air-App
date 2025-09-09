# Vitaliti Air App - Parallel Refactor Plan
*Last Updated: 2025-09-08*

## Overview
This plan divides refactoring work between two developers to work simultaneously without merge conflicts. Each developer has a distinct area of responsibility with minimal overlap.

---

## DEVELOPER A (You) - UI/Component Layer & Documentation
*Focus: Frontend, Components, Screens, Documentation*

### Phase 1: Immediate Cleanup (Day 1)
**Priority: HIGH | Risk: LOW | No Dependencies**

1. **Dead Screen Removal** ✅ Safe to do immediately
   ```bash
   # Remove unused IHHT training screens
   rm src/screens/IHHTTrainingScreenV2.js
   rm src/screens/IHHTTrainingScreenV2Enhanced.js
   rm src/screens/IHHTTrainingScreenV2Fixed.js.backup
   rm src/screens/IHHTTrainingScreenSimplified.js
   rm src/screens/IHHTTrainingWorking.js
   rm src/screens/IHHTActiveSession.js
   rm src/screens/IHHTSessionSetupScreen.js
   rm src/screens/DashboardScreen.js  # Replaced by PremiumDashboard
   ```

2. **Icon System Consolidation**
   - Standardize on `SafeIcon.js` as the single icon interface
   - Update all components using Icon.js or VectorIcon.js to use SafeIcon
   - Files to modify:
     ```
     src/components/base/Icon.js → DELETE after migration
     src/components/base/VectorIcon.js → DELETE after migration
     src/components/base/SafeIcon.js → KEEP as primary
     ```

3. **Documentation Cleanup**
   ```bash
   # Create archive folder for old docs
   mkdir docs/archive
   
   # Move outdated planning docs
   mv ALTITUDE_SYNC_FIX_PLAN.md docs/archive/
   mv EKG_ANIMATION_DEBUG.md docs/archive/
   mv BLUETOOTH_FIX_SUMMARY.md docs/archive/
   mv BLUETOOTH_DATA_STORAGE_ISSUES.md docs/archive/
   mv BLUETOOTH_EAS_TESTING_PLAN.md docs/archive/
   
   # Delete empty file
   rm CLAUDE.md
   ```

### Phase 2: Component Organization (Day 2-3)
**Priority: MEDIUM | Risk: LOW**

1. **Component Categorization**
   ```
   src/components/
   ├── base/           # Keep as is
   ├── ihht/           # Keep as is
   ├── feedback/       # Keep as is
   ├── animations/     # Keep as is
   ├── navigation/     # NEW - Move navigation-related components
   ├── integrations/   # NEW - Move integration cards here
   └── common/         # NEW - Shared components
   ```

2. **Component Cleanup Tasks**
   - Move `IntegrationCard.js` → `components/integrations/`
   - Move `CapabilityBanner.js` → `components/common/`
   - Ensure all imports are updated

3. **Update Component Documentation**
   - Add JSDoc comments to all components
   - Create `components/README.md` with component hierarchy

### Phase 3: Screen Simplification (Day 4-5)
**Priority: MEDIUM | Risk: MEDIUM**

1. **Active Screen Optimization**
   - `SimplifiedSessionSetup.js` - Clean up and add proper PropTypes
   - `IHHTSessionSimple.js` - Remove commented code, optimize
   - `PremiumDashboard.js` - Component extraction for reusability

2. **Navigation Cleanup** (Coordinate with Dev B on services)
   - Simplify `AppNavigator.js` conditional logic
   - Extract navigation helpers to separate file
   - Create navigation constants file

### Phase 4: Design System Standardization (Day 6-7)
**Priority: LOW | Risk: LOW**

1. **Fix Theme Structure**
   ```bash
   # Option 1: Match README structure
   mkdir src/theme
   mv src/design-system/* src/theme/
   
   # OR Option 2: Update README to match reality
   # Keep src/design-system/ and update documentation
   ```

2. **Create Theme Documentation**
   - Document color palette
   - Typography scale
   - Spacing system
   - Component styling patterns

---

## DEVELOPER B (Colleague) - Services/Backend Layer
*Focus: Services, Database, API, Testing Infrastructure*

### Phase 1: Service Layer Cleanup (Day 1)
**Priority: HIGH | Risk: LOW | No Dependencies**

1. **Mock Service Consolidation**
   - Review `MockBLEService.js` and `MockBLEServiceWrapper.js`
   - Ensure clear documentation of when to use each
   - Add comprehensive comments

2. **Dead Code in Services**
   ```bash
   # Clean up unused service methods
   # Review and remove unused functions in:
   - src/services/DatabaseService.js
   - src/services/BluetoothService.js
   - src/services/SupabaseService.js
   ```

3. **Service Documentation**
   - Add JSDoc to all service methods
   - Create `services/README.md` with service architecture

### Phase 2: Background Service Refactor (Day 2-3)
**Priority: HIGH | Risk: MEDIUM**

1. **ServiceFactory Pattern Enhancement**
   - Document ServiceFactory pattern clearly
   - Ensure all background services follow consistent interface
   - Files to review:
     ```
     src/services/BackgroundService.js
     src/services/AggressiveBackgroundService.js
     src/services/expo/ExpoBackgroundService.js
     src/services/native/NativeBackgroundService.js
     src/services/abstract/BaseBackgroundService.js
     ```

2. **Consolidate Background Service Logic**
   - Create clear decision tree for which service to use
   - Add environment detection improvements
   - Document iOS vs Android differences

### Phase 3: Testing Infrastructure (Day 4-5)
**Priority: HIGH | Risk: LOW**

1. **Setup Testing Framework**
   ```bash
   npm install --save-dev jest @testing-library/react-native
   npm install --save-dev @testing-library/jest-native
   ```

2. **Create Test Structure**
   ```
   __tests__/
   ├── services/
   │   ├── DatabaseService.test.js
   │   ├── BluetoothService.test.js
   │   └── SupabaseService.test.js
   ├── utils/
   └── setup.js
   ```

3. **Write Critical Service Tests**
   - DatabaseService CRUD operations
   - Session management logic
   - Bluetooth connection handling

### Phase 4: Database & API Layer (Day 6-7)
**Priority: MEDIUM | Risk: MEDIUM**

1. **Database Service Modularization**
   - Review modularized database services:
     ```
     src/services/database/MetricsDatabaseService.js
     src/services/database/SurveyDatabaseService.js
     src/services/database/AdaptiveDatabaseService.js
     ```
   - Ensure consistent error handling
   - Add retry logic where appropriate

2. **API Error Handling**
   - Standardize error responses
   - Implement consistent retry logic
   - Add request/response logging

3. **Migration System** (if time permits)
   - Implement migration structure mentioned in README
   - Create migration runner
   - Document migration process

---

## Coordination Points

### Areas Requiring Communication

1. **Navigation (Day 3)**
   - Dev A: UI simplification
   - Dev B: Service initialization
   - **Sync Point**: Ensure navigation doesn't break service initialization

2. **Session Management (Day 4)**
   - Dev A: Screen state management
   - Dev B: EnhancedSessionManager service
   - **Sync Point**: Coordinate on state flow

3. **Testing (Day 5)**
   - Dev A: Component tests (if time permits)
   - Dev B: Service tests
   - **Sync Point**: Shared test utilities and mocks

---

## Git Strategy

### Branch Structure
```
main
├── refactor/ui-cleanup (Dev A)
└── refactor/service-cleanup (Dev B)
```

### Daily Sync Protocol
1. Morning: Pull latest from main
2. Noon: Quick sync on Slack/Teams
3. Evening: Create PR for review
4. Next Morning: Merge approved PRs

### Commit Message Convention
```
refactor(ui): Remove unused IHHT training screens
refactor(services): Consolidate mock BLE services
refactor(docs): Archive outdated documentation
refactor(tests): Add DatabaseService unit tests
```

---

## Success Metrics

### Week 1 Goals
- [ ] All dead code removed
- [ ] Icon system consolidated
- [ ] Service layer documented
- [ ] Testing infrastructure in place
- [ ] 0 merge conflicts

### Quality Checks
- [ ] No console errors in development
- [ ] All imports resolved correctly
- [ ] Documentation updated
- [ ] At least 30% test coverage for services
- [ ] Build succeeds for both iOS and Android

---

## Risk Mitigation

### High Risk Areas
1. **Navigation changes** - Test thoroughly on both platforms
2. **Service refactoring** - Maintain backward compatibility
3. **Database changes** - Ensure data integrity

### Rollback Plan
- Keep feature branches separate until fully tested
- Tag current state before major changes
- Document all breaking changes

---

## Timeline Summary

**Week 1 (Parallel Work)**
- Day 1: Immediate cleanup (both)
- Day 2-3: Components (A) / Services (B)
- Day 4-5: Screens (A) / Testing (B)
- Day 6-7: Design System (A) / Database (B)

**Week 2 (If needed)**
- Integration testing
- Performance optimization
- Documentation finalization
- Code review and merge

---

## Notes

- This plan assumes both developers work full-time
- Adjust timeline based on actual availability
- Priority items should be completed first
- Communication is key - sync daily to avoid conflicts
- Create PRs early and often for visibility

---

*Remember: The goal is maintainability and cleanliness, not perfection. Focus on high-impact, low-risk changes first.*