import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Circle, G, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Animated } from 'react-native';
import {
  useAnimatedProps,
  useSharedValue,
  withTiming,
  withSpring,
  interpolate,
  Easing,
  AnimatedAPI,
  isExpoGo,
  createAnimatedComponent
} from '../../utils/animationHelpers';
import colors from '../colors';
import typography from '../typography';
import spacing from '../spacing';

const AnimatedCircle = createAnimatedComponent(Circle);
const { width: screenWidth } = Dimensions.get('window');

const MetricRing = ({
  value,
  maxValue = 100,
  size = 140,
  strokeWidth = 12,
  color = colors.metrics.recovery,
  label,
  unit = '%',
  showValue = true,
  animate = true,
  gradientColors = null,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const progress = useSharedValue(0);
  const scale = useSharedValue(0.9);

  useEffect(() => {
    if (animate) {
      progress.value = withTiming(value / maxValue, {
        duration: 1200,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      });
      scale.value = withSpring(1, {
        damping: 12,
        stiffness: 100,
      });
    } else {
      progress.value = value / maxValue;
      scale.value = 1;
    }
  }, [value, maxValue, animate]);

  const animatedProps = useAnimatedProps(() => {
    const strokeDashoffset = circumference * (1 - progress.value);
    return {
      strokeDashoffset,
    };
  });

  const animatedStyle = useAnimatedProps(() => ({
    transform: [{ scale: scale.value }],
  }));

  const displayValue = Math.round(value);
  const gradientId = `gradient_${label}_${Date.now()}`;

  return (
    <AnimatedAPI.View style={[styles.container, animatedStyle, { width: size, height: size }]}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFillObject}>
        <Defs>
          {gradientColors && (
            <LinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={gradientColors[0]} stopOpacity="1" />
              <Stop offset="100%" stopColor={gradientColors[1]} stopOpacity="1" />
            </LinearGradient>
          )}
        </Defs>
        <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
          {/* Background circle */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors.border.subtle}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
          />
          {/* Progress circle */}
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={gradientColors ? `url(#${gradientId})` : color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={circumference}
            strokeLinecap="round"
            animatedProps={animatedProps}
          />
        </G>
      </Svg>

      <View style={styles.centerContent}>
        {showValue && (
          <Text style={[styles.value, { fontSize: size * 0.28 }]}>
            {displayValue}
            {unit && <Text style={styles.unit}>{unit}</Text>}
          </Text>
        )}
        {label && <Text style={styles.label}>{label}</Text>}
      </View>
    </AnimatedAPI.View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerContent: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  value: {
    ...typography.metricMedium,
    color: colors.text.primary,
    includeFontPadding: false,
  },
  unit: {
    ...typography.bodyLarge,
    color: colors.text.secondary,
  },
  label: {
    ...typography.metricLabel,
    color: colors.text.tertiary,
    marginTop: spacing.xxs,
  },
});

export default MetricRing;