import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, typography, spacing } from '../../design-system';
import SafeIcon from '../base/SafeIcon';

class FeedbackErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Feedback component error:', error, errorInfo);
    // Report to error tracking service if available
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleDismiss = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onDismiss) {
      this.props.onDismiss();
    }
  };

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onRetry) {
      this.props.onRetry();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <View style={styles.errorCard}>
            <SafeIcon 
              name="alert-circle" 
              size="lg" 
              color={colors.status.error} 
              style={styles.icon} 
            />
            
            <Text style={styles.title}>Survey Temporarily Unavailable</Text>
            <Text style={styles.message}>
              We're having trouble loading the feedback survey. 
              Your session data is safe and will be saved.
            </Text>

            <View style={styles.actions}>
              <TouchableOpacity 
                style={styles.dismissButton}
                onPress={this.handleDismiss}
              >
                <Text style={styles.dismissText}>Dismiss</Text>
              </TouchableOpacity>

              {this.props.onRetry && (
                <TouchableOpacity 
                  style={styles.retryButton}
                  onPress={this.handleRetry}
                >
                  <Text style={styles.retryText}>Try Again</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  errorCard: {
    backgroundColor: colors.background.elevated,
    borderRadius: spacing.radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    maxWidth: 320,
    width: '100%',
  },
  icon: {
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h3,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  message: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  dismissButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: spacing.radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: 'center',
  },
  dismissText: {
    ...typography.bodyMedium,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  retryButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: spacing.radius.md,
    backgroundColor: colors.brand.accent,
    alignItems: 'center',
  },
  retryText: {
    ...typography.bodyMedium,
    color: colors.text.primary,
    fontWeight: '600',
  },
});

export default FeedbackErrorBoundary;