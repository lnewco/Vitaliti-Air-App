import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Animated } from 'react-native';
import {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate,
  Easing,
  AnimatedAPI,
  isExpoGo,
  createAnimatedComponent
} from '../../utils/animationHelpers';
// import HapticFeedback from 'react-native-haptic-feedback'; // Disabled for Expo Go
// import { BlurView } from '@react-native-community/blur'; // Disabled for Expo Go
import Ionicons from 'react-native-vector-icons/Ionicons';
import colors from '../colors';
import typography from '../typography';
import spacing from '../spacing';

const { width: screenWidth } = Dimensions.get('window');
const TAB_WIDTH = (screenWidth - spacing.screenPadding * 2) / 2;

const TabIcon = ({ name, focused, label }) => {
  const scale = useSharedValue(focused ? 1 : 1);
  const opacity = useSharedValue(focused ? 1 : 0.4);

  useEffect(() => {
    scale.value = withSpring(focused ? 1.1 : 1, {
      damping: 15,
      stiffness: 200,
    });
    opacity.value = withTiming(focused ? 1 : 0.4, {
      duration: 200,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    });
  }, [focused]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <AnimatedAPI.View style={[styles.tabIcon, animatedStyle]}>
      <Ionicons
        name={name}
        size={24}
        color={focused ? colors.brand.primary : colors.text.tertiary}
      />
      {focused && (
        <View style={styles.activeIndicator} />
      )}
      <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>
        {label}
      </Text>
    </AnimatedAPI.View>
  );
};

const FloatingTabBar = ({ state, descriptors, navigation }) => {
  const insets = useSafeAreaInsets();
  const indicatorPosition = useSharedValue(0);

  useEffect(() => {
    indicatorPosition.value = withSpring(state.index * TAB_WIDTH, {
      damping: 18,
      stiffness: 120,
    });
  }, [state.index]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorPosition.value }],
  }));

  const tabIcons = {
    Dashboard: 'home-outline',
    Profile: 'person-outline',
  };

  const tabLabels = {
    Dashboard: 'Home',
    Profile: 'Profile',
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <View style={styles.tabBarWrapper}>
        <View style={[StyleSheet.absoluteFillObject, styles.androidBackground]} />
        
        <View style={styles.tabBar}>
          {/* Active tab background indicator */}
          <AnimatedAPI.View style={[styles.activeTabBackground, indicatorStyle]} />
          
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const isFocused = state.index === index;

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });

              if (!isFocused && !event.defaultPrevented) {
                // HapticFeedback.trigger('impactLight'); // Disabled for Expo Go
                navigation.navigate(route.name);
              }
            };

            const onLongPress = () => {
              // HapticFeedback.trigger('impactMedium'); // Disabled for Expo Go
              navigation.emit({
                type: 'tabLongPress',
                target: route.key,
              });
            };

            return (
              <TouchableOpacity
                key={route.key}
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : {}}
                accessibilityLabel={options.tabBarAccessibilityLabel}
                testID={options.tabBarTestID}
                onPress={onPress}
                onLongPress={onLongPress}
                style={styles.tab}
                activeOpacity={0.8}
              >
                <TabIcon
                  name={tabIcons[route.name]}
                  focused={isFocused}
                  label={tabLabels[route.name]}
                />
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
  },
  tabBarWrapper: {
    marginHorizontal: spacing.screenPadding,
    marginBottom: spacing.md,
    height: 72,
    borderRadius: spacing.radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border.subtle,
    backgroundColor: 'transparent',
  },
  androidBackground: {
    backgroundColor: 'rgba(12, 14, 18, 0.95)',
  },
  tabBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
  },
  activeTabBackground: {
    position: 'absolute',
    width: TAB_WIDTH - spacing.xs,
    height: 56,
    backgroundColor: colors.border.subtle,
    borderRadius: spacing.radius.lg,
    marginLeft: spacing.xxs,
  },
  tab: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
  },
  tabIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: -8,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.brand.accent,
  },
  tabLabel: {
    ...typography.micro,
    color: colors.text.tertiary,
    marginTop: spacing.xxs,
  },
  tabLabelActive: {
    color: colors.text.primary,
  },
});

export default FloatingTabBar;