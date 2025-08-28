import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, typography, spacing } from '../../design-system';

const FeedbackButton = ({ 
  label, 
  selected, 
  onPress, 
  style,
  compact = false 
}) => {
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 3,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View
      style={[
        { transform: [{ scale: scaleAnim }] },
        style
      ]}
    >
      <TouchableOpacity
        style={[
          styles.button,
          compact && styles.buttonCompact,
          selected && styles.buttonSelected
        ]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.8}
      >
        {selected && (
          <LinearGradient
            colors={[colors.brand.accent + '30', colors.brand.accent + '15']}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
        )}
        <Text style={[
          styles.label,
          compact && styles.labelCompact,
          selected && styles.labelSelected
        ]}>
          {label}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: spacing.radius.md,
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.default,
    minHeight: 48,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  buttonCompact: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: 36,
  },
  buttonSelected: {
    borderColor: colors.brand.accent,
    backgroundColor: 'transparent',
  },
  label: {
    ...typography.bodyMedium,
    color: colors.text.tertiary,
    textAlign: 'center',
    fontWeight: '500',
  },
  labelCompact: {
    ...typography.caption,
  },
  labelSelected: {
    color: colors.text.primary,
    fontWeight: '600',
  },
});

export default FeedbackButton;