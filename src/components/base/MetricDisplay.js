import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors, spacing, shadows } from '../../theme';
import { Metric, MetricLabel, Caption, BodySmall } from './Typography';
import Badge from './Badge';

const MetricDisplay = ({
  value,
  unit,
  label,
  status,
  statusColor,
  trend,
  subtitle,
  size = 'medium', // small, medium, large
  align = 'center',
  style,
}) => {
  const getStatusColor = () => {
    if (statusColor) return statusColor;
    
    const statusColors = {
      good: colors.secondary[500],
      warning: colors.warning[500],
      danger: colors.error[500],
      neutral: colors.text.secondary,
    };
    
    return statusColors[status] || colors.text.primary;
  };

  const sizeStyles = {
    small: {
      valueSize: 24,
      unitSize: 14,
      labelSize: 12,
    },
    medium: {
      valueSize: 36,
      unitSize: 18,
      labelSize: 14,
    },
    large: {
      valueSize: 48,
      unitSize: 24,
      labelSize: 16,
    },
  };

  const currentSize = sizeStyles[size] || sizeStyles.medium;

  return (
    <View style={[styles.container, { alignItems: align }, style]}>
      {label && (
        <MetricLabel style={[styles.label, { textAlign: align }]}>
          {label}
        </MetricLabel>
      )}
      
      <View style={styles.valueContainer}>
        <Metric 
          style={[
            styles.value, 
            { fontSize: currentSize.valueSize, color: getStatusColor() }
          ]}
        >
          {value}
        </Metric>
        {unit && (
          <Caption 
            style={[
              styles.unit, 
              { fontSize: currentSize.unitSize, color: getStatusColor() }
            ]}
          >
            {unit}
          </Caption>
        )}
        {trend && (
          <View style={styles.trendContainer}>
            {trend === 'up' && <Caption color="success">↑</Caption>}
            {trend === 'down' && <Caption color="error">↓</Caption>}
            {trend === 'stable' && <Caption color="secondary">→</Caption>}
          </View>
        )}
      </View>

      {status && (
        <Badge 
          label={status} 
          variant={status === 'good' ? 'success' : status === 'warning' ? 'warning' : 'error'}
          size="small"
          style={styles.statusBadge}
        />
      )}

      {subtitle && (
        <BodySmall color="secondary" style={[styles.subtitle, { textAlign: align }]}>
          {subtitle}
        </BodySmall>
      )}
    </View>
  );
};

// Compound component for displaying multiple metrics in a row
MetricDisplay.Row = ({ children, style }) => {
  return (
    <View style={[styles.row, style]}>
      {React.Children.map(children, (child, index) => (
        <View style={styles.rowItem} key={index}>
          {child}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.sm,
  },
  label: {
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  value: {
    lineHeight: undefined, // Override default line height for better alignment
  },
  unit: {
    marginLeft: spacing.xs,
    marginBottom: spacing.xs,
  },
  trendContainer: {
    marginLeft: spacing.sm,
  },
  statusBadge: {
    marginTop: spacing.sm,
    alignSelf: 'center',
  },
  subtitle: {
    marginTop: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
  },
  rowItem: {
    flex: 1,
    alignItems: 'center',
  },
});

export default MetricDisplay;