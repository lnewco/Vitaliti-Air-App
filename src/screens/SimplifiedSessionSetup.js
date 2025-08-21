import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { useAppTheme } from '../theme';
import { useBluetoothConnection } from '../context/BluetoothContext';
import OptimizedConnectionManager from '../components/OptimizedConnectionManager';
import SessionIdGenerator from '../utils/sessionIdGenerator';
import DatabaseService from '../services/DatabaseService';
import SupabaseService from '../services/SupabaseService';

const SimplifiedSessionSetup = ({ navigation }) => {
  const { colors, spacing } = useAppTheme();
  const { isPulseOxConnected, isAnyDeviceConnected } = useBluetoothConnection();
  const [isStartingSession, setIsStartingSession] = useState(false);

  // Hardcoded protocol configuration
  const protocolConfig = {
    totalCycles: 5,
    hypoxicDuration: 7, // 7 minutes
    hyperoxicDuration: 3, // 3 minutes
    defaultAltitudeLevel: 6 // Default altitude level (1-11 scale)
  };

  const handleStartSession = async () => {
    // Check if pulse oximeter is connected
    if (!isPulseOxConnected) {
      Alert.alert(
        'Pulse Oximeter Required',
        'Please connect a pulse oximeter before starting the session.',
        [{ text: 'OK' }]
      );
      return;
    }

    setIsStartingSession(true);

    try {
      // Generate session ID
      const sessionId = SessionIdGenerator.generate('IHHT');
      console.log('📝 Generated session ID:', sessionId);

      // Initialize database
      await DatabaseService.init();

      // Create session in background (non-blocking)
      (async () => {
        try {
          console.log('🔄 Creating session in background...');
          
          // Ensure SupabaseService is initialized
          await SupabaseService.initialize();
          const deviceId = await SupabaseService.getDeviceId();
          
          await SupabaseService.createSession({
            id: sessionId,
            startTime: Date.now(),
            deviceId: deviceId,
            sessionType: 'IHHT'
          });
          console.log('✅ Session created in background');
        } catch (error) {
          console.warn('⚠️ Failed to create session in background:', error);
          // Continue anyway - session will work locally
        }
      })();

      // Navigate directly to training screen
      navigation.navigate('AirSession', { 
        sessionId: sessionId,
        protocolConfig: protocolConfig 
      });
    } catch (error) {
      console.error('❌ Error starting session:', error);
      Alert.alert(
        'Error',
        'Failed to start session. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsStartingSession(false);
    }
  };

  const totalSessionTime = protocolConfig.totalCycles * (protocolConfig.hypoxicDuration + protocolConfig.hyperoxicDuration);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.surface.background,
    },
    content: {
      flex: 1,
      padding: spacing.md,
    },
    header: {
      marginBottom: spacing.md,
      alignItems: 'center',
    },
    title: {
      fontSize: 22,
      fontWeight: 'bold',
      color: colors.text.primary,
      marginBottom: spacing.xs,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 14,
      color: colors.text.secondary,
      textAlign: 'center',
      lineHeight: 20,
    },
    connectionSection: {
      flex: 1,
      marginBottom: spacing.sm,
    },
    sessionInfo: {
      backgroundColor: colors.surface.card,
      borderRadius: 10,
      padding: spacing.md,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    sessionInfoTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text.primary,
      marginBottom: spacing.sm,
    },
    sessionInfoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: spacing.xs,
    },
    sessionInfoLabel: {
      fontSize: 13,
      color: colors.text.secondary,
    },
    sessionInfoValue: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text.primary,
    },
    sessionInfoDivider: {
      height: 1,
      backgroundColor: colors.border.light,
      marginVertical: spacing.xs,
    },
    sessionInfoNote: {
      fontSize: 11,
      color: colors.text.tertiary,
      fontStyle: 'italic',
      marginTop: spacing.xs,
    },
    startButton: {
      backgroundColor: isPulseOxConnected ? colors.primary[500] : colors.neutral[400],
      paddingVertical: 14,
      paddingHorizontal: spacing.lg,
      borderRadius: 10,
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    startButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.white,
    },
    backButton: {
      paddingVertical: 14,
      paddingHorizontal: spacing.lg,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border.medium,
      backgroundColor: colors.surface.background,
      alignItems: 'center',
    },
    backButtonText: {
      fontSize: 15,
      color: colors.text.primary,
      fontWeight: '500',
    },
    connectionStatus: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
      padding: spacing.sm,
      backgroundColor: isPulseOxConnected ? colors.success[50] : colors.warning[50],
      borderRadius: 8,
    },
    connectionStatusText: {
      fontSize: 13,
      fontWeight: '600',
      color: isPulseOxConnected ? colors.success[700] : colors.warning[700],
      marginLeft: spacing.xs,
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Session Setup</Text>
          <Text style={styles.subtitle}>
            Connect pulse oximeter to begin
          </Text>
        </View>

        {/* Session Configuration Info */}
        <View style={styles.sessionInfo}>
          <Text style={styles.sessionInfoTitle}>Protocol</Text>
          
          <View style={styles.sessionInfoRow}>
            <Text style={styles.sessionInfoLabel}>Cycles:</Text>
            <Text style={styles.sessionInfoValue}>{protocolConfig.totalCycles}</Text>
          </View>
          
          <View style={styles.sessionInfoRow}>
            <Text style={styles.sessionInfoLabel}>Hypoxic:</Text>
            <Text style={styles.sessionInfoValue}>{protocolConfig.hypoxicDuration} min</Text>
          </View>
          
          <View style={styles.sessionInfoRow}>
            <Text style={styles.sessionInfoLabel}>Recovery:</Text>
            <Text style={styles.sessionInfoValue}>{protocolConfig.hyperoxicDuration} min</Text>
          </View>
          
          <View style={styles.sessionInfoRow}>
            <Text style={styles.sessionInfoLabel}>Total:</Text>
            <Text style={styles.sessionInfoValue}>{totalSessionTime} min</Text>
          </View>
          
          <View style={styles.sessionInfoRow}>
            <Text style={styles.sessionInfoLabel}>Altitude:</Text>
            <Text style={styles.sessionInfoValue}>Level {protocolConfig.defaultAltitudeLevel}</Text>
          </View>
        </View>

        {/* Connection Status */}
        <View style={styles.connectionStatus}>
          <Text style={styles.connectionStatusText}>
            {isPulseOxConnected ? '✓ Pulse Oximeter Connected' : '⚠️ Pulse Oximeter Not Connected'}
          </Text>
        </View>

        {/* Bluetooth Connection Manager */}
        <View style={styles.connectionSection}>
          <OptimizedConnectionManager hideDataDisplay />
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View style={{ padding: spacing.md }}>
        <TouchableOpacity 
          style={styles.startButton}
          onPress={handleStartSession}
          disabled={!isPulseOxConnected || isStartingSession}
        >
          <Text style={styles.startButtonText}>
            {isStartingSession ? 'Starting...' : isPulseOxConnected ? 'Start Training' : 'Connect Device First'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default SimplifiedSessionSetup;