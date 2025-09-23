/**
 * @fileoverview Simplified IHHT session setup screen with device connection and configuration
 */

import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
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
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Animated } from 'react-native';
import {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  AnimatedAPI,
  isExpoGo
} from '../utils/animationHelpers';
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
import { SESSION_DEFAULTS, SESSION_LIMITS, SESSION_COLORS, DEMO_MODE } from '../constants/sessionConstants';
import { calculateSessionDuration, cycleCount, cycleHypoxicDuration, cycleRecoveryDuration } from '../utils/sessionHelpers';

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
  const [recommendedAltitude, setRecommendedAltitude] = useState(SESSION_DEFAULTS.ALTITUDE_LEVEL);
  const [selectedAltitude, setSelectedAltitude] = useState(SESSION_DEFAULTS.ALTITUDE_LEVEL);
  const [altitudeLoadingState, setAltitudeLoadingState] = useState('loading');
  const [userAdjustedAltitude, setUserAdjustedAltitude] = useState(false);
  // Dynamic protocol configuration states with AI-recommended defaults
  const [totalCycles, setTotalCycles] = useState(SESSION_DEFAULTS.TOTAL_CYCLES);
  const [hypoxicDuration, setHypoxicDuration] = useState(SESSION_DEFAULTS.HYPOXIC_DURATION);
  const [recoveryDuration, setRecoveryDuration] = useState(SESSION_DEFAULTS.RECOVERY_DURATION);

  // Animation shared values
  const scale = useSharedValue(1);
  const progressAnimation = useSharedValue(0);

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
    hypoxicDuration: hypoxicDuration, // Keep in minutes - IHHTSessionSimple will convert
    hyperoxicDuration: recoveryDuration, // Keep in minutes - IHHTSessionSimple will convert
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
      const userId = SESSION_DEFAULTS.DEFAULT_USER_ID; // TODO: Get from auth context
      
      const progressionData = await AltitudeProgressionService.calculateOptimalStartingAltitude(userId);
      
      setRecommendedAltitude(progressionData.recommendedLevel);
      setSelectedAltitude(progressionData.recommendedLevel); // Set initial selection to recommended
      setAltitudeLoadingState('loaded');
      
      // Recommendation loaded successfully
    } catch (error) {
      // Failed to calculate, using defaults
      setRecommendedAltitude(SESSION_DEFAULTS.ALTITUDE_LEVEL);
      setSelectedAltitude(SESSION_DEFAULTS.ALTITUDE_LEVEL);
      setAltitudeLoadingState('loaded');
    }
  };

  const handleAltitudeSelect = (level) => {
    setSelectedAltitude(level);
    setUserAdjustedAltitude(level !== recommendedAltitude);
    // User selected altitude
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
    // Demo mode - starting without pulse oximeter

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
      // Initialize database
      await DatabaseService.init();

      // Session will be created by EnhancedSessionManager in IHHTSessionSimple screen

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
      // Error handled with Alert
      Alert.alert(
        'Error',
        'Failed to start session. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsStartingSession(false);
    }
  };

  const totalSessionTime = calculateSessionDuration(totalCycles, hypoxicDuration, recoveryDuration);

  // Protocol metrics data - now interactive
  const protocolMetrics = [
    { 
      label: 'CYCLES', 
      value: totalCycles, 
      unit: '',
      isDefault: totalCycles === SESSION_DEFAULTS.TOTAL_CYCLES,
      onPress: () => setTotalCycles(prev => cycleCount(prev))
    },
    { 
      label: 'HYPOXIC', 
      value: hypoxicDuration, 
      unit: 'min',
      isDefault: hypoxicDuration === SESSION_DEFAULTS.HYPOXIC_DURATION,
      onPress: () => setHypoxicDuration(prev => cycleHypoxicDuration(prev))
    },
    { 
      label: 'RECOVERY', 
      value: recoveryDuration, 
      unit: 'min',
      isDefault: recoveryDuration === SESSION_DEFAULTS.RECOVERY_DURATION,
      onPress: () => setRecoveryDuration(prev => cycleRecoveryDuration(prev))
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
          <AnimatedAPI.View
            style={[styles.header, isExpoGo ? {} : { opacity: 1 }]}
          >
            <Text style={styles.title}>Adaptive Training</Text>
            <Text style={styles.subtitle}>
              Configure your personalized session
            </Text>
          </AnimatedAPI.View>

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
                      <Text style={styles.cardSubtitle}>AI-Optimized IHHT</Text>
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
                        style={[styles.metricItem, metric.isDefault && styles.metricItemDefault]}
                        onPress={metric.onPress}
                        activeOpacity={0.7}
                      >
                        {metric.isDefault && (
                          <View style={styles.aiRecommendedBadge}>
                            <Text style={styles.aiRecommendedText}>AI</Text>
                          </View>
                        )}
                        <View style={styles.metricValueContainer}>
                          <Text style={[styles.metricValue, metric.isDefault && styles.metricValueDefault]}>{metric.value}</Text>
                          {metric.unit && <Text style={[styles.metricUnit, metric.isDefault && styles.metricUnitDefault]}>{metric.unit}</Text>}
                        </View>
                        <Text style={[styles.metricLabel, metric.isDefault && styles.metricLabelDefault]}>{metric.label}</Text>
                        <View style={styles.tapHintContainer}>
                          <Ionicons 
                            name="chevron-up" 
                            size={12} 
                            color={
                              // Green arrow if current value is below AI recommendation
                              (metric.label === 'CYCLES' && totalCycles < 5) ||
                              (metric.label === 'HYPOXIC' && hypoxicDuration < 7) ||
                              (metric.label === 'RECOVERY' && recoveryDuration < 3)
                                ? '#4CAF50' 
                                : colors.text.quaternary
                            } 
                          />
                          <View style={[styles.tapHintBadge, metric.isDefault && styles.tapHintBadgeDefault]}>
                            <Text style={[styles.tapHintText, metric.isDefault && styles.tapHintTextDefault]}>TAP</Text>
                          </View>
                          <Ionicons 
                            name="chevron-down" 
                            size={12} 
                            color={
                              // Green arrow if current value is above AI recommendation
                              (metric.label === 'CYCLES' && totalCycles > 5) ||
                              (metric.label === 'HYPOXIC' && hypoxicDuration > 7) ||
                              (metric.label === 'RECOVERY' && recoveryDuration > 3)
                                ? '#4CAF50' 
                                : colors.text.quaternary
                            } 
                          />
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
                      <AnimatedAPI.View style={[
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
                // Device connected
                setShowConnectionManager(false);
                // Device is already connected via the scanner
              }}
            />
          )}
        </ScrollView>

        {/* Floating Action Button with Gradient Fade */}
        <AnimatedAPI.View
          style={[styles.floatingAction, isExpoGo ? {} : { opacity: 1 }]}
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
        </AnimatedAPI.View>
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
    backgroundColor: SESSION_COLORS.DARK_BG,
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
  tapHintContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    marginTop: 8,
  },
  tapHintBadge: {
    backgroundColor: 'rgba(78, 184, 186, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginVertical: 2,
  },
  tapHintBadgeDefault: {
    backgroundColor: 'rgba(78, 184, 186, 0.3)',
  },
  tapHintText: {
    fontSize: 9,
    color: colors.brand.accent,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  tapHintTextDefault: {
    color: colors.brand.accent,
  },
  metricItemDefault: {
    backgroundColor: 'rgba(78, 184, 186, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(78, 184, 186, 0.2)',
  },
  metricValueDefault: {
    color: colors.brand.accent,
  },
  metricUnitDefault: {
    color: 'rgba(78, 184, 186, 0.7)',
  },
  metricLabelDefault: {
    color: 'rgba(78, 184, 186, 0.6)',
  },
  aiRecommendedBadge: {
    position: 'absolute',
    top: -8,
    right: 4,
    backgroundColor: SESSION_COLORS.SUCCESS,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  aiRecommendedText: {
    fontSize: 9,
    color: SESSION_COLORS.DARK_BG,
    fontWeight: '800',
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
    color: SESSION_COLORS.WARNING,
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
    color: SESSION_COLORS.ERROR,
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
    backgroundColor: SESSION_COLORS.DARK_BG,
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

SimplifiedSessionSetup.propTypes = {
  navigation: PropTypes.shape({
    replace: PropTypes.func.isRequired,
    navigate: PropTypes.func.isRequired,
  }).isRequired,
};

export default SimplifiedSessionSetup;