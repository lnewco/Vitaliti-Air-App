import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View } from 'react-native';
import { useAppTheme } from '../../theme';

const Button = ({
  title,
  onPress,
  variant = 'primary', // primary, secondary, ghost, danger
  size = 'medium', // small, medium, large
  disabled = false,
  loading = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  style,
  textStyle,
  ...props
}) => {
  const { colors, typography, spacing, shadows } = useAppTheme();
  
  const styles = StyleSheet.create({
    base: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: spacing.borderRadius.md,
    },

    // Variants
    primary: {
      backgroundColor: colors.primary[500],
      ...shadows.md,
    },
    primaryDisabled: {
      backgroundColor: colors.primary[300],
      ...shadows.none,
    },
    
    secondary: {
      backgroundColor: colors.surface.background,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    secondaryDisabled: {
      backgroundColor: colors.surface.background,
      borderColor: colors.border.light,
    },
    
    ghost: {
      backgroundColor: 'transparent',
    },
    ghostDisabled: {
      opacity: 0.5,
    },
    
    danger: {
      backgroundColor: colors.error[500],
      ...shadows.md,
    },
    dangerDisabled: {
      backgroundColor: colors.error[300],
      ...shadows.none,
    },

    // Sizes
    small: {
      paddingVertical: spacing.buttonPadding.small.vertical,
      paddingHorizontal: spacing.buttonPadding.small.horizontal,
    },
    medium: {
      paddingVertical: spacing.buttonPadding.medium.vertical,
      paddingHorizontal: spacing.buttonPadding.medium.horizontal,
    },
    large: {
      paddingVertical: spacing.buttonPadding.large.vertical,
      paddingHorizontal: spacing.buttonPadding.large.horizontal,
    },

    // Text styles
    text: {
      textAlign: 'center',
    },
    primaryText: {
      color: colors.text.inverse,
      ...typography.styles.buttonMedium,
    },
    secondaryText: {
      color: colors.text.primary,
      ...typography.styles.buttonMedium,
    },
    ghostText: {
      color: colors.primary[500],
      ...typography.styles.buttonMedium,
    },
    dangerText: {
      color: colors.text.inverse,
      ...typography.styles.buttonMedium,
    },
    
    smallText: {
      ...typography.styles.buttonSmall,
    },
    mediumText: {
      ...typography.styles.buttonMedium,
    },
    largeText: {
      ...typography.styles.buttonLarge,
    },

    // States
    disabled: {
      opacity: 0.6,
    },
    disabledText: {
      color: colors.text.disabled,
    },
    fullWidth: {
      width: '100%',
    },

    // Icon spacing
    contentContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    iconLeft: {
      marginRight: spacing.xs,
    },
    iconRight: {
      marginLeft: spacing.xs,
    },
  });

  const buttonStyles = [
    styles.base,
    styles[variant],
    styles[size],
    fullWidth && styles.fullWidth,
    disabled && styles.disabled,
    disabled && styles[`${variant}Disabled`],
    style,
  ];

  const textStyles = [
    styles.text,
    styles[`${variant}Text`],
    styles[`${size}Text`],
    disabled && styles.disabledText,
    textStyle,
  ];

  const content = (
    <>
      {loading ? (
        <ActivityIndicator 
          color={variant === 'primary' ? colors.text.inverse : colors.primary[500]} 
          size="small" 
        />
      ) : (
        <View style={styles.contentContainer}>
          {icon && iconPosition === 'left' && <View style={styles.iconLeft}>{icon}</View>}
          <Text style={textStyles}>{title}</Text>
          {icon && iconPosition === 'right' && <View style={styles.iconRight}>{icon}</View>}
        </View>
      )}
    </>
  );

  return (
    <TouchableOpacity
      style={buttonStyles}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      {...props}
    >
      {content}
    </TouchableOpacity>
  );
};

export default Button;