import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, spacing, typography } from '../../design-system';

// Main Card component
const Card = ({ children, style, padding = true, shadow = 'md', elevated = false, pressable = false, onPress, ...props }) => {
  // Design tokens imported from design-system
  
  const cardStyles = [
    {
      backgroundColor: elevated ? colors.background.elevated : colors.background.tertiary,
      borderRadius: spacing.borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    padding && { padding: spacing.cardPadding },
    shadow === 'md' ? {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 3
    } : {},
    style
  ];
  
  if (pressable && onPress) {
    return (
      <TouchableOpacity
        style={cardStyles}
        onPress={onPress}
        activeOpacity={0.8}
        {...props}
      >
        {children}
      </TouchableOpacity>
    );
  }
  
  return (
    <View style={cardStyles} {...props}>
      {children}
    </View>
  );
};

// Card Header subcomponent
Card.Header = ({ 
  title, 
  subtitle, 
  icon, 
  badge, 
  action,
  style,
  titleStyle,
  subtitleStyle,
}) => {
  // Design tokens imported from design-system
  
  const styles = StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    headerIcon: {
      marginRight: spacing.sm,
    },
    headerText: {
      flex: 1,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    headerTitle: {
      ...typography.styles.h4,
      color: colors.text.primary,
    },
    headerSubtitle: {
      ...typography.styles.bodySmall,
      color: colors.text.secondary,
      marginTop: spacing.xxs,
    },
    headerAction: {
      marginLeft: spacing.md,
    },
    badge: {
      backgroundColor: colors.background.elevated,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xxs,
      borderRadius: spacing.borderRadius.full,
      marginLeft: spacing.sm,
    },
    badgeText: {
      ...typography.styles.captionBold,
      color: colors.brand.accent,
      textTransform: 'uppercase',
    },
  });
  
  return (
    <View style={[styles.header, style]}>
      <View style={styles.headerLeft}>
        {icon && <View style={styles.headerIcon}>{icon}</View>}
        <View style={styles.headerText}>
          {title && (
            <View style={styles.titleRow}>
              {typeof title === 'string' ? (
                <Text style={[styles.headerTitle, titleStyle]}>{title}</Text>
              ) : (
                title
              )}
              {badge && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{badge}</Text>
                </View>
              )}
            </View>
          )}
          {subtitle && (
            typeof subtitle === 'string' ? (
              <Text style={[styles.headerSubtitle, subtitleStyle]}>{subtitle}</Text>
            ) : (
              subtitle
            )
          )}
        </View>
      </View>
      {action && <View style={styles.headerAction}>{action}</View>}
    </View>
  );
};

// Card Body subcomponent
Card.Body = ({ children, style, noPadding = false }) => {
  // Design tokens imported from design-system
  
  const styles = StyleSheet.create({
    body: {
      paddingVertical: spacing.sm,
    },
    bodyNoPadding: {
      paddingVertical: 0,
    },
  });
  
  return (
    <View style={[styles.body, noPadding && styles.bodyNoPadding, style]}>
      {children}
    </View>
  );
};

// Card Footer subcomponent
Card.Footer = ({ 
  children, 
  style, 
  divider = true,
  justify = 'space-between' // 'start', 'end', 'center', 'space-between', 'space-around'
}) => {
  // Design tokens imported from design-system
  
  const justifyContent = {
    'start': 'flex-start',
    'end': 'flex-end',
    'center': 'center',
    'space-between': 'space-between',
    'space-around': 'space-around',
  }[justify] || 'space-between';
  
  const styles = StyleSheet.create({
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop: spacing.md,
    },
    footerDivider: {
      borderTopWidth: 1,
      borderTopColor: colors.border.light,
      marginTop: spacing.md,
    },
  });

  return (
    <View style={[
      styles.footer, 
      divider && styles.footerDivider,
      { justifyContent },
      style
    ]}>
      {children}
    </View>
  );
};

// Card Divider subcomponent
Card.Divider = ({ style }) => {
  // Design tokens imported from design-system
  
  const styles = StyleSheet.create({
    divider: {
      height: 1,
      backgroundColor: colors.border.light,
      marginVertical: spacing.md,
    },
  });
  
  return <View style={[styles.divider, style]} />;
};


export default Card;
