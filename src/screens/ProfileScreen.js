import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../auth/AuthContext';
import { CommonActions } from '@react-navigation/native';
import { supabase } from '../config/supabase';
import { useAppTheme } from '../theme';
import Container from '../components/base/Container';
import Button from '../components/base/Button';
import Card from '../components/base/Card';
import { H1, H2, Body, Caption } from '../components/base/Typography';
import SafeIcon from '../components/base/SafeIcon';

const ProfileScreen = ({ navigation }) => {
  const { user, signOut } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [userName, setUserName] = useState(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  // Fetch user profile data on mount
  useEffect(() => {
    fetchUserProfile();
  }, [user]);

  const fetchUserProfile = async () => {
    if (!user?.id) {
      setIsLoadingProfile(false);
      return;
    }

    try {
      setIsLoadingProfile(true);
      const { data, error } = await supabase
        .from('user_profiles')
        .select('full_name')
        .eq('user_id', user.id)
        .single();

      if (data && data.full_name) {
        setUserName(data.full_name);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    } finally {
      setIsLoadingProfile(false);
    }
  };

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

  const { colors, spacing, theme, toggleTheme, themePreference, setTheme } = useAppTheme();
  
  const styles = StyleSheet.create({
    header: {
      marginBottom: spacing.lg,
    },
    section: {
      marginBottom: spacing.lg,
    },
    userCard: {
      alignItems: 'center',
      paddingVertical: spacing.lg,
    },
    avatarContainer: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.surface.background,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    avatarText: {
      fontSize: 40,
    },
    userInfo: {
      alignItems: 'center',
    },
    themeRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing.sm,
    },
    themeOption: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    themeIcon: {
      marginRight: spacing.sm,
    },
    devSection: {
      borderWidth: 1,
      borderColor: colors.error[200],
      borderStyle: 'dashed',
      backgroundColor: colors.error[50],
      padding: spacing.md,
      borderRadius: spacing.borderRadius.lg,
    },
    appInfo: {
      alignItems: 'center',
      marginTop: spacing.xl,
      paddingBottom: spacing.xl,
    },
  });

  return (
    <Container scrollable>
      <View style={styles.header}>
        <H1>Profile</H1>
      </View>

      {/* User Info Section */}
      <Card style={styles.section}>
        <Card.Body>
          <View style={styles.userCard}>
            <View style={styles.avatarContainer}>
              <Caption style={{ fontSize: 40 }}>👤</Caption>
            </View>
            {isLoadingProfile ? (
              <ActivityIndicator size="small" color={colors.primary[500]} style={{ marginVertical: 10 }} />
            ) : (
              <View style={styles.userInfo}>
                {userName && (
                  <H2>{userName}</H2>
                )}
                <Caption color="secondary" style={{ marginTop: spacing.xs }}>Phone Number</Caption>
                <Body weight="semibold">{getUserIdentifier()}</Body>
                {user?.id && (
                  <Caption color="tertiary" style={{ marginTop: spacing.xs }}>ID: {user.id.substring(0, 8)}...</Caption>
                )}
              </View>
            )}
          </View>
        </Card.Body>
      </Card>

      {/* Appearance Settings */}
      <Card style={styles.section}>
        <Card.Header title="Appearance" />
        <Card.Body>
          <View style={styles.themeRow}>
            <View style={styles.themeOption}>
              <SafeIcon name={theme === 'dark' ? 'moon' : 'sun'} size={20} color={colors.text.primary} style={styles.themeIcon} />
              <Body>Dark Mode</Body>
            </View>
            <Switch
              value={theme === 'dark'}
              onValueChange={toggleTheme}
              trackColor={{ false: colors.border.light, true: colors.primary[500] }}
              thumbColor={colors.white}
            />
          </View>
          <Caption color="secondary" style={{ marginTop: spacing.xs }}>
            {themePreference === 'system' ? 'Following system preference' : `Using ${theme} theme`}
          </Caption>
        </Card.Body>
      </Card>

      {/* Integrations Section */}
      <View style={styles.section}>
        <Button
          title="⚡ Manage Integrations"
          variant="secondary"
          onPress={() => navigation.navigate('Integrations')}
          fullWidth
        />
      </View>

      {/* Actions Section */}
      <View style={styles.section}>
        <Button
          title="Log Out"
          variant="primary"
          onPress={handleLogout}
          loading={isLoggingOut}
          disabled={isLoggingOut}
          fullWidth
        />
      </View>

      {/* Developer Options Section */}
      <Card style={styles.section}>
        <Card.Body>
          <View style={styles.devSection}>
            <Body weight="semibold" color="error">Developer Options</Body>
            <Caption color="error" style={{ marginBottom: spacing.md }}>For testing purposes only</Caption>
            
            <Button
              title="Clear All Data & Start Fresh"
              variant="danger"
              onPress={handleClearAllData}
              loading={isClearing}
              disabled={isClearing}
              fullWidth
            />
            <Caption color="error" style={{ marginTop: spacing.xs, textAlign: 'center' }}>
              Reset to fresh install state
            </Caption>
          </View>
        </Card.Body>
      </Card>

      {/* App Info */}
      <View style={styles.appInfo}>
        <Body color="secondary">Vitaliti Air</Body>
        <Caption color="tertiary">Version 1.0.0</Caption>
      </View>
    </Container>
  );
};


export default ProfileScreen;