import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  StatusBar,
  Switch,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../auth/AuthContext';
import { colors, typography, spacing, PremiumCard, PremiumButton } from '../design-system';
import SafeIcon from '../components/base/SafeIcon';
import IntegrationCard from '../components/IntegrationCard';
import WhoopService from '../services/integrations/WhoopService';
import OuraService from '../services/integrations/OuraService';

const SettingsScreen = ({ navigation }) => {
  const { user, signOut } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [whoopConnected, setWhoopConnected] = useState(false);
  const [ouraConnected, setOuraConnected] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    console.log('🔧 SettingsScreen mounted');
    checkIntegrationStatus();
    // OAuth deep link handler is now global in AppNavigator
    
    // Poll for connection status changes when screen is focused
    const interval = setInterval(() => {
      checkIntegrationStatus();
    }, 2000); // Check every 2 seconds
    
    return () => clearInterval(interval);
  }, []);

  const checkIntegrationStatus = async () => {
    const whoopStatus = await WhoopService.isConnected();
    const ouraStatus = await OuraService.isConnected();
    setWhoopConnected(whoopStatus);
    setOuraConnected(ouraStatus);
  };

  // OAuth deep link handling is now done globally in AppNavigator
  // This ensures the handler is always active even when this screen unmounts

  const handleWhoopConnect = async () => {
    try {
      console.log('🔌 Attempting to connect WHOOP...');
      // Store which vendor we're connecting for callback handling
      await AsyncStorage.setItem('pending_oauth_vendor', 'whoop');
      
      const authUrl = await WhoopService.getAuthUrl(user?.id);
      if (authUrl) {
        console.log('🔗 Opening WHOOP OAuth URL:', authUrl);
        await Linking.openURL(authUrl);
      } else {
        console.error('❌ No auth URL generated for WHOOP');
        Alert.alert('Configuration Error', 'WHOOP integration is not properly configured.');
      }
    } catch (error) {
      console.error('❌ Error connecting WHOOP:', error);
      Alert.alert('Error', `Failed to connect to WHOOP: ${error.message}`);
    }
  };

  const handleOuraConnect = async () => {
    try {
      console.log('💍 Attempting to connect Oura...');
      // Store which vendor we're connecting for callback handling
      await AsyncStorage.setItem('pending_oauth_vendor', 'oura');
      
      const authUrl = await OuraService.getAuthUrl(user?.id);
      if (authUrl) {
        console.log('🔗 Opening Oura OAuth URL:', authUrl);
        await Linking.openURL(authUrl);
      } else {
        console.error('❌ No auth URL generated for Oura');
        Alert.alert('Configuration Error', 'Oura integration is not properly configured.');
      }
    } catch (error) {
      console.error('❌ Error connecting Oura:', error);
      Alert.alert('Error', `Failed to connect to Oura: ${error.message}`);
    }
  };

  const handleWhoopDisconnect = async () => {
    Alert.alert(
      'Disconnect WHOOP',
      'Are you sure you want to disconnect your WHOOP account?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            await WhoopService.disconnect(user?.id);
            setWhoopConnected(false);
          },
        },
      ]
    );
  };

  const handleOuraDisconnect = async () => {
    Alert.alert(
      'Disconnect Oura',
      'Are you sure you want to disconnect your Oura account?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            await OuraService.disconnect(user?.id);
            setOuraConnected(false);
          },
        },
      ]
    );
  };

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            setIsLoggingOut(true);
            try {
              await signOut();
            } catch (error) {
              console.error('Sign out error:', error);
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            } finally {
              setIsLoggingOut(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <LinearGradient
        colors={['#0C0E12', '#13161B', '#1A1D23']}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <SafeIcon name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Settings</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Integrations Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Integrations</Text>
            <Text style={styles.sectionSubtitle}>
              Connect your wearables to automatically sync health data
            </Text>
            
            <View style={styles.integrationsList}>
              <IntegrationCard
                name="WHOOP"
                icon="watch"
                connected={whoopConnected}
                onConnect={handleWhoopConnect}
                onDisconnect={handleWhoopDisconnect}
                description="Sync recovery, strain, and sleep data"
              />
              
              <IntegrationCard
                name="Oura Ring"
                icon="fitness"
                connected={ouraConnected}
                onConnect={handleOuraConnect}
                onDisconnect={handleOuraDisconnect}
                description="Sync readiness, activity, and sleep scores"
              />
            </View>
          </View>

          {/* App Settings Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>App Settings</Text>
            
            <PremiumCard style={styles.settingCard}>
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Notifications</Text>
                  <Text style={styles.settingDescription}>Session reminders and updates</Text>
                </View>
                <Switch
                  value={true}
                  trackColor={{ false: colors.background.secondary, true: colors.brand.accent }}
                  thumbColor={colors.text.primary}
                />
              </View>
            </PremiumCard>

            <PremiumCard style={styles.settingCard}>
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Auto-sync</Text>
                  <Text style={styles.settingDescription}>Automatically sync data when online</Text>
                </View>
                <Switch
                  value={true}
                  trackColor={{ false: colors.background.secondary, true: colors.brand.accent }}
                  thumbColor={colors.text.primary}
                />
              </View>
            </PremiumCard>
          </View>

          {/* Account Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account</Text>
            
            <TouchableOpacity style={styles.actionCard}>
              <SafeIcon name="person" size={20} color={colors.text.secondary} />
              <Text style={styles.actionText}>Edit Profile</Text>
              <SafeIcon name="chevron-forward" size={20} color={colors.text.tertiary} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionCard}>
              <SafeIcon name="lock-closed" size={20} color={colors.text.secondary} />
              <Text style={styles.actionText}>Privacy</Text>
              <SafeIcon name="chevron-forward" size={20} color={colors.text.tertiary} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionCard}>
              <SafeIcon name="help-circle" size={20} color={colors.text.secondary} />
              <Text style={styles.actionText}>Support</Text>
              <SafeIcon name="chevron-forward" size={20} color={colors.text.tertiary} />
            </TouchableOpacity>
          </View>

          {/* Sign Out Button */}
          <View style={styles.signOutSection}>
            <PremiumButton
              title={isLoggingOut ? 'Signing Out...' : 'Sign Out'}
              variant="secondary"
              onPress={handleSignOut}
              disabled={isLoggingOut}
              loading={isLoggingOut}
              style={styles.signOutButton}
            />
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
  },
  section: {
    marginTop: spacing.xl,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  integrationsList: {
    gap: spacing.md,
  },
  settingCard: {
    marginBottom: spacing.sm,
    padding: spacing.md,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    padding: spacing.md,
    borderRadius: 12,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  actionText: {
    flex: 1,
    fontSize: 16,
    color: colors.text.primary,
    marginLeft: spacing.md,
  },
  signOutSection: {
    marginTop: spacing.xxl,
    marginBottom: spacing.xl,
  },
  signOutButton: {
    borderColor: colors.semantic.error,
  },
});

export default SettingsScreen;