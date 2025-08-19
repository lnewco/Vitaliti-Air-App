import { useContext } from 'react';
import { AppThemeContext } from './ThemeContext';

export const useAppTheme = () => {
  const context = useContext(AppThemeContext);
  
  if (!context) {
    throw new Error('useAppTheme must be used within AppThemeProvider');
  }
  
  return context;
};

export default useAppTheme;