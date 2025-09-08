class MockBLEService {
  constructor() {
    this.isConnected = false;
    this.dataInterval = null;
    this.listeners = new Set();
    this.baseSpO2 = 96;
    this.baseHR = 72;
    this.currentPhase = 'altitude';
    this.currentCycle = 1;
    this.lastLoggedSecond = 0;
    this.lastSpo2LogTime = 0;
    this.phaseStartTime = null;
    this.maskLiftTriggered = false;
    this.maskLiftTime = null;
    this.secondMaskLiftTriggered = false;
    this.sessionStarted = false; // Track if session has actually started
  }

  async connect() {
    return new Promise((resolve) => {
      setTimeout(() => {
        this.isConnected = true;
        // Don't start data stream until session actually begins
        // Just send stable data while connected but not in session
        this.startDataStream();
        resolve(true);
      }, 1500);
    });
  }

  disconnect() {
    this.isConnected = false;
    if (this.dataInterval) {
      clearInterval(this.dataInterval);
      this.dataInterval = null;
    }
  }

  startDataStream() {
    if (this.dataInterval) return;
    
    this.dataInterval = setInterval(() => {
      const data = this.generateMockData();
      this.notifyListeners(data);
    }, 1000);
  }

  generateMockData() {
    // If session hasn't started yet, just return stable baseline data
    if (!this.sessionStarted || !this.phaseStartTime) {
      return {
        spo2: 99,
        heartRate: 72 + Math.round(Math.sin(Date.now() / 1000) * 3),
        timestamp: Date.now(),
        signalQuality: 95 + Math.random() * 5
      };
    }
    
    const now = Date.now();
    const elapsedSeconds = this.phaseStartTime ? (now - this.phaseStartTime) / 1000 : 0;
    
    let spo2, heartRate;
    
    if (this.currentPhase === 'altitude') {
      // Log cycle info only once every 5 seconds with more detail
      const currentFiveSeconds = Math.floor(elapsedSeconds / 5);
      if (this.lastLoggedSecond !== currentFiveSeconds) {
        this.lastLoggedSecond = currentFiveSeconds;
        console.log(`📊 Mock Data State:`, {
          cycle: this.currentCycle,
          phase: this.currentPhase,
          elapsed: Math.floor(elapsedSeconds),
          maskLiftTriggered: this.maskLiftTriggered,
          willDropFurther: this.willDropFurther
        });
      }
      
      if (this.currentCycle === 1) {
        // Cycle 1: Start at 99, descend to 83 faster (12 seconds instead of 20)
        // This gives more time for mask lift scenarios
        if (elapsedSeconds < 12) {
          // Faster descent from 99 to 83 over 12 seconds
          spo2 = Math.round(99 - (16 * elapsedSeconds / 12));
        } else {
          // Check if we need to trigger mask lift
          if (!this.maskLiftTriggered) {
            // First mask lift should be triggered around here
            this.maskLiftTriggered = true;
            this.maskLiftTime = elapsedSeconds;
            
            // Coin toss: 50% chance to recover, 50% chance to drop further
            this.willDropFurther = Math.random() < 0.5;
            console.log(`🎭 Cycle 1: Mask lift at 83%, will ${this.willDropFurther ? 'DROP to <80' : 'RECOVER to 87-90'}`);
          }
          
          const timeSinceMaskLift = elapsedSeconds - this.maskLiftTime;
          
          if (this.willDropFurther) {
            // Stay at 83 for 3 seconds, then drop to <80 faster
            if (timeSinceMaskLift < 3) {
              // Hold at 83 for 3 seconds
              spo2 = 83;
            } else if (timeSinceMaskLift < 8) {
              // Next 5 seconds: drop from 83 to 78
              spo2 = Math.round(83 - ((timeSinceMaskLift - 3) * 1));
            } else {
              // After hitting 78, recover to 85+
              spo2 = Math.round(78 + Math.min(9, (timeSinceMaskLift - 8) * 0.7));
            }
          } else {
            // Recover immediately to 87-90
            if (timeSinceMaskLift < 10) {
              // First 10 seconds: recover from 83 to 89
              spo2 = Math.round(83 + (timeSinceMaskLift * 0.6));
            } else {
              // After 10 seconds: stabilize around 88-90 with small variations
              const wave = Math.sin((elapsedSeconds - this.maskLiftTime) * 0.2);
              spo2 = Math.round(89 + wave * 1); // Varies between 88 and 90
            }
          }
        }
        
      } else if (this.currentCycle === 2) {
        // Cycle 2: Start at 99, then hover between 87-93 (avg >90) for dial increase
        if (elapsedSeconds < 8) {
          // Start at 99, drop to 90 over 8 seconds
          spo2 = Math.round(99 - (9 * elapsedSeconds / 8));
        } else {
          // Hover between 87-93 with average around 91
          const wave = Math.sin((elapsedSeconds - 8) * 0.3);
          spo2 = Math.round(90 + wave * 3); // 87-93 range, avg 90
        }
        
      } else {
        // Cycle 3+: Start at 99, then normal range 85-90, no adjustments
        if (elapsedSeconds < 10) {
          // Start at 99, drop to 87 over 10 seconds
          spo2 = Math.round(99 - (12 * elapsedSeconds / 10));
        } else {
          // Hover between 85-90
          const wave = Math.sin((elapsedSeconds - 10) * 0.25);
          spo2 = Math.round(87.5 + wave * 2.5); // 85-90 range
        }
      }
      
      // Heart rate increases during altitude phase
      heartRate = Math.round(72 + 15 + Math.sin(elapsedSeconds * 0.1) * 5);
      
    } else {
      // Recovery phase: always return to 99
      if (elapsedSeconds < 3) {
        // Quick recovery to 99 from wherever we were
        spo2 = Math.round(85 + (14 * elapsedSeconds / 3));
      } else {
        // Stay at 99
        spo2 = 99;
      }
      heartRate = Math.round(72 + 5 + Math.sin(elapsedSeconds * 0.1) * 3);
    }
    
    // Ensure bounds
    spo2 = Math.max(75, Math.min(100, spo2));
    heartRate = Math.max(50, Math.min(120, heartRate));
    
    // Log current SpO2 for debugging
    const logTime = Math.floor(elapsedSeconds);
    if (logTime % 5 === 0 && this.lastSpo2LogTime !== logTime) {
      this.lastSpo2LogTime = logTime;
      console.log(`🔵 Cycle ${this.currentCycle} SpO2: ${spo2}% at ${logTime}s (phase: ${this.currentPhase})`);
    }
    
    return {
      spo2,
      heartRate,
      timestamp: Date.now(),
      signalQuality: 95 + Math.random() * 5
    };
  }

  startSession() {
    this.sessionStarted = true;
    this.currentCycle = 1;
    this.currentPhase = 'altitude';
    this.phaseStartTime = Date.now();
    this.maskLiftTriggered = false;
    this.maskLiftTime = null;
    this.secondMaskLiftTriggered = false;
    this.willDropFurther = false;
    console.log('🚀 MockBLE: Session started - beginning data simulation');
  }
  
  endSession() {
    this.sessionStarted = false;
    this.currentCycle = 1;
    this.phaseStartTime = null;
    console.log('🛑 MockBLE: Session ended - returning to baseline');
  }
  
  setPhase(phase) {
    this.currentPhase = phase;
    this.phaseStartTime = Date.now();
    
    // Reset mask lift flags when phase changes
    if (phase === 'altitude') {
      this.maskLiftTriggered = false;
      this.maskLiftTime = null;
      this.secondMaskLiftTriggered = false;
      this.willDropFurther = false;
    }
    console.log(`🔄 MockBLE: Phase changed to ${phase}`);
  }

  setCycle(cycle) {
    const previousCycle = this.currentCycle;
    this.currentCycle = cycle;
    // Reset mask lift flags for new cycle
    this.maskLiftTriggered = false;
    this.maskLiftTime = null;
    this.secondMaskLiftTriggered = false;
    this.willDropFurther = false;
    console.log(`📊 MockBLE: Cycle updated from ${previousCycle} to ${cycle}`);
    console.log(`📊 Current state: phase=${this.currentPhase}, cycle=${this.currentCycle}`);
  }

  onData(callback) {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  notifyListeners(data) {
    this.listeners.forEach(listener => {
      try {
        listener(data);
      } catch (error) {
        console.error('Error in BLE listener:', error);
      }
    });
  }

  async searchForDevices() {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve([
          { id: 'mock-1', name: 'Mock Pulse Oximeter', rssi: -45 }
        ]);
      }, 1000);
    });
  }

  getConnectionStatus() {
    return this.isConnected;
  }
}

export const mockBLEService = new MockBLEService();