import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  Text,
  StyleSheet,
  StatusBar,
  RefreshControl,
  Dimensions,
  Image,
  TouchableOpacity,
  AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolate,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import {
  colors,
  typography,
  spacing,
  MetricRing,
  PremiumCard,
  PremiumButton,
} from '../design-system';
import EnhancedSessionManager from '../services/EnhancedSessionManager';
import WearablesDataService from '../services/WearablesDataService';
import WearablesMetricsCard from '../components/WearablesMetricsCard';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../config/supabase';

const { width: screenWidth } = Dimensions.get('window');

// Mock historical data - NO LONGER USED (using real data from whoop_data/oura_data tables)
// Entire mock data object removed - now fetching real data from Supabase

const PremiumDashboard = ({ navigation }) => {
  const [sessionInfo, setSessionInfo] = useState(EnhancedSessionManager.getSessionInfo());
  const [refreshing, setRefreshing] = useState(false);
  const [wearableMetrics, setWearableMetrics] = useState(null);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isRefreshingMetrics, setIsRefreshingMetrics] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [availableVendors, setAvailableVendors] = useState([]);
  const [userName, setUserName] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isContentReady, setIsContentReady] = useState(false); // Add this to prevent jittery animation
  const scrollY = useSharedValue(0);
  const contentOpacity = useSharedValue(0); // Use shared value for opacity
  const { user } = useAuth();

  useEffect(() => {
    const interval = setInterval(() => {
      setSessionInfo(EnhancedSessionManager.getSessionInfo());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Trigger sync when app comes to foreground
  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      if (nextAppState === 'active' && user?.id) {
        console.log('[Dashboard] App became active, triggering wearables sync');
        triggerWearablesSync();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    // Also trigger sync on mount
    if (user?.id) {
      console.log('[Dashboard] Component mounted, triggering initial sync');
      triggerWearablesSync();
    }

    return () => {
      subscription?.remove();
    };
  }, [user]);

  // Fetch user profile
  useEffect(() => {
    if (user?.id) {
      fetchUserProfile();
    }
  }, [user]);

  // Fetch wearable metrics
  useEffect(() => {
    if (user?.id) {
      loadWearableMetrics();
      checkAvailableVendors();

      // Refresh metrics every minute
      const metricsInterval = setInterval(() => {
        loadWearableMetrics();
      }, 60000);

      return () => clearInterval(metricsInterval);
    }
  }, [user, selectedVendor, selectedDate]); // Added selectedDate as dependency

  // Set content ready after initial data load to prevent jittery animations
  useEffect(() => {
    // Add a small delay to ensure smooth transition
    const timer = setTimeout(() => {
      setIsContentReady(true);
      contentOpacity.value = withTiming(1, { duration: 300 });
    }, 150); // 150ms delay for smooth initial render

    return () => clearTimeout(timer);
  }, []);

  const fetchUserProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('full_name')
        .eq('user_id', user.id)
        .single();

      if (data?.full_name) {
        // Extract first name from full name
        const firstName = data.full_name.split(' ')[0];
        setUserName(firstName);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  const loadWearableMetrics = async () => {
    try {
      // Only show loading state on initial load, not on refreshes
      if (isInitialLoad) {
        setIsLoadingMetrics(true);
      } else {
        setIsRefreshingMetrics(true);
      }
      
      // Format the date as YYYY-MM-DD
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      const dateKey = `${year}-${month}-${day}`;
      
      console.log('Loading real metrics for date:', dateKey); // Debug log
      
      // Try to get real data first
      const metrics = await WearablesDataService.getCombinedMetrics(user?.id, dateKey);
      
      if (metrics) {
        console.log('Found real data:', metrics); // Debug log
        
        const newMetrics = {
          sleepScore: metrics.sleep_score,
          recovery: metrics.recovery,
          readiness: metrics.readiness,
          strain: metrics.strain,
          activity: metrics.activity,
          restingHR: metrics.resting_hr,
          hrv: metrics.hrv,
          respRate: metrics.resp_rate,
          vendor: metrics.vendor || selectedVendor || 'whoop',
          date: dateKey
        };
        
        // Only update if data has actually changed
        const hasChanged = !wearableMetrics || 
          JSON.stringify(newMetrics) !== JSON.stringify(wearableMetrics);
        
        if (hasChanged) {
          setWearableMetrics(newMetrics);
        }
        
        if (!selectedVendor && metrics.vendor) {
          setSelectedVendor(metrics.vendor === 'both' ? 'whoop' : metrics.vendor);
        }
      } else {
        console.log('No real data found for date:', dateKey); // Debug log
        // Only clear metrics if they were previously set
        if (wearableMetrics) {
          setWearableMetrics(null);
        }
      }
    } catch (error) {
      console.error('Error loading wearable metrics:', error);
      if (wearableMetrics) {
        setWearableMetrics(null);
      }
    } finally {
      setIsLoadingMetrics(false);
      setIsRefreshingMetrics(false);
      if (isInitialLoad) {
        setIsInitialLoad(false);
      }
    }
  };

  const checkAvailableVendors = async () => {
    try {
      const vendors = await WearablesDataService.getAvailableWearables(user?.id);
      setAvailableVendors(vendors);
      
      if (vendors.length > 0 && !selectedVendor) {
        const preferred = await WearablesDataService.getPreferredWearable(user?.id);
        setSelectedVendor(preferred || vendors[0]);
      }
    } catch (error) {
      console.error('Error checking available vendors:', error);
    }
  };

  const triggerWearablesSync = async () => {
    if (!user?.id) return;
    
    try {
      console.log('[Dashboard] Triggering wearables sync for user:', user.id);
      
      // Call the backend to trigger sync (with 60 second timeout)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout
      
      const response = await fetch('https://vitaliti-air-analytics.onrender.com/api/sync/manual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          vendor: 'all', // Sync both WHOOP and Oura
        }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (response.ok) {
        const result = await response.json();
        console.log('[Dashboard] Sync completed:', result);
        
        // Sync is now complete (we await it), so load metrics immediately
        loadWearableMetrics();
      } else {
        console.error('[Dashboard] Failed to trigger sync:', response.status);
      }
    } catch (error) {
      console.error('[Dashboard] Error triggering sync:', error);
      // Continue to load metrics even if sync fails
      loadWearableMetrics();
    }
  };

  const handleVendorToggle = async () => {
    if (availableVendors.length <= 1) return;
    
    const currentIndex = availableVendors.indexOf(selectedVendor);
    const nextIndex = (currentIndex + 1) % availableVendors.length;
    const nextVendor = availableVendors[nextIndex];
    
    setSelectedVendor(nextVendor);
    await WearablesDataService.setPreferredWearable(nextVendor);
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

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    // Don't reset initial load for pull-to-refresh
    loadWearableMetrics().then(() => {
      setTimeout(() => {
        setRefreshing(false);
      }, 1000);
    });
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 17 || hour < 4) {
      return 'Good evening';
    } else if (hour >= 12) {
      return 'Good afternoon';
    } else {
      return 'Good morning';
    }
  };

  const getCurrentDate = () => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return `${days[selectedDate.getDay()]}, ${months[selectedDate.getMonth()]} ${selectedDate.getDate()}`;
  };

  const isToday = () => {
    const today = new Date();
    return selectedDate.toDateString() === today.toDateString();
  };

  const navigateDate = (direction) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + direction);
    
    // Don't allow navigation to future dates
    const today = new Date();
    if (newDate > today) return;
    
    // Reset initial load for date navigation to show loading state
    setIsInitialLoad(true);
    setSelectedDate(newDate);
    // Metrics will reload automatically via useEffect
  };

  const renderHeader = () => (
    <Animated.View style={[styles.header, headerAnimatedStyle]}>
      <View style={styles.headerTop}>
        <TouchableOpacity
          onPress={() => navigation.navigate('AnimationPreview')}
          activeOpacity={0.7}
        >
          <Image
            source={require('../../assets/IMG_4490.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </TouchableOpacity>
        <View style={styles.headerBadge}>
          <View style={[styles.statusDot, isRefreshingMetrics && styles.statusDotLoading]} />
          <Text style={styles.statusText}>{isRefreshingMetrics ? 'Loading...' : 'Connected'}</Text>
        </View>
      </View>
      
      <Text style={styles.greeting}>{getGreeting()},  {userName || 'User'}</Text>
      <Text style={styles.date}>{getCurrentDate()}</Text>
    </Animated.View>
  );

  const renderMetrics = () => {
    // Always show the WearablesMetricsCard component
    // It will handle loading, no data, and data states internally
    return (
      <View style={styles.metricsSection}>
        <WearablesMetricsCard
          metrics={wearableMetrics}
          isLoading={isInitialLoad && isLoadingMetrics}
          vendor={selectedVendor || 'whoop'}
          onVendorToggle={handleVendorToggle}
          availableVendors={availableVendors}
          sessionInfo={sessionInfo}
          onStartTraining={() => navigation.navigate('SessionSetup')}
          selectedDate={selectedDate}
          onNavigateDate={navigateDate}
          isToday={isToday}
        />
      </View>
    );
  };

  const renderNotesCard = () => (
    <PremiumCard style={styles.sessionCard}>
      <View style={styles.sessionHeader}>
        <Text style={styles.sessionTitle}>Notes</Text>
        <TouchableOpacity style={styles.addNoteButton}>
          <Text style={styles.addNoteIcon}>+</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.notesContent}>
        <Text style={styles.notesPlaceholder}>
          Add notes about your day, how you're feeling, or any observations about your health and training.
        </Text>
      </View>
    </PremiumCard>
  );

  // Add fade-in animation style
  const contentAnimatedStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
  }));

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background.primary} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <Animated.View style={[styles.safeArea, contentAnimatedStyle]}>
          <Animated.ScrollView
            onScroll={scrollHandler}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.brand.accent}
              />
            }
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.headerSpacer} />
            {renderMetrics()}
            
            {renderNotesCard()}
            
            <View style={styles.bottomSpacing} />
          </Animated.ScrollView>
          {renderHeader()}
        </Animated.View>
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
    height: 220, // Move card down to create separation from date
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  logoImage: {
    width: 120,
    height: 36,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.elevated,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: spacing.radius.full,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.metrics.breath,
    marginRight: spacing.xs,
  },
  statusDotLoading: {
    backgroundColor: colors.text.tertiary,
  },
  statusText: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  greeting: {
    ...typography.h1,
    color: colors.text.primary,
    marginBottom: spacing.xxs,
  },
  date: {
    ...typography.bodyMedium,
    color: colors.text.tertiary,
  },
  metricsSection: {
    paddingHorizontal: spacing.screenPadding,
    marginBottom: spacing.lg,
  },
  mainMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  primaryMetric: {
    flex: 1,
    alignItems: 'center',
  },
  secondaryMetrics: {
    flex: 1,
    justifyContent: 'space-between',
    paddingLeft: spacing.md,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.md,
  },
  recoveryBar: {
    backgroundColor: colors.background.tertiary,
    padding: spacing.sm,
    borderRadius: spacing.radius.md,
  },
  recoveryLabel: {
    ...typography.micro,
    color: colors.text.tertiary,
    marginBottom: spacing.xs,
  },
  recoveryProgress: {
    height: 8,
    backgroundColor: colors.background.secondary,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  recoveryFill: {
    height: '100%',
    borderRadius: 4,
  },
  recoveryValue: {
    ...typography.bodySmall,
    color: colors.text.primary,
    fontWeight: '600',
  },
  sessionCard: {
    marginHorizontal: spacing.screenPadding,
    marginBottom: spacing.lg,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sessionTitle: {
    ...typography.h3,
    color: colors.text.primary,
  },
  sessionBadge: {
    backgroundColor: colors.brand.accent,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: spacing.radius.sm,
  },
  sessionBadgeText: {
    ...typography.micro,
    color: colors.text.primary,
    fontWeight: '600',
  },
  activeSession: {
    alignItems: 'center',
  },
  sessionStatus: {
    ...typography.bodyMedium,
    color: colors.metrics.breath,
    marginBottom: spacing.xs,
  },
  sessionTime: {
    ...typography.displaySmall,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  sessionMetrics: {
    flexDirection: 'row',
    gap: spacing.xl,
  },
  sessionMetric: {
    alignItems: 'center',
  },
  sessionMetricLabel: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginBottom: spacing.xxs,
  },
  sessionMetricValue: {
    ...typography.bodyLarge,
    color: colors.text.primary,
    fontWeight: '600',
  },
  noSession: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  noSessionText: {
    ...typography.bodyMedium,
    color: colors.text.tertiary,
    marginBottom: spacing.md,
  },
  startButton: {
    minWidth: 160,
  },
  addNoteButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.brand.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addNoteIcon: {
    fontSize: 20,
    color: colors.text.primary,
    fontWeight: '600',
  },
  notesContent: {
    paddingVertical: spacing.md,
  },
  notesPlaceholder: {
    ...typography.bodyMedium,
    color: colors.text.tertiary,
    lineHeight: 22,
  },
  bottomSpacing: {
    height: spacing.xxl,
  },
  trainingButtonContainer: {
    padding: spacing.md,
  },
  cardSubtitle: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  dateNavigation: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 26, // Reduced by 50% from 51px
    marginTop: spacing.sm, // Add some space between date and arrows
  },
  navArrow: {
    padding: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navArrowText: {
    fontSize: 29, // Reduced by 10% from 32
    color: colors.text.secondary, // 25% darker (70% opacity instead of 100%)
    fontWeight: '200',
  },
  navArrowTextDisabled: {
    color: colors.text.quaternary,
  },
});

export default PremiumDashboard;