import { Platform } from 'react-native';

// Typography system for consistent text styling
const typography = {
  // Font families
  fontFamily: {
    regular: Platform.select({
      ios: 'System',
      android: 'Roboto',
      default: 'System',
    }),
    medium: Platform.select({
      ios: 'System',
      android: 'Roboto-Medium',
      default: 'System',
    }),
    semibold: Platform.select({
      ios: 'System',
      android: 'Roboto-Medium',
      default: 'System',
    }),
    bold: Platform.select({
      ios: 'System',
      android: 'Roboto-Bold',
      default: 'System',
    }),
  },

  // Font weights
  fontWeight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },

  // Font sizes
  fontSize: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 28,
    '4xl': 32,
    '5xl': 36,
  },

  // Line heights
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
    loose: 2,
  },

  // Letter spacing
  letterSpacing: {
    tight: -0.5,
    normal: 0,
    wide: 0.5,
  },

  // Pre-defined text styles
  styles: {
    // Headings
    h1: {
      fontSize: 32,
      fontWeight: '700',
      lineHeight: 40,
      letterSpacing: -0.5,
    },
    h2: {
      fontSize: 28,
      fontWeight: '600',
      lineHeight: 36,
      letterSpacing: -0.25,
    },
    h3: {
      fontSize: 24,
      fontWeight: '600',
      lineHeight: 32,
      letterSpacing: 0,
    },
    h4: {
      fontSize: 20,
      fontWeight: '600',
      lineHeight: 28,
      letterSpacing: 0,
    },
    h5: {
      fontSize: 18,
      fontWeight: '600',
      lineHeight: 24,
      letterSpacing: 0,
    },
    h6: {
      fontSize: 16,
      fontWeight: '600',
      lineHeight: 20,
      letterSpacing: 0,
    },

    // Body text
    bodyLarge: {
      fontSize: 18,
      fontWeight: '400',
      lineHeight: 28,
      letterSpacing: 0,
    },
    bodyMedium: {
      fontSize: 16,
      fontWeight: '400',
      lineHeight: 24,
      letterSpacing: 0,
    },
    bodySmall: {
      fontSize: 14,
      fontWeight: '400',
      lineHeight: 20,
      letterSpacing: 0,
    },

    // Labels
    labelLarge: {
      fontSize: 16,
      fontWeight: '500',
      lineHeight: 20,
      letterSpacing: 0,
    },
    labelMedium: {
      fontSize: 14,
      fontWeight: '500',
      lineHeight: 18,
      letterSpacing: 0,
    },
    labelSmall: {
      fontSize: 12,
      fontWeight: '500',
      lineHeight: 16,
      letterSpacing: 0,
    },

    // Captions
    caption: {
      fontSize: 12,
      fontWeight: '400',
      lineHeight: 16,
      letterSpacing: 0,
    },
    captionBold: {
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 16,
      letterSpacing: 0,
    },

    // Buttons
    buttonLarge: {
      fontSize: 18,
      fontWeight: '600',
      lineHeight: 24,
      letterSpacing: 0,
    },
    buttonMedium: {
      fontSize: 16,
      fontWeight: '600',
      lineHeight: 20,
      letterSpacing: 0,
    },
    buttonSmall: {
      fontSize: 14,
      fontWeight: '600',
      lineHeight: 18,
      letterSpacing: 0,
    },

    // Special styles
    metric: {
      fontSize: 36,
      fontWeight: '700',
      lineHeight: 44,
      letterSpacing: -1,
    },
    metricLabel: {
      fontSize: 14,
      fontWeight: '500',
      lineHeight: 18,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
  },
};

export default typography;