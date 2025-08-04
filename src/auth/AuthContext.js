import React, { createContext, useContext, useEffect, useState } from 'react';
import { AuthService } from './AuthService';

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
    console.log('🔐 AuthContext: useEffect triggered');
    console.log('🔐 AuthContext: authService instance:', authService);
    console.log('🔐 AuthContext: authService type:', typeof authService);
    console.log('🔐 AuthContext: authService methods:', authService ? Object.getOwnPropertyNames(Object.getPrototypeOf(authService)) : 'N/A');
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      console.log('🔐 AuthContext: Initializing authentication...');
      console.log('🔐 AuthContext: authService in initializeAuth:', authService);
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

      console.log('🔐 AuthContext: Auth initialized', currentUser ? 'with user' : 'without user');

      // Set up auth state change listener
      const unsubscribe = authService.onAuthStateChange((event, user) => {
        console.log('🔐 AuthContext: Auth state changed:', event, user?.id);
        setUser(user);
        setIsAuthenticated(!!user);
      });

      // Store unsubscribe function for cleanup
      return unsubscribe;
    } catch (error) {
      console.error('❌ AuthContext: Auth initialization failed:', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Send OTP to phone number
  const sendOTP = async (phoneNumber) => {
    try {
      console.log('📱 AuthContext: Sending OTP to:', phoneNumber);
      console.log('📱 AuthContext: authService available:', !!authService);
      console.log('📱 AuthContext: authService methods:', authService ? Object.getOwnPropertyNames(Object.getPrototypeOf(authService)) : 'N/A');
      
      if (!authService) {
        throw new Error('AuthService not available');
      }
      
      if (!authService.sendOTP) {
        throw new Error('sendOTP method not available on AuthService');
      }
      
      const result = await authService.sendOTP(phoneNumber);
      return result;
    } catch (error) {
      console.error('❌ AuthContext: Send OTP failed:', error.message);
      throw error;
    }
  };

  // Verify OTP and sign in
  const verifyOTP = async (phoneNumber, otpCode) => {
    try {
      console.log('🔑 AuthContext: Verifying OTP...');
      const result = await authService.verifyOTP(phoneNumber, otpCode);
      
      // Auth state will be updated automatically via onAuthStateChange listener
      console.log('✅ AuthContext: OTP verification successful');
      return result;
    } catch (error) {
      console.error('❌ AuthContext: OTP verification failed:', error.message);
      throw error;
    }
  };

  // Sign out user
  const signOut = async () => {
    try {
      console.log('🔐 AuthContext: Signing out...');
      await authService.signOut();
      
      // Auth state will be updated automatically via onAuthStateChange listener
      console.log('✅ AuthContext: Sign out successful');
    } catch (error) {
      console.error('❌ AuthContext: Sign out failed:', error.message);
      throw error;
    }
  };

  // Get user profile
  const getUserProfile = async () => {
    try {
      const profile = await authService.getUserProfile();
      return profile;
    } catch (error) {
      console.error('❌ AuthContext: Get user profile failed:', error.message);
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