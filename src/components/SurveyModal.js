import React from 'react';
import {
  View,
  Modal,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useAppTheme } from '../theme';
import { H1, Body, Caption } from './base/Typography';
import Button from './base/Button';

const SurveyModal = ({
  visible,
  title,
  subtitle,
  children,
  onSubmit,
  onCancel,
  submitButtonText = 'Continue',
  cancelButtonText = 'Cancel',
  submitDisabled = false,
  isRequired = false,
  validationErrors = [],
  stepIndicator = null,
}) => {
  const theme = useAppTheme();
  const { colors, spacing } = theme || {};
  
  // Fallback if theme is not ready
  if (!colors || !spacing) {
    return null;
  }

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.surface.background,
    },
    keyboardAvoidingView: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xl * 1.5,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
      backgroundColor: colors.surface.card,
    },
    headerContent: {
      flex: 1,
      paddingRight: spacing.md,
    },
    title: {
      marginBottom: spacing.xs,
    },
    subtitle: {
      lineHeight: 22,
      marginTop: spacing.xs,
    },
    requiredNote: {
      marginTop: spacing.sm,
      fontStyle: 'italic',
    },
    closeButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surface.background,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: spacing.xs,
    },
    closeButtonText: {
      fontSize: 18,
      color: colors.text.secondary,
      fontWeight: 'bold',
    },
    errorContainer: {
      backgroundColor: colors.error[50],
      borderColor: colors.error[200],
      borderWidth: 1,
      borderRadius: spacing.borderRadius.md,
      padding: spacing.md,
      margin: spacing.lg,
    },
    errorText: {
      marginBottom: spacing.xs,
    },
    content: {
      flex: 1,
    },
    contentContainer: {
      padding: spacing.lg,
      paddingBottom: spacing.xl * 2,
    },
    footer: {
      flexDirection: 'row',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border.light,
      backgroundColor: colors.surface.card,
      gap: spacing.sm,
    },
    buttonWrapper: {
      flex: 1,
    },
  });
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent={false}
    >
      <SafeAreaView style={styles.container}>
        {/* Step Indicator */}
        {stepIndicator && stepIndicator}
        
        <KeyboardAvoidingView
          style={styles.keyboardAvoidingView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <H1 style={styles.title}>{title}</H1>
              {subtitle && <Body color="secondary" style={styles.subtitle}>{subtitle}</Body>}
              {isRequired && (
                <Caption color="error" style={styles.requiredNote}>* Required fields</Caption>
              )}
            </View>
            {onCancel && (
              <View style={styles.closeButton}>
                <Button
                  title="✕"
                  variant="ghost"
                  onPress={onCancel}
                  accessibilityLabel="Close survey"
                />
              </View>
            )}
          </View>

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <View style={styles.errorContainer}>
              {validationErrors.map((error, index) => (
                <Caption key={index} color="error" style={styles.errorText}>
                  • {error}
                </Caption>
              ))}
            </View>
          )}

          {/* Content */}
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            {onCancel && (
              <View style={styles.buttonWrapper}>
                <Button
                  title={cancelButtonText}
                  variant="secondary"
                  onPress={onCancel}
                  fullWidth
                />
              </View>
            )}
            
            <View style={[styles.buttonWrapper, !onCancel && { marginHorizontal: 0 }]}>
              <Button
                title={submitButtonText}
                variant="primary"
                onPress={onSubmit}
                disabled={submitDisabled}
                fullWidth
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

export default SurveyModal; 