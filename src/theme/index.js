// Main theme export - single source of truth for all design tokens
import colors from './colors';
import typography from './typography';
import spacing from './spacing';
import shadows from './shadows';
import responsive from './responsive';

// Theme context and hook exports
export { AppThemeProvider, AppThemeContext } from './ThemeContext';
export { useAppTheme } from './useTheme';

// For backward compatibility during migration
const theme = {
  colors,
  typography,
  spacing,
  shadows,
  responsive,
};

// Export individual modules for convenience
export { colors, typography, spacing, shadows, responsive };

// Export default theme object
export default theme;