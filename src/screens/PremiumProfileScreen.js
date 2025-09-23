import React, { useState, useEffect, useCallback } from 'react';
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
  RefreshControl,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Animated } from 'react-native';
import {
  FadeInDown,
  useAnimatedScrollHandler,
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolate,
  AnimatedAPI,
  isExpoGo
} from '../utils/animationHelpers';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CommonActions, useFocusEffect } from '@react-navigation/native';
import { supabase } from '../config/supabase';
import { useAuth } from '../auth/AuthContext';
import { colors, typography, spacing, PremiumCard, PremiumButton } from '../design-system';
import DatabaseService from '../services/DatabaseService';
import SupabaseService from '../services/SupabaseService';
import SessionDetailsModal from '../components/common/SessionDetailsModal';

const { width: screenWidth } = Dimensions.get('window');

const PremiumProfileScreen = ({ navigation, route }) => {
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
  
  // Session history states
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [sessionData, setSessionData] = useState(null);

  useEffect(() => {
    fetchUserProfile();
    fetchUserStats();
  }, [user]);
  
  // Load sessions on focus
  useFocusEffect(
    useCallback(() => {
      loadSessions();
    }, [])
  );

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
    try {
      // Initialize database first
      await DatabaseService.init();
      
      // Get real stats from database
      const allSessions = await DatabaseService.getAllSessions();
      const completedSessions = allSessions.filter(s => s.status === 'completed');
      
      // Calculate total minutes from completed sessions
      const totalSeconds = completedSessions.reduce((total, session) => {
        if (session.duration && typeof session.duration === 'string') {
          const parts = session.duration.split(':').map(p => parseInt(p, 10));
          if (parts.length === 3) {
            return total + (parts[0] * 3600 + parts[1] * 60 + parts[2]);
          }
        }
        return total;
      }, 0);
      
      setUserStats({
        sessionsCompleted: completedSessions.length,
        totalMinutes: Math.floor(totalSeconds / 60),
        streak: calculateStreak(completedSessions),
      });
    } catch (error) {
      console.error('Error fetching user stats:', error);
      // Use default values on error
      setUserStats({
        sessionsCompleted: 0,
        totalMinutes: 0,
        streak: 0,
      });
    }
  };
  
  const calculateStreak = (sessions) => {
    if (!sessions || sessions.length === 0) return 0;
    
    // Sort sessions by date (newest first)
    const sortedSessions = sessions.sort((a, b) => 
      new Date(b.start_time) - new Date(a.start_time)
    );
    
    let streak = 0;
    let currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    
    for (const session of sortedSessions) {
      const sessionDate = new Date(session.start_time);
      sessionDate.setHours(0, 0, 0, 0);
      
      const dayDiff = Math.floor((currentDate - sessionDate) / (1000 * 60 * 60 * 24));
      
      if (dayDiff <= streak) {
        streak = Math.max(streak, dayDiff + 1);
      } else {
        break;
      }
    }
    
    return streak;
  };
  
  const createTestSession = async () => {
    try {
      console.log('🧪 Creating test session...');
      const testId = await DatabaseService.createTestSession();
      if (testId) {
        console.log('✅ Test session created successfully');
        // Reload sessions
        loadSessions();
      }
    } catch (error) {
      console.error('❌ Failed to create test session:', error);
    }
  };
  
  const loadSessions = async () => {
    try {
      setLoading(true);
      console.log('🔄 Starting to load sessions...');
      
      // Initialize database first
      await DatabaseService.init();
      
      // Try to sync from Supabase but don't fail if it doesn't work
      try {
        console.log('🔄 Attempting to sync sessions from Supabase...');
        const syncResult = await SupabaseService.syncSessionsToLocalDatabase();
        if (syncResult.success && syncResult.count > 0) {
          console.log(`✅ Synced ${syncResult.count} sessions from Supabase`);
        } else if (!syncResult.success) {
          console.log('⚠️ Sync failed but continuing with local data:', syncResult.error);
        }
      } catch (syncError) {
        console.log('⚠️ Could not sync from Supabase, using local data only:', syncError.message);
      }
      
      // Always try to fetch sessions from local database regardless of sync result
      const localSessions = await DatabaseService.getAllSessions();
      console.log('📊 Loaded sessions from database:', localSessions?.length || 0, 'sessions');
      
      if (localSessions && localSessions.length > 0) {
        // Sort by date (newest first) - handle both timestamp formats
        const sortedSessions = localSessions.sort((a, b) => {
          // Convert timestamps to milliseconds if needed
          const getTime = (session) => {
            const time = session.start_time || session.created_at;
            // If it's a Unix timestamp in seconds, convert to milliseconds
            if (time && time < 10000000000) {
              return time * 1000;
            }
            return time || 0;
          };
          
          const dateA = getTime(a);
          const dateB = getTime(b);
          return dateB - dateA;
        });
        
        setSessions(sortedSessions);
        console.log('✅ Sessions set in state:', sortedSessions.length);
        console.log('📝 First session in list:', sortedSessions[0]);
      } else {
        setSessions([]);
        console.log('ℹ️ No sessions found in database');
      }
      
      // Also update stats when loading sessions
      fetchUserStats();
      
    } catch (error) {
      console.error('❌ Failed to load sessions:', error);
      setSessions([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  
  const loadSessionDetails = async (sessionId) => {
    try {
      setModalVisible(true);
      const sessionData = await DatabaseService.getSessionWithData(sessionId);
      
      if (sessionData) {
        setSessionData(sessionData);
      } else {
        if (modalVisible) {
          setModalVisible(false);
          Alert.alert('Error', 'Session data not found');
        }
      }
    } catch (error) {
      console.error('Failed to load session details:', error);
      if (modalVisible) {
        Alert.alert('Error', 'Failed to load session details');
      }
    }
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

  // Profile actions moved to Settings screen

  const renderHeader = () => (
    <AnimatedAPI.View style={[styles.header, headerAnimatedStyle]}>
      <View style={styles.headerTop}>
        <Image
          source={require('../../assets/IMG_4490.png')}
          style={styles.logoImage}
          resizeMode="contain"
        />
        <TouchableOpacity 
          style={styles.settingsButton}
          onPress={() => navigation.navigate('Settings')}
        >
          <Text style={styles.settingsIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.screenTitle}>Profile</Text>
    </AnimatedAPI.View>
  );

  const renderUserCard = () => (
    <AnimatedAPI.View style={isExpoGo ? {} : { opacity: 1 }}>
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
              <Text style={styles.userEmail}>{getUserIdentifier()}</Text>
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
    </AnimatedAPI.View>
  );

  // Actions section removed - moved to Settings screen

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Unknown Date';
    
    // Convert Unix timestamp in seconds to milliseconds if needed
    let dateValue = timestamp;
    if (timestamp < 10000000000) {
      dateValue = timestamp * 1000;
    }
    
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }
    
    // Format: 8/28/2025 2:16 PM
    return date.toLocaleDateString('en-US', {
      month: 'numeric',
      day: 'numeric', 
      year: 'numeric'
    }) + ' ' + date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDuration = (duration) => {
    if (!duration && duration !== 0) return '0:00';
    
    // Handle different duration formats
    if (typeof duration === 'number') {
      // If it's seconds as a number
      const mins = Math.floor(duration / 60);
      const secs = duration % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    } else if (typeof duration === 'string') {
      // If it's already formatted as string (HH:MM:SS or MM:SS)
      const parts = duration.split(':');
      if (parts.length === 3) {
        // HH:MM:SS format - convert to MM:SS
        const hours = parseInt(parts[0], 10) || 0;
        const mins = parseInt(parts[1], 10) || 0;
        const secs = parseInt(parts[2], 10) || 0;
        const totalMins = (hours * 60) + mins;
        return `${totalMins}:${secs.toString().padStart(2, '0')}`;
      } else if (parts.length === 2) {
        // Already MM:SS format
        return duration;
      }
      // Try to parse as number if no colons
      const seconds = parseInt(duration);
      if (!isNaN(seconds)) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
      }
    }
    return '0:00';
  };

  const renderSessionItem = (session) => (
    <TouchableOpacity
      key={session.id}
      onPress={() => loadSessionDetails(session.id)}
      activeOpacity={0.7}
    >
      <View style={styles.sessionItem}>
        <View style={styles.sessionHeader}>
          <Text style={styles.sessionDate}>{formatDate(session.start_time)}</Text>
          <View style={[styles.statusBadge, { backgroundColor: session.status === 'completed' ? colors.semantic.success : session.status === 'active' ? colors.semantic.warning : colors.semantic.error }]}>
            <Text style={styles.statusText}>{session.status === 'active' ? 'ACTIVE' : session.status === 'completed' ? 'COMPLETED' : session.status?.toUpperCase() || 'IN PROGRESS'}</Text>
          </View>
        </View>
        <View style={styles.sessionStats}>
          <View style={styles.sessionStat}>
            <Text style={styles.sessionStatLabel}>DURATION</Text>
            <Text style={styles.sessionStatValue}>{formatDuration(session.duration)}</Text>
          </View>
          <View style={styles.sessionStat}>
            <Text style={styles.sessionStatLabel}>AVG SPO2</Text>
            <Text style={styles.sessionStatValue}>{session.average_spo2 || session.avg_spo2 || '95'}%</Text>
          </View>
          <View style={styles.sessionStat}>
            <Text style={styles.sessionStatLabel}>AVG HR</Text>
            <Text style={styles.sessionStatValue}>{session.average_heart_rate || session.avg_hr || '72'}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderSessionHistory = () => (
    <AnimatedAPI.View style={isExpoGo ? {} : { opacity: 1 }}>
      <View style={styles.sessionHistorySection}>
        {loading ? (
          <ActivityIndicator color={colors.brand.primary} style={styles.loader} />
        ) : sessions.length > 0 ? (
          <View>
            {sessions.slice(0, 5).map(renderSessionItem)}
            {sessions.length > 5 && (
              <TouchableOpacity
                onPress={() => navigation.navigate('History')}
                style={styles.viewAllButton}
              >
                <Text style={styles.viewAllText}>View All Sessions ({sessions.length})</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No sessions yet</Text>
            <Text style={styles.emptyStateSubtext}>Start your first training session to see your progress here</Text>
            {/* Debug button to create test session */}
            {__DEV__ && (
              <TouchableOpacity
                onPress={createTestSession}
                style={[styles.debugButton, { marginTop: 20, padding: 10, backgroundColor: colors.brand.accent, borderRadius: 8 }]}
              >
                <Text style={{ color: 'white', textAlign: 'center' }}>Create Test Session (Debug)</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </AnimatedAPI.View>
  );

  // Logout section removed - moved to Settings screen

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
        <AnimatedAPI.ScrollView
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadSessions();
              }}
              tintColor={colors.brand.primary}
            />
          }
        >
          <View style={styles.headerSpacer} />
          {renderUserCard()}
          {renderSessionHistory()}
          {renderFooter()}
        </AnimatedAPI.ScrollView>
        {renderHeader()}
        
        {/* Session Details Modal */}
        <SessionDetailsModal
          visible={modalVisible}
          sessionData={sessionData}
          onClose={() => {
            setModalVisible(false);
            setSessionData(null);
          }}
        />
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
  userEmail: {
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
  // Removed action and logout styles - moved to Settings screen
  // Session History styles
  sessionHistorySection: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    ...typography.headingSmall,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  sessionItem: {
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sessionDate: {
    ...typography.bodyMedium,
    color: colors.text.primary,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: 12,
  },
  statusText: {
    ...typography.caption,
    color: colors.text.inverse,
    fontWeight: '600',
  },
  sessionStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  sessionStat: {
    alignItems: 'center',
  },
  sessionStatLabel: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginBottom: spacing.xxs,
  },
  sessionStatValue: {
    ...typography.bodyLarge,
    color: colors.text.primary,
    fontWeight: '600',
  },
  viewAllButton: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  viewAllText: {
    ...typography.bodyMedium,
    color: colors.brand.primary,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyStateText: {
    ...typography.bodyLarge,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  emptyStateSubtext: {
    ...typography.bodySmall,
    color: colors.text.tertiary,
    textAlign: 'center',
  },
  loader: {
    paddingVertical: spacing.xl,
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