import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StatusBar,
  Dimensions,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  FadeInDown,
  useAnimatedScrollHandler,
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CommonActions } from '@react-navigation/native';
import { supabase } from '../config/supabase';
import { useAuth } from '../auth/AuthContext';
import { colors, typography, spacing, PremiumCard, PremiumButton } from '../design-system';

const { width: screenWidth } = Dimensions.get('window');

const PremiumProfileScreen = ({ navigation }) => {
  const { user, signOut } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [userName, setUserName] = useState(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [userStats, setUserStats] = useState({
    sessionsCompleted: 0,
    totalMinutes: 0,
    streak: 0,
  });
  const scrollY = useSharedValue(0);

  useEffect(() => {
    fetchUserProfile();
    fetchUserStats();
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

      if (data?.full_name) {
        setUserName(data.full_name);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const fetchUserStats = async () => {
    // Mock stats for now
    setUserStats({
      sessionsCompleted: 42,
      totalMinutes: 1260,
      streak: 7,
    });
  };

  const formatPhoneNumber = (phone) => {
    if (!phone) return 'Unknown';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    } else if (cleaned.length === 10) {
      return `+1 (${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  const getUserIdentifier = () => {
    if (user?.phone) return formatPhoneNumber(user.phone);
    if (user?.email) return user.email;
    return 'Unknown User';
  };

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const headerAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [0, 100],
      [1, 0],
      Extrapolate.CLAMP
    );
    return { opacity };
  });

  const handleLogout = () => {
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
              await signOut();
              // The auth state change will automatically trigger navigation
              // AppNavigator handles the navigation based on auth state
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

  const profileActions = [
    { id: 'integrations', title: 'Integrations', icon: '⚡', onPress: () => navigation.navigate('Integrations') },
    { id: 'history', title: 'Session History', icon: '📊', onPress: () => navigation.navigate('SessionHistory') },
    { id: 'settings', title: 'Settings', icon: '⚙️', onPress: () => {} },
    { id: 'support', title: 'Support', icon: '💬', onPress: () => {} },
    { id: 'about', title: 'About', icon: 'ℹ️', onPress: () => {} },
  ];

  const renderHeader = () => (
    <Animated.View style={[styles.header, headerAnimatedStyle]}>
      <View style={styles.headerTop}>
        <Image
          source={require('../../assets/IMG_4490.png')}
          style={styles.logoImage}
          resizeMode="contain"
        />
        <TouchableOpacity style={styles.settingsButton}>
          <Text style={styles.settingsIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.screenTitle}>Profile</Text>
    </Animated.View>
  );

  const renderUserCard = () => (
    <Animated.View entering={FadeInDown.duration(600).springify()}>
      <PremiumCard style={styles.userCard} gradient>
        <LinearGradient
          colors={[colors.brand.accent + '20', 'transparent']}
          style={styles.avatarBackground}
        />
        
        <View style={styles.avatarContainer}>
          <LinearGradient
            colors={[colors.brand.accent, colors.brand.secondary]}
            style={styles.avatarGradient}
          >
            <Text style={styles.avatarText}>
              {userName ? userName.charAt(0).toUpperCase() : '👤'}
            </Text>
          </LinearGradient>
        </View>

        <View style={styles.userInfo}>
          {isLoadingProfile ? (
            <ActivityIndicator color={colors.brand.accent} />
          ) : (
            <>
              <Text style={styles.userName}>{userName || 'Vitaliti User'}</Text>
              <Text style={styles.userPhone}>{getUserIdentifier()}</Text>
            </>
          )}
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{userStats.sessionsCompleted}</Text>
            <Text style={styles.statLabel}>Sessions</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{Math.floor(userStats.totalMinutes / 60)}h</Text>
            <Text style={styles.statLabel}>Total Time</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{userStats.streak}</Text>
            <Text style={styles.statLabel}>Day Streak</Text>
          </View>
        </View>
      </PremiumCard>
    </Animated.View>
  );

  const renderActions = () => (
    <Animated.View entering={FadeInDown.duration(600).delay(200).springify()}>
      <View style={styles.actionsSection}>
        {profileActions.map((action, index) => (
          <TouchableOpacity
            key={action.id}
            onPress={action.onPress}
            activeOpacity={0.7}
          >
            <PremiumCard style={styles.actionCard}>
              <View style={styles.actionContent}>
                <View style={styles.actionLeft}>
                  <Text style={styles.actionIcon}>{action.icon}</Text>
                  <Text style={styles.actionTitle}>{action.title}</Text>
                </View>
                <Text style={styles.actionArrow}>›</Text>
              </View>
            </PremiumCard>
          </TouchableOpacity>
        ))}
      </View>
    </Animated.View>
  );

  const renderLogoutSection = () => (
    <Animated.View entering={FadeInDown.duration(600).delay(400).springify()}>
      <View style={styles.logoutSection}>
        <PremiumButton
          title="Log Out"
          onPress={handleLogout}
          loading={isLoggingOut}
          variant="secondary"
          style={styles.logoutButton}
        />
      </View>
    </Animated.View>
  );

  const renderFooter = () => (
    <View style={styles.footer}>
      <Text style={styles.footerText}>Vitaliti Air</Text>
      <Text style={styles.footerVersion}>Version 1.0.0</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background.primary} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <Animated.ScrollView
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.headerSpacer} />
          {renderUserCard()}
          {renderActions()}
          {renderLogoutSection()}
          {renderFooter()}
        </Animated.ScrollView>
        {renderHeader()}
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  header: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: spacing.lg,
    zIndex: 10,
  },
  headerSpacer: {
    height: 140,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  logoImage: {
    width: 120,
    height: 36,
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsIcon: {
    fontSize: 20,
  },
  screenTitle: {
    ...typography.h1,
    color: colors.text.primary,
  },
  userCard: {
    marginHorizontal: spacing.screenPadding,
    marginBottom: spacing.xl,
    alignItems: 'center',
    paddingVertical: spacing.xl,
    overflow: 'hidden',
  },
  avatarBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 150,
  },
  avatarContainer: {
    marginBottom: spacing.md,
  },
  avatarGradient: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 42,
    color: colors.text.primary,
    fontWeight: '600',
  },
  userInfo: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  userName: {
    ...typography.h2,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  userPhone: {
    ...typography.bodyMedium,
    color: colors.text.secondary,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: spacing.md,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    ...typography.h2,
    color: colors.brand.accent,
    marginBottom: spacing.xxs,
  },
  statLabel: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.border.light,
  },
  actionsSection: {
    paddingHorizontal: spacing.screenPadding,
    marginBottom: spacing.xl,
  },
  actionCard: {
    marginBottom: spacing.sm,
  },
  actionContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionIcon: {
    fontSize: 20,
    marginRight: spacing.md,
  },
  actionTitle: {
    ...typography.bodyLarge,
    color: colors.text.primary,
  },
  actionArrow: {
    fontSize: 24,
    color: colors.text.tertiary,
  },
  logoutSection: {
    paddingHorizontal: spacing.screenPadding,
    marginBottom: spacing.xl,
  },
  logoutButton: {
    backgroundColor: colors.background.tertiary,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  footerText: {
    ...typography.bodyMedium,
    color: colors.text.tertiary,
    marginBottom: spacing.xxs,
  },
  footerVersion: {
    ...typography.caption,
    color: colors.text.quaternary,
  },
});

export default PremiumProfileScreen;