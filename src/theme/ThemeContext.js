import React, { createContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getColors } from './colors';
import typography from './typography';
import spacing from './spacing';
import shadows from './shadows';
import responsive from './responsive';

const THEME_STORAGE_KEY = '@vitaliti_theme_preference';

// Don't provide a default value - this ensures useContext returns undefined
// if not wrapped in provider, which our useAppTheme hook will catch
export const AppThemeContext = createContext();

export const AppThemeProvider = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [themePreference, setThemePreference] = useState('system');
  const [isLoading, setIsLoading] = useState(true);

  // Load saved theme preference on mount
  useEffect(() => {
    loadThemePreference();
  }, []);

  const loadThemePreference = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
        setThemePreference(savedTheme);
      }
    } catch (error) {
      console.error('Error loading theme preference:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveThemePreference = async (theme) => {
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (error) {
      console.error('Error saving theme preference:', error);
    }
  };

  // Determine actual theme based on preference and system setting
  const activeTheme = useMemo(() => {
    if (themePreference === 'system') {
      return systemColorScheme || 'light';
    }
    return themePreference;
  }, [themePreference, systemColorScheme]);

  // Get theme-specific colors - ensure it's never undefined
  const colors = useMemo(() => {
    const themeColors = getColors(activeTheme);
    if (!themeColors) {
      throw new Error(`Failed to load colors for theme: ${activeTheme}`);
    }
    return themeColors;
  }, [activeTheme]);

  // Theme control functions - memoized for stability
  const setTheme = useCallback(async (newTheme) => {
    if (['light', 'dark', 'system'].includes(newTheme)) {
      setThemePreference(newTheme);
      await saveThemePreference(newTheme);
    }
  }, []);

  const toggleTheme = useCallback(async () => {
    const newTheme = activeTheme === 'light' ? 'dark' : 'light';
    setThemePreference(newTheme);
    await saveThemePreference(newTheme);
  }, [activeTheme]);

  // Create the context value with all theme properties
  // Ensure all values are always defined
  const value = useMemo(() => {
    // These imports are synchronous and always available at module load time
    const contextValue = {
      colors: colors,
      typography: typography,
      spacing: spacing,
      shadows: shadows,
      responsive: responsive,
      theme: activeTheme,
      isDark: activeTheme === 'dark',
      isLight: activeTheme === 'light',
      themePreference,
      setTheme,
      toggleTheme,
      isLoading,
    };
    
    // Validate the context value in development
    if (__DEV__) {
      if (!contextValue.colors) console.error('Colors missing in theme context');
      if (!contextValue.typography) console.error('Typography missing in theme context');
      if (!contextValue.spacing) console.error('Spacing missing in theme context');
      if (!contextValue.shadows) console.error('Shadows missing in theme context');
      if (!contextValue.responsive) console.error('Responsive missing in theme context');
    }
    
    return contextValue;
  }, [colors, activeTheme, themePreference, isLoading, setTheme, toggleTheme]);

  // Don't render children until we have a valid theme context
  if (!colors || !typography || !spacing || !shadows || !responsive) {
    console.error('Theme not ready:', { 
      colors: !!colors, 
      typography: !!typography, 
      spacing: !!spacing,
      shadows: !!shadows,
      responsive: !!responsive 
    });
    return null; // Don't render anything until theme is ready
  }

  return (
    <AppThemeContext.Provider value={value}>
      {children}
    </AppThemeContext.Provider>
  );
};