import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import SafeIcon from '../base/SafeIcon';
import FeedbackButton from './FeedbackButton';
import SensationTag from './SensationTag';
import { colors, typography, spacing } from '../../design-system';
import { Audio } from 'expo-av';

const { height: screenHeight, width: screenWidth } = Dimensions.get('window');
const PANEL_HEIGHT = screenHeight * 0.48; // Reduced height for center positioning
const AUTO_DISMISS_TIME = 30000; // 30 seconds (increased by 10)

const IntraSessionFeedback = ({ 
  visible, 
  onSubmit, 
  onDismiss,
  cycleNumber,
  currentSpo2,
  currentHR 
}) => {
  // Survey states
  const [stressPerception, setStressPerception] = useState(null);
  const [energy, setEnergy] = useState(null);
  const [clarity, setClarity] = useState(null);
  const [sensations, setSensations] = useState([]);
  
  // Animation values
  const slideAnim = useRef(new Animated.Value(screenHeight)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(1)).current;
  
  // Timer
  const dismissTimer = useRef(null);
  const [showTooltip, setShowTooltip] = useState(false);

  // Play gentle chime on appearance
  useEffect(() => {
    if (visible) {
      playChime();
      animateIn();
      startAutoDismissTimer();
    } else {
      animateOut();
      clearAutoDismissTimer();
    }
  }, [visible]);

  const playChime = async () => {
    try {
      // Try to load the sound file
      const { sound } = await Audio.Sound.createAsync(
        require('../../../assets/sounds/gentle-chime.mp3'),
        { shouldPlay: true, volume: 0.3 }
      );
      await sound.playAsync();
      
      // Cleanup sound after playing
      setTimeout(() => {
        sound.unloadAsync();
      }, 2000);
    } catch (error) {
      // Fallback: Use system haptic feedback if sound fails
      console.log('Sound playback failed:', error.message);
      try {
        const Haptics = require('expo-haptics');
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (hapticError) {
        // Silent fail if haptics also not available
        console.log('Haptic feedback also failed:', hapticError.message);
      }
    }
  };

  const animateIn = () => {
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 65,
        friction: 10,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const animateOut = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: PANEL_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Delay resetForm to avoid React warning
      setTimeout(() => {
        resetForm();
      }, 0);
    });
  };

  const startAutoDismissTimer = () => {
    clearAutoDismissTimer();
    
    // Animate progress bar
    Animated.timing(progressAnim, {
      toValue: 0,
      duration: AUTO_DISMISS_TIME,
      useNativeDriver: false,
    }).start();

    // Set dismiss timer
    dismissTimer.current = setTimeout(() => {
      handleDismiss();
    }, AUTO_DISMISS_TIME);
  };

  const clearAutoDismissTimer = () => {
    if (dismissTimer.current) {
      clearTimeout(dismissTimer.current);
      dismissTimer.current = null;
    }
    progressAnim.stopAnimation();
  };

  const resetForm = () => {
    setStressPerception(null);
    setEnergy(null);
    setClarity(null);
    setSensations([]);
    setShowTooltip(false);
    progressAnim.setValue(1);
  };

  const handleSubmit = () => {
    if (stressPerception && energy && clarity) {
      clearAutoDismissTimer();
      onSubmit({
        stressPerception,
        energy,
        clarity,
        sensations,
        cycleNumber,
        spo2: currentSpo2,
        heartRate: currentHR,
      });
      animateOut();
    }
  };

  const handleDismiss = () => {
    clearAutoDismissTimer();
    onDismiss();
    animateOut();
  };

  const toggleSensation = (sensation) => {
    setSensations(prev => 
      prev.includes(sensation)
        ? prev.filter(s => s !== sensation)
        : [...prev, sensation]
    );
  };

  const isComplete = stressPerception && energy && clarity;

  const sensationOptions = [
    { id: 'tingling', label: 'Tingling', icon: 'flash' },
    { id: 'heaviness', label: 'Muscle Heaviness', icon: 'fitness' },
    { id: 'euphoria', label: 'Calm / Euphoria', icon: 'happy' },
    { id: 'tension', label: 'Neck/Shoulder Tension', icon: 'warning' },
    { id: 'lightheaded', label: 'Lightheadedness', icon: 'pulse' },
  ];

  if (!visible) return null;

  return (
    <View style={[StyleSheet.absoluteFillObject, { zIndex: 1000 }]} pointerEvents="box-none">
      {/* Backdrop */}
      <TouchableWithoutFeedback onPress={handleDismiss}>
        <Animated.View 
          style={[
            styles.backdrop,
            { opacity: fadeAnim }
          ]}
        />
      </TouchableWithoutFeedback>

      {/* Panel */}
      <Animated.View 
        style={[
          styles.panel,
          {
            transform: [{ translateY: slideAnim }],
            opacity: fadeAnim,
          }
        ]}
      >
        <BlurView intensity={95} tint="dark" style={styles.blurContainer}>
          <LinearGradient
            colors={[colors.background.elevated + 'f5', colors.background.primary + 'f5']}
            style={styles.gradient}
          >
            {/* Progress Bar */}
            <View style={styles.progressContainer}>
              <Animated.View 
                style={[
                  styles.progressBar,
                  {
                    width: progressAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                    }),
                  }
                ]}
              />
            </View>

            {/* Header */}
            <View style={styles.header}>
              <View>
                <Text style={styles.title}>Quick Check-in</Text>
                <Text style={styles.subtitle}>Cycle {cycleNumber} Recovery Phase</Text>
              </View>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={handleDismiss}
              >
                <SafeIcon name="close" size="sm" color={colors.text.secondary} />
              </TouchableOpacity>
            </View>

            <ScrollView 
              style={styles.content}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              {/* Question 1: Stress Perception */}
              <View style={styles.question}>
                <View style={styles.questionHeader}>
                  <Text style={styles.questionText}>How does the stress feel?</Text>
                  <TouchableOpacity 
                    onPress={() => setShowTooltip(!showTooltip)}
                    style={styles.helpButton}
                  >
                    <SafeIcon name="help-circle" size="xs" color={colors.text.tertiary} />
                  </TouchableOpacity>
                </View>
                {showTooltip && (
                  <Text style={styles.tooltip}>
                    Positive stress feels challenging but manageable. 
                    Negative stress feels overwhelming.
                  </Text>
                )}
                <View style={styles.optionsRow}>
                  {['Very
Neg', 'Neg', 'Neut', 'Pos', 'Very
Pos'].map((label, index) => (
                    <FeedbackButton
                      key={index}
                      label={label}
                      selected={stressPerception === index + 1}
                      onPress={() => setStressPerception(index + 1)}
                      style={{ flex: 1 }}
                      compact
                    />
                  ))}
                </View>
              </View>

              {/* Question 2: Energy */}
              <View style={styles.question}>
                <Text style={styles.questionText}>How is your energy?</Text>
                <View style={styles.optionsRow}>
                  {['Very
Tired', 'Tired', 'Neut', 'Alert', 'Very
Alert'].map((label, index) => (
                    <FeedbackButton
                      key={index}
                      label={label}
                      selected={energy === index + 1}
                      onPress={() => setEnergy(index + 1)}
                      style={{ flex: 1 }}
                      compact
                    />
                  ))}
                </View>
              </View>

              {/* Question 3: Mental Clarity */}
              <View style={styles.question}>
                <Text style={styles.questionText}>How is your mental clarity?</Text>
                <View style={styles.optionsRow}>
                  {['Very
Foggy', 'Foggy', 'Neut', 'Clear', 'Very
Clear'].map((label, index) => (
                    <FeedbackButton
                      key={index}
                      label={label}
                      selected={clarity === index + 1}
                      onPress={() => setClarity(index + 1)}
                      style={{ flex: 1 }}
                      compact
                    />
                  ))}
                </View>
              </View>

              {/* Question 4: Sensations */}
              <View style={styles.question}>
                <Text style={styles.questionText}>Any specific sensations?</Text>
                <View style={styles.sensationsGrid}>
                  {sensationOptions.map(sensation => (
                    <SensationTag
                      key={sensation.id}
                      label={sensation.label}
                      icon={sensation.icon}
                      selected={sensations.includes(sensation.id)}
                      onPress={() => toggleSensation(sensation.id)}
                    />
                  ))}
                </View>
              </View>
            </ScrollView>

            {/* Footer */}
            <View style={styles.footer}>
              <TouchableOpacity
                style={styles.skipButton}
                onPress={handleDismiss}
              >
                <Text style={styles.skipText}>Skip</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  !isComplete && styles.submitButtonDisabled
                ]}
                onPress={handleSubmit}
                disabled={!isComplete}
              >
                <LinearGradient
                  colors={isComplete 
                    ? [colors.brand.accent, colors.brand.accent + 'dd']
                    : ['#444444', '#333333']
                  }
                  style={StyleSheet.absoluteFillObject}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                />
                <Text style={styles.submitText}>Submit</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </BlurView>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  panel: {
    position: 'absolute',
    bottom: '50%',
    left: 20,
    right: 20,
    height: PANEL_HEIGHT,
    marginBottom: -(PANEL_HEIGHT / 2), // Center vertically
    borderRadius: spacing.radius.xl,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 15,
  },
  blurContainer: {
    flex: 1,
  },
  gradient: {
    flex: 1,
    paddingTop: spacing.md,
  },
  progressContainer: {
    height: 3,
    backgroundColor: colors.background.tertiary,
    marginHorizontal: spacing.xl,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.brand.accent,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: {
    ...typography.h3,
    color: colors.text.primary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: 2,
  },
  closeButton: {
    padding: spacing.xs,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  question: {
    marginBottom: spacing.lg,
  },
  questionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  questionText: {
    ...typography.bodyMedium,
    color: colors.text.primary,
    fontWeight: '600',
  },
  helpButton: {
    marginLeft: spacing.xs,
    padding: spacing.xxs,
  },
  tooltip: {
    ...typography.caption,
    color: colors.text.tertiary,
    backgroundColor: colors.background.tertiary,
    padding: spacing.sm,
    borderRadius: spacing.radius.sm,
    marginBottom: spacing.sm,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  sensationsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.xs,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  skipButton: {
    flex: 1,
    paddingVertical: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: spacing.radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  skipText: {
    ...typography.bodyMedium,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  submitButton: {
    flex: 2,
    paddingVertical: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: spacing.radius.md,
    overflow: 'hidden',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitText: {
    ...typography.bodyMedium,
    color: colors.text.primary,
    fontWeight: '600',
  },
});

export default IntraSessionFeedback;