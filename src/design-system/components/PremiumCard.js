import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  interpolate,
} from 'react-native-reanimated';
// import HapticFeedback from 'react-native-haptic-feedback'; // Disabled for Expo Go
import colors from '../colors';
import typography from '../typography';
import spacing from '../spacing';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

const PremiumCard = ({
  children,
  onPress,
  style,
  gradient = false,
  borderGlow = false,
  hapticType = 'impactLight',
  disabled = false,
  padding = spacing.cardPadding,
}) => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const handlePressIn = () => {
    if (!disabled) {
      scale.value = withSpring(0.98, {
        damping: 15,
        stiffness: 400,
      });
      opacity.value = withSpring(0.9);
      // HapticFeedback.trigger(hapticType); // Disabled for Expo Go
    }
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, {
      damping: 15,
      stiffness: 400,
    });
    opacity.value = withSpring(1);
  };

  const cardContent = (
    <View style={[styles.cardContent, { padding }]}>
      {children}
    </View>
  );

  const cardBase = gradient ? (
    <LinearGradient
      colors={[colors.components.card.background, colors.background.secondary]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.card,
        borderGlow && styles.borderGlow,
        disabled && styles.disabled,
        style,
      ]}
    >
      {cardContent}
    </LinearGradient>
  ) : (
    <View
      style={[
        styles.card,
        borderGlow && styles.borderGlow,
        disabled && styles.disabled,
        style,
      ]}
    >
      {cardContent}
    </View>
  );

  if (onPress && !disabled) {
    return (
      <AnimatedTouchable
        activeOpacity={1}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={animatedStyle}
      >
        {cardBase}
      </AnimatedTouchable>
    );
  }

  return cardBase;
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.components.card.background,
    borderRadius: spacing.radius.card,
    borderWidth: 1,
    borderColor: colors.components.card.border,
    overflow: 'hidden',
  },
  cardContent: {
    // Content styles applied via padding prop
  },
  borderGlow: {
    shadowColor: colors.brand.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  disabled: {
    opacity: 0.5,
  },
});

export default PremiumCard;