/**
 * Animation utilities that conditionally use reanimated or fallback to React Native Animated
 * This allows the app to work in both Expo Go and production builds
 */

import { Animated, Easing as RNEasing } from 'react-native';
import Constants from 'expo-constants';

// Detect if we're in Expo Go
const isExpoGo = Constants.appOwnership === 'expo';

// Try to load reanimated, but provide fallbacks if not available or in Expo Go
let ReanimatedModule = null;
let useSharedValue, useAnimatedStyle, withSpring, withTiming, withDelay, withSequence, withRepeat;
let interpolate, Easing, Extrapolate, FadeIn, FadeOut, FadeInDown, FadeInUp;
let AnimatedView, AnimatedText, AnimatedImage, AnimatedScrollView;

if (!isExpoGo) {
  try {
    ReanimatedModule = require('react-native-reanimated');
    useSharedValue = ReanimatedModule.useSharedValue;
    useAnimatedStyle = ReanimatedModule.useAnimatedStyle;
    withSpring = ReanimatedModule.withSpring;
    withTiming = ReanimatedModule.withTiming;
    withDelay = ReanimatedModule.withDelay;
    withSequence = ReanimatedModule.withSequence;
    withRepeat = ReanimatedModule.withRepeat;
    interpolate = ReanimatedModule.interpolate;
    Easing = ReanimatedModule.Easing;
    Extrapolate = ReanimatedModule.Extrapolate;
    FadeIn = ReanimatedModule.FadeIn;
    FadeOut = ReanimatedModule.FadeOut;
    FadeInDown = ReanimatedModule.FadeInDown;
    FadeInUp = ReanimatedModule.FadeInUp;
    AnimatedView = ReanimatedModule.default.View;
    AnimatedText = ReanimatedModule.default.Text;
    AnimatedImage = ReanimatedModule.default.Image;
    AnimatedScrollView = ReanimatedModule.default.ScrollView;
  } catch (error) {
    console.log('⚠️ Reanimated not available, using fallbacks');
  }
}

// Fallback implementations for Expo Go
if (!ReanimatedModule || isExpoGo) {
  // Fallback shared value implementation
  useSharedValue = (initialValue) => {
    const value = new Animated.Value(initialValue);
    return { value };
  };

  // Fallback animated style (just returns the style)
  useAnimatedStyle = (styleFactory) => {
    try {
      return styleFactory();
    } catch {
      return {};
    }
  };

  // Fallback animation functions (return the target value)
  withSpring = (toValue) => toValue;
  withTiming = (toValue) => toValue;
  withDelay = (delay, animation) => animation;
  withSequence = (...animations) => animations[0];
  withRepeat = (animation) => animation;

  // Fallback interpolation
  interpolate = (value, inputRange, outputRange) => {
    if (typeof value === 'number') return value;
    return outputRange[0];
  };

  // Use React Native's Easing
  Easing = RNEasing;

  // Fallback Extrapolate
  Extrapolate = {
    EXTEND: 'extend',
    CLAMP: 'clamp',
    IDENTITY: 'identity',
  };

  // Fallback animation presets (empty objects)
  FadeIn = {};
  FadeOut = {};
  FadeInDown = {};
  FadeInUp = {};

  // Use React Native's Animated components
  AnimatedView = Animated.View;
  AnimatedText = Animated.Text;
  AnimatedImage = Animated.Image;
  AnimatedScrollView = Animated.ScrollView;
}

// Export a default Animated object for compatibility
const AnimatedCompat = {
  Value: Animated.Value,
  View: AnimatedView,
  Text: AnimatedText,
  Image: AnimatedImage,
  ScrollView: AnimatedScrollView,
  createAnimatedComponent: Animated.createAnimatedComponent,
};

// Helper to check if we're using real reanimated
export const isReanimatedAvailable = () => !isExpoGo && ReanimatedModule !== null;

// Export all animation utilities
export {
  AnimatedCompat as default,
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
  AnimatedView,
  AnimatedText,
  AnimatedImage,
  AnimatedScrollView,
  isExpoGo,
};