// Shim for react-native-reanimated in Expo Go
// This provides mock implementations to prevent crashes

const Animated = {
  Value: class {
    constructor(value) {
      this._value = value;
    }
    setValue(value) {
      this._value = value;
    }
  },
  View: require('react-native').Animated.View,
  Text: require('react-native').Animated.Text,
  Image: require('react-native').Animated.Image,
  ScrollView: require('react-native').Animated.ScrollView,
  FlatList: require('react-native').Animated.FlatList,
  createAnimatedComponent: (Component) => Component,
};

const useSharedValue = (value) => ({ value });
const useAnimatedStyle = (styleFactory) => styleFactory();
const withSpring = (value) => value;
const withTiming = (value) => value;
const withDelay = (delay, animation) => animation;
const withSequence = (...animations) => animations[0];
const withRepeat = (animation) => animation;
const interpolate = (value, inputRange, outputRange) => value;
const Easing = require('react-native').Easing;
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

module.exports = {
  default: Animated,
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