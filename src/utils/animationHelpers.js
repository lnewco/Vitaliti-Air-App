import { Animated, Easing as RNEasing } from 'react-native';
import Constants from 'expo-constants';

// Detect if we're in Expo Go
const isExpoGo = Constants.appOwnership === 'expo';

// Try to load reanimated only in production builds
let ReanimatedModule = null;
if (!isExpoGo) {
  try {
    ReanimatedModule = require('react-native-reanimated');
  } catch (e) {
    console.log('📱 Reanimated not available, using fallbacks');
  }
}

// Export helper to check if we should use reanimated
export const useReanimated = () => !isExpoGo && ReanimatedModule !== null;

// Export reanimated hooks with fallbacks
export const useSharedValue = (initialValue) => {
  if (ReanimatedModule && !isExpoGo) {
    return ReanimatedModule.useSharedValue(initialValue);
  }
  // Fallback: return a simple object that mimics the API
  return { value: initialValue };
};

export const useAnimatedStyle = (styleFactory) => {
  if (ReanimatedModule && !isExpoGo) {
    return ReanimatedModule.useAnimatedStyle(styleFactory);
  }
  // Fallback: return empty style or try to call the factory
  try {
    return typeof styleFactory === 'function' ? styleFactory() : {};
  } catch {
    return {};
  }
};

export const withSpring = (toValue, config) => {
  if (ReanimatedModule && !isExpoGo) {
    return ReanimatedModule.withSpring(toValue, config);
  }
  // Fallback: return the target value
  return toValue;
};

export const withTiming = (toValue, config) => {
  if (ReanimatedModule && !isExpoGo) {
    return ReanimatedModule.withTiming(toValue, config);
  }
  // Fallback: return the target value
  return toValue;
};

export const withDelay = (delay, animation) => {
  if (ReanimatedModule && !isExpoGo) {
    return ReanimatedModule.withDelay(delay, animation);
  }
  // Fallback: return the animation
  return animation;
};

export const withSequence = (...animations) => {
  if (ReanimatedModule && !isExpoGo) {
    return ReanimatedModule.withSequence(...animations);
  }
  // Fallback: return first animation
  return animations[0];
};

export const withRepeat = (animation, numberOfReps, reverse) => {
  if (ReanimatedModule && !isExpoGo) {
    return ReanimatedModule.withRepeat(animation, numberOfReps, reverse);
  }
  // Fallback: return the animation
  return animation;
};

export const interpolate = (value, inputRange, outputRange, extrapolate) => {
  if (ReanimatedModule && !isExpoGo) {
    return ReanimatedModule.interpolate(value, inputRange, outputRange, extrapolate);
  }
  // Fallback: return first output value
  if (typeof value === 'number') return value;
  return outputRange[0];
};

// Add scroll handler support
export const useAnimatedScrollHandler = (handlers) => {
  if (ReanimatedModule && !isExpoGo) {
    return ReanimatedModule.useAnimatedScrollHandler(handlers);
  }
  // Fallback: return a no-op handler for Expo Go
  return () => {};
};

export const runOnJS = (fn) => {
  if (ReanimatedModule && !isExpoGo) {
    return ReanimatedModule.runOnJS(fn);
  }
  // Fallback: return the function directly
  return fn;
};

// Add animated props support for SVG and other components
export const useAnimatedProps = (propsFactory) => {
  if (ReanimatedModule && !isExpoGo) {
    return ReanimatedModule.useAnimatedProps(propsFactory);
  }
  // Fallback: try to return static props or empty object
  try {
    return typeof propsFactory === 'function' ? propsFactory() : {};
  } catch {
    return {};
  }
};

export const Easing = ReanimatedModule && !isExpoGo ? ReanimatedModule.Easing : RNEasing;

export const Extrapolate = ReanimatedModule && !isExpoGo ? ReanimatedModule.Extrapolate : {
  EXTEND: 'extend',
  CLAMP: 'clamp',
  IDENTITY: 'identity',
};

// Animation presets
export const FadeIn = ReanimatedModule && !isExpoGo ? ReanimatedModule.FadeIn : { duration: 300 };
export const FadeOut = ReanimatedModule && !isExpoGo ? ReanimatedModule.FadeOut : { duration: 300 };
export const FadeInDown = ReanimatedModule && !isExpoGo ? ReanimatedModule.FadeInDown : { duration: 300 };
export const FadeInUp = ReanimatedModule && !isExpoGo ? ReanimatedModule.FadeInUp : { duration: 300 };

// Create animated component helper
export const createAnimatedComponent = (Component) => {
  if (ReanimatedModule && !isExpoGo) {
    return ReanimatedModule.default.createAnimatedComponent(Component);
  }
  // Fallback: return the original component
  return Component;
};

// Export the default Animated object (either reanimated or React Native's)
export const AnimatedAPI = ReanimatedModule && !isExpoGo ? ReanimatedModule.default : {
  Value: Animated.Value,
  View: Animated.View,
  Text: Animated.Text,
  Image: Animated.Image,
  ScrollView: Animated.ScrollView,
  FlatList: Animated.FlatList,
  createAnimatedComponent: (Component) => Component,
};

export { isExpoGo };