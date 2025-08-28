/**
 * DataValidator - Common validation utilities for pulse oximeter data
 */

class DataValidator {
  /**
   * Validate SpO2 value
   */
  static isValidSpO2(value) {
    return typeof value === 'number' && value >= 70 && value <= 100;
  }

  /**
   * Validate heart rate value
   */
  static isValidHeartRate(value) {
    return typeof value === 'number' && value >= 30 && value <= 250;
  }

  /**
   * Validate perfusion index
   */
  static isValidPerfusionIndex(value) {
    return typeof value === 'number' && value >= 0 && value <= 20;
  }

  /**
   * Validate battery level
   */
  static isValidBattery(value) {
    return typeof value === 'number' && value >= 0 && value <= 100;
  }

  /**
   * Validate complete reading
   */
  static validateReading(spo2, heartRate) {
    const spo2Valid = this.isValidSpO2(spo2);
    const hrValid = this.isValidHeartRate(heartRate);
    
    return {
      spo2Valid,
      hrValid,
      isValid: spo2Valid || hrValid,
      bothValid: spo2Valid && hrValid
    };
  }

  /**
   * Sanitize SpO2 value (return null if invalid)
   */
  static sanitizeSpO2(value) {
    return this.isValidSpO2(value) ? value : null;
  }

  /**
   * Sanitize heart rate value
   */
  static sanitizeHeartRate(value) {
    return this.isValidHeartRate(value) ? value : null;
  }

  /**
   * Check if buffer looks like valid packet data
   */
  static isValidBuffer(buffer, minLength = 1) {
    return buffer && 
           Buffer.isBuffer(buffer) && 
           buffer.length >= minLength;
  }

  /**
   * Extract bits from a byte (for status flags)
   */
  static getBit(byte, position) {
    return (byte & (1 << position)) !== 0;
  }

  /**
   * Combine two bytes into 16-bit value
   */
  static combine16Bit(lowByte, highByte) {
    return lowByte | (highByte << 8);
  }
}

export default DataValidator;