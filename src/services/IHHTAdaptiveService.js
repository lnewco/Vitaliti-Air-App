class IHHTAdaptiveService {
  constructor() {
    this.currentDial = 6;
    this.baselineSpO2 = 96;
    this.targetSpO2 = 88;
    this.adjustmentHistory = [];
  }

  calculateOptimalDial(currentSpO2, heartRate, timeInPhase) {
    const spO2Difference = currentSpO2 - this.targetSpO2;
    
    let adjustment = 0;
    if (spO2Difference > 5) {
      adjustment = 1;
    } else if (spO2Difference > 2) {
      adjustment = 0.5;
    } else if (spO2Difference < -5) {
      adjustment = -1;
    } else if (spO2Difference < -2) {
      adjustment = -0.5;
    }
    
    const newDial = Math.max(1, Math.min(10, this.currentDial + adjustment));
    
    this.adjustmentHistory.push({
      timestamp: Date.now(),
      currentSpO2,
      heartRate,
      timeInPhase,
      previousDial: this.currentDial,
      newDial,
      adjustment
    });
    
    this.currentDial = newDial;
    return newDial;
  }

  getRecommendedRecoveryTime(lowestSpO2, avgHeartRate) {
    if (lowestSpO2 < 80) {
      return 240;
    } else if (lowestSpO2 < 85) {
      return 210;
    } else if (lowestSpO2 < 88) {
      return 180;
    }
    return 150;
  }

  shouldTriggerEmergencyStop(spO2, heartRate) {
    if (spO2 < 75) return { stop: true, reason: 'SpO2 critically low (< 75%)' };
    if (heartRate > 140) return { stop: true, reason: 'Heart rate too high (> 140 BPM)' };
    if (heartRate < 40) return { stop: true, reason: 'Heart rate too low (< 40 BPM)' };
    return { stop: false, reason: null };
  }

  getPhaseStatus(currentPhase, timeInPhase, totalPhaseTime) {
    const progress = (timeInPhase / totalPhaseTime) * 100;
    const timeRemaining = totalPhaseTime - timeInPhase;
    
    return {
      phase: currentPhase,
      progress,
      timeRemaining,
      formattedTime: this.formatTime(timeRemaining)
    };
  }

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  reset() {
    this.currentDial = 6;
    this.adjustmentHistory = [];
  }
}

export default new IHHTAdaptiveService();