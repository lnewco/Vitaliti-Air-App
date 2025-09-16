# Database Migrations

## Overview
This directory contains database migrations that manage schema changes for the Vitaliti Air App.

## Migration Structure

Each migration file exports an object with:
- `version`: Unique integer version number
- `name`: Descriptive name in snake_case
- `up`: Function to apply the migration
- `down`: Optional function to rollback the migration

## Creating New Migrations

1. Create a new file: `XXX_description.js` (where XXX is the next version number)
2. Export a migration object:

```javascript
const migration = {
  version: 4,
  name: 'add_new_feature',
  
  up: async (db) => {
    // Apply schema changes
    await db.execAsync('CREATE TABLE ...');
  },
  
  down: async (db) => {
    // Rollback changes (optional)
    await db.execAsync('DROP TABLE ...');
  }
};

export default migration;
```

3. Import and add to `index.js`

## Migration Commands

Migrations run automatically when DatabaseService initializes. To manually control:

```javascript
import MigrationRunner from './MigrationRunner';

// Run pending migrations
await MigrationRunner.runMigrations();

// Check current version
const version = await MigrationRunner.getCurrentVersion();

// Rollback to specific version
await MigrationRunner.rollbackTo(2);

// Reset database (WARNING: deletes all data)
await MigrationRunner.reset();
```

## Current Migrations

1. **001_initial_schema** - Base tables (sessions, readings, surveys)
2. **002_add_adaptive_tables** - Adaptive training system tables
3. **003_add_indices** - Performance optimization indices

## Best Practices

- Never modify existing migrations after they've been deployed
- Always provide a `down` method for rollback capability
- Test migrations thoroughly in development
- Use transactions for data integrity
- Keep migrations focused and atomic