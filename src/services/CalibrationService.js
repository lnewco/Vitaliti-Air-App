import DatabaseService from './DatabaseService';
import logger from '../utils/logger';

const log = logger.createModuleLogger('CalibrationService');

// React Native compatible UUID generator
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

class CalibrationService {
  constructor() {
    this.currentSession = null;
    this.currentIntensity = 2; // Starting intensity
    this.minuteNumber = 0;
    this.minuteStartTime = null;
    this.spo2Readings = [];
    this.heartRateReadings = [];
    this.isMonitoring = false;
    this.SPO2_THRESHOLD = 85;
    this.MAX_INTENSITY = 10;
    this.MINUTE_DURATION = 60; // seconds
  }

  async startCalibrationSession(userId = null, deviceId = 'unknown') {
    try {
      // Generate unique session ID
      const sessionId = generateUUID();
      log.info(`Starting calibration session with ID: ${sessionId}, userId: ${userId}, deviceId: ${deviceId}`);
      
      // Create session in database
      try {
        await DatabaseService.createCalibrationSession(sessionId, userId, deviceId);
      } catch (dbError) {
        log.error('Database error creating calibration session:', {
          message: dbError.message,
          stack: dbError.stack,
          name: dbError.name,
          code: dbError.code,
          details: JSON.stringify(dbError)
        });
        throw new Error(`Database error: ${dbError.message || 'Unknown database error'}`);
      }
      
      // Initialize session state
      this.currentSession = {
        id: sessionId,
        userId,
        deviceId,
        startTime: Date.now(),
        status: 'active'
      };
      
      this.currentIntensity = 2;
      this.minuteNumber = 0;
      this.minuteStartTime = null;
      this.spo2Readings = [];
      this.heartRateReadings = [];
      this.isMonitoring = false;
      
      log.info(`Calibration session started successfully: ${sessionId}`);
      return sessionId;
    } catch (error) {
      log.error('Failed to start calibration session:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
        details: JSON.stringify(error)
      });
      throw error;
    }
  }

  async recordSpo2Reading(spo2, heartRate) {
    if (!this.currentSession || this.currentSession.status !== 'active') {
      return null;
    }

    // Store readings for averaging
    if (this.isMonitoring && this.minuteStartTime) {
      if (spo2 && spo2 > 0) {
        this.spo2Readings.push(spo2);
      }
      if (heartRate && heartRate > 0) {
        this.heartRateReadings.push(heartRate);
      }
    }

    // Check if SpO2 threshold is reached
    if (spo2 && spo2 <= this.SPO2_THRESHOLD) {
      log.info(`SpO2 threshold reached: ${spo2}% <= ${this.SPO2_THRESHOLD}%`);
      
      // Save current minute data
      if (this.minuteStartTime) {
        await this.saveMinuteData(spo2, heartRate);
      }
      
      // End calibration with current intensity
      const result = await this.endCalibrationSession(this.currentIntensity, 'spo2_threshold');
      return {
        thresholdReached: true,
        calibrationValue: this.currentIntensity,
        finalSpo2: spo2,
        finalHeartRate: heartRate,
        ...result
      };
    }

    return {
      thresholdReached: false,
      currentIntensity: this.currentIntensity,
      spo2,
      heartRate
    };
  }

  async confirmIntensityChange() {
    if (!this.currentSession || this.currentSession.status !== 'active') {
      throw new Error('No active calibration session');
    }

    const confirmationTime = Date.now();
    
    // If this is not the first intensity, save the previous minute's data
    if (this.minuteStartTime) {
      await this.saveMinuteData();
    }

    // Start monitoring for this intensity level
    this.minuteNumber++;
    this.minuteStartTime = Date.now();
    this.spo2Readings = [];
    this.heartRateReadings = [];
    this.isMonitoring = true;

    log.info(`Intensity ${this.currentIntensity} confirmed at minute ${this.minuteNumber}`);
    
    return {
      currentIntensity: this.currentIntensity,
      minuteNumber: this.minuteNumber,
      startTime: this.minuteStartTime
    };
  }

  async saveMinuteData(finalSpo2 = null, finalHeartRate = null) {
    if (!this.minuteStartTime) return;

    const endTime = Date.now();
    const durationSeconds = Math.floor((endTime - this.minuteStartTime) / 1000);

    // Calculate averages
    const avgSpo2 = this.spo2Readings.length > 0 
      ? this.spo2Readings.reduce((a, b) => a + b, 0) / this.spo2Readings.length 
      : null;
    const minSpo2 = this.spo2Readings.length > 0 
      ? Math.min(...this.spo2Readings) 
      : null;
    const avgHeartRate = this.heartRateReadings.length > 0 
      ? this.heartRateReadings.reduce((a, b) => a + b, 0) / this.heartRateReadings.length 
      : null;

    // Use final values or last readings
    const lastSpo2 = finalSpo2 || (this.spo2Readings.length > 0 ? this.spo2Readings[this.spo2Readings.length - 1] : null);
    const lastHeartRate = finalHeartRate || (this.heartRateReadings.length > 0 ? this.heartRateReadings[this.heartRateReadings.length - 1] : null);

    await DatabaseService.saveCalibrationReading(this.currentSession.id, {
      intensityLevel: this.currentIntensity,
      minuteNumber: this.minuteNumber,
      startTime: this.minuteStartTime,
      endTime: endTime,
      confirmationTime: this.minuteStartTime, // Confirmation happens at start
      durationSeconds: durationSeconds,
      finalSpO2: lastSpo2,
      finalHeartRate: lastHeartRate,
      avgSpO2: avgSpo2,
      minSpO2: minSpo2,
      avgHeartRate: avgHeartRate,
      completed: true
    });

    log.info(`Minute ${this.minuteNumber} data saved for intensity ${this.currentIntensity}`);
  }

  async incrementIntensity() {
    if (!this.currentSession || this.currentSession.status !== 'active') {
      throw new Error('No active calibration session');
    }

    // Check if we've reached max intensity
    if (this.currentIntensity >= this.MAX_INTENSITY) {
      log.info('Max intensity reached, ending calibration');
      const result = await this.endCalibrationSession(this.MAX_INTENSITY, 'max_intensity');
      return {
        maxReached: true,
        calibrationValue: this.MAX_INTENSITY,
        ...result
      };
    }

    // Increment intensity
    this.currentIntensity++;
    this.isMonitoring = false; // Stop monitoring until confirmed
    
    log.info(`Intensity incremented to ${this.currentIntensity}`);
    
    return {
      newIntensity: this.currentIntensity,
      maxReached: false
    };
  }

  async endCalibrationSession(calibrationValue, terminatedReason) {
    if (!this.currentSession) {
      throw new Error('No active calibration session');
    }

    try {
      // Mark session as completed
      this.currentSession.status = 'completed';
      
      // Save final data to database
      const result = await DatabaseService.endCalibrationSession(
        this.currentSession.id,
        calibrationValue,
        terminatedReason
      );

      // Update user's calibration value if we have a user ID
      if (this.currentSession.userId && calibrationValue) {
        await DatabaseService.updateUserCalibrationValue(
          this.currentSession.userId,
          calibrationValue
        );
      }

      log.info(`Calibration session ended: value=${calibrationValue}, reason=${terminatedReason}`);
      
      // Clear session state
      const sessionData = {
        sessionId: this.currentSession.id,
        calibrationValue,
        terminatedReason,
        ...result
      };
      
      this.currentSession = null;
      this.currentIntensity = 2;
      this.minuteNumber = 0;
      this.minuteStartTime = null;
      this.spo2Readings = [];
      this.heartRateReadings = [];
      this.isMonitoring = false;
      
      return sessionData;
    } catch (error) {
      log.error('Failed to end calibration session:', error);
      throw error;
    }
  }

  async cancelCalibrationSession() {
    if (!this.currentSession) {
      return;
    }

    try {
      // Save any pending minute data
      if (this.minuteStartTime) {
        await this.saveMinuteData();
      }

      // End session without calibration value
      await this.endCalibrationSession(null, 'user_ended');
    } catch (error) {
      log.error('Failed to cancel calibration session:', error);
      // Reset state even if database update fails
      this.currentSession = null;
      this.currentIntensity = 2;
      this.minuteNumber = 0;
      this.minuteStartTime = null;
      this.spo2Readings = [];
      this.heartRateReadings = [];
      this.isMonitoring = false;
    }
  }

  getCurrentStatus() {
    if (!this.currentSession) {
      return {
        isActive: false
      };
    }

    const secondsElapsed = this.minuteStartTime 
      ? Math.floor((Date.now() - this.minuteStartTime) / 1000)
      : 0;

    return {
      isActive: true,
      sessionId: this.currentSession.id,
      currentIntensity: this.currentIntensity,
      minuteNumber: this.minuteNumber,
      secondsElapsed,
      secondsRemaining: Math.max(0, this.MINUTE_DURATION - secondsElapsed),
      isMonitoring: this.isMonitoring,
      readingCount: this.spo2Readings.length,
      avgSpo2: this.spo2Readings.length > 0 
        ? Math.round(this.spo2Readings.reduce((a, b) => a + b, 0) / this.spo2Readings.length)
        : null,
      avgHeartRate: this.heartRateReadings.length > 0
        ? Math.round(this.heartRateReadings.reduce((a, b) => a + b, 0) / this.heartRateReadings.length)
        : null
    };
  }

  async getCalibrationHistory(userId, limit = 10) {
    try {
      return await DatabaseService.getCalibrationHistory(userId, limit);
    } catch (error) {
      log.error('Failed to get calibration history:', error);
      throw error;
    }
  }

  async getLatestCalibrationValue(userId) {
    try {
      return await DatabaseService.getLatestCalibrationValue(userId);
    } catch (error) {
      log.error('Failed to get latest calibration value:', error);
      return null;
    }
  }
}

export default new CalibrationService();