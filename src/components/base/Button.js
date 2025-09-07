import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View } from 'react-native';
import { colors, typography, spacing } from '../../design-system';

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
  // Design tokens imported from design-system
  
  const styles = StyleSheet.create({
    base: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: spacing.borderRadius.md,
    },

    // Variants
    primary: {
      backgroundColor: colors.brand.accent,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 6,
    },
    primaryDisabled: {
      backgroundColor: colors.components.button.primary.disabled,
      shadowOpacity: 0,
    },
    
    secondary: {
      backgroundColor: colors.components.button.secondary.background,
      borderWidth: 1,
      borderColor: colors.components.button.secondary.border,
    },
    secondaryDisabled: {
      backgroundColor: colors.components.button.secondary.background,
      borderColor: colors.components.button.secondary.border,
    },
    
    ghost: {
      backgroundColor: 'transparent',
    },
    ghostDisabled: {
      opacity: 0.5,
    },
    
    danger: {
      backgroundColor: colors.semantic.error,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 6,
    },
    dangerDisabled: {
      backgroundColor: colors.semantic.error,
      shadowOpacity: 0,
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
      color: colors.brand.accent,
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
          color={variant === 'primary' ? colors.text.inverse : colors.brand.accent} 
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