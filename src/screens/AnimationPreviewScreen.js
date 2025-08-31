import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PulseOxRingAnimation from '../components/animations/PulseOxRingAnimation';
import { colors, typography, spacing } from '../design-system';

const AnimationPreviewScreen = ({ navigation }) => {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Animation Preview</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.animationSection}>
          <Text style={styles.sectionTitle}>Pulse Oximeter Animation</Text>
          <Text style={styles.sectionDescription}>
            Tap to see the finger sliding animation
          </Text>
          
          <View style={styles.animationContainer}>
            <PulseOxRingAnimation />
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>About this animation</Text>
            <Text style={styles.infoText}>
              This animation demonstrates how to properly place the pulse oximeter on your finger.
              The device should slide smoothly onto your index or middle finger for accurate readings.
            </Text>
          </View>
        </View>

        {/* Space for future animations */}
        <View style={styles.comingSoonSection}>
          <Text style={styles.comingSoonTitle}>More Animations Coming Soon</Text>
          <Text style={styles.comingSoonText}>
            Additional instructional animations will be added here
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    ...typography.heading3,
    color: colors.text.primary,
  },
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.lg,
  },
  animationSection: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    ...typography.heading2,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  sectionDescription: {
    ...typography.body,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
  },
  animationContainer: {
    backgroundColor: colors.background.secondary,
    borderRadius: 16,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 300,
    marginBottom: spacing.lg,
  },
  infoCard: {
    backgroundColor: colors.background.tertiary,
    borderRadius: 12,
    padding: spacing.md,
  },
  infoTitle: {
    ...typography.bodyBold,
    color: colors.brand.accent,
    marginBottom: spacing.xs,
  },
  infoText: {
    ...typography.body,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  comingSoonSection: {
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    padding: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  comingSoonTitle: {
    ...typography.heading3,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  comingSoonText: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
  },
});

export default AnimationPreviewScreen;