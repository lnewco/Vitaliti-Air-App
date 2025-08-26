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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolate,
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

// Mock historical data for two weeks
const mockHistoricalData = {
  '2025-08-12': {
    sleepScore: 82,
    recovery: 71,
    strain: 8.3,
    restingHR: 52,
    hrv: 89,
    respRate: 16.2
  },
  '2025-08-13': {
    sleepScore: 75,
    recovery: 65,
    strain: 12.1,
    restingHR: 54,
    hrv: 85,
    respRate: 16.8
  },
  '2025-08-14': {
    sleepScore: 91,
    recovery: 88,
    strain: 6.7,
    restingHR: 49,
    hrv: 102,
    respRate: 15.9
  },
  '2025-08-15': {
    sleepScore: 68,
    recovery: 52,
    strain: 14.5,
    restingHR: 56,
    hrv: 76,
    respRate: 17.1
  },
  '2025-08-16': {
    sleepScore: 85,
    recovery: 79,
    strain: 9.2,
    restingHR: 51,
    hrv: 94,
    respRate: 16.4
  },
  '2025-08-17': {
    sleepScore: 73,
    recovery: 61,
    strain: 15.8,
    restingHR: 55,
    hrv: 81,
    respRate: 16.9
  },
  '2025-08-18': {
    sleepScore: 88,
    recovery: 84,
    strain: 4.3,
    restingHR: 50,
    hrv: 98,
    respRate: 16.0
  },
  '2025-08-19': {
    sleepScore: 79,
    recovery: 72,
    strain: 10.6,
    restingHR: 53,
    hrv: 91,
    respRate: 16.5
  },
  '2025-08-20': {
    sleepScore: 71,
    recovery: 58,
    strain: 13.9,
    restingHR: 57,
    hrv: 78,
    respRate: 17.3
  },
  '2025-08-21': {
    sleepScore: 86,
    recovery: 81,
    strain: 7.4,
    restingHR: 50,
    hrv: 95,
    respRate: 16.1
  },
  '2025-08-22': {
    sleepScore: 92,
    recovery: 90,
    strain: 5.2,
    restingHR: 48,
    hrv: 105,
    respRate: 15.7
  },
  '2025-08-23': {
    sleepScore: 64,
    recovery: 45,
    strain: 16.7,
    restingHR: 58,
    hrv: 72,
    respRate: 17.5
  },
  '2025-08-24': {
    sleepScore: 77,
    recovery: 68,
    strain: 11.3,
    restingHR: 53,
    hrv: 87,
    respRate: 16.7
  },
  '2025-08-25': {
    sleepScore: 83,
    recovery: 75,
    strain: 8.9,
    restingHR: 52,
    hrv: 92,
    respRate: 16.3
  },
  '2025-08-26': {
    sleepScore: 78,
    recovery: 66,
    strain: 5.1,
    restingHR: 51,
    hrv: 96,
    respRate: 17.8
  }
};

const PremiumDashboard = ({ navigation }) => {
  const [sessionInfo, setSessionInfo] = useState(EnhancedSessionManager.getSessionInfo());
  const [refreshing, setRefreshing] = useState(false);
  const [wearableMetrics, setWearableMetrics] = useState(null);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(true);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [availableVendors, setAvailableVendors] = useState([]);
  const [userName, setUserName] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const scrollY = useSharedValue(0);
  const { user } = useAuth();

  useEffect(() => {
    const interval = setInterval(() => {
      setSessionInfo(EnhancedSessionManager.getSessionInfo());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

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
      setIsLoadingMetrics(true);
      
      // Format the date as YYYY-MM-DD
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      const dateKey = `${year}-${month}-${day}`;
      
      console.log('Loading metrics for date:', dateKey); // Debug log
      
      // Check if we have mock data for this date
      if (mockHistoricalData[dateKey]) {
        const mockData = mockHistoricalData[dateKey];
        console.log('Found mock data:', mockData); // Debug log
        
        // Force a complete update of the metrics
        setWearableMetrics({
          sleepScore: mockData.sleepScore,
          recovery: mockData.recovery,
          strain: mockData.strain,
          restingHR: mockData.restingHR,
          hrv: mockData.hrv,
          respRate: mockData.respRate,
          vendor: selectedVendor || 'whoop',
          date: dateKey
        });
        
        if (!selectedVendor) {
          setSelectedVendor('whoop');
        }
      } else {
        console.log('No mock data for date:', dateKey); // Debug log
        // Fall back to real data for dates not in mock
        const metrics = await WearablesDataService.getLatestMetrics(user?.id, selectedVendor);
        setWearableMetrics(metrics);
        
        if (metrics && !selectedVendor) {
          setSelectedVendor(metrics.vendor);
        }
      }
    } catch (error) {
      console.error('Error loading wearable metrics:', error);
    } finally {
      setIsLoadingMetrics(false);
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
    
    setSelectedDate(newDate);
    // Metrics will reload automatically via useEffect
  };

  const renderHeader = () => (
    <Animated.View style={[styles.header, headerAnimatedStyle]}>
      <View style={styles.headerTop}>
        <Image
          source={require('../../assets/IMG_4490.png')}
          style={styles.logoImage}
          resizeMode="contain"
        />
        <View style={styles.headerBadge}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>Connected</Text>
        </View>
      </View>
      
      <Text style={styles.greeting}>{getGreeting()},  {userName || 'User'}</Text>
      <Text style={styles.date}>{getCurrentDate()}</Text>
      
      {/* Date Navigation Arrows - positioned absolutely */}
      <View style={styles.dateNavigation}>
        <TouchableOpacity 
          onPress={() => navigateDate(-1)}
          style={styles.navArrow}
          activeOpacity={0.6}
        >
          <Text style={styles.navArrowText}>‹</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          onPress={() => navigateDate(1)}
          disabled={isToday()}
          style={styles.navArrow}
          activeOpacity={isToday() ? 1 : 0.6}
        >
          <Text style={[styles.navArrowText, isToday() && styles.navArrowTextDisabled]}>›</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  const renderMetrics = () => {
    // If we have wearables data, show it in a better format
    if (wearableMetrics || isLoadingMetrics || availableVendors.length > 0) {
      return (
        <View style={styles.metricsSection}>
          <WearablesMetricsCard
            metrics={wearableMetrics}
            isLoading={isLoadingMetrics}
            vendor={selectedVendor}
            onVendorToggle={handleVendorToggle}
            availableVendors={availableVendors}
            sessionInfo={sessionInfo}
            onStartTraining={() => navigation.navigate('SessionSetup')}
          />
        </View>
      );
    }
    
    // Otherwise show the original mock SpO2 metrics with reordered layout
    return (
      <View style={styles.metricsSection}>
        <View style={styles.mainMetrics}>
          <View style={styles.primaryMetric}>
            <MetricRing
              value={78}
              maxValue={100}
              size={160}
              strokeWidth={14}
              color={colors.metrics.sleep}
              label="Sleep"
              unit="%"
              gradientColors={[colors.metrics.sleep, colors.metrics.recovery]}
            />
          </View>
          
          <View style={styles.secondaryMetrics}>
            <View style={styles.metricRow}>
              <MetricRing
                value={66}
                maxValue={100}
                size={80}
                strokeWidth={8}
                color={colors.metrics.recovery}
                label="Recovery"
                unit="%"
              />
              <MetricRing
                value={5.1}
                maxValue={21}
                size={80}
                strokeWidth={8}
                color={colors.metrics.strain}
                label="Strain"
                unit=""
              />
            </View>
            
            <View style={styles.recoveryBar}>
              <Text style={styles.recoveryLabel}>RECOVERY</Text>
              <View style={styles.recoveryProgress}>
                <LinearGradient
                  colors={[colors.metrics.recovery, colors.metrics.spo2]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.recoveryFill, { width: '87%' }]}
                />
              </View>
              <Text style={styles.recoveryValue}>87%</Text>
            </View>
          </View>
        </View>
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

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background.primary} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
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
    height: 160, // Original spacing
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
  dateNavigation: {
    position: 'absolute',
    bottom: -20, // Moved down by 1px
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 26, // Reduced by 50% from 51px
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