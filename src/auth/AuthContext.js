import React, { createContext, useContext, useEffect, useState } from 'react';
import { AuthService } from './AuthService';
import logger from '../utils/logger';

const log = logger.createModuleLogger('AuthContext');

// Create Auth Context
const AuthContext = createContext({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  signIn: async () => {},
  sendOTP: async () => {},
  verifyOTP: async () => {},
  signOut: async () => {},
  getUserProfile: async () => {},
});

// Create AuthService instance
const authService = new AuthService();

// Auth Provider Component
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Initialize auth service and check for existing session
  useEffect(() => {
    log.info('AuthContext: useEffect triggered');
    log.info('AuthContext: authService instance:', authService);
    log.info('AuthContext: authService type:', typeof authService);
    log.info('AuthContext: authService methods:', authService ? Object.getOwnPropertyNames(Object.getPrototypeOf(authService)) : 'N/A');
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      log.info('AuthContext: Initializing authentication...');
      log.info('AuthContext: authService in initializeAuth:', authService);
      setIsLoading(true);

      if (!authService) {
        throw new Error('AuthService instance not available');
      }

      // Initialize auth service
      await authService.initialize();

      // Get current user
      const currentUser = authService.getCurrentUser();
      setUser(currentUser);
      setIsAuthenticated(!!currentUser);

      log.info('AuthContext: Auth initialized', currentUser ? 'with user' : 'without user');

      // Set up auth state change listener
      const unsubscribe = authService.onAuthStateChange((event, user) => {
        log.info('AuthContext: Auth state changed:', event, user?.id);
        setUser(user);
        setIsAuthenticated(!!user);
      });

      // Store unsubscribe function for cleanup
      return unsubscribe;
    } catch (error) {
      log.error('❌ AuthContext: Auth initialization failed:', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Send OTP to phone number
  const sendOTP = async (phoneNumber) => {
    try {
      log.info('AuthContext: Sending OTP to:', phoneNumber);
      log.info('AuthContext: authService available:', !!authService);
      log.info('AuthContext: authService methods:', authService ? Object.getOwnPropertyNames(Object.getPrototypeOf(authService)) : 'N/A');
      
      if (!authService) {
        throw new Error('AuthService not available');
      }
      
      if (!authService.sendOTP) {
        throw new Error('sendOTP method not available on AuthService');
      }
      
      const result = await authService.sendOTP(phoneNumber);
      return result;
    } catch (error) {
      log.error('❌ AuthContext: Send OTP failed:', error.message);
      throw error;
    }
  };

  // Verify OTP and sign in
  const verifyOTP = async (phoneNumber, otpCode) => {
    try {
      log.info('✅ AuthContext: Verifying OTP...');
      log.info('Phone number:', phoneNumber);
      log.info('OTP code length:', otpCode?.length);
      
      const result = await authService.verifyOTP(phoneNumber, otpCode);
      
      // Auth state will be updated automatically via onAuthStateChange listener
      log.info('✅ AuthContext: OTP verification successful');
      return result;
    } catch (error) {
      log.error('❌ AuthContext: OTP verification failed:', error.message);
      throw error;
    }
  };

  // Sign out user
  const signOut = async () => {
    try {
      log.info('AuthContext: Signing out...');
      await authService.signOut();
      
      // Auth state will be updated automatically via onAuthStateChange listener
      log.info('AuthContext: Sign out successful');
    } catch (error) {
      log.error('❌ AuthContext: Sign out failed:', error.message);
      throw error;
    }
  };

  // Get user profile
  const getUserProfile = async () => {
    try {
      const profile = await authService.getUserProfile();
      return profile;
    } catch (error) {
      log.error('❌ AuthContext: Get user profile failed:', error.message);
      throw error;
    }
  };

  // Generic sign in method (for future compatibility)
  const signIn = async (phoneNumber, otpCode) => {
    return await verifyOTP(phoneNumber, otpCode);
  };

  const contextValue = {
    // State
    user,
    isAuthenticated,
    isLoading,

    // Methods
    signIn,
    sendOTP,
    verifyOTP,
    signOut,
    getUserProfile,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use Auth Context
export const useAuth = () => {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
};

// Export context for direct access if needed
export default AuthContext; 