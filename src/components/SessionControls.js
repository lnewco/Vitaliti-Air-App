import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import SessionManager from '../services/SessionManager';

const SessionControls = ({ isConnected, onSessionChanged, navigation }) => {
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [sessionDuration, setSessionDuration] = useState('0:00');
  const [readingCount, setReadingCount] = useState(0);
  const [currentSession, setCurrentSession] = useState(null);

  useEffect(() => {
    // Check for existing session on mount
    const checkSession = async () => {
      try {
        const recovered = await SessionManager.recoverSession();
        if (recovered) {
          setCurrentSession(recovered);
          setIsSessionActive(true);
          setReadingCount(recovered.readingCount || 0);
        }
      } catch (error) {
        console.error('Failed to recover session:', error);
      }
    };

    checkSession();

    // Set up session listeners
    const unsubscribe = SessionManager.addListener((event, data) => {
      switch (event) {
        case 'sessionStarted':
          setIsSessionActive(true);
          setCurrentSession(data);
          setReadingCount(0);
          onSessionChanged?.(event, data);
          break;
        case 'sessionEnded':
          setIsSessionActive(false);
          setCurrentSession(null);
          setReadingCount(0);
          setSessionDuration('0:00');
          onSessionChanged?.(event, data);
          break;
        case 'sessionPaused':
          setIsSessionActive(false);
          onSessionChanged?.(event, data);
          break;
        case 'sessionResumed':
          setIsSessionActive(true);
          onSessionChanged?.(event, data);
          break;
        case 'newReading':
          setReadingCount(prev => prev + 1);
          break;
        case 'sessionRecovered':
          setIsSessionActive(true);
          setCurrentSession(data);
          setReadingCount(data.readingCount || 0);
          onSessionChanged?.(event, data);
          break;
      }
    });

    // Update duration timer
    const durationInterval = setInterval(() => {
      if (SessionManager.isSessionActive()) {
        setSessionDuration(SessionManager.getFormattedDuration());
      }
    }, 1000);

    return () => {
      unsubscribe();
      clearInterval(durationInterval);
    };
  }, [onSessionChanged]);

  const handleStartSession = async () => {
    }

    try {
      navigation?.navigate("training");
      console.log('Started session:', sessionId);
    } catch (error) {
      console.error('Failed to start session:', error);
      Alert.alert(
        'Error',
        'Failed to start training session. Please try again.',
        [{ text: 'OK', style: 'default' }]
      );
    }
  };

  const handleStopSession = async () => {
    Alert.alert(
      'End Session',
      'Are you sure you want to end this training session?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Session',
          style: 'destructive',
          onPress: async () => {
            try {
              const completedSession = await SessionManager.stopSession();
              console.log('Session completed:', completedSession);
            } catch (error) {
              console.error('Failed to stop session:', error);
              Alert.alert(
                'Error',
                'Failed to stop session properly. Data may have been saved.',
                [{ text: 'OK', style: 'default' }]
              );
            }
          }
        }
      ]
    );
  };

  const handlePauseSession = async () => {
    try {
      if (SessionManager.isSessionActive()) {
        await SessionManager.pauseSession();
      } else {
        await SessionManager.resumeSession();
      }
    } catch (error) {
      console.error('Failed to pause/resume session:', error);
    }
  };

  const formatReadingCount = (count) => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}k`;
    }
    return count.toString();
  };

  if (!currentSession && !isSessionActive) {
    // No active session - show start button
    return (
      <View style={styles.container}>
        <TouchableOpacity
          style={[
            styles.startButton,
            false && styles.buttonDisabled
          ]}
          onPress={handleStartSession}
          disabled={false}
        >
          <Text style={styles.startButtonText}>Start Training Session</Text>
          {false && (
            <Text style={styles.disabledText}>Connect device first</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  // Active session - show session controls
  return (
    <View style={styles.container}>
      {/* Session Info */}
      <View style={styles.sessionInfo}>
        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Duration</Text>
            <Text style={styles.infoValue}>{sessionDuration}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Readings</Text>
            <Text style={styles.infoValue}>{formatReadingCount(readingCount)}</Text>
          </View>
        </View>
        
        <View style={styles.statusIndicator}>
          <View style={[
            styles.statusDot, 
            { backgroundColor: isSessionActive ? '#4CAF50' : '#FF9800' }
          ]} />
          <Text style={styles.statusText}>
            {isSessionActive ? 'Recording' : 'Paused'}
          </Text>
        </View>
      </View>

      {/* Control Buttons */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.controlButton, styles.pauseButton]}
          onPress={handlePauseSession}
        >
          <Text style={styles.controlButtonText}>
            {isSessionActive ? '⏸️ Pause' : '▶️ Resume'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, styles.stopButton]}
          onPress={handleStopSession}
        >
          <Text style={styles.controlButtonText}>⏹️ Stop</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginHorizontal: 20,
    marginVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  startButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#E0E0E0',
  },
  startButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  disabledText: {
    fontSize: 14,
    color: '#9E9E9E',
    marginTop: 4,
  },
  sessionInfo: {
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  infoItem: {
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  controlButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 12,
    marginHorizontal: 6,
    alignItems: 'center',
  },
  pauseButton: {
    backgroundColor: '#FF9800',
  },
  stopButton: {
    backgroundColor: '#F44336',
  },
  controlButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default SessionControls; 