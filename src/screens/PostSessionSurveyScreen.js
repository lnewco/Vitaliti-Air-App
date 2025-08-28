import React, { useState, useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  Alert, 
  ScrollView, 
  Platform, 
  Text, 
  TouchableOpacity,
  StatusBar,
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { colors, spacing, typography } from '../design-system';
import PremiumButton from '../design-system/components/PremiumButton';
import SurveyScaleInput from '../components/SurveyScaleInput';
import StarRating from '../components/feedback/StarRating';
import SensationTag from '../components/feedback/SensationTag';
import DatabaseService from '../services/DatabaseService';
import SupabaseService from '../services/SupabaseService';
import { 
  CLARITY_LABELS, 
  ENERGY_LABELS, 
  STRESS_LABELS,
  isPostSessionSurveyComplete 
} from '../utils/surveyValidation';
import SafeIcon from '../components/base/SafeIcon';

const { height: screenHeight } = Dimensions.get('window');

const PostSessionSurveyScreen = ({ route, navigation }) => {
  const { sessionId } = route.params;
  const [surveyData, setSurveyData] = useState({
    clarity: null,
    energy: null,
    stress: null,
    notes: '',
  });
  const [preSessionData, setPreSessionData] = useState(null);
  const [symptoms, setSymptoms] = useState([]);
  const [overallRating, setOverallRating] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);

  // Fetch pre-session data for comparison
  useEffect(() => {
    fetchPreSessionData();
  }, [sessionId]);

  const fetchPreSessionData = async () => {
    try {
      // This would fetch from database - placeholder for now
      // const data = await DatabaseService.getPreSessionSurvey(sessionId);
      // setPreSessionData(data);
    } catch (error) {
      console.log('No pre-session data available');
    }
  };

  const handleRatingChange = (field, value) => {
    setSurveyData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear validation errors for this field
    setValidationErrors(prev => prev.filter(err => err !== field));
  };

  const toggleSymptom = (symptomId) => {
    if (symptomId === 'none') {
      setSymptoms(['none']);
    } else {
      setSymptoms(prev => {
        const filtered = prev.filter(s => s !== 'none');
        if (filtered.includes(symptomId)) {
          return filtered.filter(s => s !== symptomId);
        } else {
          return [...filtered, symptomId];
        }
      });
    }
  };

  const validateForm = () => {
    const errors = [];
    if (!surveyData.clarity) errors.push('clarity');
    if (!surveyData.energy) errors.push('energy');
    if (!surveyData.stress) errors.push('stress');
    if (!overallRating) errors.push('overall');
    
    setValidationErrors(errors);
    return errors.length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      Alert.alert(
        'Incomplete Survey',
        'Please complete all required fields before submitting.',
        [{ text: 'OK' }]
      );
      return;
    }

    setIsSubmitting(true);
    
    try {
      console.log('💾 Saving post-session survey data:', { sessionId, ...surveyData });
      
      // Initialize database if needed
      await DatabaseService.init();
      
      // Save to local database first with enhanced fields
      await DatabaseService.savePostSessionSurvey(
        sessionId, 
        surveyData.clarity, 
        surveyData.energy, 
        surveyData.stress, 
        surveyData.notes,
        symptoms,
        overallRating
      );
      console.log('✅ Post-session survey saved to local database');
      
      // Sync to Supabase (will queue if offline) with enhanced fields
      await SupabaseService.syncPostSessionSurvey(
        sessionId, 
        surveyData.clarity, 
        surveyData.energy, 
        surveyData.stress, 
        surveyData.notes,
        symptoms,
        overallRating
      );
      console.log('✅ Post-session survey queued for Supabase sync');
      
      // Show success and complete
      console.log('🎉 Post-session survey save completed successfully');
      
      // Navigate to Profile screen where sessions are now displayed
      navigation.navigate('MainTabs', {
        screen: 'Profile',
        params: {
          justCompleted: true,
          refreshSessions: true
        }
      });
      
      // Show a quick success message with defensive scheduling
      const timeoutId = setTimeout(() => {
        requestAnimationFrame(() => {
          Alert.alert(
            '✅ Survey Complete',
            'Thank you for completing your post-session survey!',
            [{ text: 'OK' }]
          );
        });
      }, 500);
      
    } catch (error) {
      console.error('❌ Failed to save post-session survey:', error);
      Alert.alert(
        'Save Error',
        'Failed to save your survey responses. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = isPostSessionSurveyComplete(surveyData) && overallRating && !isSubmitting;

  const symptomOptions = [
    { id: 'headache', label: 'Headache', icon: 'head' },
    { id: 'drowsiness', label: 'Drowsiness', icon: 'moon' },
    { id: 'dizziness', label: 'Lightheadedness', icon: 'refresh' },
    { id: 'brain_fog', label: 'Brain Fog', icon: 'cloud' },
    { id: 'nausea', label: 'Nausea', icon: 'medical' },
    { id: 'anxiety', label: 'Anxiety', icon: 'pulse' },
    { id: 'none', label: 'None', icon: 'checkmark-circle' },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Premium gradient background */}
      <LinearGradient
        colors={['#0C0E12', '#13161B', '#1A1D23']}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <SafeIcon name="arrow-back" size={24} color={colors.text.primary} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>Post-Session Survey</Text>
        </View>

        {/* Main Content - Wrapped in View to fix scrolling */}
        <View style={{ flex: 1 }}>
          <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            bounces={true}
            nestedScrollEnabled={true}
          >
          {/* Survey Header */}
          <View style={styles.surveyHeader}>
            <Text style={styles.subtitle}>
              How are you feeling after training?
            </Text>
            <Text style={styles.requiredNote}>
              * Required
            </Text>
          </View>

          {/* Mental Clarity */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Mental Clarity *</Text>
            <SurveyScaleInput
              label="Mental Clarity"
              value={surveyData.clarity}
              onValueChange={(value) => handleRatingChange('clarity', value)}
              scaleLabels={{
                1: "Very Foggy",
                5: "Very Clear"
              }}
              isRequired={true}
              style={styles.scaleInput}
            />
          </View>

          {/* Energy Level */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Energy Level *</Text>
            <SurveyScaleInput
              label="Energy Level"
              value={surveyData.energy}
              onValueChange={(value) => handleRatingChange('energy', value)}
              scaleLabels={{
                1: "Very Fatigued",
                5: "Very Energized"
              }}
              isRequired={true}
              style={styles.scaleInput}
            />
          </View>

          {/* Stress Level */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Stress Level *</Text>
            <SurveyScaleInput
              label="Stress Level"
              value={surveyData.stress}
              onValueChange={(value) => handleRatingChange('stress', value)}
              scaleLabels={{
                1: "Negative stress",
                5: "Positive stress"
              }}
              isRequired={true}
              style={styles.scaleInput}
            />
          </View>

          {/* Symptoms */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Did you experience any of the following?</Text>
            <View style={styles.symptomsGrid}>
              {symptomOptions.map((symptom) => (
                <SensationTag
                  key={symptom.id}
                  label={symptom.label}
                  icon={symptom.icon}
                  selected={symptoms.includes(symptom.id)}
                  onPress={() => toggleSymptom(symptom.id)}
                />
              ))}
            </View>
          </View>

          {/* Overall Rating */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Overall Session Rating *</Text>
            <Text style={styles.ratingSubtitle}>
              How was your experience?
            </Text>
            <StarRating
              rating={overallRating}
              onRatingChange={setOverallRating}
              size="lg"
            />
          </View>

          {/* Bottom padding for footer */}
          <View style={{ height: 120 }} />
          </ScrollView>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <BlurView intensity={30} tint="dark" style={styles.footerGlass}>
            <PremiumButton
              title={isSubmitting ? 'Saving...' : 'Complete Session'}
              variant="primary"
              onPress={handleSubmit}
              disabled={!canSubmit}
              loading={isSubmitting}
              style={{ width: '100%' }}
            />
          </BlurView>
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    backgroundColor: 'transparent',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing.lg,
  },
  backText: {
    color: colors.text.primary,
    fontSize: 16,
    marginLeft: spacing.xs,
    fontWeight: '500',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: 140, // Space for footer
  },
  surveyHeader: {
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 16,
    color: colors.text.secondary,
    lineHeight: 24,
    marginBottom: spacing.xs,
  },
  requiredNote: {
    fontSize: 13,
    color: colors.semantic.error,
    marginTop: spacing.xs,
    fontWeight: '500',
  },
  card: {
    backgroundColor: 'rgba(26, 29, 35, 0.6)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  scaleInput: {
    marginTop: spacing.sm,
  },
  symptomsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  ratingSubtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    paddingBottom: spacing.xl,
  },
  footerGlass: {
    padding: spacing.lg,
    borderRadius: 24,
    backgroundColor: 'rgba(26, 29, 35, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
});

export default PostSessionSurveyScreen;