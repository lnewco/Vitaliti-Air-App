import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../auth/AuthContext';
import { CommonActions } from '@react-navigation/native';

const ProfileScreen = ({ navigation }) => {
  const { user, signOut } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  // Format phone number for display
  const formatPhoneNumber = (phone) => {
    if (!phone) return 'Unknown';
    // Remove any non-digits
    const cleaned = phone.replace(/\D/g, '');
    // Format as (XXX) XXX-XXXX
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    } else if (cleaned.length === 10) {
      return `+1 (${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone; // Return as-is if format doesn't match
  };

  const handleLogout = async () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoggingOut(true);
              
              // Call signOut from auth context
              await signOut();
              
              // Clear navigation state and go to Welcome
              navigation.dispatch(
                CommonActions.reset({
                  index: 0,
                  routes: [
                    { name: 'Onboarding', params: { screen: 'Welcome' } },
                  ],
                })
              );
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert('Error', 'Failed to log out. Please try again.');
            } finally {
              setIsLoggingOut(false);
            }
          },
        },
      ],
    );
  };

  const handleClearAllData = async () => {
    Alert.alert(
      '⚠️ Clear All Data',
      'This will reset the app to a fresh install state. You will need to complete onboarding again. Are you sure?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Clear Everything',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsClearing(true);
              
              // Clear ALL AsyncStorage
              await AsyncStorage.clear();
              console.log('🗑️ All AsyncStorage data cleared');
              
              // Sign out from auth
              await signOut();
              
              // Reset navigation to Welcome screen
              navigation.dispatch(
                CommonActions.reset({
                  index: 0,
                  routes: [
                    { name: 'Onboarding', params: { screen: 'Welcome' } },
                  ],
                })
              );
            } catch (error) {
              console.error('Clear data error:', error);
              Alert.alert('Error', 'Failed to clear data. Please try again.');
            } finally {
              setIsClearing(false);
            }
          },
        },
      ],
    );
  };

  const getUserIdentifier = () => {
    // Try to get phone from user object
    if (user?.phone) return formatPhoneNumber(user.phone);
    if (user?.email) return user.email;
    if (user?.id) return `User ID: ${user.id.substring(0, 8)}...`;
    return 'Unknown User';
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
        </View>

        {/* User Info Section */}
        <View style={styles.section}>
          <View style={styles.userCard}>
            <View style={styles.avatarContainer}>
              <Text style={styles.avatarText}>👤</Text>
            </View>
            <Text style={styles.userLabel}>Logged in as:</Text>
            <Text style={styles.userPhone}>{getUserIdentifier()}</Text>
            {user?.id && (
              <Text style={styles.userId}>ID: {user.id.substring(0, 8)}...</Text>
            )}
          </View>
        </View>

        {/* Actions Section */}
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.button, styles.logoutButton]}
            onPress={handleLogout}
            disabled={isLoggingOut}
          >
            {isLoggingOut ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Log Out</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Developer Options Section */}
        <View style={styles.section}>
          <View style={styles.devSection}>
            <Text style={styles.devTitle}>Developer Options</Text>
            <Text style={styles.devSubtitle}>For testing purposes only</Text>
            
            <TouchableOpacity
              style={[styles.button, styles.clearButton]}
              onPress={handleClearAllData}
              disabled={isClearing}
            >
              {isClearing ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.clearButtonText}>Clear All Data & Start Fresh</Text>
                  <Text style={styles.clearButtonSubtext}>Reset to fresh install state</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={styles.appInfoText}>Vitaliti Air</Text>
          <Text style={styles.appInfoSubtext}>Version 1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  scrollContent: {
    paddingBottom: 30,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  section: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  userCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 40,
  },
  userLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  userPhone: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  userId: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  button: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutButton: {
    backgroundColor: '#3B82F6',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  devSection: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    borderStyle: 'dashed',
  },
  devTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#DC2626',
    marginBottom: 4,
  },
  devSubtitle: {
    fontSize: 14,
    color: '#F87171',
    marginBottom: 16,
  },
  clearButton: {
    backgroundColor: '#EF4444',
  },
  clearButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  clearButtonSubtext: {
    color: '#FEE2E2',
    fontSize: 12,
    marginTop: 4,
  },
  appInfo: {
    alignItems: 'center',
    marginTop: 40,
    paddingHorizontal: 20,
  },
  appInfoText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  appInfoSubtext: {
    fontSize: 12,
    color: '#D1D5DB',
    marginTop: 4,
  },
});

export default ProfileScreen;