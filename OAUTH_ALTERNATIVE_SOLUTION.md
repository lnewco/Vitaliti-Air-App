# Alternative OAuth Solution

## The Problem
Whoop's OAuth flow seems to lose the redirect_uri parameter when going through the consent screen, which causes the "Invalid URL" error.

## Potential Solutions

### Option 1: Use a Web-Based Redirect (Recommended)
Instead of `vitalitiair://whoop-callback`, use a web URL that redirects to your app:

1. **Register a new redirect URI in Whoop Dashboard:**
   - `https://auth.expo.io/@sophiafay24/Vitaliti-Air-App`
   - Or use your own domain: `https://vitaliti.org/oauth/whoop-callback`

2. **The flow would be:**
   - User authorizes in Safari
   - Redirects to web URL with code
   - Web page auto-redirects to `vitalitiair://whoop-callback?code=xxx`
   - App handles the callback

### Option 2: Test with Existing Working Redirect URIs
You mentioned these work in other apps:
- `vitaliti://today/whoop-auth`
- `https://synapse-prod.vitaliti.org/third-party/whoop/auth-callback`

Try adding one of these to your Whoop app's redirect URIs and update the code to use it.

### Option 3: Universal Links (iOS)
Configure Universal Links so `https://vitaliti.org/oauth/whoop` opens your app directly:
1. Host an `apple-app-site-association` file
2. Configure associated domains in app.json
3. Use HTTPS URLs as redirect URIs

## Quick Test
To verify if it's a redirect URI issue, try using one of your working redirect URIs temporarily:

```javascript
// In WhoopService.js, change:
this.redirectUri = 'vitalitiair://whoop-callback';
// To:
this.redirectUri = 'https://synapse-prod.vitaliti.org/third-party/whoop/auth-callback';
```

Then update your server at that URL to redirect to `vitalitiair://whoop-callback?code=xxx&state=xxx`

## The Root Cause
Looking at the Whoop consent URL you provided, it completely lacks the redirect_uri parameter. This suggests Whoop's OAuth implementation might:
1. Only accept certain redirect URI formats
2. Strip custom URL schemes during the consent flow
3. Require pre-approved redirect URIs that match exactly

## Recommended Next Steps
1. Check if Whoop has any restrictions on custom URL schemes in their developer docs
2. Try using an HTTPS redirect URI that then redirects to your app
3. Contact Whoop support to clarify if custom URL schemes are supported