/**
 * Database Migrations Index
 *
 * All migrations must be imported and exported here in order.
 * Migrations are run in version order, not array order.
 */

import migration001InitialSchema from './001_initial_schema';
import migration002AddAdaptiveTables from './002_add_adaptive_tables';
import migration003AddIndices from './003_add_indices';

const migrations = [
  migration001InitialSchema,
  migration002AddAdaptiveTables,
  migration003AddIndices
];

// Sort by version to ensure correct order
migrations.sort((a, b) => a.version - b.version);

export default migrations;