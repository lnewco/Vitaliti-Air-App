# Complete Wearables Integration Setup

## Information I Need From You

To complete the setup, I need the following API credentials:

### 1. Whoop Credentials
- **Client ID**: (You'll get this after registering)
- **Client Secret**: (You'll get this after registering)

### 2. Oura Credentials  
- **Client ID**: (You'll get this after registering)
- **Client Secret**: (You'll get this after registering)

## Step-by-Step Registration Process

### STEP 1: Register with Whoop Developer Portal

1. **Go to**: https://developer.whoop.com/
2. **Sign up** for a developer account (use your regular Whoop account if you have one)
3. **Create a new application** with these settings:
   - **Application Name**: Vitaliti Air
   - **Description**: Personal health monitoring integration
   - **Redirect URI**: `vitalitiair://integrations/whoop`
   - **Scopes needed**: 
     - read:body_measurement
     - read:workout
     - offline
     - read:cycles
     - read:recovery
     - read:sleep
     - read:profile
4. **Save the application**
5. **Copy these values**:
   - Client ID: ________________
   - Client Secret: ________________

### STEP 2: Register with Oura Developer Portal

1. **Go to**: https://cloud.ouraring.com/developers
2. **Sign in** with your Oura account (or create one)
3. **Click "Create New Application"**
4. **Fill in the form**:
   - **Application Name**: Vitaliti Air
   - **Description**: Personal health monitoring integration
   - **Redirect URI**: `vitalitiair://integrations/oura`
   - **Application Type**: Mobile Application
5. **Save the application**
6. **Copy these values**:
   - Client ID: ________________
   - Client Secret: ________________

## After You Have The Credentials

Once you have all four values (2 for Whoop, 2 for Oura), provide them to me in this format:

```
Whoop Client ID: [your_whoop_client_id]
Whoop Client Secret: [your_whoop_client_secret]
Oura Client ID: [your_oura_client_id]
Oura Client Secret: [your_oura_client_secret]
```

## What I'll Do Next

Once you provide the credentials, I will:

1. ✅ Update your `.env.local` file with the actual credentials
2. ✅ Verify the configuration is correct
3. ✅ Provide instructions to restart Metro bundler
4. ✅ Create a testing checklist for you

## Important Notes

- **Keep your credentials secure** - Never share them publicly
- **The redirect URIs must match exactly** as shown above
- **You need active Whoop/Oura accounts** to register as a developer
- If you don't have a Whoop or Oura device, you can still register but won't have real data to sync

## Troubleshooting Registration

### If Whoop Developer Portal is Not Available
- Whoop sometimes restricts developer access
- You may need to email developer@whoop.com to request access
- Alternative: Use the test credentials already in the code (limited functionality)

### If Oura Registration Fails
- Make sure you have an Oura account first
- The developer portal requires email verification
- Check your spam folder for verification emails

## Ready to Proceed?

Please complete the registration steps above and provide me with the four credential values. I'll handle everything else!