import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { useAppTheme } from '../../theme';
import { H1, H3, Body, Caption } from '../base/Typography';

const LegalDocumentModal = ({ 
  visible, 
  onClose, 
  document,
  onAgree 
}) => {
  const { colors, spacing } = useAppTheme();

  const styles = StyleSheet.create({
    modal: {
      flex: 1,
      backgroundColor: colors.surface.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: colors.surface.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    backButton: {
      padding: spacing.sm,
    },
    backButtonText: {
      color: colors.primary[500],
      fontSize: 16,
      fontWeight: '600',
    },
    headerTitle: {
      flex: 1,
      textAlign: 'center',
      marginHorizontal: spacing.md,
    },
    spacer: {
      width: 60, // Same width as back button for centering
    },
    content: {
      flex: 1,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.lg,
    },
    lastUpdated: {
      textAlign: 'center',
      marginBottom: spacing.lg,
    },
    documentContent: {
      lineHeight: 24,
      marginBottom: spacing.xl,
    },
    footer: {
      padding: spacing.md,
      backgroundColor: colors.surface.card,
      borderTopWidth: 1,
      borderTopColor: colors.border.light,
    },
    agreeButton: {
      backgroundColor: colors.primary[500],
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: spacing.borderRadius.md,
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    agreeButtonText: {
      color: colors.white,
      fontSize: 16,
      fontWeight: '600',
    },
    closeButton: {
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: spacing.borderRadius.md,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border.medium,
    },
    closeButtonText: {
      color: colors.text.primary,
      fontSize: 16,
      fontWeight: '500',
    },
  });

  if (!document) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={styles.modal}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onClose}>
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
          <H3 style={styles.headerTitle}>{document.title}</H3>
          <View style={styles.spacer} />
        </View>

        {/* Content */}
        <ScrollView 
          style={styles.content}
          showsVerticalScrollIndicator={true}
        >
          <Caption style={styles.lastUpdated}>
            Last Updated: {document.lastUpdated}
          </Caption>
          
          <Body style={styles.documentContent}>
            {document.content}
          </Body>
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          {onAgree && (
            <TouchableOpacity style={styles.agreeButton} onPress={onAgree}>
              <Text style={styles.agreeButtonText}>I Agree</Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

export default LegalDocumentModal;
