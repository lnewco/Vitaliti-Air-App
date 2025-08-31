import React from 'react';
import { View, Text, StyleSheet, Modal } from 'react-native';
import { BlurView } from 'expo-blur';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export default function MaskLiftInstruction({ visible, message, timeRemaining }) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
    >
      <BlurView intensity={95} style={styles.container}>
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Icon name="face-mask" size={60} color="#00C853" />
          </View>
          
          <Text style={styles.title}>Mask Transition</Text>
          <Text style={styles.message}>{message}</Text>
          
          {timeRemaining > 0 && (
            <View style={styles.timerContainer}>
              <Text style={styles.timerText}>{timeRemaining}</Text>
              <Text style={styles.timerLabel}>seconds</Text>
            </View>
          )}
        </View>
      </BlurView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  content: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 25,
    padding: 30,
    alignItems: 'center',
    width: '85%',
    maxWidth: 350,
  },
  iconContainer: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
    marginBottom: 10,
  },
  message: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  timerContainer: {
    alignItems: 'center',
    marginTop: 10,
  },
  timerText: {
    fontSize: 48,
    fontWeight: '200',
    color: '#00C853',
  },
  timerLabel: {
    fontSize: 14,
    color: '#999',
    marginTop: -5,
  },
});