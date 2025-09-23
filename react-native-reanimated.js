/**
 * Proxy module for react-native-reanimated
 * This intercepts all imports and provides fallbacks for Expo Go
 */

import Constants from 'expo-constants';
import { Animated, Easing as RNEasing } from 'react-native';

// Detect if we're in Expo Go
const isExpoGo = Constants.appOwnership === 'expo';

// In production builds, export the real reanimated
if (!isExpoGo) {
  try {
    module.exports = require('./node_modules/react-native-reanimated');
  } catch (error) {
    console.warn('⚠️ Reanimated not available, using fallbacks');
  }
}

// In Expo Go, export our shim
if (isExpoGo || !module.exports) {
  // Fallback implementations
  const useSharedValue = (initialValue) => {
    return { value: initialValue };
  };

  const useAnimatedStyle = (styleFactory) => {
    try {
      return typeof styleFactory === 'function' ? styleFactory() : {};
    } catch {
      return {};
    }
  };

  const withSpring = (toValue) => toValue;
  const withTiming = (toValue) => toValue;
  const withDelay = (delay, animation) => animation;
  const withSequence = (...animations) => animations[0];
  const withRepeat = (animation) => animation;
  const interpolate = (value, inputRange, outputRange) => {
    if (typeof value === 'number') return value;
    return outputRange[0];
  };

  const Easing = RNEasing;
  const Extrapolate = {
    EXTEND: 'extend',
    CLAMP: 'clamp',
    IDENTITY: 'identity',
  };

  // Animation presets
  const FadeIn = { duration: 300 };
  const FadeOut = { duration: 300 };
  const FadeInDown = { duration: 300 };
  const FadeInUp = { duration: 300 };

  // Main animated object
  const AnimatedShim = {
    Value: Animated.Value,
    View: Animated.View,
    Text: Animated.Text,
    Image: Animated.Image,
    ScrollView: Animated.ScrollView,
    FlatList: Animated.FlatList,
    createAnimatedComponent: (Component) => {
      // Return the component as-is in Expo Go
      return Component;
    },
  };

  // Export everything
  module.exports = {
    default: AnimatedShim,
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    withDelay,
    withSequence,
    withRepeat,
    interpolate,
    Easing,
    Extrapolate,
    FadeIn,
    FadeOut,
    FadeInDown,
    FadeInUp,
  };
}