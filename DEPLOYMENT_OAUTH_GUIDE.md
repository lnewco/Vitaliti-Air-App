# OAuth Deployment Guide: EAS → TestFlight → App Store

## 🔐 Pre-Deployment Checklist

### 1. Secure OAuth Credentials as EAS Secrets
```bash
# Set OAuth credentials as EAS secrets (not in code!)
eas secret:create --name EXPO_PUBLIC_WHOOP_CLIENT_ID --value "your-whoop-client-id"
eas secret:create --name EXPO_PUBLIC_WHOOP_CLIENT_SECRET --value "your-whoop-client-secret"
eas secret:create --name EXPO_PUBLIC_OURA_CLIENT_ID --value "your-oura-client-id"  
eas secret:create --name EXPO_PUBLIC_OURA_CLIENT_SECRET --value "your-oura-client-secret"
```

### 2. Remove Hardcoded Credentials
```javascript
// ❌ NEVER do this in production:
this.clientId = 'ef01edf8-b61c-4cac-99a0-d0825098dace';

// ✅ Always use environment variables:
this.clientId = process.env.EXPO_PUBLIC_WHOOP_CLIENT_ID;
```

## 📱 Deployment Stages

### Stage 1: EAS Development (Current)
```bash
eas build --profile development --platform ios
```
- **Purpose:** Internal testing
- **Distribution:** Internal (specific devices)
- **OAuth:** Works with vitalitiair:// scheme
- **Credentials:** From .env.local or EAS secrets

### Stage 2: TestFlight
```bash
# First, ensure secrets are set
eas secret:list

# Build for TestFlight
eas build --profile preview --platform ios

# Submit to TestFlight
eas submit --profile preview --platform ios
```
- **Purpose:** Beta testing with external testers
- **Distribution:** TestFlight (up to 10,000 testers)
- **OAuth:** Same configuration, works identically
- **Credentials:** MUST use EAS secrets (no .env.local)
- **No changes needed to OAuth code!** ✅

### Stage 3: App Store
```bash
# Build for production
eas build --profile production --platform ios

# Submit to App Store
eas submit --profile production --platform ios
```
- **Purpose:** Public release
- **Distribution:** App Store
- **OAuth:** Same configuration, works identically
- **Credentials:** MUST use EAS secrets
- **No changes needed to OAuth code!** ✅

## 🔄 What Stays the Same

1. **Deep Linking**
   - `vitalitiair://` scheme works identically
   - No URL changes needed
   - CFBundleURLTypes configuration remains

2. **OAuth Flow**
   - Same redirect URIs: vitalitiair://whoop-callback
   - Same authorization endpoints
   - Same token exchange process

3. **Code**
   - No changes to WhoopService.js
   - No changes to OuraService.js
   - No changes to IntegrationsScreen.js

## ⚠️ Important Considerations

### API Rate Limits
- **Development:** Usually unlimited or high limits
- **Production:** May have stricter rate limits
- **Solution:** Implement rate limiting in your sync services

### Redirect URI Registration
- Some OAuth providers require separate apps for dev/prod
- If needed, create separate OAuth apps:
  - Development: vitalitiair://whoop-callback
  - Production: vitalitiair://whoop-callback (same!)
  
### Security
```javascript
// Add error handling for missing credentials
if (!process.env.EXPO_PUBLIC_WHOOP_CLIENT_ID) {
  console.error('Whoop credentials not configured');
  // Disable Whoop integration gracefully
}
```

## 📋 TestFlight Submission Checklist

- [ ] All OAuth credentials in EAS secrets
- [ ] Remove any hardcoded API keys
- [ ] Test OAuth flow with TestFlight build
- [ ] Verify deep linking works
- [ ] Check token refresh logic
- [ ] Ensure error handling for failed OAuth

## 🚀 Migration Path

### Current Development Build → TestFlight
1. Run `./scripts/setup-eas-secrets.sh` to set secrets
2. Build with `eas build --profile preview --platform ios`
3. Submit with `eas submit --profile preview`
4. **No code changes needed!**

### TestFlight → App Store
1. Ensure all TestFlight feedback addressed
2. Build with `eas build --profile production --platform ios`
3. Submit with `eas submit --profile production`
4. **No code changes needed!**

## 🎯 Key Takeaway

**The OAuth integration you build now will work identically in TestFlight and App Store!**

The only differences are:
- Build profile used (development → preview → production)
- How credentials are provided (must use EAS secrets for TestFlight/App Store)
- Distribution method (internal → TestFlight → App Store)

The actual OAuth flow, deep linking, and code remain exactly the same! 🎉