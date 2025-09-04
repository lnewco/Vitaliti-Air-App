# Implementation Plan: Three Key Changes

## Overview
This document outlines the implementation plan for three requested changes:
1. **User-selectable altitude level** at session start
2. **Reordered intrasession questionnaire** (symptoms first)
3. **Remove pulse ox thumb animation** from setup screen

---

## Change 1: User-Selectable Altitude Level

### Current Implementation
- Altitude level is automatically calculated by `AltitudeProgressionService`
- User sees "Starting altitude will be calculated based on your progression"
- No manual override option available

### Proposed Implementation
Add an **optional manual override** that allows experienced users to select their altitude level while showing the recommended level.

### Files to Modify

#### 1. `src/screens/SimplifiedSessionSetup.js`
**Changes:**
- Add state for `manualAltitudeMode` and `selectedAltitudeLevel`
- Replace static "Adaptive" text with interactive altitude selector
- Add toggle between "Automatic" and "Manual" modes
- Show recommended level even in manual mode

#### 2. `src/services/EnhancedSessionManager.js`
**Changes:**
- Modify `startSession()` to accept optional `manualAltitudeLevel` parameter
- Priority: Use manual level if provided, otherwise use calculated level
- Log whether manual or automatic mode was used

#### 3. `src/services/AltitudeProgressionService.js`
**Changes:**
- Add method `validateManualAltitudeSelection()` to check safety bounds
- Provide warnings if manual selection deviates significantly from recommended

#### 4. `src/components/altitude/AltitudeLevelSelector.js` (NEW FILE)
**Purpose:**
- Reusable component for altitude level selection
- Shows levels 0-10 with descriptions
- Highlights recommended level
- Includes safety warnings

### Dependencies & Impact
- **Database**: Manual selection stored as `session_selection_type` ('manual' or 'automatic')
- **Analytics**: Track manual vs automatic selections for insights
- **Safety**: Implement bounds checking (max ±3 levels from recommended)
- **UI/UX**: Clear indication of recommended vs selected level

---

## Change 2: Reorder Intrasession Questionnaire

### Current Implementation
Order of questions:
1. How does the stress feel?
2. How is your energy?
3. How is your mental clarity?
4. Any specific sensations?

### Proposed Implementation
**New order:**
1. Any specific sensations? (moved to first)
2. How does the stress feel?
3. How is your energy?
4. How is your mental clarity?

### Files to Modify

#### 1. `src/components/feedback/IntraSessionFeedback.js`
**Changes:**
- Reorder the question blocks in the render method
- Move sensations section (lines 322-336) before stress perception (lines 257-286)
- Adjust animation delays if needed for smooth flow
- Update any question numbering in comments

### Dependencies & Impact
- **Data Collection**: No changes needed - same data fields
- **Database**: No schema changes required
- **Analytics**: No impact on data analysis
- **User Flow**: Smoother progression from concrete (sensations) to abstract (mental state)

---

## Change 3: Remove Pulse Ox Thumb Animation

### Current Implementation
- `PulseOxRingAnimation` component displayed in setup screen
- Shows animated thumb with pulse ox placement
- Located at line in `SimplifiedSessionSetup.js`

### Proposed Implementation
**Complete removal** of the animation, keeping only text instructions.

### Files to Modify

#### 1. `src/screens/SimplifiedSessionSetup.js`
**Changes:**
- Remove import: `import PulseOxRingAnimation from '../components/animations/PulseOxRingAnimation';`
- Remove component usage: `<PulseOxRingAnimation isPlaying={true} size={200} />`
- Adjust spacing/layout to compensate for removed animation
- Consider adding a static icon or simplified visual if needed

### Files to Keep (Not Delete)
- `src/components/animations/PulseOxRingAnimation.js` - Keep for potential future use
- Animation showcase screens - Keep for reference

### Dependencies & Impact
- **Performance**: Slight improvement in screen load time
- **Bundle Size**: Minor reduction (animation not imported)
- **User Experience**: Cleaner, less distracting interface
- **Accessibility**: Better for users who find animations distracting

---

## Implementation Order & Testing Plan

### Recommended Implementation Order
1. **Change 3** (Remove Animation) - Simplest, no dependencies
2. **Change 2** (Reorder Questions) - UI only, no logic changes
3. **Change 1** (Altitude Selection) - Most complex, requires testing

### Testing Checklist

#### For Change 1 (Altitude Selection):
- [ ] Automatic mode works as before
- [ ] Manual selection properly overrides
- [ ] Selected level persists through session
- [ ] Safety bounds are enforced
- [ ] Sync to Supabase includes selection type
- [ ] Recommended level still visible in manual mode

#### For Change 2 (Question Reorder):
- [ ] Questions appear in new order
- [ ] All responses still save correctly
- [ ] Auto-dismiss timer still works
- [ ] Skip functionality unaffected
- [ ] Submit sends all data fields

#### For Change 3 (Animation Removal):
- [ ] Screen loads without errors
- [ ] Layout looks balanced without animation
- [ ] Instructions still clear
- [ ] No console errors about missing component
- [ ] Other animations in app unaffected

---

## Risk Assessment

### Low Risk
- **Change 3**: Simple removal, no functional impact
- **Change 2**: UI reordering only, data unchanged

### Medium Risk
- **Change 1**: Requires careful testing of safety bounds and edge cases

### Mitigation Strategies
1. **Preserve Automatic Mode**: Make manual selection optional, not default
2. **Safety Warnings**: Clear warnings when manual selection differs from recommended
3. **Logging**: Track all manual selections for safety monitoring
4. **Rollback Plan**: Feature flag to disable manual selection if issues arise

---

## Estimated Timeline
- **Change 3**: 5 minutes (remove 2 lines)
- **Change 2**: 10 minutes (reorder components)
- **Change 1**: 30-45 minutes (new component, integration, testing)
- **Testing**: 30 minutes (all changes together)

**Total: ~1.5 hours**

---

## Approval Checklist
- [ ] Agree with optional manual altitude selection approach
- [ ] Confirm new question order (sensations first)
- [ ] Approve complete removal of pulse ox animation
- [ ] Accept safety bounds for manual altitude (±3 levels)
- [ ] Approve implementation order (3, 2, 1)

---

**Ready for implementation upon approval.**