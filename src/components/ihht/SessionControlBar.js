import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export default function SessionControlBar({ 
  isPaused, 
  onPause, 
  onResume, 
  onStop,
  onSkip,
  onEnd,
  currentCycle = 1,
  totalCycles = 5,
  currentPhase,
  totalSessionTime
}) {
  // Handle prop variations - some screens use onPause/onResume, others use onPause only
  const handlePausePress = onPause || (() => {});
  const handleResumePress = onResume || onPause || (() => {});
  const handleStopPress = onStop || onEnd || (() => {});
  const handleSkipPress = onSkip || (() => {});
  
  return (
    <View style={styles.container}>
      <View style={styles.cycleInfo}>
        <Text style={styles.cycleText}>
          Cycle {currentCycle} of {totalCycles}
        </Text>
      </View>
      
      <View style={styles.controls}>
        {!isPaused ? (
          <TouchableOpacity style={styles.button} onPress={handlePausePress}>
            <Icon name="pause" size={24} color="#FFF" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.button} onPress={handleResumePress}>
            <Icon name="play" size={24} color="#FFF" />
          </TouchableOpacity>
        )}
        
        {onSkip && (
          <TouchableOpacity style={styles.button} onPress={handleSkipPress}>
            <Icon name="skip-next" size={24} color="#FFF" />
          </TouchableOpacity>
        )}
        
        <TouchableOpacity style={[styles.button, styles.stopButton]} onPress={handleStopPress}>
          <Icon name="stop" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 15,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  cycleInfo: {
    flex: 1,
  },
  cycleText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  controls: {
    flexDirection: 'row',
    gap: 15,
  },
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stopButton: {
    backgroundColor: 'rgba(255, 59, 48, 0.3)',
  },
});