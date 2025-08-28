# OAuth Integration Testing Checklist

## Pre-Build Setup ✅

### 1. Environment Variables
- [ ] Update `.env.local` with real Whoop credentials
- [ ] Update `.env.local` with real Oura credentials
- [ ] Verify credentials are not test/placeholder values

### 2. EAS Secrets Setup
Run the setup script to configure EAS secrets:
```bash
chmod +x scripts/setup-eas-secrets.sh
./scripts/setup-eas-secrets.sh
```

Verify secrets are set:
```bash
eas secret:list
```

### 3. Verify OAuth Redirect URIs
Make sure these EXACT redirect URIs are registered in your OAuth apps:
- **Whoop**: `vitalitiair://whoop-callback`
- **Oura**: `vitalitiair://oura-callback`

⚠️ **IMPORTANT**: The redirect URIs must match EXACTLY, including the scheme and path!

## Build Process 🔨

### 1. Clear Build Cache
```bash
eas build --profile development --platform ios --clear-cache
```

### 2. Monitor Build Progress
- Check build logs for any environment variable warnings
- Ensure deep linking configuration is processed

### 3. Install Build on Device
- Download and install the build on your iOS device
- Make sure it's the new build (check build number)

## Testing OAuth Flow 🧪

### 1. Pre-Connection Testing
```bash
# Monitor OAuth connections (run in separate terminal)
node scripts/monitor-oauth.js

# Check current connection status
node scripts/check-connection.js
```

### 2. Whoop Connection Test
1. Open app → Navigate to Integrations
2. Tap "Connect" for Whoop
3. **Expected**: Opens Whoop OAuth page in Safari
4. Login and click "Grant"
5. **Expected**: Redirects back to app with success message
6. **Verify**: Whoop shows as "Connected" in the app

### 3. Oura Connection Test
1. Tap "Connect" for Oura
2. **Expected**: Opens Oura OAuth page in Safari
3. Login and click "Accept"
4. **Expected**: Redirects back to app with success message
5. **Verify**: Oura shows as "Connected" in the app

### 4. Data Sync Verification
```bash
# Verify data sync after connection
node scripts/verify-sync.js

# Check specific user's data
node scripts/verify-sync.js [userId]
```

Expected results:
- Initial 30-day data fetch completes
- Data appears in `health_metrics` table
- No gaps or format errors in data

### 5. Analytics Backend Verification
In the Analytics backend terminal:
```bash
# Monitor incoming data
node scripts/monitor-api-connection.js

# Process the data
node scripts/test-live-sync.js

# Check processing results
node scripts/investigate-missing-data.js
```

## Common Issues & Solutions 🔧

### "Safari cannot open the page"
✅ **Fixed**: Deep linking configuration added to app.json
- CFBundleURLTypes configured
- LSApplicationQueriesSchemes added
- Requires new build to take effect

### "Session expired"
✅ **Fixed**: Session state management added
- State tokens with 5-minute expiry
- AsyncStorage for state persistence
- Proper state validation on callback

### "Invalid OAuth state"
✅ **Fixed**: State token validation
- Unique state tokens generated
- State validated on callback
- CSRF protection implemented

### Deep link not returning to app
✅ **Fixed**: URL parsing updated
- Handles `vitalitiair://` scheme correctly
- Parses path and query parameters properly
- Supports both Whoop and Oura callbacks

## Post-Connection Monitoring 📊

### 1. Check Token Validity
```bash
node scripts/check-connection.js
```
- Shows token expiry times
- Warns if tokens need refresh

### 2. Monitor Ongoing Syncs
```bash
node scripts/monitor-oauth.js
```
- Real-time monitoring
- Shows recent sync activity
- Auto-refreshes every 30 seconds

### 3. Verify Data Flow
- Check `health_metrics` table for raw data
- Check `whoop_data` / `oura_data` tables for processed data
- Verify data appears in both Vitaliti Air and Analytics apps

## Success Criteria ✨

- [ ] Whoop OAuth flow completes without errors
- [ ] Oura OAuth flow completes without errors
- [ ] Tokens stored in `user_profiles` table
- [ ] Initial 30-day sync completes
- [ ] Data appears in `health_metrics` table
- [ ] Analytics backend processes data
- [ ] Data visible in both apps

## Important Notes 📝

1. **Always use a fresh build** after making deep linking changes
2. **Test on real device**, not simulator
3. **Use real API credentials**, not test ones
4. **Monitor logs** during testing for debugging
5. **Check both apps** to verify data flow

## Commands Summary

```bash
# Before build
./scripts/setup-eas-secrets.sh

# Create build
eas build --profile development --platform ios --clear-cache

# During testing
node scripts/monitor-oauth.js          # Real-time monitoring
node scripts/check-connection.js       # Quick status check
node scripts/verify-sync.js           # Data verification

# In Analytics backend
node scripts/monitor-api-connection.js
node scripts/test-live-sync.js
```

---

**Ready to test!** Follow this checklist step-by-step for successful OAuth integration testing.