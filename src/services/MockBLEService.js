class MockBLEService {
  constructor() {
    this.isConnected = false;
    this.dataInterval = null;
    this.listeners = new Set();
    this.baseSpO2 = 96;
    this.baseHR = 72;
    this.currentPhase = 'altitude';
    this.currentCycle = 1;
  }

  async connect() {
    return new Promise((resolve) => {
      setTimeout(() => {
        this.isConnected = true;
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
    const time = Date.now() / 1000;
    const waveform = Math.sin(time * 2);
    
    let spo2, heartRate;
    
    if (this.currentPhase === 'altitude') {
      // Cycle 1: High SpO2 (90-95%) to trigger dial increase
      // Cycle 2: Low SpO2 (80-85%) to trigger dial decrease and mask lifts
      if (this.currentCycle === 1) {
        // First hypoxic phase: 90-95%
        spo2 = Math.round(92.5 + waveform * 2.5);
      } else {
        // Second hypoxic phase: 80-85%
        spo2 = Math.round(82.5 + waveform * 2.5);
      }
      heartRate = Math.round(this.baseHR + 15 + waveform * 5);
    } else {
      // Recovery phase: normal high SpO2
      spo2 = Math.round(this.baseSpO2 - 2 + waveform);
      heartRate = Math.round(this.baseHR + 5 + waveform * 3);
    }
    
    spo2 = Math.max(75, Math.min(100, spo2));
    heartRate = Math.max(50, Math.min(120, heartRate));
    
    return {
      spo2,
      heartRate,
      timestamp: Date.now(),
      signalQuality: 95 + Math.random() * 5
    };
  }

  setPhase(phase) {
    this.currentPhase = phase;
  }

  setCycle(cycle) {
    this.currentCycle = cycle;
    console.log(`📊 MockBLE: Cycle updated to ${cycle}`);
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