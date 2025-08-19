import palette from './palette';

// Dark theme colors
const darkTheme = {
  // Surface colors - backgrounds and containers
  surface: {
    primary: palette.gray[900],
    secondary: palette.gray[800],
    tertiary: palette.gray[700],
    elevated: palette.gray[800],
    overlay: 'rgba(0, 0, 0, 0.7)',
    inverse: palette.white,
  },

  // Text colors
  text: {
    primary: palette.gray[50],
    secondary: palette.gray[300],
    tertiary: palette.gray[500],
    inverse: palette.gray[900],
    link: palette.blue[400],
    disabled: palette.gray[600],
    onPrimary: palette.white,
    onError: palette.white,
    onWarning: palette.gray[900],
    onSuccess: palette.white,
  },

  // Border colors
  border: {
    default: palette.gray[700],
    light: palette.gray[800],
    dark: palette.gray[600],
    focus: palette.blue[400],
    error: palette.red[400],
  },

  // Interactive colors - slightly adjusted for dark backgrounds
  primary: {
    50: palette.blue[950] || palette.blue[900],
    100: palette.blue[900],
    200: palette.blue[800],
    300: palette.blue[700],
    400: palette.blue[600],
    500: palette.blue[500],
    600: palette.blue[400],
    700: palette.blue[300],
    800: palette.blue[200],
    900: palette.blue[100],
  },

  // Secondary/accent colors
  secondary: {
    50: palette.gray[900],
    100: palette.gray[800],
    200: palette.gray[700],
    300: palette.gray[600],
    400: palette.gray[500],
    500: palette.gray[400],
    600: palette.gray[300],
    700: palette.gray[200],
    800: palette.gray[100],
    900: palette.gray[50],
  },

  // Status colors - adjusted for dark mode visibility
  error: {
    50: palette.red[950] || palette.red[900],
    100: palette.red[900],
    200: palette.red[800],
    300: palette.red[700],
    400: palette.red[600],
    500: palette.red[500],
    600: palette.red[400],
    700: palette.red[300],
    800: palette.red[200],
    900: palette.red[100],
  },

  warning: {
    50: palette.amber[950] || palette.amber[900],
    100: palette.amber[900],
    200: palette.amber[800],
    300: palette.amber[700],
    400: palette.amber[600],
    500: palette.amber[500],
    600: palette.amber[400],
    700: palette.amber[300],
    800: palette.amber[200],
    900: palette.amber[100],
  },

  success: {
    50: palette.green[950] || palette.green[900],
    100: palette.green[900],
    200: palette.green[800],
    300: palette.green[700],
    400: palette.green[600],
    500: palette.green[500],
    600: palette.green[400],
    700: palette.green[300],
    800: palette.green[200],
    900: palette.green[100],
  },

  info: {
    50: palette.blue[950] || palette.blue[900],
    100: palette.blue[900],
    200: palette.blue[800],
    300: palette.blue[700],
    400: palette.blue[600],
    500: palette.blue[500],
    600: palette.blue[400],
    700: palette.blue[300],
    800: palette.blue[200],
    900: palette.blue[100],
  },

  // Medical colors - consistent across themes for safety
  medical: {
    spo2: {
      safe: palette.green[500],
      warning: palette.amber[500],
      danger: palette.red[500],
    },
    heartRate: {
      low: palette.blue[500],
      normal: palette.green[500],
      elevated: palette.amber[500],
      high: palette.red[500],
    },
    hypoxic: palette.blue[500],
    hyperoxic: palette.green[500],
  },

  // Neutral colors for legacy support
  neutral: {
    0: palette.white,
    50: palette.gray[950],
    100: palette.gray[900],
    200: palette.gray[800],
    300: palette.gray[700],
    400: palette.gray[600],
    500: palette.gray[500],
    600: palette.gray[400],
    700: palette.gray[300],
    800: palette.gray[200],
    900: palette.gray[100],
    1000: palette.black,
  },

  // Special colors
  transparent: palette.transparent,
  white: palette.white,
  black: palette.black,
};

export default darkTheme;