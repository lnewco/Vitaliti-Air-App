import React from 'react';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Feather from 'react-native-vector-icons/Feather';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';
import { colors, spacing } from '../../design-system';

// Map icon names to vector icons
const iconMap = {
  // Navigation
  'home': { family: 'MaterialIcons', name: 'home' },
  'settings': { family: 'MaterialIcons', name: 'settings' },
  'profile': { family: 'MaterialIcons', name: 'person' },
  'history': { family: 'MaterialIcons', name: 'history' },
  'back': { family: 'MaterialIcons', name: 'arrow-back' },
  'forward': { family: 'MaterialIcons', name: 'arrow-forward' },
  'close': { family: 'MaterialIcons', name: 'close' },
  'menu': { family: 'MaterialIcons', name: 'menu' },
  
  // Health/Medical
  'heart': { family: 'MaterialCommunityIcons', name: 'heart-pulse' },
  'lungs': { family: 'MaterialCommunityIcons', name: 'lungs' },
  'pulse': { family: 'MaterialCommunityIcons', name: 'pulse' },
  'health': { family: 'MaterialIcons', name: 'local-hospital' },
  'medical': { family: 'MaterialIcons', name: 'medical-services' },
  
  // Training/Exercise
  'training': { family: 'MaterialIcons', name: 'fitness-center' },
  'calibration': { family: 'MaterialCommunityIcons', name: 'target' },
  'timer': { family: 'MaterialIcons', name: 'timer' },
  'play': { family: 'MaterialIcons', name: 'play-arrow' },
  'pause': { family: 'MaterialIcons', name: 'pause' },
  'stop': { family: 'MaterialIcons', name: 'stop' },
  'skip': { family: 'MaterialIcons', name: 'skip-next' },
  
  // Status
  'success': { family: 'MaterialIcons', name: 'check-circle' },
  'warning': { family: 'MaterialIcons', name: 'warning' },
  'error': { family: 'MaterialIcons', name: 'error' },
  'info': { family: 'MaterialIcons', name: 'info' },
  'help': { family: 'MaterialIcons', name: 'help-outline' },
  'notification': { family: 'MaterialIcons', name: 'notifications' },
  
  // Data/Analytics
  'chart': { family: 'MaterialIcons', name: 'show-chart' },
  'data': { family: 'MaterialIcons', name: 'analytics' },
  'report': { family: 'MaterialIcons', name: 'assessment' },
  'calendar': { family: 'MaterialIcons', name: 'calendar-today' },
  
  // Devices
  'bluetooth': { family: 'MaterialIcons', name: 'bluetooth' },
  'bluetooth-connected': { family: 'MaterialIcons', name: 'bluetooth-connected' },
  'device': { family: 'MaterialIcons', name: 'devices' },
  'connected': { family: 'MaterialIcons', name: 'link' },
  'disconnected': { family: 'MaterialIcons', name: 'link-off' },
  
  // Actions
  'add': { family: 'MaterialIcons', name: 'add' },
  'remove': { family: 'MaterialIcons', name: 'remove' },
  'edit': { family: 'MaterialIcons', name: 'edit' },
  'delete': { family: 'MaterialIcons', name: 'delete' },
  'save': { family: 'MaterialIcons', name: 'save' },
  'share': { family: 'MaterialIcons', name: 'share' },
  'download': { family: 'MaterialIcons', name: 'download' },
  'refresh': { family: 'MaterialIcons', name: 'refresh' },
  
  // Misc
  'star': { family: 'MaterialIcons', name: 'star' },
  'flag': { family: 'MaterialIcons', name: 'flag' },
  'lock': { family: 'MaterialIcons', name: 'lock' },
  'unlock': { family: 'MaterialIcons', name: 'lock-open' },
  'search': { family: 'MaterialIcons', name: 'search' },
  'filter': { family: 'MaterialIcons', name: 'filter-list' },
  'sort': { family: 'MaterialIcons', name: 'sort' },
  'check': { family: 'MaterialIcons', name: 'check' },
  'chevron-right': { family: 'MaterialIcons', name: 'chevron-right' },
  'arrow-right': { family: 'MaterialIcons', name: 'arrow-forward' },
};

const VectorIcon = ({
  name,
  size = 'md',
  color = colors.text.primary,
  style,
  ...props
}) => {
  const iconSize = typeof size === 'number' ? size : spacing.iconSize[size] || spacing.iconSize.md;
  const iconConfig = iconMap[name];

  if (!iconConfig) {
    // Fallback to MaterialIcons with the provided name
    return (
      <MaterialIcons
        name={name}
        size={iconSize}
        color={color}
        style={style}
        {...props}
      />
    );
  }

  const IconComponent = {
    'MaterialIcons': MaterialIcons,
    'MaterialCommunityIcons': MaterialCommunityIcons,
    'Ionicons': Ionicons,
    'Feather': Feather,
    'FontAwesome': FontAwesome,
    'FontAwesome5': FontAwesome5,
  }[iconConfig.family] || MaterialIcons;

  return (
    <IconComponent
      name={iconConfig.name}
      size={iconSize}
      color={color}
      style={style}
      {...props}
    />
  );
};

export default VectorIcon;