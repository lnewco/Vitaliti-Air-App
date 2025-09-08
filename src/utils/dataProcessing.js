/**
 * Data processing utilities for session analytics
 * Ported from Vitaliti-Air-Analytics for mobile use
 */

/**
 * Smart sampling algorithm that preserves data extremes while reducing points
 * @param {Array} readings - Array of reading objects with timestamps
 * @param {Object} options - Sampling options
 * @returns {Array} Sampled readings
 */
export const smartSampleReadings = (readings, options = {}) => {
  const {
    maxPoints = 300,
    preserveExtremes = true,
    smoothingWindow = 3
  } = options;

  if (!readings || readings.length === 0) return [];
  if (readings.length <= maxPoints) return readings;

  // Sort readings by timestamp
  const sortedReadings = [...readings].sort((a, b) => {
    const timeA = typeof a.timestamp === 'string' ? new Date(a.timestamp).getTime() : a.timestamp;
    const timeB = typeof b.timestamp === 'string' ? new Date(b.timestamp).getTime() : b.timestamp;
    return timeA - timeB;
  });

  // Calculate sampling interval
  const interval = Math.floor(sortedReadings.length / maxPoints);
  const sampled = [];
  
  // Always include first reading
  sampled.push(sortedReadings[0]);

  // Track extremes for each metric
  const extremes = new Set();
  
  if (preserveExtremes) {
    // Find local extremes for SpO2 and heart rate
    for (let i = 1; i < sortedReadings.length - 1; i++) {
      const prev = sortedReadings[i - 1];
      const curr = sortedReadings[i];
      const next = sortedReadings[i + 1];
      
      // Check SpO2 extremes
      if (curr.spo2) {
        if ((curr.spo2 < prev.spo2 && curr.spo2 < next.spo2) || 
            (curr.spo2 > prev.spo2 && curr.spo2 > next.spo2)) {
          extremes.add(i);
        }
      }
      
      // Check heart rate extremes
      if (curr.heart_rate) {
        if ((curr.heart_rate < prev.heart_rate && curr.heart_rate < next.heart_rate) || 
            (curr.heart_rate > prev.heart_rate && curr.heart_rate > next.heart_rate)) {
          extremes.add(i);
        }
      }
    }
  }

  // Sample readings with phase change detection
  let lastPhase = sortedReadings[0].phase_type || sortedReadings[0].phaseType;
  let lastCycle = sortedReadings[0].cycle_number || sortedReadings[0].cycleNumber;
  
  for (let i = interval; i < sortedReadings.length - 1; i += interval) {
    const reading = sortedReadings[i];
    const currentPhase = reading.phase_type || reading.phaseType;
    const currentCycle = reading.cycle_number || reading.cycleNumber;
    
    // Always include phase transitions
    if (currentPhase !== lastPhase || currentCycle !== lastCycle) {
      // Add the last reading of the previous phase
      if (i > 0) sampled.push(sortedReadings[i - 1]);
      sampled.push(reading);
      lastPhase = currentPhase;
      lastCycle = currentCycle;
    } else {
      sampled.push(reading);
    }
    
    // Include nearby extremes
    if (preserveExtremes) {
      for (let j = i - interval + 1; j < i; j++) {
        if (extremes.has(j)) {
          sampled.push(sortedReadings[j]);
        }
      }
    }
  }
  
  // Always include last reading
  const lastReading = sortedReadings[sortedReadings.length - 1];
  if (sampled[sampled.length - 1] !== lastReading) {
    sampled.push(lastReading);
  }

  // Sort sampled readings by timestamp
  return sampled.sort((a, b) => {
    const timeA = typeof a.timestamp === 'string' ? new Date(a.timestamp).getTime() : a.timestamp;
    const timeB = typeof b.timestamp === 'string' ? new Date(b.timestamp).getTime() : b.timestamp;
    return timeA - timeB;
  });
};

/**
 * Remove duplicate readings based on timestamp
 * @param {Array} readings - Array of reading objects
 * @returns {Array} Deduplicated readings
 */
export const removeDuplicateReadings = (readings) => {
  if (!readings || readings.length === 0) return [];
  
  const seen = new Set();
  return readings.filter(reading => {
    const timestamp = typeof reading.timestamp === 'string' 
      ? new Date(reading.timestamp).getTime() 
      : reading.timestamp;
    
    if (seen.has(timestamp)) {
      return false;
    }
    seen.add(timestamp);
    return true;
  });
};

/**
 * Calculate data quality metrics
 * @param {Array} originalReadings - Original unprocessed readings
 * @param {Array} sampledReadings - Sampled readings
 * @returns {Object} Data quality metrics
 */
export const calculateDataQuality = (originalReadings, sampledReadings) => {
  const totalReadings = originalReadings.length;
  const sampledCount = sampledReadings.length;
  
  // Calculate time span
  if (totalReadings === 0) {
    return {
      dataQuality: 'unknown',
      totalReadings: 0,
      sampledReadings: 0,
      readingsPerMinute: 0,
      reductionPercentage: 0
    };
  }
  
  const firstTime = typeof originalReadings[0].timestamp === 'string' 
    ? new Date(originalReadings[0].timestamp).getTime()
    : originalReadings[0].timestamp;
  
  const lastTime = typeof originalReadings[totalReadings - 1].timestamp === 'string'
    ? new Date(originalReadings[totalReadings - 1].timestamp).getTime()
    : originalReadings[totalReadings - 1].timestamp;
  
  const durationMinutes = (lastTime - firstTime) / (1000 * 60);
  const readingsPerMinute = durationMinutes > 0 ? Math.round(totalReadings / durationMinutes) : 0;
  
  // Determine data quality based on readings per minute
  let dataQuality = 'unknown';
  if (readingsPerMinute > 100) {
    dataQuality = 'excessive';
  } else if (readingsPerMinute > 30) {
    dataQuality = 'excellent';
  } else if (readingsPerMinute > 10) {
    dataQuality = 'good';
  } else if (readingsPerMinute > 2) {
    dataQuality = 'fair';
  } else {
    dataQuality = 'poor';
  }
  
  return {
    dataQuality,
    totalReadings,
    sampledReadings: sampledCount,
    readingsPerMinute,
    reductionPercentage: Math.round((1 - sampledCount / totalReadings) * 100)
  };
};

/**
 * Calculate phase zones for visualization
 * @param {Array} readings - Array of reading objects
 * @returns {Array} Array of phase zone objects
 */
export const calculatePhaseZones = (readings) => {
  if (!readings || readings.length === 0) return [];
  
  const zones = [];
  let currentPhase = null;
  let currentCycle = null;
  let zoneStart = 0;
  
  readings.forEach((reading, index) => {
    const phase = reading.phase_type || reading.phaseType;
    const cycle = reading.cycle_number || reading.cycleNumber;
    
    // Skip readings without phase data or with COMPLETED phase
    if (!phase || phase === 'COMPLETED') return;
    
    // Check if phase changed
    if (phase !== currentPhase || cycle !== currentCycle) {
      if (currentPhase !== null && index > 0) {
        // End current zone
        zones.push({
          phase: currentPhase,
          cycle: currentCycle,
          startIndex: zoneStart,
          endIndex: index - 1,
          startTime: readings[zoneStart].timestamp,
          endTime: readings[index - 1].timestamp
        });
      }
      // Start new zone
      currentPhase = phase;
      currentCycle = cycle;
      zoneStart = index;
    }
  });
  
  // Add final zone
  if (currentPhase !== null) {
    zones.push({
      phase: currentPhase,
      cycle: currentCycle,
      startIndex: zoneStart,
      endIndex: readings.length - 1,
      startTime: readings[zoneStart].timestamp,
      endTime: readings[readings.length - 1].timestamp
    });
  }
  
  return zones;
};

/**
 * Analyze FiO2 distribution during hypoxic phases
 * @param {Array} readings - Array of reading objects
 * @returns {Array} FiO2 distribution data
 */
export const analyzeFiO2Distribution = (readings) => {
  const hypoxicReadings = readings.filter(r => {
    const phase = r.phase_type || r.phaseType;
    return phase === 'HYPOXIC' && r.fio2_level != null;
  });
  
  if (hypoxicReadings.length === 0) return [];

  const fio2Counts = {};
  hypoxicReadings.forEach(reading => {
    const fio2 = reading.fio2_level;
    fio2Counts[fio2] = (fio2Counts[fio2] || 0) + 1;
  });

  return Object.entries(fio2Counts)
    .map(([fio2, count]) => ({
      fio2: Number(fio2),
      count,
      percentage: Math.round((count / hypoxicReadings.length) * 100)
    }))
    .sort((a, b) => b.count - a.count);
};

/**
 * Format time label based on elapsed time
 * @param {number} elapsedMs - Elapsed time in milliseconds
 * @param {number} totalDurationMs - Total duration in milliseconds
 * @returns {string} Formatted time label
 */
export const formatTimeLabel = (elapsedMs, totalDurationMs) => {
  const seconds = Math.floor(elapsedMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  // Format based on total duration
  if (totalDurationMs < 60000) { // Less than 1 minute - show seconds
    return `${seconds}s`;
  } else if (totalDurationMs < 3600000) { // Less than 1 hour - show mm:ss
    const displayMinutes = minutes;
    const displaySeconds = seconds % 60;
    if (displayMinutes === 0) {
      return `${displaySeconds}s`;
    }
    return `${displayMinutes}:${displaySeconds.toString().padStart(2, '0')}`;
  } else { // 1 hour or more - show hh:mm
    const displayHours = hours;
    const displayMinutes = minutes % 60;
    return `${displayHours}:${displayMinutes.toString().padStart(2, '0')}`;
  }
};