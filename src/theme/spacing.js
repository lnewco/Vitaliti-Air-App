// Consistent spacing scale based on 4px grid
const spacing = {
  // Base spacing units
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,

  // Component-specific spacing
  screenPadding: 20,
  cardPadding: 20,
  sectionGap: 30,
  
  // Input spacing
  inputPadding: {
    vertical: 12,
    horizontal: 16,
  },
  
  // Button spacing
  buttonPadding: {
    small: {
      vertical: 8,
      horizontal: 16,
    },
    medium: {
      vertical: 12,
      horizontal: 24,
    },
    large: {
      vertical: 16,
      horizontal: 32,
    },
  },

  // Border radius
  borderRadius: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    full: 9999,
  },

  // Icon sizes
  iconSize: {
    xs: 16,
    sm: 20,
    md: 24,
    lg: 32,
    xl: 40,
    xxl: 48,
  },

  // Common layout patterns
  layout: {
    headerHeight: 60,
    tabBarHeight: 56,
    cardGap: 16,
    listItemGap: 12,
  },
};

export default spacing;