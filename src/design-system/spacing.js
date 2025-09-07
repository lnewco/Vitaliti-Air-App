/**
 * Vitaliti Air Design System - Spacing
 * Consistent spacing system based on 4px grid
 */

const spacing = {
  // Base unit
  unit: 4,

  // T-shirt sizes
  xxxs: 2,
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,

  // Specific use cases
  screenPadding: 16,
  cardPadding: 20,
  sectionGap: 24,
  elementGap: 12,
  inputPadding: 16,
  buttonPadding: 16,
  iconSize: {
    small: 16,
    medium: 24,
    large: 32,
    xlarge: 48,
  },

  // Navigation specific
  tabBarHeight: 84,
  headerHeight: 96,
  floatingBarMargin: 16,

  // Border radius (matching Whoop's smooth corners)
  radius: {
    none: 0,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    full: 999,
    card: 16,
    button: 12,
    input: 12,
    chip: 999,
    sheet: 24,
  },

  // Hit slop for touchable elements
  hitSlop: {
    small: { top: 8, bottom: 8, left: 8, right: 8 },
    medium: { top: 12, bottom: 12, left: 12, right: 12 },
    large: { top: 16, bottom: 16, left: 16, right: 16 },
  },
};

export default spacing;