/**
 * Centralized logging utility for Vitaliti Air App
 * Provides structured logging with different levels and environment-aware output
 */

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

const LOG_EMOJIS = {
  ERROR: '❌',
  WARN: '⚠️',
  INFO: '✅',
  DEBUG: '🔍',
};

class Logger {
  constructor() {
    // Default to INFO level in production, DEBUG in development
    this.logLevel = __DEV__ ? LOG_LEVELS.DEBUG : LOG_LEVELS.INFO;
    this.enableConsole = true;
    this.logHistory = [];
    this.maxHistorySize = 100;
  }

  setLogLevel(level) {
    if (typeof level === 'string' && LOG_LEVELS[level.toUpperCase()] !== undefined) {
      this.logLevel = LOG_LEVELS[level.toUpperCase()];
    } else if (typeof level === 'number') {
      this.logLevel = level;
    }
  }

  setConsoleEnabled(enabled) {
    this.enableConsole = enabled;
  }

  _formatMessage(level, module, message, data) {
    const timestamp = new Date().toISOString();
    const emoji = LOG_EMOJIS[level] || '';
    
    let formattedMessage = `${emoji} [${module}] ${message}`;
    
    if (data !== undefined) {
      if (typeof data === 'object') {
        try {
          formattedMessage += ` | ${JSON.stringify(data, null, 2)}`;
        } catch (e) {
          formattedMessage += ` | [Circular or non-serializable data]`;
        }
      } else {
        formattedMessage += ` | ${data}`;
      }
    }

    return {
      timestamp,
      level,
      module,
      message,
      data,
      formatted: formattedMessage
    };
  }

  _log(level, module, message, data) {
    const levelValue = LOG_LEVELS[level];
    
    if (levelValue > this.logLevel) {
      return;
    }

    const logEntry = this._formatMessage(level, module, message, data);
    
    // Store in history for debugging
    this.logHistory.push(logEntry);
    if (this.logHistory.length > this.maxHistorySize) {
      this.logHistory.shift();
    }

    // Output to console if enabled
    if (this.enableConsole) {
      switch (level) {
        case 'ERROR':
          console.error(logEntry.formatted);
          break;
        case 'WARN':
          console.warn(logEntry.formatted);
          break;
        case 'INFO':
          console.log(logEntry.formatted);
          break;
        case 'DEBUG':
          console.log(logEntry.formatted);
          break;
      }
    }
  }

  error(module, message, data) {
    this._log('ERROR', module, message, data);
  }

  warn(module, message, data) {
    this._log('WARN', module, message, data);
  }

  info(module, message, data) {
    this._log('INFO', module, message, data);
  }

  debug(module, message, data) {
    this._log('DEBUG', module, message, data);
  }

  // Get recent logs for debugging
  getHistory(level = null) {
    if (level) {
      return this.logHistory.filter(entry => entry.level === level);
    }
    return this.logHistory;
  }

  // Clear log history
  clearHistory() {
    this.logHistory = [];
  }

  // Create a module-specific logger instance
  createModuleLogger(moduleName) {
    return {
      error: (message, data) => this.error(moduleName, message, data),
      warn: (message, data) => this.warn(moduleName, message, data),
      info: (message, data) => this.info(moduleName, message, data),
      debug: (message, data) => this.debug(moduleName, message, data),
    };
  }
}

// Create singleton instance
const logger = new Logger();

// Export both the logger instance and the Logger class
export default logger;
export { Logger, LOG_LEVELS };