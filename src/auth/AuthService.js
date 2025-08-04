import { supabase } from '../config/supabase';

class AuthService {
  constructor() {
    this.currentUser = null;
    this.isInitialized = false;
    this.authStateChangeListeners = [];
  }

  // Initialize auth service and check for existing session
  async initialize() {
    try {
      console.log('🔐 Initializing AuthService...');
      
      // Get current session
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('❌ Error getting session:', error.message);
        return false;
      }

      this.currentUser = session?.user || null;
      this.isInitialized = true;

      console.log('🔐 Auth initialized:', this.currentUser ? 'User logged in' : 'No user');
      
      // Set up auth state change listener
      supabase.auth.onAuthStateChange((event, session) => {
        console.log('🔐 Auth state changed:', event, session?.user?.id);
        this.currentUser = session?.user || null;
        
        // Notify all listeners
        this.authStateChangeListeners.forEach(listener => {
          listener(event, session?.user || null);
        });
      });

      return true;
    } catch (error) {
      console.error('❌ Error initializing auth:', error.message);
      this.isInitialized = true; // Set as initialized even on error
      return false;
    }
  }

  // Send OTP to phone number
  async sendOTP(phoneNumber) {
    try {
      console.log('📱 Sending OTP to:', phoneNumber);

      // Clean and format phone number (should include country code)
      const cleanPhone = this.formatPhoneNumber(phoneNumber);
      
      const { data, error } = await supabase.auth.signInWithOtp({
        phone: cleanPhone,
        options: {
          // You can add custom data here if needed
          data: {
            app_name: 'Vitaliti Air'
          }
        }
      });

      if (error) {
        console.error('❌ Error sending OTP:', error.message);
        throw new Error(this.getReadableErrorMessage(error.message));
      }

      console.log('✅ OTP sent successfully');
      return { success: true, data };
    } catch (error) {
      console.error('❌ Send OTP failed:', error.message);
      throw error;
    }
  }

  // Verify OTP and sign in
  async verifyOTP(phoneNumber, otpCode) {
    try {
      console.log('🔑 Verifying OTP for:', phoneNumber);

      const cleanPhone = this.formatPhoneNumber(phoneNumber);
      
      const { data, error } = await supabase.auth.verifyOtp({
        phone: cleanPhone,
        token: otpCode,
        type: 'sms'
      });

      if (error) {
        console.error('❌ Error verifying OTP:', error.message);
        throw new Error(this.getReadableErrorMessage(error.message));
      }

      this.currentUser = data.user;
      console.log('✅ User signed in:', data.user.id);

      // Create user profile if needed
      await this.createUserProfileIfNeeded(data.user, phoneNumber);

      return { success: true, user: data.user, session: data.session };
    } catch (error) {
      console.error('❌ Verify OTP failed:', error.message);
      throw error;
    }
  }

  // Sign out user
  async signOut() {
    try {
      console.log('🔐 Signing out user...');
      
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('❌ Error signing out:', error.message);
        throw new Error('Failed to sign out');
      }

      this.currentUser = null;
      console.log('✅ User signed out successfully');
      return true;
    } catch (error) {
      console.error('❌ Sign out failed:', error.message);
      throw error;
    }
  }

  // Get current user
  getCurrentUser() {
    return this.currentUser;
  }

  // Check if user is authenticated
  isAuthenticated() {
    return !!this.currentUser;
  }

  // Add auth state change listener
  onAuthStateChange(callback) {
    this.authStateChangeListeners.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.authStateChangeListeners.indexOf(callback);
      if (index > -1) {
        this.authStateChangeListeners.splice(index, 1);
      }
    };
  }

  // Create user profile in our custom table
  async createUserProfileIfNeeded(user, phoneNumber) {
    try {
      // Check if profile already exists
      const { data: existingProfile, error: fetchError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id) // Fixed: use user_id instead of id
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 is "not found"
        console.error('❌ Error checking user profile:', fetchError.message);
        return;
      }

      if (existingProfile) {
        console.log('✅ User profile already exists');
        return;
      }

      // Don't create profile here - let onboarding flow handle it
      console.log('✅ User authenticated - profile creation will be handled by onboarding flow');
      
    } catch (error) {
      console.error('❌ Error in createUserProfileIfNeeded:', error.message);
    }
  }

  // Format phone number (basic implementation)
  formatPhoneNumber(phoneNumber) {
    // Remove all non-digit characters except +
    let cleaned = phoneNumber.replace(/[^\d+]/g, '');
    
    // Ensure it starts with +
    if (!cleaned.startsWith('+')) {
      // Default to US country code if no country code provided
      cleaned = '+1' + cleaned;
    }

    return cleaned;
  }

  // Convert Supabase error messages to user-friendly messages
  getReadableErrorMessage(errorMessage) {
    const errorMappings = {
      'Invalid login credentials': 'Invalid verification code. Please try again.',
      'Token has expired': 'Verification code has expired. Please request a new one.',
      'Too many requests': 'Too many attempts. Please wait before trying again.',
      'Invalid phone number': 'Please enter a valid phone number.',
      'SMS sending failed': 'Failed to send verification code. Please try again.',
    };

    // Check for exact matches
    for (const [key, value] of Object.entries(errorMappings)) {
      if (errorMessage.includes(key)) {
        return value;
      }
    }

    // Return original message if no mapping found
    return errorMessage;
  }

  // Check if service is ready
  isReady() {
    return this.isInitialized;
  }

  // Get user profile
  async getUserProfile() {
    if (!this.currentUser) {
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', this.currentUser.id)
        .single();

      if (error) {
        console.error('❌ Error fetching user profile:', error.message);
        return null;
      }

      return data;
    } catch (error) {
      console.error('❌ Error in getUserProfile:', error.message);
      return null;
    }
  }
}

// Create and export singleton instance
const authService = new AuthService();

// Export both the class and the singleton instance
export { AuthService };
export default authService; 