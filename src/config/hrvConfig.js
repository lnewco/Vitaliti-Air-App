// HRV Configuration for Dual-Timeframe Approach
// Based on research findings for optimal user experience and clinical accuracy

export const HRV_CONFIG = {
  // Quick HRV - Fast feedback for users (immediate start)
  QUICK: {
    MIN_INTERVALS: 10,        // Start after just 10 intervals (~10-15 seconds)
    MAX_WINDOW_SIZE: 60,      // Maximum intervals to keep
    UPDATE_FREQUENCY: 2000,   // Update every 2 seconds
    CONFIDENCE_LABEL: 'Quick Reading',
    MIN_CONFIDENCE: 0.4,
    MAX_CONFIDENCE: 0.75
  },
  
  // Real HRV - Research-grade accuracy (start after 1 minute)
  REAL: {
    MIN_INTERVALS: 60,        // Start after 60 intervals (~1 minute)
    MAX_WINDOW_SIZE: 300,     // Maximum intervals to keep (~5 minutes)
    UPDATE_FREQUENCY: 15000,  // Update every 15 seconds (faster updates)
    CONFIDENCE_LABEL: 'Real HRV',
    MIN_CONFIDENCE: 0.85,
    MAX_CONFIDENCE: 0.98
  },
  
  // Progressive reliability stages
  RELIABILITY_STAGES: {
    0: { 
      label: "Initializing HRV...", 
      show: false, 
      confidence: 0,
      description: "Collecting initial data"
    },
    10: { 
      label: "Quick Reading", 
      show: true, 
      confidence: 0.4,
      description: "Early HRV estimate"
    },
    30: { 
      label: "Good Reading", 
      show: true, 
      confidence: 0.6,
      description: "Reliable short-term HRV"
    },
    60: { 
      label: "Real HRV", 
      show: true, 
      confidence: 0.85,
      description: "Research-grade accuracy"
    },
    150: { 
      label: "High Accuracy", 
      show: true, 
      confidence: 0.95,
      description: "Very high confidence level"
    },
    300: { 
      label: "Optimal Accuracy", 
      show: true, 
      confidence: 0.98,
      description: "Maximum confidence level"
    }
  },
  
  // Calculation settings
  CALCULATION: {
    // Original settings
    OLD_MIN_INTERVALS: 2,           // What we currently use (too low)
    OLD_UPDATE_FREQUENCY: 2000,     // What we currently use (too frequent)
    
    // RR Interval validation (time between heartbeats)
    MIN_RR_INTERVAL: 300,           // 200 BPM max (300ms between beats)
    MAX_RR_INTERVAL: 2000,          // 30 BPM min (2000ms between beats)
    
    // HRV RMSSD validation (heart rate variability)
    MIN_HRV_RMSSD: 5,              // Minimum realistic HRV (very low variability)
    MAX_HRV_RMSSD: 200,            // Maximum realistic HRV (very high variability)
    TYPICAL_HRV_RANGE: {           // Typical healthy adult ranges
      LOW: 10,
      NORMAL_MIN: 20,
      NORMAL_MAX: 60,
      HIGH: 100,
      VERY_HIGH: 150
    },
    
    // Quality assessment
    DATA_QUALITY_THRESHOLDS: {
      LOW: 10,      // intervals
      MEDIUM: 30,
      HIGH: 60,
      EXCELLENT: 150
    },
    
    // Outlier detection settings
    OUTLIER_DETECTION: {
      ENABLED: true,
      METHOD: 'IQR', // Interquartile Range method
      IQR_MULTIPLIER: 1.5, // Standard IQR outlier threshold
      MAX_DEVIATION_PERCENT: 50 // Max % deviation from median
    }
  },
  
  // UI Configuration
  UI: {
    SHOW_QUICK_AFTER: 10000,    // Show Quick HRV after 10 seconds
    SHOW_REAL_AFTER: 60000,     // Show Real HRV after 1 minute
    
    // Confidence indicators
    CONFIDENCE_COLORS: {
      LOW: '#FF6B6B',      // Red
      MEDIUM: '#FFE66D',   // Yellow  
      HIGH: '#4ECDC4',     // Teal
      EXCELLENT: '#45B7D1' // Blue
    },
    
    // Icons for different stages
    STAGE_ICONS: {
      INITIALIZING: '⏳',
      QUICK: '⚡',
      GOOD: '✅',
      REAL: '🎯',
      OPTIMAL: '⭐'
    }
  }
};

// Helper functions for HRV calculations
export const HRV_HELPERS = {
  /**
   * Get confidence level based on interval count
   */
  getConfidence: (intervalCount) => {
    const stages = HRV_CONFIG.RELIABILITY_STAGES;
    
    if (intervalCount >= 300) return stages[300].confidence;
    if (intervalCount >= 150) return stages[150].confidence;
    if (intervalCount >= 60) return stages[60].confidence;
    if (intervalCount >= 30) return stages[30].confidence;
    if (intervalCount >= 10) return stages[10].confidence;
    return stages[0].confidence;
  },
  
  /**
   * Get current stage info based on interval count
   */
  getStageInfo: (intervalCount) => {
    const stages = HRV_CONFIG.RELIABILITY_STAGES;
    
    if (intervalCount >= 300) return stages[300];
    if (intervalCount >= 150) return stages[150];
    if (intervalCount >= 60) return stages[60];
    if (intervalCount >= 30) return stages[30];
    if (intervalCount >= 10) return stages[10];
    return stages[0];
  },
  
  /**
   * Determine data quality based on interval count
   */
  getDataQuality: (intervalCount) => {
    const thresholds = HRV_CONFIG.CALCULATION.DATA_QUALITY_THRESHOLDS;
    
    if (intervalCount >= thresholds.EXCELLENT) return 'excellent';
    if (intervalCount >= thresholds.HIGH) return 'high';
    if (intervalCount >= thresholds.MEDIUM) return 'medium';
    if (intervalCount >= thresholds.LOW) return 'low';
    return 'insufficient';
  },
  
  /**
   * Validate RR interval is within acceptable range
   */
  isValidRRInterval: (interval) => {
    const { MIN_RR_INTERVAL, MAX_RR_INTERVAL } = HRV_CONFIG.CALCULATION;
    return interval >= MIN_RR_INTERVAL && interval <= MAX_RR_INTERVAL;
  },
  
  /**
   * Validate HRV RMSSD value is within realistic range
   */
  isValidHRV: (rmssd) => {
    const { MIN_HRV_RMSSD, MAX_HRV_RMSSD } = HRV_CONFIG.CALCULATION;
    return rmssd >= MIN_HRV_RMSSD && rmssd <= MAX_HRV_RMSSD;
  },
  
  /**
   * Get HRV quality classification
   */
  getHRVClassification: (rmssd) => {
    const range = HRV_CONFIG.CALCULATION.TYPICAL_HRV_RANGE;
    if (rmssd < range.LOW) return 'very-low';
    if (rmssd < range.NORMAL_MIN) return 'low';
    if (rmssd <= range.NORMAL_MAX) return 'normal';
    if (rmssd <= range.HIGH) return 'high';
    if (rmssd <= range.VERY_HIGH) return 'very-high';
    return 'abnormal';
  },
  
  /**
   * Remove outliers from RR intervals using IQR method
   */
  removeOutliers: (intervals) => {
    if (!HRV_CONFIG.CALCULATION.OUTLIER_DETECTION.ENABLED || intervals.length < 4) {
      return intervals;
    }
    
    // Sort intervals for quartile calculation
    const sorted = [...intervals].sort((a, b) => a - b);
    const q1Index = Math.floor(sorted.length * 0.25);
    const q3Index = Math.floor(sorted.length * 0.75);
    
    const q1 = sorted[q1Index];
    const q3 = sorted[q3Index];
    const iqr = q3 - q1;
    
    const multiplier = HRV_CONFIG.CALCULATION.OUTLIER_DETECTION.IQR_MULTIPLIER;
    const lowerBound = q1 - (iqr * multiplier);
    const upperBound = q3 + (iqr * multiplier);
    
    // Also apply maximum deviation from median
    const median = sorted[Math.floor(sorted.length / 2)];
    const maxDev = HRV_CONFIG.CALCULATION.OUTLIER_DETECTION.MAX_DEVIATION_PERCENT / 100;
    const medianLower = median * (1 - maxDev);
    const medianUpper = median * (1 + maxDev);
    
    // Filter outliers
    const filtered = intervals.filter(interval => {
      return interval >= Math.max(lowerBound, medianLower) && 
             interval <= Math.min(upperBound, medianUpper);
    });
    
    return filtered;
  }
};

export default HRV_CONFIG; 