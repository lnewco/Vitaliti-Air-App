/**
 * @fileoverview Reusable dashboard header component
 */

import React from 'react';
import PropTypes from 'prop-types';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Animated } from 'react-native';
import { AnimatedAPI, isExpoGo } from '../../utils/animationHelpers';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, typography, spacing } from '../../design-system';
import VitalitiLogo from '../common/VitalitiLogo';
import StatusBadge from './StatusBadge';
import SafeIcon from '../base/SafeIcon';

/**
 * DashboardHeader - Reusable header for dashboard screens
 * 
 * @component
 * @param {Object} props - Component props
 * @param {Object} props.animatedStyle - Animated style for header
 * @param {Function} props.onSettingsPress - Settings button handler
 * @param {boolean} props.isLoading - Loading state
 * @param {string} props.statusText - Status badge text
 * @param {string} props.greeting - Greeting message
 * @param {string} props.dateText - Formatted date text
 * @param {string} props.userName - User's name for greeting
 * @returns {React.ReactElement} Rendered header
 */
const DashboardHeader = ({ 
  animatedStyle,
  onSettingsPress,
  isLoading,
  statusText,
  greeting,
  dateText,
  userName,
}) => {
  return (
    <AnimatedAPI.View style={[styles.header, animatedStyle]}>
      <LinearGradient
        colors={['rgba(0,0,0,0.8)', 'rgba(0,0,0,0)']}
        style={styles.headerGradient}
      />
      
      <View style={styles.headerTop}>
        <View style={styles.logoContainer}>
          <VitalitiLogo width={32} height={32} />
        </View>
        
        <StatusBadge 
          isLoading={isLoading}
          status={isLoading ? 'disconnected' : 'connected'}
          text={statusText}
        />
        
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={onSettingsPress}
        >
          <SafeIcon name="settings" size={20} color={colors.text.secondary} />
        </TouchableOpacity>
      </View>
      
      <View style={styles.headerContent}>
        <Text style={styles.greeting}>
          {greeting}{userName ? `, ${userName}` : ''}
        </Text>
        <Text style={styles.dateText}>{dateText}</Text>
      </View>
    </AnimatedAPI.View>
  );
};

const styles = StyleSheet.create({
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingTop: 60,
    paddingBottom: spacing.xl,
  },
  headerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  logoContainer: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContent: {
    paddingHorizontal: spacing.lg,
  },
  greeting: {
    ...typography.h2,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  dateText: {
    ...typography.body.medium,
    color: colors.text.tertiary,
  },
});

DashboardHeader.propTypes = {
  animatedStyle: PropTypes.object,
  onSettingsPress: PropTypes.func.isRequired,
  isLoading: PropTypes.bool,
  statusText: PropTypes.string.isRequired,
  greeting: PropTypes.string.isRequired,
  dateText: PropTypes.string.isRequired,
  userName: PropTypes.string,
};

export default DashboardHeader;