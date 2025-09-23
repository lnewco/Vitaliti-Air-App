import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';
// import HapticFeedback from 'react-native-haptic-feedback'; // Disabled for Expo Go
import colors from '../colors';
import typography from '../typography';
import spacing from '../spacing';

// Detect if we're in Expo Go
const isExpoGo = Constants.appOwnership === 'expo';

// Only import reanimated in production builds
let ReanimatedModule = null;
let AnimatedTouchable = TouchableOpacity;

if (!isExpoGo) {
  try {
    ReanimatedModule = require('react-native-reanimated');
    AnimatedTouchable = ReanimatedModule.default.createAnimatedComponent(TouchableOpacity);
  } catch (e) {
    console.log('📱 Reanimated not available, using fallbacks');
  }
}

const PremiumCard = ({
  children,
  onPress,
  style,
  gradient = false,
  borderGlow = false,
  hapticType = 'impactLight',
  disabled = false,
  padding = spacing.cardPadding,
}) => {
  // Use React Native's built-in Animated API for Expo Go
  const scaleValue = React.useRef(new Animated.Value(1)).current;
  const opacityValue = React.useRef(new Animated.Value(1)).current;

  // Reanimated values for production builds
  let scale, opacity, animatedStyle;

  if (!isExpoGo && ReanimatedModule) {
    const { useSharedValue, useAnimatedStyle, withSpring } = ReanimatedModule;
    scale = useSharedValue(1);
    opacity = useSharedValue(1);

    animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
      opacity: opacity.value,
    }));
  } else {
    // Fallback style for Expo Go
    animatedStyle = {
      transform: [{ scale: scaleValue }],
      opacity: opacityValue,
    };
  }

  const handlePressIn = () => {
    if (!disabled) {
      if (!isExpoGo && ReanimatedModule) {
        const { withSpring } = ReanimatedModule;
        scale.value = withSpring(0.98, {
          damping: 15,
          stiffness: 400,
        });
        opacity.value = withSpring(0.9);
      } else {
        // Use React Native's Animated API for Expo Go
        Animated.parallel([
          Animated.spring(scaleValue, {
            toValue: 0.98,
            useNativeDriver: true,
          }),
          Animated.spring(opacityValue, {
            toValue: 0.9,
            useNativeDriver: true,
          }),
        ]).start();
      }
      // HapticFeedback.trigger(hapticType); // Disabled for Expo Go
    }
  };

  const handlePressOut = () => {
    if (!isExpoGo && ReanimatedModule) {
      const { withSpring } = ReanimatedModule;
      scale.value = withSpring(1, {
        damping: 15,
        stiffness: 400,
      });
      opacity.value = withSpring(1);
    } else {
      // Use React Native's Animated API for Expo Go
      Animated.parallel([
        Animated.spring(scaleValue, {
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.spring(opacityValue, {
          toValue: 1,
          useNativeDriver: true,
        }),
      ]).start();
    }
  };

  const cardContent = (
    <View style={[styles.cardContent, { padding }]}>
      {children}
    </View>
  );

  const cardBase = gradient ? (
    <LinearGradient
      colors={[colors.components.card.background, colors.background.secondary]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.card,
        borderGlow && styles.borderGlow,
        disabled && styles.disabled,
        style,
      ]}
    >
      {cardContent}
    </LinearGradient>
  ) : (
    <View
      style={[
        styles.card,
        borderGlow && styles.borderGlow,
        disabled && styles.disabled,
        style,
      ]}
    >
      {cardContent}
    </View>
  );

  if (onPress && !disabled) {
    if (isExpoGo) {
      // For Expo Go, use regular Animated.View wrapper
      return (
        <Animated.View style={animatedStyle}>
          <TouchableOpacity
            activeOpacity={1}
            onPress={onPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
          >
            {cardBase}
          </TouchableOpacity>
        </Animated.View>
      );
    } else if (AnimatedTouchable !== TouchableOpacity) {
      // For production builds with reanimated
      return (
        <AnimatedTouchable
          activeOpacity={1}
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={animatedStyle}
        >
          {cardBase}
        </AnimatedTouchable>
      );
    } else {
      // Fallback if reanimated fails to load in production
      return (
        <TouchableOpacity
          activeOpacity={1}
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
        >
          {cardBase}
        </TouchableOpacity>
      );
    }
  }

  return cardBase;
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.components.card.background,
    borderRadius: spacing.radius.card,
    borderWidth: 1,
    borderColor: colors.components.card.border,
    overflow: 'hidden',
  },
  cardContent: {
    // Content styles applied via padding prop
  },
  borderGlow: {
    shadowColor: colors.brand.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  disabled: {
    opacity: 0.5,
  },
});

export default PremiumCard;