# OAuth Integration Fix for Standalone Builds

## Problem Summary
OAuth works in Expo Go but fails in standalone EAS builds with "Something went wrong trying to finish signing in" error from Expo Auth Proxy.

## Root Cause
Expo Auth Proxy (`https://auth.expo.io/@vitaliti/Vitaliti-Air-App`) is designed for Expo Go development, not standalone builds. It receives the OAuth callback but fails to redirect to standalone apps.

## Key Findings from API Documentation

### Whoop OAuth
- **Supports custom URL schemes**: Explicitly allows both `https://` and custom schemes like `whoop://`
- Example from docs: `whoop://example/redirect` is valid

### Oura OAuth  
- **No restriction to HTTPS**: Requires exact URI matching but doesn't limit to web protocols
- Custom schemes are implicitly supported

## Solution 1: Direct Custom Scheme (Recommended)

Since both providers support custom URL schemes, use your app's scheme directly:

### Steps:
1. **Current Configuration**
   - Redirect URI: `vitalitiair://oauth-callback`
   - Already configured in `/src/config/oauthConfig.js`

2. **Update OAuth Providers**
   - Go to Whoop Developer Dashboard
   - Update redirect URI to: `vitalitiair://oauth-callback`
   - Go to Oura Developer Dashboard  
   - Update redirect URI to: `vitalitiair://oauth-callback`

3. **Build and Test**
   ```bash
   git add -A
   git commit -m "Fix OAuth: Use direct custom scheme instead of Expo Auth Proxy"
   git push origin integration-branch
   eas build --platform ios --profile preview --clear-cache
   ```

### Why This Works:
- Removes Expo Auth Proxy from the flow
- Direct: OAuth Provider → Your App
- Your app already handles `vitalitiair://` URLs correctly

## Solution 2: Web Redirect (Fallback)

If providers reject custom schemes (unlikely based on docs), use web redirect:

### Steps:
1. **Deploy Redirect Page to Render**
   ```bash
   # In your project directory
   git add -A
   git commit -m "Add OAuth redirect page for Render"
   git push origin integration-branch
   
   # Go to render.com
   # Create new Static Site
   # Connect your repo
   # Set publish directory: public
   ```

2. **Update Configuration**
   Edit `/src/config/oauthConfig.js`:
   ```javascript
   get current() {
     return this.WEB_REDIRECT; // Switch to web redirect
   }
   ```
   Update the URL in WEB_REDIRECT with your actual Render URL.

3. **Update OAuth Providers**
   - Update redirect URI to: `https://your-app.onrender.com/oauth-callback`

### How Web Redirect Works:
1. OAuth Provider → Web Page (with code)
2. Web Page → App (via `vitalitiair://oauth-callback?code=xxx`)
3. App handles deep link and completes authentication

## Quick Testing

To test immediately without deployment:

1. **Use ngrok for temporary HTTPS**
   ```bash
   npm install -g ngrok
   cd public
   python3 -m http.server 8080
   # In another terminal:
   ngrok http 8080
   ```

2. **Update redirect URI to ngrok URL**
   - Copy ngrok URL (e.g., `https://abc123.ngrok.io`)
   - Update in both Whoop and Oura dashboards
   - Update in `/src/config/oauthConfig.js`

## Verification Checklist

✅ App has `vitalitiair://` URL scheme registered in `app.json`
✅ IntegrationsScreen handles `vitalitiair://oauth-callback` 
✅ Deep link parsing works for code extraction
✅ OAuth state validation is implemented
✅ Redirect URI matches exactly in:
   - OAuth provider dashboard
   - App configuration
   - Token exchange request

## Common Issues

### "Invalid redirect_uri" Error
- Ensure exact match (including trailing slashes)
- URL encoding: Whoop wants unencoded, Oura wants encoded

### Deep Link Not Opening App
- Verify URL scheme in Info.plist after build
- Check `CFBundleURLSchemes` includes `vitalitiair`

### State Mismatch Errors  
- Clear AsyncStorage and try again
- Check state token format (Whoop requires exactly 8 characters)

## OAuth Flow Diagram

```
Direct Custom Scheme (Solution 1):
User → Whoop/Oura → vitalitiair://oauth-callback → App

Web Redirect (Solution 2):  
User → Whoop/Oura → Web Page → vitalitiair://oauth-callback → App

Expo Auth Proxy (Broken):
User → Whoop/Oura → auth.expo.io → ??? → Fail
```

## Next Steps

1. Try Solution 1 first (direct custom scheme)
2. If rejected, use Solution 2 (web redirect)
3. Test thoroughly in standalone build
4. Monitor console logs for redirect URI confirmation