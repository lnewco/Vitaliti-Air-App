import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing } from '../../design-system';

// Icon wrapper component
// This will be replaced with react-native-vector-icons once installed
// For now, using emojis as placeholders with proper styling
const Icon = ({ 
  name, 
  size = 'md',
  color = colors.text.primary,
  style,
  type = 'emoji', // Will support 'material', 'ionicons', 'feather' etc.
}) => {
  const iconSize = spacing.iconSize[size] || spacing.iconSize.md;
  
  // Temporary emoji mapping - will be replaced with vector icons
  const emojiMap = {
    // Navigation
    'home': '🏠',
    'settings': '⚙️',
    'profile': '👤',
    'history': '📊',
    'back': '←',
    'forward': '→',
    'close': '✕',
    'menu': '☰',
    
    // Health/Medical
    'heart': '❤️',
    'lungs': '🫁',
    'pulse': '💓',
    'health': '🏥',
    'medical': '⚕️',
    
    // Training/Exercise
    'training': '💪',
    'calibration': '🎯',
    'timer': '⏱️',
    'play': '▶️',
    'pause': '⏸️',
    'stop': '⏹️',
    'skip': '⏭️',
    
    // Status
    'success': '✅',
    'warning': '⚠️',
    'error': '❌',
    'info': 'ℹ️',
    'help': '❓',
    'notification': '🔔',
    
    // Data/Analytics
    'chart': '📈',
    'data': '📊',
    'report': '📋',
    'calendar': '📅',
    
    // Devices
    'bluetooth': '📶',
    'device': '📱',
    'connected': '🔗',
    'disconnected': '🔌',
    
    // Actions
    'add': '➕',
    'remove': '➖',
    'edit': '✏️',
    'delete': '🗑️',
    'save': '💾',
    'share': '📤',
    'download': '📥',
    'refresh': '🔄',
    
    // Misc
    'star': '⭐',
    'flag': '🚩',
    'lock': '🔒',
    'unlock': '🔓',
    'search': '🔍',
    'filter': '🔽',
    'sort': '↕️',
    'check': '✓',
  };

  const iconContent = emojiMap[name] || '❓';

  return (
    <View style={[
      styles.container,
      { width: iconSize, height: iconSize },
      style
    ]}>
      <Text style={[
        styles.emoji,
        { fontSize: iconSize * 0.8, color }
      ]}>
        {iconContent}
      </Text>
    </View>
  );
};

// Icon sizes preset
Icon.sizes = {
  xs: spacing.iconSize.xs,
  sm: spacing.iconSize.sm,
  md: spacing.iconSize.md,
  lg: spacing.iconSize.lg,
  xl: spacing.iconSize.xl,
  xxl: spacing.iconSize.xxl,
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    textAlign: 'center',
  },
});

export default Icon;