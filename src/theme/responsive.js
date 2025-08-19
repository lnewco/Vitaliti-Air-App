import { Dimensions, PixelRatio, Platform } from 'react-native';

// Get device dimensions
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Base dimensions (iPhone 11 Pro)
const baseWidth = 375;
const baseHeight = 812;

// Responsive scaling utilities
const responsive = {
  // Device info
  screenWidth,
  screenHeight,
  isSmallDevice: screenHeight < 700,
  isMediumDevice: screenHeight >= 700 && screenHeight < 850,
  isLargeDevice: screenHeight >= 850,
  isTablet: screenWidth >= 768,
  
  // Platform specific
  isIOS: Platform.OS === 'ios',
  isAndroid: Platform.OS === 'android',
  
  // Pixel density
  pixelRatio: PixelRatio.get(),
  fontScale: PixelRatio.getFontScale(),
  
  // Scaling functions
  scale: (size) => (screenWidth / baseWidth) * size,
  verticalScale: (size) => (screenHeight / baseHeight) * size,
  moderateScale: (size, factor = 0.5) => size + ((screenWidth / baseWidth) * size - size) * factor,
  
  // Font scaling with accessibility support
  fontScale: (size) => size * PixelRatio.getFontScale(),
  
  // Percentage-based dimensions
  wp: (percentage) => (percentage * screenWidth) / 100,
  hp: (percentage) => (percentage * screenHeight) / 100,
  
  // Safe area helpers
  safeAreaPadding: {
    top: Platform.select({ ios: 44, android: 0 }),
    bottom: Platform.select({ ios: 34, android: 0 }),
  },
  
  // Breakpoints for responsive design
  breakpoints: {
    small: 375,
    medium: 414,
    large: 768,
    xlarge: 1024,
  },
  
  // Helper functions
  isBreakpoint: (breakpoint) => screenWidth >= responsive.breakpoints[breakpoint],
  
  // Responsive value selector
  select: (options) => {
    if (responsive.isTablet && options.tablet) return options.tablet;
    if (responsive.isLargeDevice && options.large) return options.large;
    if (responsive.isMediumDevice && options.medium) return options.medium;
    if (responsive.isSmallDevice && options.small) return options.small;
    return options.default || options.medium || options.small;
  },
  
  // Normalize sizes across devices
  normalize: (size) => {
    const scale = screenWidth / baseWidth;
    const newSize = size * scale;
    
    if (Platform.OS === 'ios') {
      return Math.round(PixelRatio.roundToNearestPixel(newSize));
    } else {
      return Math.round(PixelRatio.roundToNearestPixel(newSize)) - 2;
    }
  },
};

export default responsive;