import React, { useState, useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  Alert, 
  ScrollView, 
  Text, 
  TouchableOpacity,
  StatusBar,
  Dimensions,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Animated, { 
  FadeInDown, 
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate
} from 'react-native-reanimated';
import { colors, spacing, typography } from '../design-system';
import SurveyScaleInput from '../components/SurveyScaleInput';
import StarRating from '../components/feedback/StarRating';
import SensationTag from '../components/feedback/SensationTag';
import DatabaseService from '../services/DatabaseService';
import SupabaseService from '../services/SupabaseService';
import { isPostSessionSurveyComplete } from '../utils/surveyValidation';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const { width: screenWidth } = Dimensions.get('window');

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

  useEffect(() => {
    updateProgress();
  }, [surveyData, symptoms, overallRating]);

  const updateProgress = () => {
    let completed = 0;
    if (surveyData.clarity) completed++;
    if (surveyData.energy) completed++;
    if (surveyData.stress) completed++;
    if (overallRating) completed++;
    
    progressAnimation.value = withTiming(completed / 4, {
      duration: 300,
    });
  };

  const handleRatingChange = (field, value) => {
    setSurveyData(prev => ({
      ...prev,
      [field]: value
    }));
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

  const handleSubmit = async () => {
    if (!isPostSessionSurveyComplete(surveyData) || !overallRating) {
      Alert.alert(
        'Incomplete Survey',
        'Please complete all required fields before submitting.',
        [{ text: 'OK' }]
      );
      return;
    }

    setIsSubmitting(true);
    
    try {
      await DatabaseService.init();
      await DatabaseService.savePostSessionSurvey(
        sessionId, 
        surveyData.clarity, 
        surveyData.energy, 
        surveyData.stress, 
        surveyData.notes,
        symptoms,
        overallRating
      );
      
      await SupabaseService.syncPostSessionSurvey(
        sessionId, 
        surveyData.clarity, 
        surveyData.energy, 
        surveyData.stress, 
        surveyData.notes,
        symptoms,
        overallRating
      );
      
      navigation.navigate('MainTabs', {
        screen: 'Profile',
        params: {
          justCompleted: true,
          refreshSessions: true
        }
      });
      
      setTimeout(() => {
        Alert.alert(
          '✅ Survey Complete',
          'Thank you for completing your post-session survey!',
          [{ text: 'OK' }]
        );
      }, 500);
      
    } catch (error) {
      console.error('Failed to save post-session survey:', error);
      Alert.alert(
        'Save Error',
        'Failed to save your survey responses. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const symptomOptions = [
    { id: 'zen', label: 'Zen', icon: 'leaf' },
    { id: 'euphoria', label: 'Euphoria', icon: 'happy' },
    { id: 'neck_tension', label: 'Neck tension', icon: 'warning' },
    { id: 'tingling', label: 'Tingling', icon: 'flash' },
    { id: 'lightheaded', label: 'Light-headed', icon: 'pulse' },
    { id: 'sleepy', label: 'Sleepy', icon: 'moon' },
    { id: 'muscle_fatigue', label: 'Muscle fatigue', icon: 'fitness' },
    { id: 'trembling', label: 'Trembling', icon: 'hand-left' },
    { id: 'none', label: 'None', icon: 'checkmark-circle' },
  ];

  const animatedProgressStyle = useAnimatedStyle(() => ({
    width: `${progressAnimation.value * 100}%`,
  }));

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Premium gradient background - matching Session Setup */}
      <LinearGradient
        colors={['#000000', '#0A0B0F', '#14161B']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />
      
      <SafeAreaView style={styles.safeArea}>
        {/* Fixed Header Container with Blur - Like Session Setup */}
        <BlurView intensity={85} tint="dark" style={styles.fixedHeader}>
          {/* Navigation Bar */}
          <View style={styles.navigationBar}>
            <TouchableOpacity 
              onPress={() => navigation.goBack()}
              style={styles.backButton}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={28} color={colors.text.primary} />
            </TouchableOpacity>
            <Text style={styles.navigationTitle}>Post-Session Survey</Text>
            <View style={styles.navSpacer} />
          </View>

          {/* Progress Bar - Part of sticky header */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBackground}>
              <Animated.View style={[styles.progressBar, animatedProgressStyle]}>
                <LinearGradient
                  colors={[colors.brand.accent, colors.brand.accent + 'dd']}
                  style={StyleSheet.absoluteFillObject}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                />
              </Animated.View>
            </View>
            <Text style={styles.progressText}>
              {Math.round(progressAnimation.value * 100)}% Complete
            </Text>
          </View>
        </BlurView>
        
        <ScrollView 
          style={styles.content} 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          bounces={true}
        >
          {/* Header */}
          <Animated.View 
            entering={FadeInDown.duration(400).springify()}
            style={styles.header}
          >
            <Text style={styles.title}>How was your session?</Text>
            <Text style={styles.subtitle}>
              Help us personalize your next training
            </Text>
          </Animated.View>

          {/* Mental Clarity Card */}
          <Animated.View entering={FadeInDown.duration(500).delay(100).springify()}>
            <TouchableOpacity activeOpacity={0.98} style={styles.surveyCard}>
              <BlurView intensity={20} tint="dark" style={styles.cardBlur}>
                <LinearGradient
                  colors={['rgba(255,255,255,0.03)', 'rgba(255,255,255,0.01)']}
                  style={StyleSheet.absoluteFillObject}
                />
                <View style={styles.cardContent}>
                  <View style={styles.cardHeader}>
                    <View style={styles.iconContainer}>
                      <MaterialCommunityIcons name="head-lightbulb-outline" size={22} color={colors.brand.accent} />
                    </View>
                    <Text style={styles.cardTitle}>Mental Clarity</Text>
                    {surveyData.clarity && (
                      <View style={styles.checkmark}>
                        <Ionicons name="checkmark-circle" size={20} color={colors.metrics.breath} />
                      </View>
                    )}
                  </View>
                  <SurveyScaleInput
                    value={surveyData.clarity}
                    onValueChange={(value) => handleRatingChange('clarity', value)}
                    scaleLabels={{
                      1: "Very Foggy",
                      5: "Very Clear"
                    }}
                    style={styles.scaleInput}
                  />
                </View>
              </BlurView>
            </TouchableOpacity>
          </Animated.View>

          {/* Energy Level Card */}
          <Animated.View entering={FadeInDown.duration(500).delay(150).springify()}>
            <TouchableOpacity activeOpacity={0.98} style={styles.surveyCard}>
              <BlurView intensity={20} tint="dark" style={styles.cardBlur}>
                <LinearGradient
                  colors={['rgba(255,255,255,0.03)', 'rgba(255,255,255,0.01)']}
                  style={StyleSheet.absoluteFillObject}
                />
                <View style={styles.cardContent}>
                  <View style={styles.cardHeader}>
                    <View style={styles.iconContainer}>
                      <MaterialCommunityIcons name="lightning-bolt" size={22} color={colors.brand.accent} />
                    </View>
                    <Text style={styles.cardTitle}>Energy Level</Text>
                    {surveyData.energy && (
                      <View style={styles.checkmark}>
                        <Ionicons name="checkmark-circle" size={20} color={colors.metrics.breath} />
                      </View>
                    )}
                  </View>
                  <SurveyScaleInput
                    value={surveyData.energy}
                    onValueChange={(value) => handleRatingChange('energy', value)}
                    scaleLabels={{
                      1: "Very Fatigued",
                      5: "Very Energized"
                    }}
                    style={styles.scaleInput}
                  />
                </View>
              </BlurView>
            </TouchableOpacity>
          </Animated.View>

          {/* Stress Level Card */}
          <Animated.View entering={FadeInDown.duration(500).delay(200).springify()}>
            <TouchableOpacity activeOpacity={0.98} style={styles.surveyCard}>
              <BlurView intensity={20} tint="dark" style={styles.cardBlur}>
                <LinearGradient
                  colors={['rgba(255,255,255,0.03)', 'rgba(255,255,255,0.01)']}
                  style={StyleSheet.absoluteFillObject}
                />
                <View style={styles.cardContent}>
                  <View style={styles.cardHeader}>
                    <View style={styles.iconContainer}>
                      <MaterialCommunityIcons name="heart-pulse" size={22} color={colors.brand.accent} />
                    </View>
                    <Text style={styles.cardTitle}>Stress Level</Text>
                    {surveyData.stress && (
                      <View style={styles.checkmark}>
                        <Ionicons name="checkmark-circle" size={20} color={colors.metrics.breath} />
                      </View>
                    )}
                  </View>
                  <SurveyScaleInput
                    value={surveyData.stress}
                    onValueChange={(value) => handleRatingChange('stress', value)}
                    scaleLabels={{
                      1: "Negative stress",
                      5: "Positive stress"
                    }}
                    style={styles.scaleInput}
                  />
                </View>
              </BlurView>
            </TouchableOpacity>
          </Animated.View>

          {/* Sensations Card */}
          <Animated.View entering={FadeInDown.duration(500).delay(250).springify()}>
            <TouchableOpacity activeOpacity={0.98} style={styles.surveyCard}>
              <BlurView intensity={20} tint="dark" style={styles.cardBlur}>
                <LinearGradient
                  colors={['rgba(255,255,255,0.03)', 'rgba(255,255,255,0.01)']}
                  style={StyleSheet.absoluteFillObject}
                />
                <View style={styles.cardContent}>
                  <View style={styles.cardHeader}>
                    <View style={styles.iconContainer}>
                      <MaterialCommunityIcons name="emoticon-outline" size={22} color={colors.brand.accent} />
                    </View>
                    <Text style={styles.cardTitle}>Sensations</Text>
                  </View>
                  <Text style={styles.cardSubtitle}>
                    Did you experience any of the following?
                  </Text>
                  <View style={styles.sensationsGrid}>
                    {symptomOptions.slice(0, 8).map((symptom) => (
                      <TouchableOpacity
                        key={symptom.id}
                        style={[
                          styles.sensationItem,
                          symptoms.includes(symptom.id) && styles.sensationItemActive
                        ]}
                        onPress={() => toggleSymptom(symptom.id)}
                        activeOpacity={0.7}
                      >
                        <Text style={[
                          styles.sensationText,
                          symptoms.includes(symptom.id) && styles.sensationTextActive
                        ]}>
                          {symptom.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.noneButton,
                      symptoms.includes('none') && styles.noneButtonActive
                    ]}
                    onPress={() => toggleSymptom('none')}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.noneButtonText,
                      symptoms.includes('none') && styles.noneButtonTextActive
                    ]}>
                      None of the above
                    </Text>
                  </TouchableOpacity>
                </View>
              </BlurView>
            </TouchableOpacity>
          </Animated.View>

          {/* Overall Rating Card */}
          <Animated.View entering={FadeInDown.duration(500).delay(300).springify()}>
            <TouchableOpacity activeOpacity={0.98} style={styles.surveyCard}>
              <BlurView intensity={20} tint="dark" style={styles.cardBlur}>
                <LinearGradient
                  colors={['rgba(255,255,255,0.03)', 'rgba(255,255,255,0.01)']}
                  style={StyleSheet.absoluteFillObject}
                />
                <View style={styles.cardContent}>
                  <View style={styles.cardHeader}>
                    <View style={styles.iconContainer}>
                      <MaterialCommunityIcons name="star" size={22} color={colors.brand.accent} />
                    </View>
                    <Text style={styles.cardTitle}>Overall Rating</Text>
                    {overallRating && (
                      <View style={styles.checkmark}>
                        <Ionicons name="checkmark-circle" size={20} color={colors.metrics.breath} />
                      </View>
                    )}
                  </View>
                  <Text style={styles.cardSubtitle}>
                    How was your experience?
                  </Text>
                  <View style={styles.starContainer}>
                    <StarRating
                      rating={overallRating}
                      onRatingChange={setOverallRating}
                      size="lg"
                    />
                  </View>
                </View>
              </BlurView>
            </TouchableOpacity>
          </Animated.View>

          {/* Submit Button - Now part of scroll content */}
          <Animated.View
            entering={FadeIn.duration(400).delay(400).springify()}
            style={styles.submitButtonContainer}
          >
            <TouchableOpacity
                style={[
                  styles.submitButton,
                  (!isPostSessionSurveyComplete(surveyData) || !overallRating) && styles.submitButtonDisabled
                ]}
                onPress={handleSubmit}
                disabled={!isPostSessionSurveyComplete(surveyData) || !overallRating || isSubmitting}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={(!isPostSessionSurveyComplete(surveyData) || !overallRating)
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
                    <Text style={styles.buttonText}>Complete Survey</Text>
                    <Ionicons name="checkmark-circle" size={24} color="white" style={{ marginLeft: 8 }} />
                  </View>
                )}
              </TouchableOpacity>
          </Animated.View>

          {/* Bottom padding for safe scrolling */}
          <View style={{ height: 40 }} />
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
  fixedHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  navigationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
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
  navSpacer: {
    width: 44,
  },
  progressContainer: {
    paddingHorizontal: 20,
    paddingVertical: 8, // Tighter like Session Setup progress steps
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  progressBackground: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: colors.text.quaternary,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingTop: 125, // Adjusted for progress bar instead of steps
  },
  scrollContent: {
    padding: 20, // EXACT same as Session Setup
    paddingTop: 0,
    paddingBottom: 20, // Normal padding since button is now in scroll content
  },
  header: {
    marginBottom: 12, // EXACT same as Session Setup
    alignItems: 'center',
  },
  title: {
    fontSize: 34, // EXACT same as Session Setup
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: -0.8,
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.6)', // EXACT same as Session Setup
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '400',
  },
  surveyCard: {
    marginBottom: 16, // EXACT same as Session Setup cards
    borderRadius: 20, // EXACT same as Session Setup
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 20,
  },
  cardBlur: {
    borderRadius: 20, // EXACT same as Session Setup
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  cardContent: {
    padding: 20, // EXACT same as Session Setup
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.brand.accent + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: colors.text.primary,
    letterSpacing: -0.4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: colors.text.quaternary,
    marginBottom: 16,
  },
  checkmark: {
    marginLeft: 8,
  },
  scaleInput: {
    marginTop: 8,
  },
  sensationsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  sensationItem: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  sensationItemActive: {
    backgroundColor: colors.brand.accent + '20',
    borderColor: colors.brand.accent,
  },
  sensationText: {
    fontSize: 14,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  sensationTextActive: {
    color: colors.brand.accent,
  },
  noneButton: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center',
  },
  noneButtonActive: {
    backgroundColor: colors.brand.accent + '15',
  },
  noneButtonText: {
    fontSize: 14,
    color: colors.text.quaternary,
    fontWeight: '500',
  },
  noneButtonTextActive: {
    color: colors.brand.accent,
  },
  starContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  submitButtonContainer: {
    marginTop: 24,
    marginHorizontal: 0, // Full width within padding
  },
  submitButton: {
    height: 56,
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.5,
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
});

export default PostSessionSurveyScreen;