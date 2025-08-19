// Semantic color system for Vitaliti Air App
const colors = {
  // Primary brand colors
  primary: {
    50: '#EFF6FF',
    100: '#DBEAFE',
    200: '#BFDBFE',
    300: '#93C5FD',
    400: '#60A5FA',
    500: '#3B82F6', // Main brand blue
    600: '#2563EB',
    700: '#1D4ED8',
    800: '#1E40AF',
    900: '#1E3A8A',
  },

  // Secondary/accent colors
  secondary: {
    50: '#F0FDF4',
    100: '#DCFCE7',
    200: '#BBF7D0',
    300: '#86EFAC',
    400: '#4ADE80',
    500: '#22C55E', // Success green
    600: '#16A34A',
    700: '#15803D',
    800: '#166534',
    900: '#14532D',
  },

  // Success colors (alias for secondary)
  success: {
    50: '#F0FDF4',
    100: '#DCFCE7',
    200: '#BBF7D0',
    300: '#86EFAC',
    400: '#4ADE80',
    500: '#22C55E', // Success green
    600: '#16A34A',
    700: '#15803D',
    800: '#166534',
    900: '#14532D',
  },

  // Warning colors (for calibration, alerts)
  warning: {
    50: '#FFFBEB',
    100: '#FEF3C7',
    200: '#FDE68A',
    300: '#FCD34D',
    400: '#FBBF24',
    500: '#F59E0B', // Main warning
    600: '#D97706',
    700: '#B45309',
    800: '#92400E',
    900: '#78350F',
  },

  // Error/danger colors
  error: {
    50: '#FEF2F2',
    100: '#FEE2E2',
    200: '#FECACA',
    300: '#FCA5A5',
    400: '#F87171',
    500: '#EF4444', // Main error
    600: '#DC2626',
    700: '#B91C1C',
    800: '#991B1B',
    900: '#7F1D1D',
  },

  // Info colors (for informational messages)
  info: {
    50: '#EFF6FF',
    100: '#DBEAFE',
    200: '#BFDBFE',
    300: '#93C5FD',
    400: '#60A5FA',
    500: '#3B82F6', // Info blue
    600: '#2563EB',
    700: '#1D4ED8',
    800: '#1E40AF',
    900: '#1E3A8A',
  },

  // Neutral grays
  neutral: {
    0: '#FFFFFF',
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
    1000: '#000000',
  },

  // Surface colors
  surface: {
    background: '#F9FAFB',
    card: '#FFFFFF',
    modal: '#FFFFFF',
    overlay: 'rgba(0, 0, 0, 0.5)',
  },

  // Semantic colors for specific use cases
  semantic: {
    hypoxic: '#3B82F6',
    hyperoxic: '#22C55E',
    spo2: {
      safe: '#22C55E',
      warning: '#F59E0B',
      danger: '#EF4444',
    },
    heartRate: {
      low: '#3B82F6',
      normal: '#22C55E',
      elevated: '#F59E0B',
      high: '#EF4444',
    },
  },

  // Text colors
  text: {
    primary: '#1F2937',
    secondary: '#6B7280',
    tertiary: '#9CA3AF',
    inverse: '#FFFFFF',
    link: '#3B82F6',
    disabled: '#D1D5DB',
  },

  // Border colors
  border: {
    light: '#E5E7EB',
    medium: '#D1D5DB',
    dark: '#9CA3AF',
    focus: '#3B82F6',
  },
  
  // Base colors
  white: '#FFFFFF',
  black: '#000000',
};

// Dark theme colors
const darkColors = {
  ...colors,
  // Success colors remain the same in dark theme
  success: colors.success,
  // Override surface colors for dark theme
  surface: {
    background: '#111827',
    card: '#1F2937',
    modal: '#1F2937',
    overlay: 'rgba(0, 0, 0, 0.7)',
  },
  // Override text colors for dark theme
  text: {
    primary: '#F9FAFB',
    secondary: '#D1D5DB',
    tertiary: '#9CA3AF',
    inverse: '#1F2937',
    link: '#60A5FA',
    disabled: '#4B5563',
  },
  // Override border colors for dark theme
  border: {
    light: '#374151',
    medium: '#4B5563',
    dark: '#6B7280',
    focus: '#60A5FA',
  },
};

// Function to get theme-specific colors
export const getColors = (theme = 'light') => {
  return theme === 'dark' ? darkColors : colors;
};

export default colors;