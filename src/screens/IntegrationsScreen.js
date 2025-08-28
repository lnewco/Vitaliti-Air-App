import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, typography, spacing } from '../design-system';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../config/supabase';
import WhoopService from '../services/integrations/WhoopService';
import OuraService from '../services/integrations/OuraService';

const IntegrationsScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [connections, setConnections] = useState({
    whoop: false,
    oura: false,
  });
  const [lastSync, setLastSync] = useState({
    whoop: null,
    oura: null,
  });

  useEffect(() => {
    if (user?.id) {
      checkConnections();
      setupDeepLinkHandler();
    }
  }, [user]);

  // Setup deep link handler for OAuth callbacks
  const setupDeepLinkHandler = () => {
    // Handle initial URL if app was opened via deep link
    Linking.getInitialURL().then(handleDeepLink);
    
    // Handle deep links when app is already open
    const subscription = Linking.addEventListener('url', ({ url }) => handleDeepLink(url));
    
    return () => subscription.remove();
  };

  // Handle OAuth callback deep links
  const handleDeepLink = async (url) => {
    if (!url) return;

    console.log('📱 Received deep link:', url);
    console.log('📱 URL scheme:', url.split('://')[0]);
    console.log('📱 URL path:', url.split('://')[1]);

    try {
      // Parse the deep link URL - handles both formats:
      // 1. Direct: vitalitiair://whoop-callback?code=xxx
      // 2. Expo Auth: exp://...?code=xxx (or vitalitiair://?code=xxx)
      
      let code, state, vendor;
      
      // Check if it's an OAuth callback (has code parameter)
      // Handle multiple formats: 
      // 1. exp+vitaliti-air-app://expo-auth-session?code=xxx
      // 2. vitalitiair://oauth-callback?code=xxx  
      // 3. com.sophiafay24.vitalitiairapp://expo-auth-session?code=xxx
      // 4. vitaliti-air-app://expo-auth-session?code=xxx
      if (url.includes('code=') || url.includes('expo-auth-session')) {
        // Parse URL - handle special exp+ scheme and other formats
        let cleanUrl = url;
        if (url.startsWith('exp+')) {
          cleanUrl = url.replace('exp+vitaliti-air-app://', 'https://fake.com/');
        } else if (url.startsWith('com.sophiafay24.vitalitiairapp://')) {
          cleanUrl = url.replace('com.sophiafay24.vitalitiairapp://', 'https://fake.com/');
        } else if (url.startsWith('vitaliti-air-app://')) {
          cleanUrl = url.replace('vitaliti-air-app://', 'https://fake.com/');
        } else if (url.startsWith('vitalitiair://')) {
          cleanUrl = url.replace('vitalitiair://', 'https://fake.com/');
        }
        
        const urlObj = new URL(cleanUrl);
        code = urlObj.searchParams.get('code');
        state = urlObj.searchParams.get('state');
        
        // Determine vendor from state or stored value
        vendor = await AsyncStorage.getItem('pending_oauth_vendor');
        
        console.log('📱 OAuth callback received:', { 
          vendor, 
          code: code?.substring(0, 10) + '...', 
          state 
        });
      } else {
        console.log('Not an OAuth callback, ignoring');
        return;
      }

      if (vendor === 'whoop' && code) {
        console.log('🔗 Handling Whoop callback with state:', state);
        setSyncing(true);
        
        // Pass state for validation, handleCallback will extract userId from stored state
        const result = await WhoopService.handleCallback(code, state);
        
        // Use the current user's ID for initial sync
        await WhoopService.performInitialSync(user.id);
        
        Alert.alert('Success', 'Whoop connected successfully! Fetching your data...');
        await AsyncStorage.removeItem('pending_oauth_vendor');
        checkConnections();
      } else if (vendor === 'oura' && code) {
        console.log('💍 Handling Oura callback with state:', state);
        setSyncing(true);
        
        // Pass state for validation, handleCallback will extract userId from stored state
        const result = await OuraService.handleCallback(code, state);
        
        // Use the current user's ID for initial sync
        await OuraService.performInitialSync(user.id);
        
        Alert.alert('Success', 'Oura connected successfully! Fetching your data...');
        await AsyncStorage.removeItem('pending_oauth_vendor');
        checkConnections();
      }
    } catch (error) {
      console.error('Deep link handling error:', error);
      Alert.alert('Connection Error', 'Failed to complete authentication. Please try again.');
    } finally {
      setSyncing(false);
    }
  };

  const checkConnections = async () => {
    try {
      setLoading(true);
      
      // Check user profile for connection status
      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('whoop_connected, oura_connected')
        .eq('user_id', user.id)
        .single();

      // Check for recent sync data
      const { data: whoopData } = await supabase
        .from('whoop_data')
        .select('created_at, date')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);

      const { data: ouraData } = await supabase
        .from('oura_data')
        .select('created_at, date')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);

      setConnections({
        whoop: profileData?.whoop_connected || false,
        oura: profileData?.oura_connected || false,
      });

      setLastSync({
        whoop: whoopData?.[0]?.created_at || null,
        oura: ouraData?.[0]?.created_at || null,
      });

    } catch (error) {
      console.error('Error checking connections:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatLastSync = (syncTime) => {
    if (!syncTime) return 'Never synced';
    
    const date = new Date(syncTime);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
      return `${diffMins} minutes ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hours ago`;
    } else {
      return `${diffDays} days ago`;
    }
  };

  const handleConnect = async (vendor) => {
    try {
      let authUrl;
      
      // Store which vendor we're connecting (needed for Expo Auth Proxy)
      await AsyncStorage.setItem('pending_oauth_vendor', vendor.toLowerCase());
      
      if (vendor === 'Whoop') {
        authUrl = await WhoopService.getAuthUrl(user.id);
      } else if (vendor === 'Oura') {
        authUrl = await OuraService.getAuthUrl(user.id);
      }

      if (authUrl) {
        console.log(`🔗 Opening ${vendor} OAuth URL:`, authUrl);
        await Linking.openURL(authUrl);
      }
    } catch (error) {
      console.error(`Error connecting ${vendor}:`, error);
      Alert.alert('Connection Error', `Failed to connect to ${vendor}. Please try again.`);
    }
  };

  const handleDisconnect = async (vendor) => {
    Alert.alert(
      `Disconnect ${vendor}?`,
      'Your historical data will be preserved, but no new data will sync.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            try {
              setSyncing(true);
              
              if (vendor === 'Whoop') {
                await WhoopService.disconnect(user.id);
              } else if (vendor === 'Oura') {
                await OuraService.disconnect(user.id);
              }
              
              Alert.alert('Success', `${vendor} disconnected`);
              checkConnections();
            } catch (error) {
              Alert.alert('Error', `Failed to disconnect ${vendor}`);
            } finally {
              setSyncing(false);
            }
          },
        },
      ]
    );
  };

  const handleManualSync = async (vendor) => {
    try {
      setSyncing(true);
      
      if (vendor === 'Whoop') {
        await WhoopService.performDailySync(user.id);
      } else if (vendor === 'Oura') {
        await OuraService.performDailySync(user.id);
      }
      
      Alert.alert('Success', `${vendor} data synced successfully`);
      checkConnections();
    } catch (error) {
      console.error(`Error syncing ${vendor}:`, error);
      Alert.alert('Sync Error', `Failed to sync ${vendor} data. Please try again.`);
    } finally {
      setSyncing(false);
    }
  };

  const IntegrationCard = ({ vendor, icon, connected, lastSync }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.vendorInfo}>
          <Text style={styles.vendorIcon}>{icon}</Text>
          <View>
            <Text style={styles.vendorName}>{vendor}</Text>
            <Text style={styles.syncStatus}>
              {connected ? `Last sync: ${formatLastSync(lastSync)}` : 'Not connected'}
            </Text>
          </View>
        </View>
        <View style={[styles.statusBadge, connected ? styles.connectedBadge : styles.disconnectedBadge]}>
          <Text style={styles.statusText}>{connected ? 'Connected' : 'Not Connected'}</Text>
        </View>
      </View>
      
      <View style={styles.cardActions}>
        <TouchableOpacity
          style={[styles.actionButton, connected ? styles.disconnectButton : styles.connectButton]}
          onPress={() => connected ? handleDisconnect(vendor) : handleConnect(vendor)}
          disabled={syncing}
        >
          <Text style={[styles.actionButtonText, connected && styles.disconnectButtonText]}>
            {connected ? 'Disconnect' : 'Connect'}
          </Text>
        </TouchableOpacity>
        
        {connected && (
          <TouchableOpacity
            style={styles.syncButton}
            onPress={() => handleManualSync(vendor)}
            disabled={syncing}
          >
            {syncing ? (
              <ActivityIndicator size="small" color={colors.brand.accent} />
            ) : (
              <Text style={styles.syncButtonText}>Sync Now</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.brand.accent} />
          <Text style={styles.loadingText}>Checking connections...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Wearable Integrations</Text>
          <Text style={styles.subtitle}>
            Connect your fitness wearables to track your health metrics
          </Text>
        </View>

        <View style={styles.cardsContainer}>
          <IntegrationCard
            vendor="Whoop"
            icon="⌚"
            connected={connections.whoop}
            lastSync={lastSync.whoop}
          />
          
          <IntegrationCard
            vendor="Oura"
            icon="💍"
            connected={connections.oura}
            lastSync={lastSync.oura}
          />
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>How It Works</Text>
          <Text style={styles.infoText}>
            1. Tap "Connect" to authenticate with your wearable{'\n'}
            2. We'll fetch your last 30 days of data{'\n'}
            3. Data syncs automatically every morning{'\n'}
            4. Use "Sync Now" to manually update anytime
          </Text>
          
          <Text style={[styles.infoTitle, { marginTop: spacing.lg }]}>Data We Collect</Text>
          <Text style={styles.infoText}>
            • Sleep quality and duration{'\n'}
            • Recovery and readiness scores{'\n'}
            • Heart rate variability (HRV){'\n'}
            • Resting heart rate{'\n'}
            • Activity and strain levels
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...typography.bodyMedium,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  header: {
    padding: spacing.screenPadding,
    paddingTop: spacing.xl,
  },
  title: {
    ...typography.h2,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.bodyMedium,
    color: colors.text.secondary,
    lineHeight: 22,
  },
  cardsContainer: {
    padding: spacing.screenPadding,
    gap: spacing.lg,
  },
  card: {
    backgroundColor: colors.background.elevated,
    borderRadius: spacing.radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  vendorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vendorIcon: {
    fontSize: 32,
    marginRight: spacing.md,
  },
  vendorName: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.xxs,
  },
  syncStatus: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: spacing.radius.full,
  },
  connectedBadge: {
    backgroundColor: colors.metrics.breath + '20',
  },
  disconnectedBadge: {
    backgroundColor: colors.background.tertiary,
  },
  statusText: {
    ...typography.caption,
    fontWeight: '600',
  },
  cardActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: spacing.radius.md,
    alignItems: 'center',
  },
  connectButton: {
    backgroundColor: colors.brand.accent,
  },
  disconnectButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  actionButtonText: {
    ...typography.bodyMedium,
    color: colors.background.primary,
    fontWeight: '600',
  },
  disconnectButtonText: {
    color: colors.text.secondary,
  },
  syncButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: spacing.radius.md,
    borderWidth: 1,
    borderColor: colors.brand.accent,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
  },
  syncButtonText: {
    ...typography.bodyMedium,
    color: colors.brand.accent,
    fontWeight: '600',
  },
  infoSection: {
    padding: spacing.screenPadding,
    paddingTop: spacing.xl,
  },
  infoTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  infoText: {
    ...typography.bodyMedium,
    color: colors.text.secondary,
    lineHeight: 22,
  },
});

export default IntegrationsScreen;