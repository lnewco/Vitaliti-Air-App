/**
 * SessionIdGenerator - Generates unique session IDs for IHHT training sessions
 * 
 * Provides a single source of truth for session ID generation,
 * ensuring consistency and traceability throughout the application.
 */

class SessionIdGenerator {
  /**
   * Generate a unique session ID
   * @param {string} type - The session type (e.g., 'IHHT', 'HRV_CALIBRATION')
   * @returns {string} A unique session ID
   */
  static generate(type = 'IHHT') {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${type}_${timestamp}_${random}`;
  }

  /**
   * Parse a session ID to extract its components
   * @param {string} sessionId - The session ID to parse
   * @returns {object} Parsed components { type, timestamp, random }
   */
  static parse(sessionId) {
    const parts = sessionId.split('_');
    if (parts.length < 3) {
      return { type: null, timestamp: null, random: null };
    }
    
    return {
      type: parts[0],
      timestamp: parseInt(parts[1], 10),
      random: parts[2]
    };
  }

  /**
   * Validate if a string is a valid session ID
   * @param {string} sessionId - The string to validate
   * @returns {boolean} True if valid session ID format
   */
  static isValid(sessionId) {
    if (!sessionId || typeof sessionId !== 'string') {
      return false;
    }
    
    const parts = sessionId.split('_');
    if (parts.length < 3) {
      return false;
    }
    
    const timestamp = parseInt(parts[1], 10);
    return !isNaN(timestamp) && timestamp > 0;
  }
}

export default SessionIdGenerator;