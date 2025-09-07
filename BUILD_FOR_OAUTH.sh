#!/bin/bash

# Quick build script for OAuth-enabled EAS build
# This ensures all OAuth configurations are properly included

echo "🚀 Building OAuth-enabled Vitaliti Air App"
echo "=========================================="
echo ""

# Check for required files
echo "📝 Checking requirements..."

if [ ! -f ".env.local" ]; then
    echo "❌ .env.local not found!"
    echo "Please create .env.local with your OAuth credentials"
    exit 1
fi

# Check if credentials are real (not placeholders)
source .env.local
if [[ "$EXPO_PUBLIC_WHOOP_CLIENT_ID" == "your-whoop-client-id" ]] || [[ "$EXPO_PUBLIC_WHOOP_CLIENT_ID" == "ef01edf8-b61c-4cac-99a0-d0825098dace" ]]; then
    echo "⚠️  Warning: Using test/placeholder Whoop credentials"
    echo "OAuth will not work properly without real credentials!"
fi

if [[ "$EXPO_PUBLIC_OURA_CLIENT_ID" == "your-oura-client-id" ]]; then
    echo "⚠️  Warning: Using test/placeholder Oura credentials"
    echo "OAuth will not work properly without real credentials!"
fi

echo "✅ Requirements checked"
echo ""

# Setup EAS secrets
echo "🔐 Setting up EAS secrets..."
chmod +x scripts/setup-eas-secrets.sh
./scripts/setup-eas-secrets.sh

echo ""
echo "🔨 Starting EAS build..."
echo "Platform: iOS"
echo "Profile: development"
echo ""

# Run the build with clear cache
eas build --profile development --platform ios --clear-cache

echo ""
echo "=========================================="
echo "📱 Build started!"
echo ""
echo "Next steps:"
echo "1. Wait for build to complete"
echo "2. Download and install on your device"
echo "3. Test OAuth with: node scripts/monitor-oauth.js"
echo "4. Follow OAUTH_TESTING_CHECKLIST.md"
echo ""
echo "Important reminders:"
echo "- Whoop redirect URI: vitalitiair://whoop-callback"
echo "- Oura redirect URI: vitalitiair://oura-callback"
echo "- These must be registered in your OAuth apps!"