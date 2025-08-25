# Wearables Integration Testing Checklist

## Pre-Test Setup

### 1. Install Dependencies
```bash
cd "/Users/danyalpanjwani/Desktop/Vitaliti_Air/Vitaliti Code/Air/Vitaliti-Air-App"
npm install react-native-dotenv
```

### 2. Configure Credentials
Run the setup script:
```bash
node setup-integrations.js
```
Or manually edit `.env.local` with your credentials.

### 3. Restart Metro
```bash
# Stop any running Metro instance (Ctrl+C)
# Clear cache and restart
npx expo start -c
```

## Testing Steps

### ✅ Phase 1: Basic Setup Verification

- [ ] App launches without errors
- [ ] Can navigate to Profile screen
- [ ] "⚡ Manage Integrations" button is visible
- [ ] Clicking button opens Integrations screen

### ✅ Phase 2: Whoop Integration

#### Connect Whoop
- [ ] Tap "Connect" button for Whoop
- [ ] Browser opens with Whoop login page
- [ ] URL starts with `https://api.prod.whoop.com/oauth/oauth2/auth`
- [ ] Login with your Whoop account
- [ ] Grant permissions (all requested scopes)
- [ ] Browser redirects back to app
- [ ] Success message appears
- [ ] Whoop shows as "Connected"

#### Sync Whoop Data
- [ ] Tap "Sync Data" button
- [ ] Loading indicator appears
- [ ] Success message shows data count
- [ ] No error messages

#### Verify Whoop Data in Database
Check Supabase dashboard:
- [ ] `customer_integrations` table has Whoop entry
- [ ] `health_metrics` table has Whoop data entries

### ✅ Phase 3: Oura Integration

#### Connect Oura
- [ ] Tap "Connect" button for Oura
- [ ] Browser opens with Oura login page
- [ ] URL starts with `https://cloud.ouraring.com/oauth/authorize`
- [ ] Login with your Oura account
- [ ] Grant permissions
- [ ] Browser redirects back to app
- [ ] Success message appears
- [ ] Oura shows as "Connected"

#### Sync Oura Data
- [ ] Tap "Sync Data" button
- [ ] Loading indicator appears
- [ ] Success message shows data count
- [ ] No error messages

#### Verify Oura Data in Database
Check Supabase dashboard:
- [ ] `customer_integrations` table has Oura entry
- [ ] `health_metrics` table has Oura data entries

### ✅ Phase 4: Token Refresh Testing

#### Test Expired Token Handling
1. Manually expire token in database (set `expires_at` to past date)
2. Try to sync data
- [ ] App automatically refreshes token
- [ ] Sync completes successfully
- [ ] New token saved in database

### ✅ Phase 5: Error Handling

#### Test Invalid Credentials
- [ ] Set invalid credentials in .env.local
- [ ] Try to connect
- [ ] Error message appears about invalid credentials

#### Test Network Errors
- [ ] Turn off WiFi/cellular
- [ ] Try to sync data
- [ ] Appropriate error message appears

#### Test Disconnect Function
- [ ] Tap "Disconnect" for connected service
- [ ] Confirmation dialog appears
- [ ] After confirming, service shows as disconnected
- [ ] Database entry is removed

## Common Issues & Solutions

### Issue: "Configuration Required" Error
**Solution**: Ensure credentials are in `.env.local` and restart Metro with cache clear

### Issue: OAuth Callback Not Working
**Solution**: Verify redirect URI matches exactly in provider settings:
- Whoop: `vitalitiair://integrations/whoop`
- Oura: `vitalitiair://integrations/oura`

### Issue: No Data After Sync
**Solutions**:
1. Check you have data in the wearable app for the sync period
2. Verify all permissions were granted during OAuth
3. Check console logs for specific API errors

### Issue: Token Refresh Fails
**Solutions**:
1. Disconnect and reconnect the integration
2. Check that refresh_token exists in database
3. Verify client credentials are still valid

## Debug Commands

### Check Environment Variables
```bash
# In the app code, add this temporarily:
console.log('Whoop ID:', process.env.EXPO_PUBLIC_WHOOP_CLIENT_ID);
console.log('Oura ID:', process.env.EXPO_PUBLIC_OURA_CLIENT_ID);
```

### Check Database
```sql
-- Check integrations
SELECT * FROM customer_integrations WHERE user_id = 'YOUR_USER_ID';

-- Check synced data
SELECT COUNT(*), vendor, metric_type 
FROM health_metrics 
WHERE user_id = 'YOUR_USER_ID'
GROUP BY vendor, metric_type;
```

### View Logs
```bash
# Run app with verbose logging
EXPO_PUBLIC_LOG_LEVEL=debug npx expo start
```

## Success Criteria

✅ Both Whoop and Oura can be connected
✅ Data syncs successfully from both services
✅ Tokens refresh automatically when expired
✅ Error messages are clear and helpful
✅ Disconnect functionality works properly
✅ Data is properly stored in Supabase

## Notes

- First sync may take 30-60 seconds depending on data amount
- Default sync period is last 7 days
- Some data types may not be available if device doesn't support them
- Rate limits may apply for API calls