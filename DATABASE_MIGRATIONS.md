# Database Migrations Guide

## Overview

This document tracks all database migrations for the Vitaliti Air application, including schema changes, data updates, and performance optimizations.

## Migration History

### 2025-09-06: Sensation Schema Update

**File**: `supabase/migrations/20250906_update_sensations_schema.sql`

#### Purpose
Updates the sensation tracking system to include new, more descriptive sensation options based on user feedback and medical requirements.

#### Changes Made

1. **New Sensation Options Added**:
   - **Positive Sensations**:
     - `zen` - Feeling of calm and peace
     - `euphoria` - Feeling of intense happiness or well-being
   
   - **Physical Symptoms**:
     - `neck_tension` - Tension or discomfort in neck area
     - `muscle_fatigue` - General muscle tiredness
     - `trembling` - Involuntary shaking or tremors
   
   - **Neurological Responses**:
     - `tingling` - Pins and needles sensation
     - `lightheaded` - Feeling dizzy or faint
     - `sleepy` - Drowsiness or fatigue

2. **Database Updates**:
   - Added column comments documenting valid sensation values
   - Created `validate_sensations()` function for data integrity
   - Added check constraints to `intra_session_responses` table
   - Created GIN index for improved query performance on sensation arrays
   - Updated `save_intra_session_response()` stored procedure

3. **Affected Tables**:
   - `intra_session_responses.sensations` - Array column for tracking sensations
   - `post_session_surveys.symptoms` - Array column for post-session symptoms

#### Migration Script

```sql
-- Add validation function
CREATE OR REPLACE FUNCTION validate_sensations(sensations_array TEXT[])
RETURNS BOOLEAN AS $$
DECLARE
  valid_sensations TEXT[] := ARRAY[
    'zen', 'euphoria', 'neck_tension', 'tingling',
    'lightheaded', 'sleepy', 'muscle_fatigue', 'trembling', 'none'
  ];
BEGIN
  -- Validation logic
END;
$$ LANGUAGE plpgsql;

-- Add check constraint
ALTER TABLE intra_session_responses 
ADD CONSTRAINT valid_sensations_check 
CHECK (
  sensations IS NULL OR 
  sensations <@ ARRAY[
    'zen', 'euphoria', 'neck_tension', 'tingling',
    'lightheaded', 'sleepy', 'muscle_fatigue', 'trembling'
  ]::TEXT[]
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_intra_session_sensations 
ON intra_session_responses USING GIN (sensations);
```

#### Rollback Instructions

If needed, to rollback this migration:

```sql
-- Remove the constraint
ALTER TABLE intra_session_responses DROP CONSTRAINT IF EXISTS valid_sensations_check;

-- Drop the index
DROP INDEX IF EXISTS idx_intra_session_sensations;

-- Drop the validation function
DROP FUNCTION IF EXISTS validate_sensations(TEXT[]);

-- Remove column comments
COMMENT ON COLUMN intra_session_responses.sensations IS NULL;
COMMENT ON COLUMN post_session_surveys.symptoms IS NULL;
```

#### Application Changes Required

After running this migration, the following application components were updated:

1. **IntraSessionFeedback.js**: Updated sensation options array
2. **PostSessionSurveyScreen.js**: Updated symptom selection options
3. **PreSessionSurvey.js**: Updated for consistency
4. **SensationTag.js**: Component for displaying sensation selections

---

## Previous Migrations

### Initial Schema (001_initial_schema.sql)
- Created base tables: `sessions`, `readings`
- Established primary key relationships
- Set up initial indexes

### Auth and Profiles (002_auth_and_profiles.sql)
- Added `user_profiles` table
- Integrated with Supabase Auth
- Added user metadata columns

### Onboarding Data (003_onboarding_data.sql)
- Created onboarding flow tables
- Added user preference tracking
- Stored initial assessment data

### Surveys (004_surveys.sql)
- Created `survey_responses` table
- Added `pre_session_surveys` table
- Added `post_session_surveys` table
- Established survey relationship to sessions

### Protocol Configuration (005_protocol_config.sql)
- Created `protocol_templates` table
- Added protocol customization options
- Note: Currently deprecated - protocols are hardcoded in app

### Security Policies (006_security_policies.sql)
- Implemented Row Level Security (RLS)
- Added user data isolation policies
- Created admin access policies

---

## Migration Best Practices

### Before Running Migrations

1. **Backup Database**: Always create a backup before running migrations
   ```bash
   pg_dump -h [host] -U [user] -d [database] > backup_$(date +%Y%m%d_%H%M%S).sql
   ```

2. **Test in Development**: Run migrations in development environment first

3. **Review Changes**: Carefully review the migration script for:
   - Syntax errors
   - Data loss risks
   - Performance impacts
   - Constraint violations

### Running Migrations

1. **Connect to Database**:
   ```bash
   psql -h [host] -U [user] -d [database]
   ```

2. **Run Migration**:
   ```sql
   \i path/to/migration.sql
   ```

3. **Verify Success**:
   - Check for errors in output
   - Verify schema changes
   - Test affected queries

### After Migrations

1. **Update Application Code**: Ensure all application code is compatible
2. **Run Tests**: Execute integration tests
3. **Monitor Performance**: Watch for slow queries
4. **Document Changes**: Update this file and API documentation

---

## Troubleshooting

### Common Issues

#### Constraint Violations
If migration fails due to existing invalid data:
1. Identify invalid records
2. Clean or update data
3. Retry migration

#### Permission Errors
Ensure migration user has necessary privileges:
```sql
GRANT ALL PRIVILEGES ON SCHEMA public TO [user];
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO [user];
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO [user];
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO [user];
```

#### Rollback Failed
If rollback fails:
1. Manually reverse changes
2. Restore from backup if necessary
3. Document issue for future reference

---

## Future Migrations

### Planned Changes

1. **Performance Indexes**: Additional indexes for query optimization
2. **Archival System**: Move old sessions to archive tables
3. **Analytics Tables**: Dedicated tables for aggregated metrics
4. **Wearables Schema**: Enhanced schema for wearables data

### Migration Checklist Template

- [ ] Create backup
- [ ] Review migration script
- [ ] Test in development
- [ ] Update application code
- [ ] Run migration in staging
- [ ] Verify data integrity
- [ ] Deploy to production
- [ ] Update documentation
- [ ] Monitor for issues

---

## Contact

For questions about database migrations, contact the development team or refer to the Supabase documentation.