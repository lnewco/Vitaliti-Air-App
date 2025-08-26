/**
 * Vitaliti Air Design System - Typography
 * Premium type system matching Whoop's clean hierarchy
 */

import { Platform } from 'react-native';

const fontFamily = {
  // Use SF Pro on iOS (matches Whoop exactly)
  // Use system fonts on Android for native feel
  regular: Platform.select({
    ios: 'System',
    android: 'Roboto',
  }),
  medium: Platform.select({
    ios: 'System',
    android: 'Roboto-Medium',
  }),
  semibold: Platform.select({
    ios: 'System',
    android: 'Roboto-Medium',
  }),
  bold: Platform.select({
    ios: 'System',
    android: 'Roboto-Bold',
  }),
  mono: Platform.select({
    ios: 'Courier',
    android: 'monospace',
  }),
};

const typography = {
  // Display styles
  displayLarge: {
    fontFamily: fontFamily.bold,
    fontSize: 48,
    lineHeight: 56,
    fontWeight: '700',
    letterSpacing: -1,
  },
  displayMedium: {
    fontFamily: fontFamily.bold,
    fontSize: 36,
    lineHeight: 44,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  displaySmall: {
    fontFamily: fontFamily.semibold,
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '600',
    letterSpacing: -0.5,
  },

  // Heading styles
  h1: {
    fontFamily: fontFamily.bold,
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  h2: {
    fontFamily: fontFamily.semibold,
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  h3: {
    fontFamily: fontFamily.semibold,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  h4: {
    fontFamily: fontFamily.medium,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '500',
    letterSpacing: -0.1,
  },

  // Body styles
  bodyLarge: {
    fontFamily: fontFamily.regular,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '400',
    letterSpacing: 0,
  },
  bodyMedium: {
    fontFamily: fontFamily.regular,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
    letterSpacing: 0,
  },
  bodySmall: {
    fontFamily: fontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
    letterSpacing: 0.1,
  },

  // Label styles
  labelLarge: {
    fontFamily: fontFamily.medium,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  labelMedium: {
    fontFamily: fontFamily.medium,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  labelSmall: {
    fontFamily: fontFamily.medium,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },

  // Caption & micro text
  caption: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    letterSpacing: 0.2,
  },
  micro: {
    fontFamily: fontFamily.medium,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '500',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },

  // Data-specific styles (like Whoop metrics)
  metricLarge: {
    fontFamily: fontFamily.bold,
    fontSize: 48,
    lineHeight: 48,
    fontWeight: '700',
    letterSpacing: -1,
  },
  metricMedium: {
    fontFamily: fontFamily.semibold,
    fontSize: 36,
    lineHeight: 36,
    fontWeight: '600',
    letterSpacing: -0.5,
  },
  metricSmall: {
    fontFamily: fontFamily.medium,
    fontSize: 24,
    lineHeight: 24,
    fontWeight: '500',
    letterSpacing: 0,
  },
  metricLabel: {
    fontFamily: fontFamily.medium,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '500',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  // Monospace for numbers (like Whoop's data display)
  monoLarge: {
    fontFamily: fontFamily.mono,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '600',
  },
  monoMedium: {
    fontFamily: fontFamily.mono,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
  },
  monoSmall: {
    fontFamily: fontFamily.mono,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '400',
  },

  // Button text
  buttonLarge: {
    fontFamily: fontFamily.semibold,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  buttonMedium: {
    fontFamily: fontFamily.medium,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  buttonSmall: {
    fontFamily: fontFamily.medium,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
};

// Helper function to apply font weight properly on iOS
export const getFontWeight = (weight) => {
  if (Platform.OS === 'ios') {
    return weight;
  }
  // Android handles font weight through font family
  return 'normal';
};

export default typography;