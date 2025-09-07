#!/bin/bash

echo "Building IHHT v2 with forced environment variables"

# Set environment variables for the build
export EXPO_PUBLIC_SUPABASE_URL="https://pkabhnqarbmzfkcvnbud.supabase.co"
export EXPO_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBrYWJobnFhcmJtemZrY3ZuYnVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0NzU4MTEsImV4cCI6MjA3MjA1MTgxMX0.M_vRURfdNUJFYSxt_CjMRTDoTz3kTsV0ujgNYehNjbY"
export EXPO_PUBLIC_BRANCH="ihht-v2"

# Run the build
eas build --platform ios --profile preview --clear-cache