import lightTheme from './lightTheme';
import darkTheme from './darkTheme';

// Get colors based on current theme
export const getColors = (theme = 'light') => {
  return theme === 'dark' ? darkTheme : lightTheme;
};

// Export individual themes for direct access if needed
export { lightTheme, darkTheme };

// Default export for backward compatibility during migration
export default lightTheme;