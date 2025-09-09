/**
 * @fileoverview Reusable status badge component with indicator dot
 */

import React from 'react';
import PropTypes from 'prop-types';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { colors, typography, spacing } from '../../design-system';

/**
 * StatusBadge - Displays status with indicator dot or loading spinner
 * 
 * @component
 * @param {Object} props - Component props
 * @param {boolean} props.isLoading - Show loading spinner instead of dot
 * @param {string} props.status - Status type ('connected', 'disconnected', 'error', 'warning')
 * @param {string} props.text - Status text to display
 * @param {Object} props.style - Additional styles
 * @returns {React.ReactElement} Rendered status badge
 */
const StatusBadge = ({ isLoading, status = 'connected', text, style }) => {
  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return '#4ADE80';
      case 'disconnected':
        return '#FF6B6B';
      case 'error':
        return '#FF3B30';
      case 'warning':
        return '#FFA500';
      default:
        return colors.text.tertiary;
    }
  };

  return (
    <View style={[styles.container, style]}>
      {isLoading ? (
        <ActivityIndicator size="small" color={colors.text.tertiary} />
      ) : (
        <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
      )}
      <Text style={styles.statusText}>{text}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: spacing.xs,
  },
  statusText: {
    ...typography.body.small,
    color: colors.text.tertiary,
  },
});

StatusBadge.propTypes = {
  isLoading: PropTypes.bool,
  status: PropTypes.oneOf(['connected', 'disconnected', 'error', 'warning']),
  text: PropTypes.string.isRequired,
  style: PropTypes.object,
};

export default StatusBadge;