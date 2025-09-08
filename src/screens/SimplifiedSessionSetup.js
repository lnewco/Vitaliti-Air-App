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
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import InlineDeviceScanner from '../components/InlineDeviceScanner';
import {
  colors,
  typography,
  spacing,
  PremiumCard,
  PremiumButton,
  MetricRing,
} from '../design-system';
import { useBluetoothConnection } from '../context/BluetoothContext';
import SessionIdGenerator from '../utils/sessionIdGenerator';
import DatabaseService from '../services/DatabaseService';
import SupabaseService from '../services/SupabaseService';
import PreSessionSurvey from '../components/feedback/PreSessionSurvey';
import AltitudeLevelSelector from '../components/altitude/AltitudeLevelSelector';
import AltitudeProgressionService from '../services/AltitudeProgressionService';
import Constants from 'expo-constants';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

// Detect if running in Expo Go (demo mode) vs production build
const IS_EXPO_GO = Constants.appOwnership === 'expo';
const ALLOW_DEMO_MODE = IS_EXPO_GO;

const { width: screenWidth } = Dimensions.get('window');

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
  const progressAnimation = useSharedValue(0);
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 3;

  // Dynamic protocol configuration states
  const [totalCycles, setTotalCycles] = useState(3);
  const [hypoxicDuration, setHypoxicDuration] = useState(7); // minutes
  const [recoveryDuration, setRecoveryDuration] = useState(3); // minutes

  // Helper function to determine button title based on state
  const getButtonTitle = () => {
    if (IS_EXPO_GO && !isPulseOxConnected) {
      return 'Begin Training (Demo Mode)';
    }
    return 'Begin Training';
  };

  // Dynamic protocol configuration
  const protocolConfig = {
    totalCycles: totalCycles,
    hypoxicDuration: hypoxicDuration * 60, // Convert to seconds
    hyperoxicDuration: recoveryDuration * 60, // Convert to seconds
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

      // REMOVED: Duplicate session creation
      // Session will be created by EnhancedSessionManager in IHHTSessionSimple screen
      // This prevents the duplicate session bug where two sessions are created with same ID
      console.log('📝 Session will be created by EnhancedSessionManager');

      // Replace current screen with training session to prevent flash on completion
      navigation.replace('IHHTSessionSimple', { 
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

  const totalSessionTime = totalCycles * (hypoxicDuration + recoveryDuration);

  // Protocol metrics data - now interactive
  const protocolMetrics = [
    { 
      label: 'CYCLES', 
      value: totalCycles, 
      unit: '',
      onPress: () => {
        // Cycle through 1-5 cycles
        setTotalCycles(prev => prev >= 5 ? 1 : prev + 1);
      }
    },
    { 
      label: 'HYPOXIC', 
      value: hypoxicDuration, 
      unit: 'min',
      onPress: () => {
        // Cycle through 3-10 minutes
        setHypoxicDuration(prev => prev >= 10 ? 3 : prev + 1);
      }
    },
    { 
      label: 'RECOVERY', 
      value: recoveryDuration, 
      unit: 'min',
      onPress: () => {
        // Cycle through 2-5 minutes
        setRecoveryDuration(prev => prev >= 5 ? 2 : prev + 1);
      }
    },
  ];

  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const animatedProgressStyle = useAnimatedStyle(() => ({
    width: `${progressAnimation.value * 100}%`,
  }));

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Premium gradient background */}
      <LinearGradient
        colors={['#000000', '#0A0B0F', '#14161B']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />
      
      <SafeAreaView style={styles.safeArea}>
        {/* Fixed Header Container with Blur */}
        <BlurView intensity={85} tint="dark" style={styles.fixedHeader}>
          {/* Navigation Bar */}
          <View style={styles.navigationBar}>
            <TouchableOpacity 
              onPress={() => navigation.goBack()}
              style={styles.backButton}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={28} color={colors.text.primary} />
            </TouchableOpacity>
            <Text style={styles.navigationTitle}>Session Setup</Text>
            <View style={styles.navSpacer} />
          </View>

          {/* Progress Steps */}
          <View style={styles.progressSteps}>
          <View style={styles.stepItem}>
            <View style={[styles.stepCircle, styles.stepActive]}>
              <Text style={styles.stepNumber}>1</Text>
            </View>
            <Text style={styles.stepLabel}>Protocol</Text>
          </View>
          <View style={styles.stepLine} />
          <View style={styles.stepItem}>
            <View style={[styles.stepCircle, isPulseOxConnected && styles.stepActive]}>
              <Text style={styles.stepNumber}>2</Text>
            </View>
            <Text style={styles.stepLabel}>Device</Text>
          </View>
          <View style={styles.stepLine} />
          <View style={styles.stepItem}>
            <View style={[styles.stepCircle, (isPulseOxConnected || IS_EXPO_GO) && styles.stepActive]}>
              <Text style={styles.stepNumber}>3</Text>
            </View>
            <Text style={styles.stepLabel}>Start</Text>
          </View>
          </View>
        </BlurView>
        
        <ScrollView 
          style={styles.content} 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          bounces={true}
        >
          {/* Header */}
          <Animated.View 
            entering={FadeInDown.duration(400).springify()}
            style={styles.header}
          >
            <Text style={styles.title}>Adaptive Training</Text>
            <Text style={styles.subtitle}>
              Configure your personalized session
            </Text>
          </Animated.View>

          {/* Protocol Card - Apple Style */}
          <View>
            <TouchableOpacity 
              activeOpacity={0.98}
              style={styles.premiumCard}
            >
              <BlurView intensity={20} tint="dark" style={styles.cardBlur}>
                <LinearGradient
                  colors={['rgba(255,255,255,0.03)', 'rgba(255,255,255,0.01)']}
                  style={StyleSheet.absoluteFillObject}
                />
                <View style={styles.cardContent}>
                  <View style={styles.cardHeader}>
                    <View style={styles.iconContainer}>
                      <MaterialCommunityIcons name="timer" size={22} color={colors.brand.accent} />
                    </View>
                    <View style={styles.cardTitleContainer}>
                      <Text style={styles.cardTitle}>Training Protocol</Text>
                      <Text style={styles.cardSubtitle}>Adaptive IHHT</Text>
                    </View>
                    <View style={styles.timeBadge}>
                      <Text style={styles.timeBadgeText}>{totalSessionTime}</Text>
                      <Text style={styles.timeBadgeUnit}>min</Text>
                    </View>
                  </View>

                  <View style={styles.metricsRow}>
                    {protocolMetrics.map((metric, index) => (
                      <TouchableOpacity 
                        key={index} 
                        style={styles.metricItem}
                        onPress={metric.onPress}
                        activeOpacity={0.7}
                      >
                        <View style={styles.metricValueContainer}>
                          <Text style={styles.metricValue}>{metric.value}</Text>
                          {metric.unit && <Text style={styles.metricUnit}>{metric.unit}</Text>}
                        </View>
                        <Text style={styles.metricLabel}>{metric.label}</Text>
                        <View style={styles.tapHintBadge}>
                          <Text style={styles.tapHintText}>TAP</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <View style={styles.divider} />
                  
                  <View style={styles.altitudeContainer}>
                    <View style={styles.altitudeLabelRow}>
                      <Text style={styles.altitudeLabel}>Altitude Level</Text>
                      {userAdjustedAltitude && (
                        <View style={styles.adjustedBadge}>
                          <Text style={styles.adjustedBadgeText}>Adjusted</Text>
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
                </View>
              </BlurView>
            </TouchableOpacity>
          </View>

          {/* Device Card - Pulse Oximeter */}
          <View>
            <TouchableOpacity 
              activeOpacity={0.98}
              style={styles.premiumCard}
            >
              <BlurView intensity={20} tint="dark" style={styles.cardBlur}>
                <LinearGradient
                  colors={['rgba(255,255,255,0.03)', 'rgba(255,255,255,0.01)']}
                  style={StyleSheet.absoluteFillObject}
                />
                <View style={styles.cardContent}>
                  <View style={styles.cardHeader}>
                    <View style={styles.iconContainer}>
                      <MaterialCommunityIcons name="bluetooth" size={22} color={isPulseOxConnected ? colors.metrics.breath : colors.text.quaternary} />
                    </View>
                    <View style={styles.cardTitleContainer}>
                      <Text style={styles.cardTitle}>Pulse Oximeter</Text>
                      <Text style={[styles.cardSubtitle, { color: isPulseOxConnected ? colors.metrics.breath : colors.text.quaternary }]}>
                        {isPulseOxConnected ? 'Connected' : 'Not Connected'}
                      </Text>
                    </View>
                    <View style={styles.statusIndicator}>
                      <Animated.View style={[
                        styles.statusDot,
                        { backgroundColor: isPulseOxConnected ? colors.metrics.breath : colors.text.quaternary }
                      ]} />
                    </View>
                  </View>


                  {!isPulseOxConnected && (
                    <>
                      {IS_EXPO_GO ? (
                        <View style={styles.infoBox}>
                          <Ionicons name="information-circle-outline" size={18} color={colors.brand.accent} />
                          <Text style={styles.infoText}>Demo mode active</Text>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={styles.connectButton}
                          onPress={() => setShowConnectionManager(true)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.connectButtonText}>Connect Device</Text>
                          <Ionicons name="chevron-forward" size={18} color={colors.brand.accent} />
                        </TouchableOpacity>
                      )}
                    </>
                  )}

                  {isPulseOxConnected && (
                    <TouchableOpacity
                      style={styles.disconnectButton}
                      onPress={() => disconnect('pulse-ox')}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.disconnectButtonText}>Disconnect</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </BlurView>
            </TouchableOpacity>
          </View>

          {/* Inline Bluetooth Device Scanner - Only render when needed */}
          {(showConnectionManager && !IS_EXPO_GO) && (
            <InlineDeviceScanner
              isVisible={true}
              onClose={() => setShowConnectionManager(false)}
              onDeviceConnected={(device) => {
                console.log('Device connected:', device.name);
                setShowConnectionManager(false);
                // Device is already connected via the scanner
              }}
            />
          )}
        </ScrollView>

        {/* Floating Action Button with Gradient Fade */}
        <Animated.View 
          entering={FadeInDown.duration(400).delay(300).springify()}
          style={styles.floatingAction}
        >
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.8)', 'rgba(0,0,0,0.95)']}
            style={styles.gradientFade}
            locations={[0, 0.5, 1]}
          />
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[
                styles.primaryButton,
                (!ALLOW_DEMO_MODE && !isPulseOxConnected) && styles.primaryButtonDisabled
              ]}
              onPress={handleStartSession}
              disabled={!ALLOW_DEMO_MODE && !isPulseOxConnected || isStartingSession}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={(!ALLOW_DEMO_MODE && !isPulseOxConnected) 
                  ? ['#2A2D35', '#1F2228']
                  : [colors.brand.accent, colors.brand.accent + 'dd']
                }
                style={StyleSheet.absoluteFillObject}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              />
              {isStartingSession ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <View style={styles.buttonContent}>
                  <Text style={styles.buttonText}>{getButtonTitle()}</Text>
                  <Ionicons name="arrow-forward-circle" size={24} color="white" style={{ marginLeft: 8 }} />
                </View>
              )}
            </TouchableOpacity>
          </View>
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
    backgroundColor: '#000',
  },
  safeArea: {
    flex: 1,
  },
  fixedHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  navigationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 16,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navigationTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.4,
  },
  navSpacer: {
    width: 44,
  },
  progressSteps: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingTop: 6,
    paddingBottom: 6, // Very tight spacing
  },
  stepItem: {
    alignItems: 'center',
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  stepActive: {
    backgroundColor: colors.brand.accent,
    borderColor: colors.brand.accent,
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  stepLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 6,
    fontWeight: '500',
  },
  stepLine: {
    width: 60,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 12,
  },
  content: {
    flex: 1,
    paddingTop: 138, // Very tight to header
  },
  scrollContent: {
    padding: 20,
    paddingTop: 0,
    paddingBottom: 200, // Match top spacing for visual balance
  },
  header: {
    marginBottom: 12, // Much tighter spacing
    alignItems: 'center',
  },
  title: {
    fontSize: 34,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: -0.8,
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '400',
  },
  premiumCard: {
    marginBottom: 16, // Consistent 16px spacing between all cards
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 20,
  },
  cardBlur: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  cardContent: {
    padding: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(78, 184, 186, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardTitleContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.4,
    marginBottom: 2,
  },
  cardSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '400',
  },
  timeBadge: {
    backgroundColor: 'rgba(78, 184, 186, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  timeBadgeText: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.brand.accent,
  },
  timeBadgeUnit: {
    fontSize: 12,
    color: colors.brand.accent,
    marginLeft: 2,
    fontWeight: '500',
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 12,
    position: 'relative',
  },
  metricValueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
  },
  metricUnit: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '500',
    marginLeft: 4,
  },
  metricLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '600',
  },
  tapHintBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: 'rgba(78, 184, 186, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tapHintText: {
    fontSize: 9,
    color: colors.brand.accent,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  divider: {
    height: 0.5,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: 20,
    marginHorizontal: -20,
  },
  altitudeContainer: {
    marginTop: 0,
  },
  altitudeLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  altitudeLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '600',
  },
  adjustedBadge: {
    marginLeft: 8,
    backgroundColor: 'rgba(255, 204, 0, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  adjustedBadgeText: {
    fontSize: 10,
    color: '#FFCC00',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  statusIndicator: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(78, 184, 186, 0.1)',
    padding: 12,
    borderRadius: 12,
    marginTop: 16,
  },
  infoText: {
    fontSize: 13,
    color: colors.brand.accent,
    marginLeft: 8,
    fontWeight: '500',
  },
  connectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(78, 184, 186, 0.15)',
    padding: 14,
    borderRadius: 12,
    marginTop: 16,
  },
  connectButtonText: {
    fontSize: 15,
    color: colors.brand.accent,
    fontWeight: '600',
  },
  disconnectButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 59, 48, 0.15)',
    padding: 12,
    borderRadius: 12,
    marginTop: 16,
  },
  disconnectButtonText: {
    fontSize: 15,
    color: '#FF3B30',
    fontWeight: '600',
  },
  floatingAction: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  gradientFade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    height: 150,
  },
  buttonContainer: {
    paddingHorizontal: 20,
    paddingBottom: 30,
    paddingTop: 5, // Very minimal gap from content
  },
  primaryButton: {
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.4,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.4,
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseText: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '400',
  },
});

export default SimplifiedSessionSetup;