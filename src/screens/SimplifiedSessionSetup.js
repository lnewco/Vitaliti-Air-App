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
  Modal,
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
import PreSessionSurvey from '../components/feedback/PreSessionSurvey';
import AltitudeLevelSelector from '../components/altitude/AltitudeLevelSelector';
import AltitudeProgressionService from '../services/AltitudeProgressionService';
import Constants from 'expo-constants';

// Detect if running in Expo Go (demo mode) vs production build
const IS_EXPO_GO = Constants.appOwnership === 'expo';
const ALLOW_DEMO_MODE = IS_EXPO_GO;

const SimplifiedSessionSetup = ({ navigation }) => {
  const { isPulseOxConnected, isAnyDeviceConnected, disconnect } = useBluetoothConnection();
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [showPreSessionSurvey, setShowPreSessionSurvey] = useState(false);
  const [pendingSessionId, setPendingSessionId] = useState(null);
  const [showConnectionManager, setShowConnectionManager] = useState(false);
  const [recommendedAltitude, setRecommendedAltitude] = useState(6);
  const [selectedAltitude, setSelectedAltitude] = useState(6);
  const [altitudeLoadingState, setAltitudeLoadingState] = useState('loading');
  const [userAdjustedAltitude, setUserAdjustedAltitude] = useState(false);
  const scale = useSharedValue(1);

  // Helper function to determine button title based on state
  const getButtonTitle = () => {
    if (IS_EXPO_GO && !isPulseOxConnected) {
      return 'Begin Training (Demo Mode)';
    }
    return 'Begin Training';
  };

  // Hardcoded protocol configuration
  const protocolConfig = {
    totalCycles: 5,
    hypoxicDuration: 7, // 7 minutes
    hyperoxicDuration: 3, // 3 minutes
    // defaultAltitudeLevel removed - will be calculated by progression service
  };

  // Load recommended altitude on mount
  useEffect(() => {
    loadRecommendedAltitude();
  }, []);

  const loadRecommendedAltitude = async () => {
    try {
      setAltitudeLoadingState('loading');
      // Get user ID (you may need to get this from auth context)
      const userId = 'default_user'; // TODO: Get from auth context
      
      const progressionData = await AltitudeProgressionService.calculateOptimalStartingAltitude(userId);
      
      setRecommendedAltitude(progressionData.recommendedLevel);
      setSelectedAltitude(progressionData.recommendedLevel); // Set initial selection to recommended
      setAltitudeLoadingState('loaded');
      
      console.log(`🎯 Recommended altitude: Level ${progressionData.recommendedLevel}`);
      console.log(`📊 Reasoning:`, progressionData.reasoning);
    } catch (error) {
      console.warn('Failed to calculate recommended altitude:', error);
      setRecommendedAltitude(6); // Fallback
      setSelectedAltitude(6);
      setAltitudeLoadingState('loaded');
    }
  };

  const handleAltitudeSelect = (level) => {
    setSelectedAltitude(level);
    setUserAdjustedAltitude(level !== recommendedAltitude);
    console.log(`🎚️ User selected altitude level ${level} (Recommended: ${recommendedAltitude})`);
  };

  const handleStartSession = async () => {
    // PRODUCTION NOTE: Bluetooth check is bypassed in Expo Go for testing
    // This check MUST be enabled for production builds
    if (!ALLOW_DEMO_MODE && !isPulseOxConnected) {
      Alert.alert(
        'Pulse Oximeter Required',
        'Please connect a pulse oximeter before starting the session.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    // Log warning if starting without device in demo mode
    if (ALLOW_DEMO_MODE && !isPulseOxConnected) {
      console.warn('[DEMO MODE] Starting session without pulse oximeter - for testing only');
    }

    // Generate session ID for pre-session survey
    const sessionId = SessionIdGenerator.generate('IHHT');
    setPendingSessionId(sessionId);
    
    // Show pre-session survey first
    setShowPreSessionSurvey(true);
  };

  const handlePreSessionComplete = async (surveyData) => {
    setShowPreSessionSurvey(false);
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

      // Navigate directly to new simplified training screen
      navigation.navigate('IHHTSessionSimple', { 
        sessionId: sessionId,
        protocolConfig: {
          ...protocolConfig,
          manualAltitudeLevel: selectedAltitude,  // Pass user-selected altitude
          recommendedAltitudeLevel: recommendedAltitude, // Also pass recommended for tracking
          userAdjustedAltitude: userAdjustedAltitude // Track if user made manual adjustment
        },
        preSessionData: surveyData // Pass pre-session survey data
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
            <Text style={styles.title}>Adaptive Training Protocol</Text>
            <Text style={styles.subtitle}>
              AI-guided session with real-time adjustments for optimal performance
            </Text>
          </Animated.View>

          {/* Protocol Overview Card */}
          <Animated.View entering={FadeInDown.duration(600).delay(200)}>
            <PremiumCard style={styles.protocolCard}>
              <View style={styles.protocolHeader}>
                <Text style={styles.protocolTitle}>Adaptive IHHT Protocol</Text>
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

              {/* Altitude Level Selector */}
              <View style={styles.altitudeSection}>
                <View style={styles.altitudeHeader}>
                  <Text style={styles.altitudeLabel}>SELECT STARTING ALTITUDE</Text>
                  {userAdjustedAltitude && (
                    <View style={styles.manualBadge}>
                      <Text style={styles.manualBadgeText}>Manual</Text>
                    </View>
                  )}
                </View>
                
                {altitudeLoadingState === 'loading' ? (
                  <ActivityIndicator size="small" color={colors.brand.accent} style={{ marginVertical: 20 }} />
                ) : (
                  <AltitudeLevelSelector
                    selectedLevel={selectedAltitude}
                    recommendedLevel={recommendedAltitude}
                    onLevelSelect={handleAltitudeSelect}
                    showRecommendation={true}
                    allowManualSelection={true}
                  />
                )}
              </View>
            </PremiumCard>
          </Animated.View>

          {/* Connection Status Card */}
          <Animated.View entering={FadeInDown.duration(600).delay(350)}>
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

              {/* Connection Button or Demo Mode Message */}
              {!isPulseOxConnected && (
                <>
                  {IS_EXPO_GO ? (
                    <View style={styles.demoModeNote}>
                      <Text style={styles.demoModeNoteText}>
                        Feature currently unavailable in demo mode (Expo Go)
                      </Text>
                      <Text style={styles.demoModeSubtext}>
                        Build for Xcode or TestFlight to enable Bluetooth
                      </Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.connectDeviceButton}
                      onPress={() => setShowConnectionManager(true)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.connectDeviceButtonText}>Connect Pulse Oximeter</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}

              {/* Connected Device Actions */}
              {isPulseOxConnected && (
                <TouchableOpacity
                  style={styles.disconnectDeviceButton}
                  onPress={() => disconnect('pulse-ox')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.disconnectDeviceButtonText}>Disconnect Device</Text>
                </TouchableOpacity>
              )}
            </PremiumCard>
          </Animated.View>

          {/* Bluetooth Connection Manager Modal */}
          {showConnectionManager && !IS_EXPO_GO && (
            <Modal
              visible={showConnectionManager}
              animationType="slide"
              presentationStyle="pageSheet"
              onRequestClose={() => setShowConnectionManager(false)}
            >
              <SafeAreaView style={styles.modalContainer}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Connect Device</Text>
                  <TouchableOpacity
                    style={styles.modalCloseButton}
                    onPress={() => setShowConnectionManager(false)}
                  >
                    <Text style={styles.modalCloseText}>✕</Text>
                  </TouchableOpacity>
                </View>
                <OptimizedConnectionManager hideDataDisplay={false} />
              </SafeAreaView>
            </Modal>
          )}
        </ScrollView>

        {/* Action Buttons */}
        <Animated.View 
          entering={FadeIn.duration(600).delay(400)}
          style={styles.actionContainer}
        >
          <Animated.View style={animatedButtonStyle}>
            <PremiumButton
              title={isStartingSession ? 'Starting...' : getButtonTitle()}
              onPress={handleStartSession}
              disabled={!ALLOW_DEMO_MODE && !isPulseOxConnected || isStartingSession}
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
      
      {/* Pre-Session Survey Modal */}
      <PreSessionSurvey
        visible={showPreSessionSurvey}
        onComplete={handlePreSessionComplete}
        onCancel={handlePreSessionCancel}
      />
    </View>
  );
  
  const handlePreSessionCancel = () => {
    setShowPreSessionSurvey(false);
    setPendingSessionId(null);
  };
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
  // TEMPORARY: Animation demo styles
  animationDemoCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  animationContainer: {
    width: 220,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },
  animationTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 10,
  },
  animationInstruction: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: 10,
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
  altitudeDescription: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
    fontStyle: 'italic',
  },
  connectionCard: {
    marginBottom: spacing.md,
  },
  adaptiveCard: {
    marginBottom: spacing.md,
  },
  adaptiveHeader: {
    marginBottom: spacing.md,
  },
  adaptiveTitle: {
    ...typography.h3,
    color: colors.text.primary,
    fontWeight: '600',
  },
  adaptiveFeatures: {
    gap: spacing.sm,
  },
  adaptiveFeatureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  adaptiveBullet: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.metrics.breath,
    marginRight: spacing.sm,
    marginTop: 6,
  },
  adaptiveFeatureText: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    flex: 1,
    lineHeight: 18,
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
  connectDeviceButton: {
    marginTop: spacing.md,
    backgroundColor: colors.brand.accent,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: spacing.radius.md,
    alignItems: 'center',
  },
  connectDeviceButtonText: {
    ...typography.bodyMedium,
    color: colors.text.primary,
    fontWeight: '600',
  },
  disconnectDeviceButton: {
    marginTop: spacing.md,
    backgroundColor: colors.semantic.error + '20',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: spacing.radius.md,
    alignItems: 'center',
  },
  disconnectDeviceButtonText: {
    ...typography.bodyMedium,
    color: colors.semantic.error,
    fontWeight: '600',
  },
  demoModeNote: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.semantic.warning + '15',
    borderRadius: spacing.radius.md,
    borderWidth: 1,
    borderColor: colors.semantic.warning + '30',
  },
  demoModeNoteText: {
    ...typography.bodySmall,
    color: colors.semantic.warning,
    textAlign: 'center',
    fontWeight: '500',
  },
  demoModeSubtext: {
    ...typography.caption,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  modalTitle: {
    ...typography.h2,
    color: colors.text.primary,
  },
  modalCloseButton: {
    padding: spacing.xs,
  },
  modalCloseText: {
    ...typography.h3,
    color: colors.text.secondary,
  },
});

export default SimplifiedSessionSetup;