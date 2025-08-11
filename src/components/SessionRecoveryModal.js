/**
 * SessionRecoveryModal - UI for resuming interrupted IHHT sessions
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Dimensions,
} from 'react-native';

const { width } = Dimensions.get('window');

const SessionRecoveryModal = ({ 
  visible, 
  recoveryData, 
  onResume, 
  onDecline, 
  isLoading = false 
}) => {
  if (!recoveryData) return null;

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatPhase = (phase) => {
    return phase === 'HYPOXIC' ? 'Hypoxic' : 'Hyperoxic';
  };

  const getPhaseInstruction = (phase) => {
    return phase === 'HYPOXIC' ? 'Mask ON' : 'Mask OFF';
  };

  const sessionDuration = Math.floor(recoveryData.sessionAge / 60);

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onDecline}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>Session Recovery</Text>
            <Text style={styles.subtitle}>
              Your previous session was interrupted
            </Text>
          </View>

          <View style={styles.sessionInfo}>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Current Phase:</Text>
              <View style={styles.phaseContainer}>
                <Text style={[
                  styles.phaseText,
                  { color: recoveryData.currentPhase === 'HYPOXIC' ? '#FF6B6B' : '#4ECDC4' }
                ]}>
                  {formatPhase(recoveryData.currentPhase)}
                </Text>
                <Text style={styles.instruction}>
                  ({getPhaseInstruction(recoveryData.currentPhase)})
                </Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.label}>Cycle:</Text>
              <Text style={styles.value}>
                {recoveryData.currentCycle} of {recoveryData.totalCycles}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.label}>Time Remaining:</Text>
              <Text style={styles.value}>
                {formatTime(recoveryData.phaseTimeRemaining)}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.label}>Session Duration:</Text>
              <Text style={styles.value}>
                {sessionDuration} minute{sessionDuration !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.resumeButton]}
              onPress={onResume}
              disabled={isLoading}
            >
              <Text style={styles.resumeButtonText}>
                {isLoading ? 'Resuming...' : 'Resume Session'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.declineButton]}
              onPress={onDecline}
              disabled={isLoading}
            >
              <Text style={styles.declineButtonText}>
                Start New Session
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.disclaimer}>
            Choose "Resume Session" to continue where you left off, or "Start New Session" to begin fresh.
          </Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: Math.min(width * 0.9, 400),
    maxHeight: '80%',
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#7F8C8D',
    textAlign: 'center',
  },
  sessionInfo: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  label: {
    fontSize: 16,
    color: '#2C3E50',
    fontWeight: '500',
  },
  value: {
    fontSize: 16,
    color: '#34495E',
    fontWeight: '600',
  },
  phaseContainer: {
    alignItems: 'flex-end',
  },
  phaseText: {
    fontSize: 16,
    fontWeight: '600',
  },
  instruction: {
    fontSize: 12,
    color: '#7F8C8D',
    marginTop: 2,
  },
  buttonContainer: {
    gap: 12,
    marginBottom: 16,
  },
  button: {
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  resumeButton: {
    backgroundColor: '#3498DB',
  },
  resumeButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  declineButton: {
    backgroundColor: '#ECF0F1',
    borderWidth: 1,
    borderColor: '#BDC3C7',
  },
  declineButtonText: {
    color: '#2C3E50',
    fontSize: 16,
    fontWeight: '500',
  },
  disclaimer: {
    fontSize: 12,
    color: '#7F8C8D',
    textAlign: 'center',
    lineHeight: 16,
  },
});

export default SessionRecoveryModal;
