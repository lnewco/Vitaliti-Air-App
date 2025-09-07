/**
 * Vitaliti Air Design System - Colors
 * Premium dark theme inspired by Whoop's aesthetic
 */

const colors = {
  // Core backgrounds (OLED optimized)
  background: {
    primary: '#0C0E12',    // True black base
    secondary: '#13161B',  // Slightly elevated
    tertiary: '#1A1D23',   // Card backgrounds
    elevated: '#22262E',   // Modals, sheets
    overlay: 'rgba(0, 0, 0, 0.85)',
  },

  // Brand colors
  brand: {
    primary: '#FFFFFF',    // Vitaliti white logo
    accent: '#3B82F6',     // Premium blue for CTAs
    secondary: '#2563EB',  // Darker blue for pressed states
  },

  // Data visualization palette (Whoop-inspired)
  metrics: {
    recovery: '#4ECDC4',   // Teal - Recovery/Air Quality
    strain: '#FFB800',     // Gold - Activity/Sessions
    sleep: '#6C5CE7',      // Purple - Rest metrics
    spo2: '#00D2FF',       // Cyan - Oxygen saturation
    heartRate: '#FF6B9D',  // Pink - Heart metrics
    breath: '#4ADE80',     // Green - Breathing
  },

  // Semantic colors
  semantic: {
    success: '#4ADE80',
    warning: '#FFB800',
    error: '#FF6B6B',
    info: '#3B82F6',
  },

  // Text hierarchy
  text: {
    primary: 'rgba(255, 255, 255, 1.0)',
    secondary: 'rgba(255, 255, 255, 0.7)',
    tertiary: 'rgba(255, 255, 255, 0.45)',
    quaternary: 'rgba(255, 255, 255, 0.25)',
    inverse: '#0C0E12',
    brand: '#FFFFFF',
  },

  // Borders and dividers
  border: {
    subtle: 'rgba(255, 255, 255, 0.05)',
    light: 'rgba(255, 255, 255, 0.1)',
    medium: 'rgba(255, 255, 255, 0.15)',
    strong: 'rgba(255, 255, 255, 0.25)',
    focus: '#3B82F6',
  },

  // Component-specific colors
  components: {
    card: {
      background: '#1A1D23',
      border: 'rgba(255, 255, 255, 0.08)',
      hover: '#22262E',
    },
    button: {
      primary: {
        background: '#3B82F6',
        text: '#FFFFFF',
        pressed: '#2563EB',
        disabled: 'rgba(59, 130, 246, 0.3)',
      },
      secondary: {
        background: 'transparent',
        border: 'rgba(255, 255, 255, 0.2)',
        text: 'rgba(255, 255, 255, 0.9)',
        pressed: 'rgba(255, 255, 255, 0.05)',
      },
      ghost: {
        background: 'transparent',
        text: 'rgba(255, 255, 255, 0.7)',
        pressed: 'rgba(255, 255, 255, 0.05)',
      },
    },
    navigation: {
      background: 'rgba(12, 14, 18, 0.95)',
      blur: 'saturate(180%) blur(20px)',
      active: '#FFFFFF',
      inactive: 'rgba(255, 255, 255, 0.4)',
      badge: '#FF6B6B',
    },
    input: {
      background: 'rgba(255, 255, 255, 0.05)',
      border: 'rgba(255, 255, 255, 0.1)',
      focusBorder: '#3B82F6',
      placeholder: 'rgba(255, 255, 255, 0.3)',
      text: '#FFFFFF',
    },
  },

  // Gradients for depth and visual interest
  gradients: {
    cardOverlay: ['rgba(255, 255, 255, 0.03)', 'transparent'],
    dataViz: ['rgba(59, 130, 246, 0.3)', 'rgba(59, 130, 246, 0)'],
    success: ['rgba(74, 222, 128, 0.3)', 'rgba(74, 222, 128, 0)'],
    warning: ['rgba(255, 184, 0, 0.3)', 'rgba(255, 184, 0, 0)'],
  },

  // Shadows (subtle for dark theme)
  shadows: {
    small: '0 2px 4px rgba(0, 0, 0, 0.3)',
    medium: '0 4px 12px rgba(0, 0, 0, 0.4)',
    large: '0 8px 24px rgba(0, 0, 0, 0.5)',
    glow: {
      blue: '0 0 20px rgba(59, 130, 246, 0.3)',
      white: '0 0 20px rgba(255, 255, 255, 0.1)',
    },
  },
};

export default colors;