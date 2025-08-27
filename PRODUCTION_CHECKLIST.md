# Production Deployment Checklist

## Critical Pre-Production Tasks

### 1. Bluetooth Requirements ⚠️ CRITICAL
**File:** `src/screens/SimplifiedSessionSetup.js`
- [ ] Set `ALLOW_DEMO_MODE` flag to `false` or remove the Expo Go check
- [ ] Current implementation: Line 39-41
  ```javascript
  // PRODUCTION NOTE: This flag disables Bluetooth requirement for Expo Go testing
  // TODO: Set to false before production build or when testing with development builds
  const ALLOW_DEMO_MODE = __DEV__ && Constants.appOwnership === 'expo';
  ```
- [ ] This ensures users MUST connect a pulse oximeter before training
- [ ] The button will be properly disabled without Bluetooth connection
- [ ] Proper error messages will show when trying to start without device

### 2. Remove Development/Demo Features
- [ ] Remove or disable any demo/mock data generators
- [ ] Ensure all console.warn/console.log statements are removed or behind __DEV__ flags
- [ ] Verify error tracking is properly configured

### 3. Environment Configuration
- [ ] Update all API endpoints to production URLs
- [ ] Ensure proper environment variables are set
- [ ] Verify Supabase production keys are configured
- [ ] Check OAuth redirect URLs for production domain

### 4. Security
- [ ] Ensure no sensitive keys are hardcoded
- [ ] Verify all auth flows work correctly
- [ ] Test session management and token refresh

### 5. Testing Requirements
- [ ] Test with real Bluetooth devices (pulse oximeter)
- [ ] Verify adaptive training features work with actual SpO2 data
- [ ] Test session recording and data persistence
- [ ] Verify wearables integration (Whoop, Oura, etc.)

### 6. Build Configuration
- [ ] Update app.json for production build
- [ ] Configure proper app icons and splash screens
- [ ] Set correct bundle identifiers
- [ ] Configure push notification certificates

## Post-Deployment Verification
- [ ] Verify Bluetooth connections work on real devices
- [ ] Check that training sessions require device connection
- [ ] Ensure data is properly syncing to backend
- [ ] Monitor error logs for first 24 hours

## Notes
- The Bluetooth requirement bypass was added specifically for Expo Go testing
- In production, users should NOT be able to start training without a connected pulse oximeter
- The adaptive training engine requires real SpO2 data to function properly