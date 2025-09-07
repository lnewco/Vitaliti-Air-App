import React from 'react';
import { Text, StyleSheet, ActivityIndicator, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
} from 'react-native-reanimated';
// import HapticFeedback from 'react-native-haptic-feedback'; // Disabled for Expo Go
import colors from '../colors';
import typography from '../typography';
import spacing from '../spacing';

const PremiumButton = ({
  title,
  onPress,
  variant = 'primary', // primary, secondary, ghost
  size = 'large', // large, medium, small
  disabled = false,
  loading = false,
  icon = null,
  fullWidth = false,
  style,
}) => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const handlePressIn = () => {
    if (!disabled && !loading) {
      scale.value = withSpring(0.96, {
        damping: 15,
        stiffness: 400,
      });
      // HapticFeedback.trigger('impactMedium'); // Disabled for Expo Go
    }
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, {
      damping: 15,
      stiffness: 400,
    });
  };

  const handlePress = () => {
    if (!disabled && !loading && onPress) {
      // Add a subtle bounce animation
      scale.value = withSequence(
        withSpring(0.95, { damping: 15, stiffness: 400 }),
        withSpring(1, { damping: 10, stiffness: 300 })
      );
      onPress();
    }
  };

  const getButtonStyles = () => {
    const baseStyles = [styles.button, styles[`button_${size}`]];
    
    if (variant === 'secondary') {
      baseStyles.push(styles.buttonSecondary);
    } else if (variant === 'ghost') {
      baseStyles.push(styles.buttonGhost);
    }
    
    if (fullWidth) {
      baseStyles.push(styles.fullWidth);
    }
    
    if (disabled || loading) {
      baseStyles.push(styles.disabled);
    }
    
    return baseStyles;
  };

  const getTextStyles = () => {
    const baseStyles = [
      styles.text,
      styles[`text_${size}`],
      variant === 'primary' ? styles.textPrimary : styles.textSecondary,
    ];
    
    if (disabled || loading) {
      baseStyles.push(styles.textDisabled);
    }
    
    return baseStyles;
  };

  const buttonContent = (
    <>
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? colors.text.primary : colors.brand.accent}
          size={size === 'small' ? 'small' : 'small'}
        />
      ) : (
        <>
          {icon && icon}
          <Text style={getTextStyles()}>{title}</Text>
        </>
      )}
    </>
  );

  if (variant === 'primary') {
    return (
      <Animated.View style={[animatedStyle, fullWidth && styles.fullWidth, style]}>
        <LinearGradient
          colors={
            disabled || loading
              ? [colors.components.button.primary.disabled, colors.components.button.primary.disabled]
              : [colors.brand.accent, colors.brand.secondary]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={getButtonStyles()}
        >
          <TouchableOpacity
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={handlePress}
            disabled={disabled || loading}
            activeOpacity={1}
            style={styles.touchableContent}
          >
            {buttonContent}
          </TouchableOpacity>
        </LinearGradient>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[animatedStyle, fullWidth && styles.fullWidth, style]}>
      <TouchableOpacity
        style={getButtonStyles()}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        disabled={disabled || loading}
        activeOpacity={0.8}
      >
        {buttonContent}
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: spacing.radius.button,
    overflow: 'hidden',
  },
  touchableContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  button_large: {
    height: 52,
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
  },
  button_medium: {
    height: 44,
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  button_small: {
    height: 36,
    paddingHorizontal: spacing.sm,
    gap: spacing.xxs,
  },
  buttonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.components.button.secondary.border,
  },
  buttonGhost: {
    backgroundColor: 'transparent',
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    includeFontPadding: false,
  },
  text_large: {
    ...typography.buttonLarge,
  },
  text_medium: {
    ...typography.buttonMedium,
  },
  text_small: {
    ...typography.buttonSmall,
  },
  textPrimary: {
    color: colors.text.primary,
  },
  textSecondary: {
    color: colors.text.secondary,
  },
  textDisabled: {
    color: colors.text.tertiary,
  },
});

export default PremiumButton;