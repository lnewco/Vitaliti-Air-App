# Wearables Integration Setup Guide

This guide explains how to set up and use the Whoop and Oura Ring integrations in the Vitaliti Air app.

## Prerequisites

1. Developer accounts for the wearables you want to integrate:
   - **Whoop**: [https://developer.whoop.com/](https://developer.whoop.com/)
   - **Oura**: [https://cloud.ouraring.com/](https://cloud.ouraring.com/)

2. Your app must be registered with each provider to get API credentials

## Configuration Steps

### 1. Register Your Applications

#### Whoop Setup
1. Go to [Whoop Developer Portal](https://developer.whoop.com/)
2. Create a new application
3. Set the redirect URI to: `vitalitiair://integrations/whoop`
4. Note your Client ID and Client Secret

#### Oura Setup
1. Go to [Oura Developer Portal](https://cloud.ouraring.com/)
2. Create a new application
3. Set the redirect URI to: `vitalitiair://integrations/oura`
4. Note your Client ID and Client Secret

### 2. Configure Environment Variables

Create or update the `.env.local` file in the app directory:

```bash
# Whoop API Configuration
EXPO_PUBLIC_WHOOP_CLIENT_ID=your_whoop_client_id_here
EXPO_PUBLIC_WHOOP_CLIENT_SECRET=your_whoop_client_secret_here

# Oura API Configuration
EXPO_PUBLIC_OURA_CLIENT_ID=your_oura_client_id_here
EXPO_PUBLIC_OURA_CLIENT_SECRET=your_oura_client_secret_here

# OAuth Redirect Configuration (already set)
EXPO_PUBLIC_APP_SCHEME=vitalitiair
EXPO_PUBLIC_REDIRECT_BASE_URL=vitalitiair://integrations
```

### 3. Deep Linking Configuration

The app is already configured with the URL scheme `vitalitiair` in `app.json`. This enables OAuth callbacks to return to the app.

## Using the Integrations

### For End Users

1. Open the app and navigate to Profile
2. Tap "⚡ Manage Integrations"
3. Connect your desired wearable:
   - **Whoop**: Tap "Connect" and authenticate in the browser
   - **Oura**: Tap "Connect" and authenticate in the browser
4. Once connected, tap "Sync Data" to pull your health metrics

### Data Synced

#### Whoop Data
- Recovery scores
- Sleep data
- Workout data
- Heart rate variability (HRV)
- Strain metrics
- Physiological data
- Body measurements

#### Oura Data
- Sleep stages and quality
- Daily activity
- Readiness scores
- Heart rate (5-minute intervals)
- Workouts
- SpO2 levels
- Session data
- Personal health metrics

## Technical Implementation Details

### OAuth Flow
1. User initiates connection from IntegrationsScreen
2. App opens browser with OAuth authorization URL
3. User authenticates with the wearable provider
4. Provider redirects back to app with authorization code
5. App exchanges code for access/refresh tokens
6. Tokens are stored securely in Supabase

### Token Management
- Access tokens are automatically refreshed when expired
- Refresh tokens are used to obtain new access tokens
- Token expiration is tracked and handled transparently

### Data Storage
- All health metrics are stored in the `health_metrics` table
- Integration credentials are stored in the `customer_integrations` table
- Data is associated with the authenticated user's ID

## Troubleshooting

### Common Issues

1. **"Configuration Required" Alert**
   - Ensure environment variables are set correctly
   - Restart the Metro bundler after changing .env file

2. **OAuth Callback Not Working**
   - Verify the redirect URI matches exactly in your provider's app settings
   - Check that the app URL scheme is properly configured

3. **Token Expired Errors**
   - The app should automatically refresh tokens
   - If issues persist, disconnect and reconnect the integration

4. **No Data Syncing**
   - Ensure you have data in your wearable app for the sync period
   - Check that all required scopes are granted during OAuth

### Debug Mode

To enable detailed logging:
1. Open the browser console when running in development
2. Look for console logs prefixed with:
   - 🔧 for initialization
   - 🔄 for sync operations
   - ✅ for successful operations
   - ❌ for errors

## Security Notes

- Never commit actual API credentials to version control
- Always use environment variables for sensitive data
- Tokens are stored encrypted in Supabase with RLS policies
- OAuth refresh tokens should be kept secure

## Future Enhancements

- [ ] Background sync scheduling
- [ ] Data visualization in the app
- [ ] Correlation with IHHT session data
- [ ] Additional wearable integrations (Apple Health, Garmin, etc.)
- [ ] Webhook support for real-time updates