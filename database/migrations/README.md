# Database Migrations

This directory contains all database migrations for the Vitaliti Air App Supabase database.

## Migration Order

Migrations should be run in the following order:

1. `001_initial_schema.sql` - Base tables and indexes
2. `002_auth_and_profiles.sql` - User authentication and profiles
3. `003_onboarding_data.sql` - Onboarding flow data
4. `004_surveys.sql` - Pre/post session surveys
5. `005_protocol_config.sql` - IHHT protocol configuration
6. `006_security_policies.sql` - RLS policies and security

## Running Migrations

### For a new Supabase project:
1. Run migrations in order through Supabase SQL Editor
2. Each migration is idempotent (safe to run multiple times)

### For an existing project:
1. Check which migrations have been applied
2. Run only the new migrations in order

## Migration Guidelines

- All migrations use `IF NOT EXISTS` clauses for safety
- Each migration focuses on a single feature area
- Migrations are designed to be run in order but are idempotent
- Always test migrations in a development environment first

## Rollback Scripts

Each migration has a corresponding rollback script in case you need to undo changes:
- `rollback_001_initial_schema.sql`
- etc.

Note: Be careful with rollbacks as they may result in data loss.