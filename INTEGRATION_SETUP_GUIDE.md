# Oura & Whoop Integration Setup Guide

This guide explains how to set up the Oura Ring and Whoop integrations for EAS builds (not Expo Go).

## ✅ What's Been Fixed

### 1. **Deep Linking**
- ✅ Proper app scheme: `vitalitiair://oura-callback` and `vitalitiair://whoop-callback`
- ✅ No more manual copy/paste of URLs
- ✅ Automatic return to app after OAuth

### 2. **Persistent Connections**
- ✅ Token refresh handling
- ✅ Connection status persistence
- ✅ Automatic reconnection

### 3. **Background Sync**
- ✅ Automatic data sync every 6 hours
- ✅ Quick sync when app becomes active
- ✅ Manual sync option in UI

## 🔧 Setup Requirements

### 1. OAuth Redirect URIs Registration

You need to register these redirect URIs with the providers:

**Oura Ring:**
- Redirect URI: `vitalitiair://oura-callback`
- Login to [Oura Cloud Developer Portal](https://cloud.ouraring.com/oauth/applications)
- Update your app settings with the new redirect URI

**Whoop:**
- Redirect URI: `vitalitiair://whoop-callback`
- Login to [Whoop Developer Portal](https://developer.whoop.com/)
- Update your app settings with the new redirect URI

### 2. Environment Variables

Create a `.env` file with your API credentials:

```env
EXPO_PUBLIC_OURA_CLIENT_ID=your_oura_client_id
EXPO_PUBLIC_OURA_CLIENT_SECRET=your_oura_client_secret
EXPO_PUBLIC_WHOOP_CLIENT_ID=your_whoop_client_id
EXPO_PUBLIC_WHOOP_CLIENT_SECRET=your_whoop_client_secret
```

### 3. App Configuration

The `app.json` already includes the required scheme:

```json
{
  "expo": {
    "scheme": "vitalitiair",
    // ... other config
  }
}
```

## 📱 How It Works

### User Experience:
1. User taps "Connect Oura" or "Connect Whoop"
2. App opens browser/webview for OAuth
3. User authorizes on Oura/Whoop website
4. Browser redirects to `vitalitiair://oura-callback?code=...`
5. App automatically handles the callback
6. Connection is established and data starts syncing

### Data Sync:
- **Automatic**: Every 6 hours in background
- **Quick sync**: When app becomes active (if >30min since last sync)
- **Manual**: User can trigger immediate sync
- **Persistent**: Tokens are refreshed automatically

## 🔍 Testing

### Before EAS Build:
1. Register redirect URIs with providers
2. Set environment variables
3. Test the flow in development

### EAS Build Testing:
```bash
# Build for testing
eas build --profile preview --platform ios
# or
eas build --profile preview --platform android

# Install and test the integration flow
```

### Verification Steps:
1. ✅ Tap connect button opens OAuth page
2. ✅ After authorization, app returns automatically  
3. ✅ Integration shows as "Connected"
4. ✅ Data sync works (check database)
5. ✅ Background sync continues working

## 📊 Data Flow

```
User Device → OAuth → Oura/Whoop API → Vitaliti Database → Analytics Dashboard
```

### Sync Schedule:
- **Background**: Every 6 hours
- **App Active**: If >30 minutes since last sync
- **Manual**: User-triggered anytime
- **Initial**: Immediately after connection

### Data Types:

**Oura:**
- Sleep data (sleep stages, efficiency, etc.)
- Activity data (steps, calories, etc.) 
- Readiness scores
- Heart rate data
- SpO2 data (if available)

**Whoop:**
- Recovery data (HRV, RHR, etc.)
- Strain data (workouts, daily strain)
- Sleep data (sleep stages, efficiency)
- Cycle data (physiological cycles)

## 🚨 Troubleshooting

### Common Issues:

**"Cannot open authorization URL"**
- Check that redirect URIs are registered correctly
- Verify app scheme matches in app.json

**"Failed to connect"**
- Check environment variables are set
- Verify API credentials are valid
- Check network connectivity

**"Token expired"** 
- Should auto-refresh, but user can reconnect if needed
- Check refresh token is stored properly

**Background sync not working**
- Ensure background fetch permissions
- Check AutoSyncService initialization

### Debug Logs:

Enable verbose logging to track the flow:
```javascript
// In development, you'll see logs like:
console.log('🔗 Deep link received:', url);
console.log('✅ Integration successful');
console.log('🔄 Starting data sync...');
console.log('⏰ Auto-sync started');
```

## 🔐 Security

- All tokens encrypted in secure storage
- API calls over HTTPS only
- No sensitive data in logs (production)
- Automatic token refresh
- User can disconnect anytime

## 📈 Analytics Integration

The synced data will be available in the Vitaliti Air analytics webpage, providing insights into:
- Sleep quality trends
- Recovery patterns  
- Activity correlations with IHHT sessions
- Long-term health metrics

This creates a comprehensive health profile that enhances the IHHT training experience.