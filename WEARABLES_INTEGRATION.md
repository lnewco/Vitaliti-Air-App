# Wearables Data Integration Guide

## Frontend Implementation (Complete)

The frontend is now ready to display wearables data from either Whoop or Oura. The implementation includes:

1. **WearablesDataService** (`src/services/WearablesDataService.js`)
   - Fetches metrics from Supabase `health_metrics` table
   - Manages user's preferred wearable (Whoop/Oura)
   - Currently using mock data for testing

2. **WearablesMetricsCard** (`src/components/WearablesMetricsCard.js`)
   - Displays 6 key metrics in a grid layout
   - Supports toggling between Whoop/Oura
   - Dark theme optimized design

3. **Dashboard Integration** (`src/screens/DashboardScreen.js`)
   - Shows metrics on home screen
   - Auto-refreshes every 60 seconds
   - Persists vendor preference

## Backend Requirements

Your `vitaliti-air-analytics` service should write data to the Supabase `health_metrics` table with this structure:

```sql
INSERT INTO health_metrics (
  user_id,
  vendor,
  metric_type,
  recorded_at,
  data
) VALUES (
  'user-uuid-here',
  'whoop',  -- or 'oura'
  'daily_summary',
  '2025-08-26T00:00:00Z',
  '{
    "recovery": 66,      -- Whoop: recovery, Oura: readiness
    "strain": 5.1,       -- Whoop: strain, Oura: activity
    "sleep_score": 78,
    "resting_hr": 51,
    "hrv": 96,
    "resp_rate": 17.8
  }'::jsonb
);
```

## Data Field Mapping

### Whoop → Database
- Recovery Score → `data.recovery`
- Strain → `data.strain`
- Sleep Score → `data.sleep_score`
- Resting HR → `data.resting_hr`
- HRV → `data.hrv`
- Respiratory Rate → `data.resp_rate`

### Oura → Database
- Readiness Score → `data.recovery` (or `data.readiness`)
- Activity Score → `data.strain` (or `data.activity`)
- Sleep Score → `data.sleep_score`
- Resting HR → `data.resting_hr`
- HRV → `data.hrv`
- Respiratory Rate → `data.resp_rate`

## Enabling Live Data

To switch from mock data to live Supabase data:

1. Edit `src/services/WearablesDataService.js`
2. Change line 8: `this.USE_MOCK_DATA = false;`
3. Ensure your backend is writing to the `health_metrics` table

## Testing with Mock Data

Currently, the app shows mock data with both Whoop and Oura available for testing:
- Toggle between vendors using the button in the metrics card
- Mock data simulates realistic values for each vendor

## Real-time Updates

The frontend subscribes to Supabase real-time changes, so new data will appear automatically when your backend writes to the database.

## Troubleshooting

If metrics don't appear:
1. Check browser console for errors
2. Verify user is authenticated (`user.id` exists)
3. Ensure `customer_integrations` table has active vendor records
4. Confirm `health_metrics` table has data for the user

## Next Steps

1. Configure your `vitaliti-air-analytics` backend to write to Supabase
2. Test with real data by setting `USE_MOCK_DATA = false`
3. Monitor the app logs for any issues