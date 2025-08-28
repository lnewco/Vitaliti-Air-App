/**
 * PulseOxReading - Standard data model for pulse oximeter readings
 * Provides factory methods to create consistent reading objects
 */

const DEFAULT_READING = {
  spo2: null,
  heartRate: null,
  perfusionIndex: null,
  signalStrength: null,
  isFingerDetected: false,
  isSearchingForPulse: false,
  isLowPerfusion: false,
  isMotionDetected: false,
  pleth: null,
  bargraph: null,
  battery: null,
  chargeStatus: null,
  timestamp: null,
  rawData: null,
  protocol: null
};

class PulseOxReading {
  /**
   * Create a new pulse ox reading with defaults
   */
  static create(params = {}) {
    return {
      ...DEFAULT_READING,
      ...params,
      timestamp: params.timestamp || Date.now()
    };
  }

  /**
   * Create a valid reading with SpO2 and heart rate
   */
  static createValid(spo2, heartRate, additionalParams = {}) {
    return this.create({
      spo2,
      heartRate,
      isFingerDetected: true,
      ...additionalParams
    });
  }

  /**
   * Create a "no finger detected" reading
   */
  static createNoFinger(additionalParams = {}) {
    return this.create({
      isFingerDetected: false,
      ...additionalParams
    });
  }

  /**
   * Create a "searching for pulse" reading
   */
  static createSearching(additionalParams = {}) {
    return this.create({
      isSearchingForPulse: true,
      isFingerDetected: true,
      ...additionalParams
    });
  }

  /**
   * Create an error/invalid reading
   */
  static createError(rawData = null) {
    return this.create({
      rawData,
      protocol: 'error'
    });
  }
}

export default PulseOxReading;