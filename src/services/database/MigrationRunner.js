/**
 * MigrationRunner - Database migration system
 *
 * Manages database schema versions and runs migrations in order
 * to ensure the database is always up-to-date with the latest schema.
 */

import * as SQLite from 'expo-sqlite';
import logger from '../../utils/logger';
import migrations from './migrations';

const log = logger.createModuleLogger('MigrationRunner');

class MigrationRunner {
  constructor() {
    this.db = null;
  }

  /**
   * Initialize the migration runner with database connection
   * @param {Object} db - SQLite database instance
   */
  async initialize(db) {
    this.db = db;
    await this.createMigrationTable();
  }

  /**
   * Create migration tracking table if it doesn't exist
   */
  async createMigrationTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        version INTEGER UNIQUE NOT NULL,
        name TEXT NOT NULL,
        applied_at INTEGER NOT NULL,
        checksum TEXT
      )
    `;

    await this.db.execAsync(query);
    log.info('✅ Migration table ready');
  }

  /**
   * Get the current database version
   * @returns {Promise<number>}
   */
  async getCurrentVersion() {
    try {
      const result = await this.db.getFirstAsync(
        'SELECT MAX(version) as version FROM migrations'
      );
      return result?.version || 0;
    } catch (error) {
      log.error('Failed to get current version:', error);
      return 0;
    }
  }

  /**
   * Check if a migration has been applied
   * @param {number} version - Migration version
   * @returns {Promise<boolean>}
   */
  async isMigrationApplied(version) {
    const result = await this.db.getFirstAsync(
      'SELECT id FROM migrations WHERE version = ?',
      [version]
    );
    return !!result;
  }

  /**
   * Run all pending migrations
   * @returns {Promise<Object>}
   */
  async runMigrations() {
    try {
      const currentVersion = await this.getCurrentVersion();
      const pendingMigrations = migrations.filter(m => m.version > currentVersion);

      if (pendingMigrations.length === 0) {
        log.info('✅ Database is up to date');
        return { success: true, migrationsRun: 0, currentVersion };
      }

      log.info(`📦 Found ${pendingMigrations.length} pending migrations`);

      // Sort migrations by version
      pendingMigrations.sort((a, b) => a.version - b.version);

      let migrationsRun = 0;

      for (const migration of pendingMigrations) {
        await this.runMigration(migration);
        migrationsRun++;
      }

      const newVersion = await this.getCurrentVersion();

      log.info(`✅ Successfully ran ${migrationsRun} migrations. Current version: ${newVersion}`);

      return {
        success: true,
        migrationsRun,
        currentVersion: newVersion
      };
    } catch (error) {
      log.error('❌ Migration failed:', error);
      throw error;
    }
  }

  /**
   * Run a single migration
   * @param {Object} migration - Migration object
   */
  async runMigration(migration) {
    log.info(`🔄 Running migration ${migration.version}: ${migration.name}`);

    try {
      // Start transaction
      await this.db.execAsync('BEGIN TRANSACTION');

      // Run migration
      if (typeof migration.up === 'function') {
        await migration.up(this.db);
      } else if (typeof migration.up === 'string') {
        await this.db.execAsync(migration.up);
      } else {
        throw new Error('Migration must have an up method or SQL string');
      }

      // Record migration
      await this.db.runAsync(
        `INSERT INTO migrations (version, name, applied_at, checksum)
         VALUES (?, ?, ?, ?)`,
        [
          migration.version,
          migration.name,
          Date.now(),
          migration.checksum || null
        ]
      );

      // Commit transaction
      await this.db.execAsync('COMMIT');

      log.info(`✅ Migration ${migration.version} completed successfully`);
    } catch (error) {
      // Rollback on error
      await this.db.execAsync('ROLLBACK');
      log.error(`❌ Migration ${migration.version} failed:`, error);
      throw error;
    }
  }

  /**
   * Rollback a migration (if down method provided)
   * @param {number} version - Version to rollback to
   * @returns {Promise<Object>}
   */
  async rollbackTo(version) {
    try {
      const currentVersion = await this.getCurrentVersion();

      if (version >= currentVersion) {
        return {
          success: false,
          error: 'Target version must be less than current version'
        };
      }

      const migrationsToRollback = migrations
        .filter(m => m.version > version && m.version <= currentVersion)
        .sort((a, b) => b.version - a.version); // Reverse order

      let rolledBack = 0;

      for (const migration of migrationsToRollback) {
        if (migration.down) {
          log.info(`↩️ Rolling back migration ${migration.version}: ${migration.name}`);

          await this.db.execAsync('BEGIN TRANSACTION');

          try {
            if (typeof migration.down === 'function') {
              await migration.down(this.db);
            } else {
              await this.db.execAsync(migration.down);
            }

            await this.db.runAsync(
              'DELETE FROM migrations WHERE version = ?',
              [migration.version]
            );

            await this.db.execAsync('COMMIT');
            rolledBack++;
          } catch (error) {
            await this.db.execAsync('ROLLBACK');
            throw error;
          }
        } else {
          log.warn(`⚠️ Migration ${migration.version} has no down method, skipping`);
        }
      }

      return {
        success: true,
        rolledBack,
        currentVersion: await this.getCurrentVersion()
      };
    } catch (error) {
      log.error('❌ Rollback failed:', error);
      throw error;
    }
  }

  /**
   * Get migration history
   * @returns {Promise<Array>}
   */
  async getMigrationHistory() {
    const history = await this.db.getAllAsync(
      'SELECT * FROM migrations ORDER BY version DESC'
    );
    return history;
  }

  /**
   * Reset database (drop all tables and re-run migrations)
   * WARNING: This will delete all data!
   * @returns {Promise<Object>}
   */
  async reset() {
    log.warn('⚠️ Resetting database - all data will be lost!');

    try {
      // Get all table names
      const tables = await this.db.getAllAsync(
        `SELECT name FROM sqlite_master WHERE type='table'
         AND name NOT LIKE 'sqlite_%'`
      );

      // Drop all tables
      for (const table of tables) {
        await this.db.execAsync(`DROP TABLE IF EXISTS ${table.name}`);
        log.info(`Dropped table: ${table.name}`);
      }

      // Recreate migration table
      await this.createMigrationTable();

      // Run all migrations
      return await this.runMigrations();
    } catch (error) {
      log.error('❌ Database reset failed:', error);
      throw error;
    }
  }
}

export default new MigrationRunner();