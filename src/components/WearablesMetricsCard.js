import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';
import { colors, typography, spacing, MetricRing, PremiumButton } from '../design-system';

const WearablesMetricsCard = ({
  metrics,
  isLoading,
  vendor,
  onVendorToggle,
  availableVendors = [],
  sessionInfo,
  onStartTraining,
  selectedDate,
  onNavigateDate,
  isToday,
  style
}) => {
  // Delayed loading state to prevent flash
  const [showLoading, setShowLoading] = useState(false);
  
  useEffect(() => {
    let timeout;
    if (isLoading) {
      // Only show loading after 300ms to prevent flash for quick loads
      timeout = setTimeout(() => {
        setShowLoading(true);
      }, 300);
    } else {
      setShowLoading(false);
    }
    
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [isLoading]);

  // Use actual metrics or null (no more mock fallback)
  const displayMetrics = metrics;
  
  // Determine training recommendation based on recovery score
  const getTrainingRecommendation = () => {
    const recovery = displayMetrics?.recovery || displayMetrics?.readiness || 50;
    
    if (recovery >= 67) {
      return { text: 'PUSH', color: '#4ECDC4' }; // Encouraging green
    } else if (recovery >= 34) {
      return { text: 'LIGHT', color: '#FF7A3D' }; // More red, better contrast
    } else {
      return { text: 'REST', color: '#FF6B6B' }; // Serious red
    }
  };
  
  // Get personalized message based on recommendation
  const getSessionMessage = () => {
    const recommendation = getTrainingRecommendation().text;
    switch (recommendation) {
      case 'PUSH':
        return "Your cells need some stress. Let's go.";
      case 'LIGHT':
        return "Just a nice, easy session for today.";
      case 'REST':
        return "Take some time to recover and rebuild.";
      default:
        return "No active session";
    }
  };
  // Show loading only after delay, or show skeleton immediately for smooth transition
  if (isLoading && !metrics) {
    // First load - show skeleton immediately
    return (
      <Animated.View 
        entering={FadeIn.duration(200)}
        style={[styles.container, styles.skeletonContainer, style]}
      >
        <View style={styles.skeletonHeader}>
          <View style={styles.skeletonTitle} />
          <View style={styles.skeletonSubtitle} />
        </View>
        <View style={styles.skeletonMetrics}>
          <View style={styles.skeletonRing} />
          <View style={styles.skeletonRing} />
          <View style={styles.skeletonRing} />
        </View>
        {showLoading && (
          <Animated.View entering={FadeIn.duration(200)} style={styles.loadingOverlay}>
            <ActivityIndicator size="small" color={colors.brand.accent} />
          </Animated.View>
        )}
      </Animated.View>
    );
  }

  // Map vendor-specific labels
  const getRecoveryLabel = () => vendor === 'whoop' ? 'Recovery' : 'Readiness';
  const getStrainLabel = () => vendor === 'whoop' ? 'Strain' : 'Activity';

  // Color schemes for metrics
  const metricColors = {
    recovery: vendor === 'whoop' ? colors.metrics.recovery : colors.metrics.breath,
    strain: vendor === 'whoop' ? colors.metrics.strain : colors.metrics.spo2,
    sleep: colors.metrics.sleep,
    hr: colors.metrics.heartRate,
    hrv: colors.metrics.recovery,
    respRate: colors.metrics.breath
  };

  // Format date - shows the date being viewed
  const formatDate = () => {
    // Use selectedDate if provided (the date user navigated to)
    const dateToShow = selectedDate || new Date();
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (dateToShow.toDateString() === today.toDateString()) return 'Today';
    if (dateToShow.toDateString() === yesterday.toDateString()) return 'Yesterday';
    
    return dateToShow.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  return (
    <Animated.View 
      entering={FadeIn.duration(600)}
      style={[styles.container, style]}
    >
      {/* Header with training recommendation badge */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Your Plan</Text>
          <Text style={styles.date}>{formatDate()}</Text>
        </View>
        
        {/* Date Navigation Arrows - positioned next to "Your Plan" */}
        <View style={styles.dateNavigation}>
          <TouchableOpacity 
            onPress={() => onNavigateDate && onNavigateDate(-1)}
            style={styles.navArrow}
            activeOpacity={0.6}
          >
            <Text style={styles.navArrowText}>‹</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            onPress={() => onNavigateDate && onNavigateDate(1)}
            disabled={isToday && isToday()}
            style={styles.navArrow}
            activeOpacity={isToday && isToday() ? 1 : 0.6}
          >
            <Text style={[styles.navArrowText, isToday && isToday() && styles.navArrowTextDisabled]}>›</Text>
          </TouchableOpacity>
        </View>
        
        {/* Training recommendation badge - text only, no background */}
        <View style={styles.recommendationBadge}>
          <Text style={[styles.recommendationText, { color: getTrainingRecommendation().color }]}>
            {getTrainingRecommendation().text}
          </Text>
        </View>
      </View>

      {/* Training Section - Between header and metrics */}
      <View style={styles.trainingSection}>
        {sessionInfo?.isActive ? (
          <View style={styles.activeSession}>
            <Text style={styles.sessionStatus}>Session Active</Text>
            <Text style={styles.sessionTime}>{sessionInfo.elapsedTime}</Text>
          </View>
        ) : (
          <View style={styles.noSession}>
            <Text style={styles.noSessionText}>
              {getSessionMessage()}
            </Text>
            <PremiumButton
              title="Start Training"
              onPress={onStartTraining}
              size="medium"
              style={styles.startButton}
            />
          </View>
        )}
      </View>

      {/* Main metrics grid */}
      <View style={styles.metricsGrid}>
        {/* Top Row - Primary Metrics */}
        <View style={styles.metricRow}>
          {/* Sleep */}
          <View style={styles.metricCard}>
            <View style={styles.metricHeader}>
              <Text style={styles.metricLabel}>SLEEP</Text>
            </View>
            <MetricRing
              value={displayMetrics?.sleepScore || 0}
              maxValue={100}
              size={90}
              strokeWidth={8}
              color={metricColors.sleep}
              label=""
              unit="%"
              showLabel={false}
            />
            <Text style={styles.metricValue}>
              {displayMetrics?.sleepScore ? `${displayMetrics.sleepScore}%` : '--'}
            </Text>
          </View>

          {/* Recovery/Readiness */}
          <View style={styles.metricCard}>
            <View style={styles.metricHeader}>
              <Text style={styles.metricLabel}>{getRecoveryLabel().toUpperCase()}</Text>
            </View>
            <MetricRing
              value={displayMetrics?.recovery || displayMetrics?.readiness || 0}
              maxValue={100}
              size={90}
              strokeWidth={8}
              color={metricColors.recovery}
              label=""
              unit="%"
              showLabel={false}
            />
            <Text style={styles.metricValue}>
              {displayMetrics?.recovery || displayMetrics?.readiness ? `${displayMetrics?.recovery || displayMetrics?.readiness}%` : '--'}
            </Text>
          </View>

          {/* Strain/Activity */}
          <View style={styles.metricCard}>
            <View style={styles.metricHeader}>
              <Text style={styles.metricLabel}>{getStrainLabel().toUpperCase()}</Text>
            </View>
            <View style={styles.strainContainer}>
              <Text style={[styles.largeMetricValue, { color: metricColors.strain }]}>
                {displayMetrics?.strain || displayMetrics?.activity || '--'}
              </Text>
              {vendor === 'whoop' && (
                <View style={[styles.strainBar, { backgroundColor: metricColors.strain + '20' }]}>
                  <View 
                    style={[
                      styles.strainFill, 
                      { 
                        width: `${Math.min((displayMetrics?.strain || 0) / 21 * 100, 100)}%`,
                        backgroundColor: metricColors.strain 
                      }
                    ]} 
                  />
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Bottom Row - Vitals */}
        <View style={styles.metricRow}>
          {/* Resting HR */}
          <View style={styles.vitalCard}>
            <Text style={styles.vitalLabel}>Resting HR</Text>
            <Text style={[styles.vitalValue, { color: metricColors.hr }]}>
              {displayMetrics?.restingHR || '--'}
            </Text>
            <Text style={styles.vitalUnit}>bpm</Text>
          </View>

          {/* HRV */}
          <View style={styles.vitalCard}>
            <Text style={styles.vitalLabel}>HRV</Text>
            <Text style={[styles.vitalValue, { color: metricColors.hrv }]}>
              {displayMetrics?.hrv || '--'}
            </Text>
            <Text style={styles.vitalUnit}>ms</Text>
          </View>

          {/* Respiratory Rate */}
          <View style={styles.vitalCard}>
            <Text style={styles.vitalLabel}>Resp Rate</Text>
            <Text style={[styles.vitalValue, { color: metricColors.respRate }]}>
              {displayMetrics?.respRate || '--'}
            </Text>
            <Text style={styles.vitalUnit}>rpm</Text>
          </View>
        </View>
      </View>

      {/* Data source indicator */}
      <View style={styles.footer}>
        <View style={styles.sourceIndicator}>
          <View style={[styles.sourceDot, { backgroundColor: metrics ? colors.metrics.breath : colors.text.tertiary }]} />
          <Text style={styles.sourceText}>
            {metrics ? `Live from ${(metrics.vendor || vendor) === 'whoop' ? 'WHOOP' : 'Oura Ring'}` : 'Sample data'}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.components.card.background,
    borderRadius: spacing.radius.card,
    borderWidth: 1,
    borderColor: colors.components.card.border,
    padding: spacing.cardPadding,
  },
  loadingContainer: {
    minHeight: 320,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...typography.bodyMedium,
    color: colors.text.secondary,
    marginTop: spacing.sm,
  },
  emptyContainer: {
    minHeight: 320,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  emptyText: {
    ...typography.bodyMedium,
    color: colors.text.tertiary,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs, // Reduced by more than 20%
    position: 'relative',
  },
  headerLeft: {
    flex: 1,
  },
  title: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.xxs,
  },
  date: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  recommendationBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  recommendationText: {
    ...typography.labelSmall,
    fontWeight: '700',
    letterSpacing: 1,
  },
  dateNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 26,
    position: 'absolute',
    left: '50%',
    top: 8,
    transform: [{ translateX: -50 }, { translateY: 0 }],
  },
  navArrow: {
    padding: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navArrowText: {
    fontSize: 24,
    color: colors.text.secondary,
    fontWeight: '300',
  },
  navArrowTextDisabled: {
    color: colors.text.quaternary,
    opacity: 0.5,
  },
  trainingSection: {
    paddingTop: spacing.xxs, // Minimal top padding
    paddingBottom: spacing.xs, // Reduced bottom padding
    marginBottom: spacing.sm, // Reduced by ~20% from lg to sm
    alignItems: 'center',
  },
  noSession: {
    alignItems: 'center',
  },
  noSessionText: {
    ...typography.bodyMedium,
    color: colors.text.tertiary,
    marginBottom: spacing.xs, // Further reduced
  },
  startButton: {
    minWidth: 400, // Another 33% wider (300 -> 400)
    paddingHorizontal: spacing.xxl,
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
  },
  metricsGrid: {
    gap: spacing.md,
  },
  metricRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  metricCard: {
    flex: 1,
    backgroundColor: colors.background.secondary,
    borderRadius: spacing.radius.md,
    padding: spacing.sm,
    alignItems: 'center',
    minHeight: 140,
  },
  metricHeader: {
    width: '100%',
    marginBottom: spacing.xs,
  },
  metricLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metricValue: {
    ...typography.bodyLarge,
    color: colors.text.primary,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  largeMetricValue: {
    ...typography.displaySmall,
    fontWeight: '700',
  },
  strainContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  strainBar: {
    width: '80%',
    height: 4,
    borderRadius: 2,
    marginTop: spacing.sm,
    overflow: 'hidden',
  },
  strainFill: {
    height: '100%',
    borderRadius: 2,
  },
  vitalCard: {
    flex: 1,
    backgroundColor: colors.background.tertiary,
    borderRadius: spacing.radius.md,
    padding: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 90,
  },
  vitalLabel: {
    ...typography.micro,
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xxs,
  },
  vitalValue: {
    ...typography.h2,
    fontWeight: '600',
  },
  vitalUnit: {
    ...typography.caption,
    color: colors.text.quaternary,
    marginTop: spacing.xxs,
  },
  footer: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  sourceIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: spacing.xs,
  },
  sourceText: {
    ...typography.caption,
    color: colors.text.quaternary,
  },
  // Skeleton loader styles
  skeletonContainer: {
    minHeight: 420,
  },
  skeletonHeader: {
    marginBottom: spacing.md,
  },
  skeletonTitle: {
    width: 120,
    height: 24,
    backgroundColor: colors.background.tertiary,
    borderRadius: spacing.radius.sm,
    marginBottom: spacing.xs,
  },
  skeletonSubtitle: {
    width: 80,
    height: 14,
    backgroundColor: colors.background.tertiary,
    borderRadius: spacing.radius.sm,
  },
  skeletonMetrics: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
    justifyContent: 'center',
  },
  skeletonRing: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: colors.background.tertiary,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default WearablesMetricsCard;