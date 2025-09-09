/**
 * @fileoverview Modal component for displaying detailed session information
 */

import React from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, typography } from '../../design-system';
import SafeIcon from '../base/SafeIcon';
import PremiumButton from '../../design-system/components/PremiumButton';

const { width: screenWidth } = Dimensions.get('window');

/**
 * SessionDetailsModal - Displays comprehensive session details in a modal
 * 
 * @component
 * @param {Object} props - Component props
 * @param {boolean} props.visible - Modal visibility state
 * @param {Object} props.session - Session data object
 * @param {Function} props.onClose - Callback when modal is closed
 * @returns {React.ReactElement|null} Rendered modal or null
 */
const SessionDetailsModal = ({ visible, session, onClose }) => {
  if (!session) return null;

  const formatDuration = (seconds) => {
    if (!seconds) return '0m';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getSymptomLabel = (symptomId) => {
    const symptoms = {
      headache: 'Headache',
      drowsiness: 'Drowsiness',
      dizziness: 'Lightheadedness',
      brain_fog: 'Brain Fog',
      nausea: 'Nausea',
      anxiety: 'Anxiety',
      none: 'None',
    };
    return symptoms[symptomId] || symptomId;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        
        <View style={styles.modalContent}>
          <LinearGradient
            colors={['#1A1D23', '#13161B']}
            style={styles.gradient}
          />
          
          <View style={styles.header}>
            <Text style={styles.title}>Session Details</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <SafeIcon name="close" size={24} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Session Info</Text>
              <View style={styles.infoRow}>
                <Text style={styles.label}>Date</Text>
                <Text style={styles.value}>{formatDate(session.created_at)}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.label}>Duration</Text>
                <Text style={styles.value}>{formatDuration(session.duration)}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.label}>Type</Text>
                <Text style={styles.value}>
                  {session.session_type?.replace(/_/g, ' ') || 'Training'}
                </Text>
              </View>
            </View>

            {session.average_heart_rate && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Vitals</Text>
                <View style={styles.infoRow}>
                  <Text style={styles.label}>Avg Heart Rate</Text>
                  <Text style={styles.value}>{session.average_heart_rate} bpm</Text>
                </View>
                {session.spo2_low && (
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>SpO2 Range</Text>
                    <Text style={styles.value}>
                      {session.spo2_low}% - {session.spo2_high}%
                    </Text>
                  </View>
                )}
              </View>
            )}

            {(session.clarity_post || session.energy_post || session.stress_post) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Post-Session Ratings</Text>
                {session.clarity_post && (
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>Mental Clarity</Text>
                    <View style={styles.ratingContainer}>
                      <Text style={styles.value}>{session.clarity_post}/5</Text>
                      <View style={styles.ratingBar}>
                        <View
                          style={[
                            styles.ratingFill,
                            { width: `${(session.clarity_post / 5) * 100}%` },
                          ]}
                        />
                      </View>
                    </View>
                  </View>
                )}
                {session.energy_post && (
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>Energy Level</Text>
                    <View style={styles.ratingContainer}>
                      <Text style={styles.value}>{session.energy_post}/5</Text>
                      <View style={styles.ratingBar}>
                        <View
                          style={[
                            styles.ratingFill,
                            { width: `${(session.energy_post / 5) * 100}%` },
                          ]}
                        />
                      </View>
                    </View>
                  </View>
                )}
                {session.stress_post && (
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>Stress Level</Text>
                    <View style={styles.ratingContainer}>
                      <Text style={styles.value}>{session.stress_post}/5</Text>
                      <View style={styles.ratingBar}>
                        <View
                          style={[
                            styles.ratingFill,
                            { width: `${(session.stress_post / 5) * 100}%` },
                          ]}
                        />
                      </View>
                    </View>
                  </View>
                )}
                {session.overall_rating && (
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>Overall Rating</Text>
                    <View style={styles.starsContainer}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <SafeIcon
                          key={star}
                          name="star"
                          size={20}
                          color={
                            star <= session.overall_rating
                              ? colors.semantic.warning
                              : colors.text.tertiary
                          }
                        />
                      ))}
                    </View>
                  </View>
                )}
              </View>
            )}

            {session.post_symptoms && session.post_symptoms !== '[]' && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Symptoms</Text>
                <View style={styles.symptomsContainer}>
                  {JSON.parse(session.post_symptoms).map((symptom, index) => (
                    <View key={index} style={styles.symptomTag}>
                      <Text style={styles.symptomText}>
                        {getSymptomLabel(symptom)}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {session.notes_post && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Notes</Text>
                <Text style={styles.notesText}>{session.notes_post}</Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <PremiumButton
              title="Close"
              variant="secondary"
              onPress={onClose}
              style={{ width: '100%' }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: colors.background.secondary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    overflow: 'hidden',
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text.primary,
  },
  closeButton: {
    padding: spacing.xs,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.xl,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  label: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  value: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.primary,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  ratingBar: {
    width: 60,
    height: 4,
    backgroundColor: colors.background.tertiary,
    borderRadius: 2,
    overflow: 'hidden',
  },
  ratingFill: {
    height: '100%',
    backgroundColor: colors.brand.accent,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  symptomsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  symptomTag: {
    backgroundColor: colors.background.tertiary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  symptomText: {
    fontSize: 12,
    color: colors.text.primary,
  },
  notesText: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  footer: {
    padding: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
});

export default SessionDetailsModal;