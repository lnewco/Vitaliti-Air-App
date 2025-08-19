import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../../theme';

const Badge = ({
  label,
  variant = 'default', // default, primary, success, warning, error, info
  size = 'medium', // small, medium, large
  dot = false,
  count,
  maxCount = 99,
  style,
  textStyle,
}) => {
  const displayCount = count > maxCount ? `${maxCount}+` : count;
  const content = count !== undefined ? displayCount : label;

  if (dot) {
    return (
      <View style={[
        styles.dot,
        styles[`dot${size.charAt(0).toUpperCase() + size.slice(1)}`],
        styles[`${variant}Dot`],
        style,
      ]} />
    );
  }

  return (
    <View style={[
      styles.badge,
      styles[variant],
      styles[size],
      style,
    ]}>
      <Text style={[
        styles.text,
        styles[`${variant}Text`],
        styles[`${size}Text`],
        textStyle,
      ]}>
        {content}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: spacing.borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Variants
  default: {
    backgroundColor: colors.neutral[200],
  },
  primary: {
    backgroundColor: colors.primary[500],
  },
  success: {
    backgroundColor: colors.secondary[500],
  },
  warning: {
    backgroundColor: colors.warning[500],
  },
  error: {
    backgroundColor: colors.error[500],
  },
  info: {
    backgroundColor: colors.primary[100],
  },

  // Sizes
  small: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
    minWidth: 16,
    minHeight: 16,
  },
  medium: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    minWidth: 20,
    minHeight: 20,
  },
  large: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    minWidth: 24,
    minHeight: 24,
  },

  // Text styles
  text: {
    textAlign: 'center',
    fontWeight: '600',
  },
  defaultText: {
    color: colors.text.primary,
  },
  primaryText: {
    color: colors.text.inverse,
  },
  successText: {
    color: colors.text.inverse,
  },
  warningText: {
    color: colors.text.inverse,
  },
  errorText: {
    color: colors.text.inverse,
  },
  infoText: {
    color: colors.primary[700],
  },

  smallText: {
    ...typography.styles.caption,
    fontSize: 10,
  },
  mediumText: {
    ...typography.styles.caption,
  },
  largeText: {
    ...typography.styles.labelSmall,
  },

  // Dot styles
  dot: {
    borderRadius: spacing.borderRadius.full,
  },
  dotSmall: {
    width: 6,
    height: 6,
  },
  dotMedium: {
    width: 8,
    height: 8,
  },
  dotLarge: {
    width: 10,
    height: 10,
  },
  defaultDot: {
    backgroundColor: colors.neutral[400],
  },
  primaryDot: {
    backgroundColor: colors.primary[500],
  },
  successDot: {
    backgroundColor: colors.secondary[500],
  },
  warningDot: {
    backgroundColor: colors.warning[500],
  },
  errorDot: {
    backgroundColor: colors.error[500],
  },
  infoDot: {
    backgroundColor: colors.primary[300],
  },
});

export default Badge;