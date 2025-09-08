# EKG Animation Debugging Document
**Date**: January 8, 2025  
**Issue**: EKG animation restarts with flat line every time heart rate changes

## Problem Description
The ContinuousEKG component displays an animated EKG waveform. Every time the heart rate value changes (even though the animation doesn't use heart rate), the animation restarts from a flat line instead of continuing smoothly.

## Current File Locations
- **Component**: `/src/components/ihht/ContinuousEKG.js`
- **Parent Using It**: `/src/components/ihht/AppleMetricsDisplay.js`
- **Parent Location in AppleMetricsDisplay**: Lines 134-138

## Attempts Made to Fix

### Attempt 1: React.memo with always-true comparison
- **Approach**: Used `React.memo(ContinuousEKG, () => true)` to prevent re-renders
- **Result**: Failed - animation still restarted
- **Conclusion**: Component was being unmounted/remounted, not just re-rendering

### Attempt 2: Class Component with shouldComponentUpdate
- **Approach**: Created EKGAnimator class with `shouldComponentUpdate() { return false }`
- **Result**: Failed - animation still restarted
- **Conclusion**: Parent was causing unmount/remount

### Attempt 3: Stable Props with useRef
- **Approach**: Used useRef to store initial color and never change it
- **Result**: Failed - animation still restarted
- **Conclusion**: Color prop changes were causing remounts

### Attempt 4: Removed heart rate and color props entirely
- **Approach**: Component doesn't receive heartRate or color props at all
- **Result**: Failed - animation still restarted
- **Conclusion**: Something else in parent hierarchy causing remounts

### Attempt 5: Global Singleton Animation
- **Approach**: Created global animation that runs continuously, component joins in progress
- **Code**:
```javascript
let globalAnimation = null;
let globalScrollX = null;
let globalStartTime = Date.now();
```
- **Result**: Failed - animation still restarted
- **Conclusion**: The path is being reset even with global animation

### Attempt 6: Added debugging console.log
- **Location**: Line 16 in ContinuousEKG.js
- **Message**: "🔴 ContinuousEKG MOUNTING - This should NOT happen on heart rate change!"
- **Result**: Console log not appearing (need to check why)

## Current Implementation Status

### ContinuousEKG.js Structure:
```javascript
// Global singleton animation variables
let globalAnimation = null;
let globalScrollX = null;
let globalStartTime = Date.now();

const ContinuousEKG = ({ width = 120, height = 40 }) => {
  // No heartRate prop
  // No color prop (hardcoded to #EC4899)
  // Uses global animation that never stops
  // Calculates position based on elapsed time
}
```

### AppleMetricsDisplay.js Usage:
```javascript
<View style={styles.ekgContainer} key="ekg-container">
  <ContinuousEKG 
    key="ekg-animation-static"
    width={120}
    height={40}
  />
</View>
```

## Suspected Root Causes

1. **Parent Component Tree Re-rendering**: AppleMetricsDisplay or its parent may be completely re-rendering
2. **React Native Bridge Issue**: Animation values might be getting reset by RN bridge
3. **SVG Path Reset**: The Path element's `d` attribute might be resetting despite setNativeProps
4. **Console Logs Not Working**: Debug logs not appearing suggests deeper issue

## Next Debugging Steps

1. **Check if console.log is working**:
   - Add console.log to AppleMetricsDisplay render
   - Verify logs are appearing in correct console

2. **Track component lifecycle**:
   - Add componentDidMount/componentWillUnmount logs
   - Track exact mount/unmount pattern

3. **Check parent hierarchy**:
   - Find what component contains AppleMetricsDisplay
   - Check if that parent is re-rendering on heart rate change

4. **Alternative Solutions to Try**:
   - Move EKG to completely separate component tree
   - Use Portal to render outside of parent
   - Create native module for animation
   - Use Reanimated 2 library instead of Animated API

## Related Files Modified
- `/src/constants/altitude.js` - Created to fix circular dependency
- `/src/components/ihht/AppleMetricsDisplay.js` - Modified to use ContinuousEKG

## Impact
- Animation works but restarts on every heart rate change
- Visually jarring for users
- Not blocking functionality, just UI polish issue

## Priority
Medium - Aesthetic issue, not blocking core functionality

## Notes
- Spent significant time on this issue
- Risk of losing context if continuing to debug
- All Bluetooth data sync is working correctly
- Core IHHT functionality is operational

## Files to Preserve
1. `/src/components/ihht/ContinuousEKG.js`
2. `/src/components/ihht/AppleMetricsDisplay.js`
3. `/src/constants/altitude.js`
4. This debug document

---
**Status**: PAUSED - To be revisited after other priorities