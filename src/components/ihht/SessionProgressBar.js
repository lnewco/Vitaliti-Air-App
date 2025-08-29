import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';

export default function SessionProgressBar({
  currentCycle,
  totalCycles,
  currentPhase,
  phaseTimeElapsed,
  phaseDuration,
  totalSessionTime,
  onSkip,
  onEnd
}) {
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const phaseProgress = phaseDuration > 0 ? (phaseTimeElapsed / phaseDuration) * 100 : 0;

  return (
    <View style={styles.container}>
      {/* Top Row - Three info boxes */}
      <View style={styles.topRow}>
        {/* Cycle Progress */}
        <View style={styles.infoBox}>
          <Text style={styles.label}>Cycle</Text>
          <Text style={styles.value}>{currentCycle}/{totalCycles}</Text>
        </View>

        {/* Phase Progress */}
        <View style={[styles.infoBox, styles.centerBox]}>
          <Text style={styles.label}>
            {currentPhase === 'altitude' ? 'Altitude Phase' : 'Recovery Phase'}
          </Text>
          <Text style={styles.value}>
            {formatTime(phaseTimeElapsed)} / {formatTime(phaseDuration)}
          </Text>
          <View style={styles.progressBarContainer}>
            <View 
              style={[
                styles.progressBarFill, 
                { 
                  width: `${phaseProgress}%`,
                  backgroundColor: currentPhase === 'altitude' ? '#ff6600' : '#00ff88'
                }
              ]} 
            />
          </View>
        </View>

        {/* Total Time & Controls */}
        <View style={styles.infoBox}>
          <Text style={styles.label}>Total</Text>
          <Text style={styles.value}>{formatTime(totalSessionTime)}</Text>
          <View style={styles.controls}>
            <TouchableOpacity onPress={onSkip} style={styles.controlButton}>
              <Text style={styles.controlText}>⏭</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onEnd} style={styles.controlButton}>
              <Text style={styles.controlText}>⏹</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Bottom Progress Indicators */}
      <View style={styles.cycleIndicators}>
        {Array.from({ length: totalCycles }, (_, i) => (
          <View 
            key={i}
            style={[
              styles.cycleIndicator,
              i < currentCycle - 1 && styles.cycleComplete,
              i === currentCycle - 1 && styles.cycleCurrent,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 50,
    paddingHorizontal: 15,
    paddingBottom: 20,
    backgroundColor: '#0a0a0f',
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a2e',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  infoBox: {
    flex: 1,
    alignItems: 'center',
    padding: 10,
  },
  centerBox: {
    flex: 1.5,
  },
  label: {
    fontSize: 12,
    color: '#8e8e93',
    marginBottom: 5,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  value: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  progressBarContainer: {
    width: '100%',
    height: 4,
    backgroundColor: '#1a1a2e',
    borderRadius: 2,
    marginTop: 8,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  controls: {
    flexDirection: 'row',
    marginTop: 5,
    gap: 10,
  },
  controlButton: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 15,
  },
  controlText: {
    fontSize: 16,
    color: '#fff',
  },
  cycleIndicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 15,
    gap: 8,
  },
  cycleIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1a1a2e',
  },
  cycleComplete: {
    backgroundColor: '#00ff88',
  },
  cycleCurrent: {
    backgroundColor: '#0a84ff',
    width: 24,
  },
});