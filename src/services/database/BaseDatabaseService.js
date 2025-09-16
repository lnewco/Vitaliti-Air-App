/**
 * BaseDatabaseService - Abstract base class for database services
 *
 * Provides common database functionality including error handling,
 * retry logic, and connection management that all database services inherit.
 */

import * as SQLite from 'expo-sqlite';
import logger from '../../utils/logger';

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

class BaseDatabaseService {
  constructor(moduleName) {
    this.log = logger.createModuleLogger(moduleName);
    this.db = null;
    this.isInitialized = false;
  }

  /**
   * Initialize database connection
   * @returns {Promise<void>}
   */
  async initialize(db = null) {
    try {
      if (db) {
        this.db = db;
      } else if (!this.db) {
        this.db = await SQLite.openDatabaseAsync('vitaliti.db');
      }
      this.isInitialized = true;
      this.log.info('Database service initialized');
    } catch (error) {
      this.log.error('Failed to initialize database service:', error);
      throw error;
    }
  }

  /**
   * Execute a database operation with retry logic
   * @param {Function} operation - The database operation to execute
   * @param {string} operationName - Name for logging
   * @param {number} retries - Number of retry attempts
   * @returns {Promise<any>}
   */
  async executeWithRetry(operation, operationName, retries = MAX_RETRIES) {
    let lastError;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const result = await operation();
        if (attempt > 1) {
          this.log.info(`✅ ${operationName} succeeded on attempt ${attempt}`);
        }
        return result;
      } catch (error) {
        lastError = error;
        this.log.warn(`⚠️ ${operationName} failed on attempt ${attempt}:`, error.message);

        if (attempt < retries) {
          await this.delay(RETRY_DELAY * attempt); // Exponential backoff
        }
      }
    }

    this.log.error(`❌ ${operationName} failed after ${retries} attempts:`, lastError);
    throw lastError;
  }

  /**
   * Delay helper for retry logic
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise<void>}
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Ensure database is initialized before operations
   * @throws {Error} If database is not initialized
   */
  ensureInitialized() {
    if (!this.isInitialized || !this.db) {
      throw new Error('Database service not initialized. Call initialize() first.');
    }
  }

  /**
   * Generate a random UUID v4
   * @returns {string}
   */
  generateId() {
    const randomBytes = new Uint8Array(16);
    crypto.getRandomValues(randomBytes);

    // Set version (4) and variant bits
    randomBytes[6] = (randomBytes[6] & 0x0f) | 0x40;
    randomBytes[8] = (randomBytes[8] & 0x3f) | 0x80;

    const hex = Array.from(randomBytes, byte => byte.toString(16).padStart(2, '0')).join('');

    return [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20, 32)
    ].join('-');
  }

  /**
   * Standard error response format
   * @param {string} operation - Operation that failed
   * @param {Error} error - The error object
   * @returns {Object}
   */
  formatErrorResponse(operation, error) {
    return {
      success: false,
      error: {
        message: error.message,
        operation,
        timestamp: Date.now(),
        code: error.code || 'UNKNOWN_ERROR'
      }
    };
  }

  /**
   * Standard success response format
   * @param {string} operation - Operation that succeeded
   * @param {any} data - Response data
   * @returns {Object}
   */
  formatSuccessResponse(operation, data = null) {
    return {
      success: true,
      data,
      operation,
      timestamp: Date.now()
    };
  }

  /**
   * Log database operation for debugging
   * @param {string} operation - Operation name
   * @param {Object} params - Operation parameters
   * @param {any} result - Operation result
   */
  logOperation(operation, params = {}, result = null) {
    if (process.env.NODE_ENV === 'development') {
      this.log.debug('📊 Database Operation:', {
        operation,
        params: Object.keys(params).length > 0 ? params : undefined,
        result: result !== null ? 'Success' : 'Pending',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Validate required fields
   * @param {Object} data - Data object to validate
   * @param {string[]} requiredFields - List of required field names
   * @throws {Error} If validation fails
   */
  validateRequiredFields(data, requiredFields) {
    const missing = requiredFields.filter(field => !data[field]);
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }
  }

  /**
   * Transaction wrapper with automatic rollback on error
   * @param {Function} operations - Function containing transaction operations
   * @returns {Promise<any>}
   */
  async transaction(operations) {
    this.ensureInitialized();

    try {
      await this.db.execAsync('BEGIN TRANSACTION');
      const result = await operations(this.db);
      await this.db.execAsync('COMMIT');
      return result;
    } catch (error) {
      await this.db.execAsync('ROLLBACK');
      this.log.error('Transaction rolled back due to error:', error);
      throw error;
    }
  }
}

export default BaseDatabaseService;