import React from 'react';
import { 
  View, 
  StyleSheet, 
  StatusBar, 
  Text,
  TouchableOpacity,
  Dimensions,
  Image
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { 
  FadeInDown, 
  FadeInUp,
  useAnimatedStyle,
  withSpring,
  useSharedValue,
  withTiming,
  Easing
} from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import SafeIcon from '../../components/base/SafeIcon';
import { colors, typography, spacing } from '../../design-system';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const WelcomeScreen = ({ navigation }) => {
  const scaleValue = useSharedValue(1);

  const handleGetStarted = async () => {
    scaleValue.value = withSpring(0.95, {}, () => {
      scaleValue.value = withSpring(1);
    });
    
    try {
      await AsyncStorage.setItem('onboarding_state', 'in_progress');
      console.log('📝 Onboarding state set to: in_progress');
    } catch (error) {
      console.error('Failed to save onboarding state:', error);
    }
    
    navigation.navigate('BasicInfo');
  };

  const handleSignIn = async () => {
    try {
      await AsyncStorage.setItem('onboarding_state', 'completed');
      await AsyncStorage.setItem('hasCompletedOnboarding', 'true');
      console.log('🔑 Reset onboarding state for existing user');
    } catch (error) {
      console.error('Failed to reset onboarding state:', error);
    }
    
    navigation.navigate('Auth', { screen: 'LoginScreen' });
  };

  const animatedButtonStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scaleValue.value }]
    };
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Premium gradient background */}
      <LinearGradient
        colors={['#0C0E12', '#13161B', '#1A1D23']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Animated orb background effects */}
      <View style={styles.orbContainer}>
        <LinearGradient
          colors={['rgba(59, 130, 246, 0.15)', 'transparent']}
          style={[styles.orb, styles.orb1]}
        />
        <LinearGradient
          colors={['rgba(78, 205, 196, 0.12)', 'transparent']}
          style={[styles.orb, styles.orb2]}
        />
        <LinearGradient
          colors={['rgba(108, 92, 231, 0.1)', 'transparent']}
          style={[styles.orb, styles.orb3]}
        />
      </View>

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          {/* Logo Section */}
          <Animated.View 
            entering={FadeInDown.duration(800).delay(200)}
            style={styles.logoSection}
          >
            <View style={styles.logoContainer}>
              <LinearGradient
                colors={['rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0.05)']}
                style={styles.logoGradient}
              >
                <SafeIcon
                  name="pulse"
                  size={48}
                  color={colors.brand.primary}
                />
              </LinearGradient>
            </View>
            
            <Text style={styles.logoText}>VITALITI</Text>
            <Text style={styles.logoSubtext}>AIR</Text>
          </Animated.View>

          {/* Welcome Text */}
          <Animated.View 
            entering={FadeInDown.duration(800).delay(400)}
            style={styles.welcomeSection}
          >
            <Text style={styles.title}>
              Elevate Your{'\n'}Performance
            </Text>
            <Text style={styles.subtitle}>
              Advanced IHHT training with real-time biometric monitoring
            </Text>
          </Animated.View>

          {/* Feature Pills */}
          <Animated.View 
            entering={FadeInDown.duration(800).delay(600)}
            style={styles.featuresContainer}
          >
            {[
              { icon: 'fitness', text: 'Adaptive Training' },
              { icon: 'heart', text: 'Live Biometrics' },
              { icon: 'trending-up', text: 'Progress Tracking' }
            ].map((feature, index) => (
              <View key={index} style={styles.featurePill}>
                <SafeIcon
                  name={feature.icon}
                  size={16}
                  color={colors.metrics.recovery}
                />
                <Text style={styles.featureText}>{feature.text}</Text>
              </View>
            ))}
          </Animated.View>

          {/* Buttons Section */}
          <Animated.View 
            entering={FadeInUp.duration(800).delay(800)}
            style={styles.buttonSection}
          >
            {/* Primary CTA */}
            <TouchableOpacity
              onPress={handleGetStarted}
              activeOpacity={0.8}
            >
              <Animated.View style={animatedButtonStyle}>
                <LinearGradient
                  colors={[colors.brand.accent, colors.brand.secondary]}
                  style={styles.primaryButton}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.primaryButtonText}>Get Started</Text>
                  <SafeIcon 
                    name="arrow-forward" 
                    size={20} 
                    color="#FFFFFF"
                    style={{ marginLeft: 8 }}
                  />
                </LinearGradient>
              </Animated.View>
            </TouchableOpacity>

            {/* Secondary Sign In */}
            <TouchableOpacity
              onPress={handleSignIn}
              activeOpacity={0.7}
              style={styles.secondaryButton}
            >
              <BlurView intensity={20} tint="dark" style={styles.blurButton}>
                <Text style={styles.secondaryButtonText}>
                  Already have an account? Sign in
                </Text>
              </BlurView>
            </TouchableOpacity>
          </Animated.View>

          {/* Bottom Accent Line */}
          <Animated.View 
            entering={FadeInUp.duration(800).delay(1000)}
            style={styles.bottomAccent}
          >
            <LinearGradient
              colors={[
                'transparent',
                colors.metrics.spo2,
                colors.metrics.recovery,
                colors.metrics.sleep,
                'transparent'
              ]}
              style={styles.accentLine}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
          </Animated.View>
        </View>
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
  orbContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  orb: {
    position: 'absolute',
    borderRadius: 500,
  },
  orb1: {
    width: 400,
    height: 400,
    top: -150,
    right: -100,
  },
  orb2: {
    width: 350,
    height: 350,
    bottom: -100,
    left: -100,
  },
  orb3: {
    width: 300,
    height: 300,
    top: '40%',
    right: -150,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
  },
  logoSection: {
    alignItems: 'center',
    marginTop: screenHeight * 0.08,
    marginBottom: spacing.xxl,
  },
  logoContainer: {
    marginBottom: spacing.lg,
  },
  logoGradient: {
    width: 100,
    height: 100,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  logoText: {
    fontSize: 32,
    fontWeight: '300',
    color: colors.text.primary,
    letterSpacing: 6,
    marginTop: spacing.md,
  },
  logoSubtext: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.metrics.recovery,
    letterSpacing: 8,
    marginTop: -spacing.xs,
  },
  welcomeSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: 42,
    fontWeight: '700',
    color: colors.text.primary,
    textAlign: 'center',
    lineHeight: 48,
    marginBottom: spacing.md,
  },
  subtitle: {
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: spacing.lg,
  },
  featuresContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginBottom: spacing.xxl,
    gap: spacing.sm,
  },
  featurePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(78, 205, 196, 0.1)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(78, 205, 196, 0.2)',
    gap: spacing.xs,
  },
  featureText: {
    fontSize: 12,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  buttonSection: {
    position: 'absolute',
    bottom: spacing.xxl,
    left: spacing.xl,
    right: spacing.xl,
  },
  primaryButton: {
    height: 56,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
    shadowColor: colors.brand.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryButton: {
    height: 48,
    borderRadius: 12,
    overflow: 'hidden',
  },
  blurButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
  },
  secondaryButtonText: {
    fontSize: 15,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  bottomAccent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
  },
  accentLine: {
    flex: 1,
    height: 2,
  },
});

export default WelcomeScreen;