# Test Scripts Documentation

## Overview
This folder contains all test and debugging scripts for the Vitaliti Air mobile app. These scripts interact with both local functionality and the Analytics backend.

## Scripts

### 1. test-bluetooth-scan.js
**Purpose**: Test Bluetooth Low Energy scanning functionality
**Relation to Analytics**: Independent - tests local BLE functionality only
**Usage**: `node test-bluetooth-scan.js`

### 2. test-progression-sync.js  
**Purpose**: Test progressive overload sync (NOT YET FUNCTIONAL - feature doesn't exist)
**Relation to Analytics**: Would sync progression data to Analytics (when implemented)
**Usage**: `node test-progression-sync.js`

### 3. monitor_tokens.js
**Purpose**: Monitor OAuth token status for WHOOP/Oura
**Relation to Analytics**: Checks tokens stored in Supabase user_profiles table
**Usage**: `node monitor_tokens.js`
**Dependencies**: Requires Analytics backend to be running

### 4. debug_oura.js
**Purpose**: Debug Oura integration issues
**Relation to Analytics**: Queries Oura data from Analytics backend
**Usage**: `node debug_oura.js [userId]`
**Dependencies**: Requires Analytics sync to have run

### 5. setup-integrations.js
**Purpose**: Initial setup for wearables integrations
**Relation to Analytics**: Creates entries in customer_integrations table
**Usage**: `node setup-integrations.js`

## Relationship to Analytics Test Scripts

The Analytics folder (`Vitaliti-Air-Analytics/test-scripts/`) contains complementary scripts that:
- Query the same Supabase database
- Test sync endpoints that this app calls
- Verify data transformations from raw API data

### Cross-Repository Dependencies:
1. **Token Monitoring**: `monitor_tokens.js` (App) ↔ `check_oauth_once.js` (Analytics)
2. **User Data**: `debug_oura.js` (App) ↔ `debug_user_data.js` (Analytics)  
3. **Sync Testing**: `setup-integrations.js` (App) → `trigger_safe_sync.js` (Analytics)

## Environment Requirements
- Supabase credentials in .env
- Node.js 18+
- Analytics backend running for sync tests