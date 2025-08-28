#!/bin/bash

# Setup EAS Secrets for OAuth Integration
# Run this script before creating a new EAS build

echo "🔐 Setting up EAS Secrets for OAuth Integration"
echo "=============================================="
echo ""

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo "❌ Error: .env.local file not found!"
    echo "Please create .env.local with your OAuth credentials first."
    exit 1
fi

# Source the .env.local file
set -a
source .env.local
set +a

# Check if EAS CLI is installed
if ! command -v eas &> /dev/null; then
    echo "❌ Error: EAS CLI is not installed!"
    echo "Please run: npm install -g eas-cli"
    exit 1
fi

echo "📝 Setting up OAuth credentials as EAS secrets..."
echo ""

# Set Whoop credentials
if [ -n "$EXPO_PUBLIC_WHOOP_CLIENT_ID" ] && [ "$EXPO_PUBLIC_WHOOP_CLIENT_ID" != "your-whoop-client-id" ]; then
    echo "Setting EXPO_PUBLIC_WHOOP_CLIENT_ID..."
    eas secret:create --name EXPO_PUBLIC_WHOOP_CLIENT_ID --value "$EXPO_PUBLIC_WHOOP_CLIENT_ID" --force
    
    echo "Setting EXPO_PUBLIC_WHOOP_CLIENT_SECRET..."
    eas secret:create --name EXPO_PUBLIC_WHOOP_CLIENT_SECRET --value "$EXPO_PUBLIC_WHOOP_CLIENT_SECRET" --force
    echo "✅ Whoop credentials set!"
else
    echo "⚠️  Whoop credentials not found or using placeholder values"
fi

echo ""

# Set Oura credentials
if [ -n "$EXPO_PUBLIC_OURA_CLIENT_ID" ] && [ "$EXPO_PUBLIC_OURA_CLIENT_ID" != "your-oura-client-id" ]; then
    echo "Setting EXPO_PUBLIC_OURA_CLIENT_ID..."
    eas secret:create --name EXPO_PUBLIC_OURA_CLIENT_ID --value "$EXPO_PUBLIC_OURA_CLIENT_ID" --force
    
    echo "Setting EXPO_PUBLIC_OURA_CLIENT_SECRET..."
    eas secret:create --name EXPO_PUBLIC_OURA_CLIENT_SECRET --value "$EXPO_PUBLIC_OURA_CLIENT_SECRET" --force
    echo "✅ Oura credentials set!"
else
    echo "⚠️  Oura credentials not found or using placeholder values"
fi

echo ""
echo "=============================================="
echo "✅ EAS secrets setup complete!"
echo ""
echo "You can now build your app with:"
echo "eas build --profile development --platform ios --clear-cache"
echo ""
echo "To verify your secrets, run:"
echo "eas secret:list"