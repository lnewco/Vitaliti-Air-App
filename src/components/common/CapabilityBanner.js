/**
 * CapabilityBanner - Shows current environment capabilities during development
 * 
 * This component displays a banner showing which features are available
 * in the current runtime environment. Only shown in development mode.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import runtimeEnvironment from '../../utils/RuntimeEnvironment';

const CapabilityBanner = ({ style }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [animation] = useState(new Animated.Value(0));
  
  // Only show in development
  if (!__DEV__) return null;
  
  const capabilities = runtimeEnvironment.capabilities;
  const environment = runtimeEnvironment.environmentName;
  
  const toggleExpanded = () => {
    const toValue = isExpanded ? 0 : 1;
    setIsExpanded(!isExpanded);
    
    Animated.spring(animation, {
      toValue,
      useNativeDriver: false,
    }).start();
  };
  
  const bannerHeight = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [40, 200],
  });
  
  const getEnvironmentColor = () => {
    if (environment === 'Expo Go') return '#FF6B6B';
    if (environment === 'Development Build') return '#4ECDC4';
    return '#95E77E';
  };
  
  const renderCapability = (name, isAvailable) => {
    return (
      <View key={name} style={styles.capability}>
        <Text style={[styles.capabilityIcon, { color: isAvailable ? '#4CAF50' : '#FF5252' }]}>
          {isAvailable ? '✓' : '✗'}
        </Text>
        <Text style={[styles.capabilityText, { opacity: isAvailable ? 1 : 0.5 }]}>
          {name}
        </Text>
      </View>
    );
  };
  
  return (
    <Animated.View style={[styles.container, { height: bannerHeight }, style]}>
      <TouchableOpacity onPress={toggleExpanded} activeOpacity={0.8}>
        <View style={[styles.header, { backgroundColor: getEnvironmentColor() }]}>
          <Text style={styles.headerText}>
            🔧 {environment} Mode
          </Text>
          <Text style={styles.arrow}>
            {isExpanded ? '▼' : '▶'}
          </Text>
        </View>
      </TouchableOpacity>
      
      {isExpanded && (
        <View style={styles.content}>
          <Text style={styles.sectionTitle}>Available Features:</Text>
          <View style={styles.capabilityList}>
            {renderCapability('Live Activities', capabilities.liveActivities)}
            {renderCapability('Background Timer', capabilities.backgroundTimer)}
            {renderCapability('Background BLE', capabilities.backgroundBLE)}
            {renderCapability('Rich Notifications', capabilities.richNotifications)}
            {renderCapability('Keep Awake', capabilities.keepAwake)}
            {renderCapability('Background Audio', capabilities.backgroundAudio)}
          </View>
          
          {environment === 'Expo Go' && (
            <Text style={styles.warning}>
              ⚠️ Limited features in Expo Go.{'\n'}
              Build with `eas build` for full functionality.
            </Text>
          )}
        </View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F8F9FA',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  headerText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  arrow: {
    color: '#FFFFFF',
    fontSize: 12,
  },
  content: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  capabilityList: {
    marginTop: 8,
  },
  capability: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  capabilityIcon: {
    fontSize: 16,
    marginRight: 8,
    fontWeight: 'bold',
  },
  capabilityText: {
    fontSize: 14,
    color: '#333',
  },
  warning: {
    marginTop: 12,
    fontSize: 12,
    color: '#FF6B6B',
    lineHeight: 18,
  },
});

export default CapabilityBanner;