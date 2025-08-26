import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Alert,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
} from 'react-native-reanimated';
import {
  colors,
  typography,
  spacing,
  PremiumCard,
  PremiumButton,
  MetricRing,
} from '../design-system';
import { useBluetoothConnection } from '../context/BluetoothContext';
import OptimizedConnectionManager from '../components/OptimizedConnectionManager';
import SessionIdGenerator from '../utils/sessionIdGenerator';
import DatabaseService from '../services/DatabaseService';
import SupabaseService from '../services/SupabaseService';

const SimplifiedSessionSetup = ({ navigation }) => {
  const { isPulseOxConnected, isAnyDeviceConnected } = useBluetoothConnection();
  const [isStartingSession, setIsStartingSession] = useState(false);
  const scale = useSharedValue(1);

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

  // Protocol metrics data
  const protocolMetrics = [
    { label: 'CYCLES', value: protocolConfig.totalCycles, unit: '' },
    { label: 'HYPOXIC', value: protocolConfig.hypoxicDuration, unit: 'min' },
    { label: 'RECOVERY', value: protocolConfig.hyperoxicDuration, unit: 'min' },
  ];

  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background.primary} />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView 
          style={styles.content} 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Header */}
          <Animated.View 
            entering={FadeInDown.duration(600).delay(100)}
            style={styles.header}
          >
            <Text style={styles.title}>Training Protocol</Text>
            <Text style={styles.subtitle}>
              Prepare your body for optimal performance
            </Text>
          </Animated.View>

          {/* Protocol Overview Card */}
          <Animated.View entering={FadeInDown.duration(600).delay(200)}>
            <PremiumCard style={styles.protocolCard}>
              <View style={styles.protocolHeader}>
                <Text style={styles.protocolTitle}>IHHT Protocol</Text>
                <View style={styles.totalTimeBadge}>
                  <Text style={styles.totalTimeText}>{totalSessionTime} MIN</Text>
                </View>
              </View>

              {/* Protocol Metrics */}
              <View style={styles.protocolMetrics}>
                {protocolMetrics.map((metric, index) => (
                  <View key={index} style={styles.protocolMetricCard}>
                    <Text style={styles.protocolMetricLabel}>{metric.label}</Text>
                    <Text style={styles.protocolMetricValue}>
                      {metric.value}
                      {metric.unit && <Text style={styles.protocolMetricUnit}> {metric.unit}</Text>}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Altitude Level */}
              <View style={styles.altitudeSection}>
                <View style={styles.altitudeHeader}>
                  <Text style={styles.altitudeLabel}>ALTITUDE SIMULATION</Text>
                  <Text style={styles.altitudeValue}>Level {protocolConfig.defaultAltitudeLevel}</Text>
                </View>
                <View style={styles.altitudeBar}>
                  <LinearGradient
                    colors={[colors.metrics.recovery, colors.metrics.strain]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[
                      styles.altitudeFill,
                      { width: `${(protocolConfig.defaultAltitudeLevel / 11) * 100}%` }
                    ]}
                  />
                </View>
              </View>
            </PremiumCard>
          </Animated.View>

          {/* Connection Status Card */}
          <Animated.View entering={FadeInDown.duration(600).delay(300)}>
            <PremiumCard style={styles.connectionCard}>
              <View style={styles.connectionHeader}>
                <Text style={styles.connectionTitle}>Device Status</Text>
                <View style={[
                  styles.connectionBadge,
                  { backgroundColor: isPulseOxConnected ? colors.metrics.breath + '20' : colors.semantic.error + '20' }
                ]}>
                  <View style={[
                    styles.connectionDot,
                    { backgroundColor: isPulseOxConnected ? colors.metrics.breath : colors.semantic.error }
                  ]} />
                  <Text style={[
                    styles.connectionStatus,
                    { color: isPulseOxConnected ? colors.metrics.breath : colors.semantic.error }
                  ]}>
                    {isPulseOxConnected ? 'Connected' : 'Disconnected'}
                  </Text>
                </View>
              </View>

              {/* Device Info */}
              <View style={styles.deviceInfo}>
                <View style={styles.deviceRow}>
                  <Text style={styles.deviceLabel}>Pulse Oximeter</Text>
                  <Text style={[
                    styles.deviceValue,
                    { color: isPulseOxConnected ? colors.text.primary : colors.text.tertiary }
                  ]}>
                    {isPulseOxConnected ? 'Ready' : 'Not Connected'}
                  </Text>
                </View>
              </View>

              {!isPulseOxConnected && (
                <View style={styles.connectionNote}>
                  <Text style={styles.connectionNoteText}>
                    Connect your pulse oximeter to begin training
                  </Text>
                </View>
              )}
            </PremiumCard>
          </Animated.View>

          {/* Bluetooth Connection Manager - Hidden but functional */}
          <View style={styles.hiddenConnectionManager}>
            <OptimizedConnectionManager hideDataDisplay />
          </View>
        </ScrollView>

        {/* Action Buttons */}
        <Animated.View 
          entering={FadeIn.duration(600).delay(400)}
          style={styles.actionContainer}
        >
          <Animated.View style={animatedButtonStyle}>
            <PremiumButton
              title={isStartingSession ? 'Starting...' : 'Begin Training'}
              onPress={handleStartSession}
              disabled={!isPulseOxConnected || isStartingSession}
              loading={isStartingSession}
              size="large"
              fullWidth
            />
          </Animated.View>
          
          <TouchableOpacity 
            style={styles.cancelButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.screenPadding,
    paddingBottom: 150, // Space for buttons
  },
  header: {
    marginBottom: spacing.xl,
    alignItems: 'center',
  },
  title: {
    ...typography.h1,
    color: colors.text.primary,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.bodyMedium,
    color: colors.text.tertiary,
    textAlign: 'center',
    lineHeight: 22,
  },
  protocolCard: {
    marginBottom: spacing.md,
  },
  protocolHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  protocolTitle: {
    ...typography.h3,
    color: colors.text.primary,
  },
  totalTimeBadge: {
    backgroundColor: colors.brand.accent,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: spacing.radius.sm,
  },
  totalTimeText: {
    ...typography.labelSmall,
    color: colors.text.primary,
    fontWeight: '700',
  },
  protocolMetrics: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  protocolMetricCard: {
    flex: 1,
    backgroundColor: colors.background.secondary,
    borderRadius: spacing.radius.md,
    padding: spacing.sm,
    alignItems: 'center',
  },
  protocolMetricLabel: {
    ...typography.micro,
    color: colors.text.tertiary,
    letterSpacing: 0.5,
    marginBottom: spacing.xxs,
  },
  protocolMetricValue: {
    ...typography.h2,
    color: colors.text.primary,
    fontWeight: '600',
  },
  protocolMetricUnit: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    fontWeight: '400',
  },
  altitudeSection: {
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  altitudeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  altitudeLabel: {
    ...typography.caption,
    color: colors.text.tertiary,
    letterSpacing: 0.5,
  },
  altitudeValue: {
    ...typography.bodyMedium,
    color: colors.text.primary,
    fontWeight: '600',
  },
  altitudeBar: {
    height: 6,
    backgroundColor: colors.background.tertiary,
    borderRadius: 3,
    overflow: 'hidden',
  },
  altitudeFill: {
    height: '100%',
    borderRadius: 3,
  },
  connectionCard: {
    marginBottom: spacing.md,
  },
  connectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  connectionTitle: {
    ...typography.h3,
    color: colors.text.primary,
  },
  connectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: spacing.radius.full,
  },
  connectionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: spacing.xs,
  },
  connectionStatus: {
    ...typography.caption,
    fontWeight: '600',
  },
  deviceInfo: {
    gap: spacing.xs,
  },
  deviceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deviceLabel: {
    ...typography.bodyMedium,
    color: colors.text.secondary,
  },
  deviceValue: {
    ...typography.bodyMedium,
    fontWeight: '600',
  },
  connectionNote: {
    marginTop: spacing.md,
    padding: spacing.sm,
    backgroundColor: colors.background.secondary,
    borderRadius: spacing.radius.md,
  },
  connectionNoteText: {
    ...typography.bodySmall,
    color: colors.text.tertiary,
    textAlign: 'center',
  },
  hiddenConnectionManager: {
    position: 'absolute',
    top: -1000, // Hide off screen but keep functional
    left: 0,
    right: 0,
  },
  actionContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.screenPadding,
    paddingBottom: spacing.xl,
    backgroundColor: colors.background.primary,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  cancelButton: {
    marginTop: spacing.sm,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  cancelButtonText: {
    ...typography.bodyMedium,
    color: colors.text.tertiary,
    fontWeight: '500',
  },
});

export default SimplifiedSessionSetup;