import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { colors, spacing, typography } from '../design-system';
import SafeIcon from './base/SafeIcon';

const IntegrationCard = ({ 
  name, 
  icon, 
  connected, 
  onConnect, 
  onDisconnect, 
  description 
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.leftSection}>
        <View style={styles.iconContainer}>
          <SafeIcon name={icon} size={24} color={colors.brand.accent} />
        </View>
        <View style={styles.info}>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.description}>{description}</Text>
        </View>
      </View>
      
      <TouchableOpacity
        style={[
          styles.button,
          connected ? styles.disconnectButton : styles.connectButton
        ]}
        onPress={connected ? onDisconnect : onConnect}
      >
        <Text style={[
          styles.buttonText,
          connected ? styles.disconnectText : styles.connectText
        ]}>
          {connected ? 'Disconnect' : 'Connect'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    marginBottom: spacing.sm,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.brand.accent + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  info: {
    flex: 1,
    marginRight: spacing.md,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 4,
  },
  description: {
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  button: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    minWidth: 90,
    alignItems: 'center',
  },
  connectButton: {
    backgroundColor: colors.brand.accent,
  },
  disconnectButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  connectText: {
    color: colors.text.primary,
  },
  disconnectText: {
    color: colors.text.secondary,
  },
});

export default IntegrationCard;