import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import Constants from 'expo-constants';
import { colors, spacing } from '../../design-system';

// Import VectorIcon with error handling
let VectorIcon = null;
try {
  VectorIcon = require('./VectorIcon').default;
} catch (error) {
  console.log('📱 VectorIcon not available, using emoji fallbacks');
}

const SafeIcon = ({ 
  name, 
  size = 'md', 
  color, 
  style 
}) => {
  // Design tokens imported from design-system
  const isExpoGo = Constants.appOwnership === 'expo';
  const isProduction = Constants.appOwnership === 'standalone' && !__DEV__;
  
  // Emoji fallback mapping for production builds
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
    'chevron-right': '→',
    
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

  const iconSize = spacing.iconSize[size] || spacing.iconSize.md;
  const iconColor = color || colors.text.primary;

  // Use emoji fallback in Expo Go, production, or if VectorIcon fails
  if (isExpoGo || isProduction || !VectorIcon) {
    const emojiIcon = emojiMap[name] || '❓';
    
    return (
      <View style={[
        styles.container,
        { width: iconSize, height: iconSize },
        style
      ]}>
        <Text style={[
          styles.emoji,
          { fontSize: iconSize * 0.8, color: iconColor }
        ]}>
          {emojiIcon}
        </Text>
      </View>
    );
  }

  // Use VectorIcon in development builds
  try {
    return (
      <VectorIcon 
        name={name} 
        size={size} 
        color={color} 
        style={style} 
      />
    );
  } catch (error) {
    console.warn('⚠️ VectorIcon failed, using emoji fallback:', error);
    const emojiIcon = emojiMap[name] || '❓';
    
    return (
      <View style={[
        styles.container,
        { width: iconSize, height: iconSize },
        style
      ]}>
        <Text style={[
          styles.emoji,
          { fontSize: iconSize * 0.8, color: iconColor }
        ]}>
          {emojiIcon}
        </Text>
      </View>
    );
  }
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

export default SafeIcon;
