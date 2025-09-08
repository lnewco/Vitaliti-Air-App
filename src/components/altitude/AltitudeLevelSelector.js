import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import SafeIcon from '../base/SafeIcon';
import { colors, typography, spacing } from '../../design-system';

// Altitude level data with oxygen percentages and equivalent altitudes
// Based on official flow meter settings and simulated altitudes
const ALTITUDE_LEVELS = [
  { level: 0, oxygen: 18.0, feet: 4000, meters: 1219, label: 'Easiest' },
  { level: 1, oxygen: 17.1, feet: 5500, meters: 1676, label: 'Very Easy' },
  { level: 2, oxygen: 16.2, feet: 7500, meters: 2286, label: 'Easy' },
  { level: 3, oxygen: 15.3, feet: 9500, meters: 2896, label: 'Mild' },
  { level: 4, oxygen: 14.4, feet: 11500, meters: 3505, label: 'Moderate' },
  { level: 5, oxygen: 13.5, feet: 13500, meters: 4115, label: 'Moderate+' },
  { level: 6, oxygen: 12.5, feet: 16000, meters: 4877, label: 'Standard' },
  { level: 7, oxygen: 11.6, feet: 18500, meters: 5639, label: 'Challenging' },
  { level: 8, oxygen: 10.7, feet: 21000, meters: 6401, label: 'Hard' },
  { level: 9, oxygen: 9.8, feet: 23500, meters: 7163, label: 'Very Hard' },
  { level: 10, oxygen: 8.9, feet: 26500, meters: 8077, label: 'Extreme' },
  { level: 11, oxygen: 8.0, feet: 27000, meters: 8230, label: 'Max' },
];

const AltitudeLevelSelector = ({
  selectedLevel,
  recommendedLevel,
  onLevelSelect,
  showRecommendation = true,
  allowManualSelection = true,
}) => {
  const scrollViewRef = React.useRef(null);
  
  const isRecommended = (level) => level === recommendedLevel;
  const isSelected = (level) => level === selectedLevel;
  const isDangerous = (level) => Math.abs(level - recommendedLevel) > 3;

  // Calculate initial scroll position to show exactly 3 cards
  const getInitialScrollPosition = () => {
    if (recommendedLevel === undefined) return 0;
    
    const actualCardWidth = 110 + 12; // Card width + margins
    
    if (recommendedLevel === 0) {
      // Show 0, 1, 2 with 0 on the left
      return 0;
    } else if (recommendedLevel === 11) {
      // Show 9, 10, 11 with 11 on the right
      return 9 * actualCardWidth;
    } else if (recommendedLevel === 10) {
      // Show 8, 9, 10 with 10 in the middle
      return 8 * actualCardWidth;
    } else {
      // Show prev, recommended (centered), next
      // To center card N, we need to scroll to card N-1
      return (recommendedLevel - 1) * actualCardWidth;
    }
  };


  const getLevelColor = (level) => {
    if (isSelected(level)) return colors.brand.accent;
    if (isRecommended(level)) return colors.semantic.success;
    if (isDangerous(level)) return colors.semantic.error;
    return colors.text.tertiary;
  };

  const getLevelStyle = (level) => {
    if (isSelected(level)) {
      return [
        styles.altitudeLevel,
        styles.selectedLevel,
        isDangerous(level) && styles.dangerousLevel,
      ];
    }
    if (isRecommended(level)) {
      return [styles.altitudeLevel, styles.recommendedLevel];
    }
    return styles.altitudeLevel;
  };

  return (
    <View style={styles.container}>
      {showRecommendation && (
        <View style={styles.recommendationBanner}>
          <SafeIcon name="trending-up" size="sm" color={colors.semantic.success} />
          <Text style={styles.recommendationText}>
            AI Recommends Level {recommendedLevel} based on your progression
          </Text>
        </View>
      )}

      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.levelsContainer}
        contentOffset={{ x: getInitialScrollPosition(), y: 0 }}  // Set initial position directly
      >
        {ALTITUDE_LEVELS.map((altitude) => {
          const level = altitude.level;
          const isSelectable = allowManualSelection || level === recommendedLevel;

          return (
            <TouchableOpacity
              key={level}
              style={getLevelStyle(level)}
              onPress={() => isSelectable && onLevelSelect(level)}
              disabled={!isSelectable}
              activeOpacity={0.7}
            >
              {isRecommended(level) && (
                <View style={styles.recommendedBadge}>
                  <Text style={styles.recommendedBadgeText}>AI</Text>
                </View>
              )}

              <Text style={[styles.levelNumber, { color: getLevelColor(level) }]}>
                {level}
              </Text>
              
              <Text style={styles.levelLabel}>{altitude.label}</Text>
              
              <View style={styles.levelDetails}>
                <Text style={styles.oxygenText}>{altitude.oxygen}% O₂</Text>
                <Text style={styles.altitudeText}>
                  {(altitude.feet / 1000).toFixed(1)}k ft
                </Text>
              </View>

              {isSelected(level) && (
                <View style={styles.selectedIndicator}>
                  <SafeIcon name="check-circle" size="xs" color={colors.brand.accent} />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {selectedLevel !== recommendedLevel && Math.abs(selectedLevel - recommendedLevel) > 2 && (
        <View style={styles.warningBanner}>
          <SafeIcon name="alert-triangle" size="sm" color={colors.semantic.warning} />
          <Text style={styles.warningText}>
            {selectedLevel > recommendedLevel + 2
              ? `Level ${selectedLevel} is significantly harder than recommended. Consider starting lower.`
              : `Level ${selectedLevel} may be too easy for optimal training effect.`}
          </Text>
        </View>
      )}

      <View style={styles.infoSection}>
        <Text style={styles.infoLabel}>Selected Altitude:</Text>
        <Text style={styles.infoValue}>
          Level {selectedLevel} • {ALTITUDE_LEVELS[selectedLevel].oxygen}% O₂ • ~{(ALTITUDE_LEVELS[selectedLevel].feet / 1000).toFixed(1)}k feet
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.md,
  },
  recommendationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.semantic.success + '20',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 12,
    marginBottom: spacing.md,
    marginHorizontal: spacing.md,
  },
  recommendationText: {
    ...typography.body,
    color: colors.semantic.success,
    marginLeft: spacing.sm,
    flex: 1,
  },
  levelsContainer: {
    paddingVertical: spacing.xs,
    // No horizontal padding to ensure proper scrolling
  },
  altitudeLevel: {
    width: 110, // Increased from 90 to better fit 3 cards
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    marginHorizontal: spacing.xs,
    borderRadius: 16,
    backgroundColor: colors.background.secondary,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  selectedLevel: {
    backgroundColor: colors.brand.accent + '15',
    borderColor: colors.brand.accent,
  },
  recommendedLevel: {
    backgroundColor: colors.semantic.success + '10',
    borderColor: colors.semantic.success,
    borderStyle: 'dashed',
  },
  dangerousLevel: {
    borderColor: colors.semantic.warning,
  },
  recommendedBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: colors.semantic.success,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    zIndex: 1,
  },
  recommendedBadgeText: {
    ...typography.caption,
    color: colors.text.inverse,
    fontWeight: '700',
    fontSize: 9,
  },
  levelNumber: {
    ...typography.h2,
    fontSize: 28,
    fontWeight: '700',
    marginBottom: spacing.xxs,
  },
  levelLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 11,
    marginBottom: spacing.xs,
  },
  levelDetails: {
    alignItems: 'center',
  },
  oxygenText: {
    ...typography.caption,
    color: colors.text.tertiary,
    fontSize: 12,
    fontWeight: '600',
  },
  altitudeText: {
    ...typography.caption,
    color: colors.text.quaternary,
    fontSize: 10,
    marginTop: 2,
  },
  selectedIndicator: {
    position: 'absolute',
    bottom: -10,
    alignSelf: 'center',
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.semantic.warning + '15',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 12,
    marginTop: spacing.md,
    marginHorizontal: spacing.md,
  },
  warningText: {
    ...typography.caption,
    color: colors.semantic.warning,
    marginLeft: spacing.sm,
    flex: 1,
    lineHeight: 18,
  },
  infoSection: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
  },
  infoLabel: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginBottom: spacing.xxs,
  },
  infoValue: {
    ...typography.body,
    color: colors.text.primary,
    fontWeight: '600',
  },
});

export default AltitudeLevelSelector;