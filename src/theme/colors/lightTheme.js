import palette from './palette';

// Light theme colors
const lightTheme = {
  // Surface colors - backgrounds and containers
  surface: {
    primary: palette.white,
    secondary: palette.gray[50],
    tertiary: palette.gray[100],
    elevated: palette.white,
    overlay: 'rgba(0, 0, 0, 0.5)',
    inverse: palette.gray[900],
  },

  // Text colors
  text: {
    primary: palette.gray[900],
    secondary: palette.gray[600],
    tertiary: palette.gray[400],
    inverse: palette.white,
    link: palette.blue[600],
    disabled: palette.gray[300],
    onPrimary: palette.white,
    onError: palette.white,
    onWarning: palette.gray[900],
    onSuccess: palette.white,
  },

  // Border colors
  border: {
    default: palette.gray[200],
    light: palette.gray[100],
    dark: palette.gray[400],
    focus: palette.blue[500],
    error: palette.red[500],
  },

  // Interactive colors - buttons, links, etc
  primary: {
    50: palette.blue[50],
    100: palette.blue[100],
    200: palette.blue[200],
    300: palette.blue[300],
    400: palette.blue[400],
    500: palette.blue[500],
    600: palette.blue[600],
    700: palette.blue[700],
    800: palette.blue[800],
    900: palette.blue[900],
  },

  // Secondary/accent colors
  secondary: {
    50: palette.gray[50],
    100: palette.gray[100],
    200: palette.gray[200],
    300: palette.gray[300],
    400: palette.gray[400],
    500: palette.gray[500],
    600: palette.gray[600],
    700: palette.gray[700],
    800: palette.gray[800],
    900: palette.gray[900],
  },

  // Status colors
  error: {
    50: palette.red[50],
    100: palette.red[100],
    200: palette.red[200],
    300: palette.red[300],
    400: palette.red[400],
    500: palette.red[500],
    600: palette.red[600],
    700: palette.red[700],
    800: palette.red[800],
    900: palette.red[900],
  },

  warning: {
    50: palette.amber[50],
    100: palette.amber[100],
    200: palette.amber[200],
    300: palette.amber[300],
    400: palette.amber[400],
    500: palette.amber[500],
    600: palette.amber[600],
    700: palette.amber[700],
    800: palette.amber[800],
    900: palette.amber[900],
  },

  success: {
    50: palette.green[50],
    100: palette.green[100],
    200: palette.green[200],
    300: palette.green[300],
    400: palette.green[400],
    500: palette.green[500],
    600: palette.green[600],
    700: palette.green[700],
    800: palette.green[800],
    900: palette.green[900],
  },

  info: {
    50: palette.blue[50],
    100: palette.blue[100],
    200: palette.blue[200],
    300: palette.blue[300],
    400: palette.blue[400],
    500: palette.blue[500],
    600: palette.blue[600],
    700: palette.blue[700],
    800: palette.blue[800],
    900: palette.blue[900],
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
  neutral: palette.gray,

  // Special colors
  transparent: palette.transparent,
  white: palette.white,
  black: palette.black,
};

export default lightTheme;