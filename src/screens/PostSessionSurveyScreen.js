import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  AnimatedAPI,
  isExpoGo
} from '../utils/animationHelpers';
import { colors } from '../design-system';
import SurveyScaleInput from '../components/SurveyScaleInput';
import StarRating from '../components/feedback/StarRating';
import SensationTag from '../components/feedback/SensationTag';
import DatabaseService from '../services/DatabaseService';
import SupabaseService from '../services/SupabaseService';
import { isPostSessionSurveyComplete } from '../utils/surveyValidation';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const PostSessionSurveyScreen = ({ route, navigation }) => {
  const { sessionId = `session_${Date.now()}` } = route.params || {};
  const [surveyData, setSurveyData] = useState({
    clarity: null,
    energy: null,
    stress: null,
    notes: '',
  });
  const [symptoms, setSymptoms] = useState([]);
  const [overallRating, setOverallRating] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const progressAnimation = useSharedValue(0);

  const availableSensations = [
    { id: 'light_headed', label: 'Light-headed', icon: '💫', type: 'symptom' },
    { id: 'tingling', label: 'Tingling', icon: '✨', type: 'symptom' },
    { id: 'warm', label: 'Warm', icon: '🔥', type: 'neutral' },
    { id: 'relaxed', label: 'Relaxed', icon: '😌', type: 'positive' },
    { id: 'energized', label: 'Energized', icon: '⚡', type: 'positive' },
    { id: 'clear_minded', label: 'Clear-minded', icon: '🧠', type: 'positive' },
    { id: 'euphoric', label: 'Euphoric', icon: '🌟', type: 'positive' },
    { id: 'breathless', label: 'Breathless', icon: '😮‍💨', type: 'symptom' },
    { id: 'headache', label: 'Headache', icon: '🤕', type: 'symptom' },
    { id: 'nausea', label: 'Nausea', icon: '🤢', type: 'symptom' },
  ];

  const isFormComplete = isPostSessionSurveyComplete({
    ...surveyData,
    symptoms,
    overallRating
  });

  useEffect(() => {
    const targetProgress = calculateProgress();
    progressAnimation.value = withSpring(targetProgress, {
      damping: 15,
      stiffness: 100,
    });
  }, [surveyData, symptoms, overallRating]);

  const calculateProgress = () => {
    let completed = 0;
    const total = 4; // clarity, energy, stress, overallRating

    if (surveyData.clarity !== null) completed++;
    if (surveyData.energy !== null) completed++;
    if (surveyData.stress !== null) completed++;
    if (overallRating !== null) completed++;

    return completed / total;
  };

  const animatedProgressStyle = useAnimatedStyle(() => ({
    width: `${progressAnimation.value * 100}%`,
  }));

  const handleScaleChange = (field, value) => {
    setSurveyData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSensationToggle = (sensationId) => {
    setSymptoms(prev => {
      if (prev.includes(sensationId)) {
        return prev.filter(id => id !== sensationId);
      } else {
        return [...prev, sensationId];
      }
    });
  };

  const handleSubmit = async () => {
    if (!isFormComplete) {
      Alert.alert('Incomplete Survey', 'Please complete all required fields.');
      return;
    }

    setIsSubmitting(true);
    try {
      const surveyPayload = {
        session_id: sessionId,
        clarity: surveyData.clarity,
        energy: surveyData.energy,
        stress_level: surveyData.stress,
        symptoms: symptoms.join(','),
        overall_rating: overallRating,
        notes: surveyData.notes,
        created_at: new Date().toISOString()
      };

      console.log('Saving post-session survey:', surveyPayload);

      await DatabaseService.savePostSessionSurvey(surveyPayload);

      await SupabaseService.logEvent('post_session_survey_completed', {
        session_id: sessionId,
        overall_rating: overallRating,
        symptoms_count: symptoms.length
      });

      Alert.alert(
        'Survey Completed',
        'Thank you for your feedback!',
        [{ text: 'OK', onPress: () => navigation.navigate('Main') }]
      );
    } catch (error) {
      console.error('Error saving post-session survey:', error);
      Alert.alert('Error', 'Failed to save survey. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Background gradient */}
      <LinearGradient
        colors={['#000000', '#0A0B0F', '#14161B']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />

      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <BlurView intensity={85} tint="dark" style={styles.header}>
          <View style={styles.navigationBar}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backButton}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={28} color={colors.text.primary} />
            </TouchableOpacity>
            <Text style={styles.navigationTitle}>Post-Session Survey</Text>
            <View style={{ width: 44 }} />
          </View>

          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBackground}>
              <AnimatedAPI.View style={[styles.progressBar, animatedProgressStyle]}>
                <LinearGradient
                  colors={[colors.brand.accent, colors.brand.accent + 'dd']}
                  style={StyleSheet.absoluteFillObject}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                />
              </AnimatedAPI.View>
            </View>
            <Text style={styles.progressText}>
              {Math.round(progressAnimation.value * 100)}% Complete
            </Text>
          </View>
        </BlurView>

        {/* Scrollable content with padding for button */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Mental Clarity Card */}
          <AnimatedAPI.View
            entering={isExpoGo ? undefined : FadeInDown.delay(100)}
            style={styles.card}
          >
            <TouchableOpacity activeOpacity={0.95}>
              <BlurView intensity={40} tint="dark" style={styles.cardContent}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardIconContainer}>
                    <MaterialCommunityIcons name="head-cog" size={24} color={colors.brand.accent} />
                  </View>
                  <View style={styles.cardTitleContainer}>
                    <Text style={styles.cardTitle}>Mental Clarity</Text>
                    <Text style={styles.cardSubtitle}>How clear is your thinking?</Text>
                  </View>
                </View>
                <SurveyScaleInput
                  value={surveyData.clarity}
                  onChange={(value) => handleScaleChange('clarity', value)}
                  minLabel="Foggy"
                  maxLabel="Crystal Clear"
                  accentColor={colors.brand.accent}
                />
              </BlurView>
            </TouchableOpacity>
          </AnimatedAPI.View>

          {/* Energy Level Card */}
          <AnimatedAPI.View
            entering={isExpoGo ? undefined : FadeInDown.delay(200)}
            style={styles.card}
          >
            <TouchableOpacity activeOpacity={0.95}>
              <BlurView intensity={40} tint="dark" style={styles.cardContent}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardIconContainer}>
                    <MaterialCommunityIcons name="lightning-bolt" size={24} color="#FFD700" />
                  </View>
                  <View style={styles.cardTitleContainer}>
                    <Text style={styles.cardTitle}>Energy Level</Text>
                    <Text style={styles.cardSubtitle}>How energized do you feel?</Text>
                  </View>
                </View>
                <SurveyScaleInput
                  value={surveyData.energy}
                  onChange={(value) => handleScaleChange('energy', value)}
                  minLabel="Drained"
                  maxLabel="Energized"
                  accentColor="#FFD700"
                />
              </BlurView>
            </TouchableOpacity>
          </AnimatedAPI.View>

          {/* Stress Level Card */}
          <AnimatedAPI.View
            entering={isExpoGo ? undefined : FadeInDown.delay(300)}
            style={styles.card}
          >
            <TouchableOpacity activeOpacity={0.95}>
              <BlurView intensity={40} tint="dark" style={styles.cardContent}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardIconContainer}>
                    <MaterialCommunityIcons name="meditation" size={24} color="#60A5FA" />
                  </View>
                  <View style={styles.cardTitleContainer}>
                    <Text style={styles.cardTitle}>Stress Level</Text>
                    <Text style={styles.cardSubtitle}>How relaxed are you?</Text>
                  </View>
                </View>
                <SurveyScaleInput
                  value={surveyData.stress}
                  onChange={(value) => handleScaleChange('stress', value)}
                  minLabel="Very Stressed"
                  maxLabel="Very Relaxed"
                  accentColor="#60A5FA"
                  inverseScale={true}
                />
              </BlurView>
            </TouchableOpacity>
          </AnimatedAPI.View>

          {/* Sensations Card */}
          <AnimatedAPI.View
            entering={isExpoGo ? undefined : FadeInDown.delay(400)}
            style={styles.card}
          >
            <TouchableOpacity activeOpacity={0.95}>
              <BlurView intensity={40} tint="dark" style={styles.cardContent}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardIconContainer}>
                    <MaterialCommunityIcons name="gesture-tap" size={24} color="#F59E0B" />
                  </View>
                  <View style={styles.cardTitleContainer}>
                    <Text style={styles.cardTitle}>Sensations</Text>
                    <Text style={styles.cardSubtitle}>What did you experience?</Text>
                  </View>
                </View>
                <View style={styles.sensationGrid}>
                  {availableSensations.map((sensation) => (
                    <SensationTag
                      key={sensation.id}
                      sensation={sensation}
                      isSelected={symptoms.includes(sensation.id)}
                      onPress={() => handleSensationToggle(sensation.id)}
                    />
                  ))}
                </View>
              </BlurView>
            </TouchableOpacity>
          </AnimatedAPI.View>

          {/* Overall Rating Card */}
          <AnimatedAPI.View
            entering={isExpoGo ? undefined : FadeInDown.delay(500)}
            style={styles.card}
          >
            <TouchableOpacity activeOpacity={0.95}>
              <BlurView intensity={40} tint="dark" style={styles.cardContent}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardIconContainer}>
                    <MaterialCommunityIcons name="star" size={24} color="#FFD700" />
                  </View>
                  <View style={styles.cardTitleContainer}>
                    <Text style={styles.cardTitle}>Overall Rating</Text>
                    <Text style={styles.cardSubtitle}>Rate your session experience</Text>
                  </View>
                </View>
                <View style={styles.starContainer}>
                  <StarRating
                    rating={overallRating}
                    onRatingChange={setOverallRating}
                    size={44}
                    color="#FFD700"
                  />
                </View>
              </BlurView>
            </TouchableOpacity>
          </AnimatedAPI.View>

          {/* Submit Button - Inside scroll content */}
          <View style={styles.submitButtonContainer}>
            <TouchableOpacity
            style={[
              styles.submitButton,
              !isFormComplete && styles.submitButtonDisabled
            ]}
            onPress={handleSubmit}
            disabled={!isFormComplete || isSubmitting}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={!isFormComplete
                ? ['#2A2D35', '#1F2228']
                : [colors.brand.accent, colors.brand.accent + 'dd']
              }
              style={StyleSheet.absoluteFillObject}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
            {isSubmitting ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <View style={styles.buttonContent}>
                <Text style={[
                  styles.buttonText,
                  !isFormComplete && styles.buttonTextDisabled
                ]}>
                  {!isFormComplete ? 'Complete All Questions' : 'Complete Survey'}
                </Text>
                <Ionicons
                  name={isFormComplete ? "checkmark-circle" : "alert-circle"}
                  size={24}
                  color={isFormComplete ? "white" : "rgba(255,255,255,0.5)"}
                  style={{ marginLeft: 8 }}
                />
              </View>
            )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  navigationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 16,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navigationTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.4,
  },
  progressContainer: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  progressBackground: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginTop: 8,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  card: {
    marginBottom: 16,
    borderRadius: 20,
    overflow: 'hidden',
  },
  cardContent: {
    padding: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  cardIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardTitleContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
    letterSpacing: -0.4,
  },
  cardSubtitle: {
    fontSize: 13,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  sensationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  starContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  // Submit button container
  submitButtonContainer: {
    marginTop: 32,
    marginBottom: Platform.OS === 'ios' ? 20 : 10,
    paddingHorizontal: 0,
  },
  submitButton: {
    height: 56,
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '600',
    color: 'white',
    letterSpacing: -0.4,
  },
  buttonTextDisabled: {
    color: 'rgba(255,255,255,0.6)',
  },
});

export default PostSessionSurveyScreen;