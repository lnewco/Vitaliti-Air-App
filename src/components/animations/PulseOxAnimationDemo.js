import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import PulseOxRingAnimation from './PulseOxRingAnimation';
import { colors } from '../../design-system';

const PulseOxAnimationDemo = () => {
  const [isPlaying, setIsPlaying] = useState(true);

  const handleReplay = () => {
    setIsPlaying(false);
    setTimeout(() => setIsPlaying(true), 100);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pulse Oximeter Setup</Text>
      
      <View style={styles.animationContainer}>
        <PulseOxRingAnimation isPlaying={isPlaying} size={250} />
      </View>
      
      <Text style={styles.instruction}>
        Slide the pulse oximeter onto your left thumb
      </Text>
      
      <TouchableOpacity style={styles.replayButton} onPress={handleReplay}>
        <Text style={styles.replayText}>Replay Animation</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: 20,
  },
  animationContainer: {
    width: 300,
    height: 300,
    backgroundColor: colors.background.secondary,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  instruction: {
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: 30,
  },
  replayButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
  },
  replayText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default PulseOxAnimationDemo;