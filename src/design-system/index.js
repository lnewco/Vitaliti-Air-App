/**
 * Vitaliti Air Design System
 * Central export for all design system components and tokens
 */

// Design tokens
export { default as colors } from './colors';
export { default as typography } from './typography';
export { default as spacing } from './spacing';

// Core components
export { default as MetricRing } from './components/MetricRing';
export { default as PremiumCard } from './components/PremiumCard';
export { default as PremiumButton } from './components/PremiumButton';

// Animation presets
export const animations = {
  spring: {
    default: {
      damping: 15,
      stiffness: 150,
    },
    bouncy: {
      damping: 10,
      stiffness: 100,
    },
    stiff: {
      damping: 20,
      stiffness: 300,
    },
  },
  timing: {
    fast: 200,
    medium: 300,
    slow: 500,
  },
};

// Haptic feedback presets
export const haptics = {
  light: 'impactLight',
  medium: 'impactMedium',
  heavy: 'impactHeavy',
  success: 'notificationSuccess',
  warning: 'notificationWarning',
  error: 'notificationError',
  selection: 'selection',
};