import React from 'react';
import {
  TouchableOpacity,
  Text,
  View,
  StyleSheet,
} from 'react-native';
import SafeIcon from '../base/SafeIcon';
import { colors, typography, spacing } from '../../design-system';

const SensationTag = ({ 
  label, 
  icon,
  selected, 
  onPress 
}) => {
  return (
    <TouchableOpacity
      style={[
        styles.tag,
        selected && styles.tagSelected
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <SafeIcon 
        name={icon} 
        size="xs" 
        color={selected ? colors.text.primary : colors.text.tertiary} 
      />
      <Text style={[
        styles.label,
        selected && styles.labelSelected
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: spacing.radius.full,
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.default,
    gap: spacing.xs,
    marginRight: spacing.xs,
    marginBottom: spacing.xs,
  },
  tagSelected: {
    borderColor: colors.brand.accent,
    backgroundColor: colors.brand.accent + '10',
  },
  label: {
    ...typography.caption,
    color: colors.text.tertiary,
    fontWeight: '500',
  },
  labelSelected: {
    color: colors.text.primary,
    fontWeight: '600',
  },
});

export default SensationTag;