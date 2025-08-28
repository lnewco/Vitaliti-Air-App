import React, { useState } from 'react';
import {
  View,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, typography, spacing } from '../../design-system';

const { width: screenWidth } = Dimensions.get('window');

const PreSessionSurvey = ({ visible, onComplete, onCancel }) => {
  const [energy, setEnergy] = useState(null);
  const [clarity, setClarity] = useState(null);
  const [stress, setStress] = useState(null);
  
  // Animation values
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));

  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          speed: 14,
          bounciness: 8,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleComplete = () => {
    if (energy && clarity && stress) {
      onComplete({ energy, clarity, stress });
    }
  };

  const isComplete = energy && clarity && stress;

  const QuestionRow = ({ question, value, setValue, options }) => {
    return (
      <View style={styles.questionContainer}>
        <Text style={styles.questionText}>{question}</Text>
        <View style={styles.optionsRow}>
          {options.map((option, index) => {
            const isSelected = value === index + 1;
            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.optionButton,
                  isSelected && styles.optionButtonSelected
                ]}
                onPress={() => setValue(index + 1)}
                activeOpacity={0.7}
              >
                {isSelected && (
                  <LinearGradient
                    colors={[colors.brand.accent + '20', colors.brand.accent + '40']}
                    style={StyleSheet.absoluteFillObject}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  />
                )}
                <Text style={[
                  styles.optionText,
                  isSelected && styles.optionTextSelected
                ]}>
                  {option}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent={true}
      statusBarTranslucent={true}
    >
      <Animated.View 
        style={[
          styles.container,
          {
            opacity: fadeAnim,
          }
        ]}
      >
        <View style={styles.backdrop} />
        
        <Animated.View 
          style={[
            styles.content,
            {
              transform: [{ translateY: slideAnim }],
            }
          ]}
        >
          <LinearGradient
            colors={[colors.background.elevated, colors.background.primary]}
            style={styles.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
          >
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerLine} />
              <Text style={styles.title}>Pre-Session Check-in</Text>
              <Text style={styles.subtitle}>
                How are you feeling right now?
              </Text>
            </View>

            {/* Questions */}
            <View style={styles.questions}>
              <QuestionRow
                question="Current Energy Level"
                value={energy}
                setValue={setEnergy}
                options={['Very Low', 'Low', 'Neutral', 'High', 'Very High']}
              />

              <QuestionRow
                question="Current Mental Clarity"
                value={clarity}
                setValue={setClarity}
                options={['Very Foggy', 'Foggy', 'Neutral', 'Clear', 'Very Clear']}
              />

              <QuestionRow
                question="Current Stress Level"
                value={stress}
                setValue={setStress}
                options={['Very Stressed', 'Stressed', 'Neutral', 'Relaxed', 'Very Relaxed']}
              />
            </View>

            {/* Footer */}
            <View style={styles.footer}>
              {onCancel && (
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={onCancel}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
              )}
              
              <TouchableOpacity
                style={[
                  styles.continueButton,
                  !isComplete && styles.continueButtonDisabled
                ]}
                onPress={handleComplete}
                disabled={!isComplete}
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={isComplete 
                    ? [colors.brand.accent, colors.brand.accent + 'dd']
                    : ['#444444', '#333333']
                  }
                  style={StyleSheet.absoluteFillObject}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                />
                <Text style={styles.continueText}>
                  {isComplete ? 'Start Session' : 'Please complete all questions'}
                </Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
  },
  content: {
    width: screenWidth - 32,
    maxWidth: 500,
    borderRadius: spacing.radius.xl,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  gradient: {
    padding: spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  headerLine: {
    width: 40,
    height: 3,
    backgroundColor: colors.brand.accent,
    borderRadius: 2,
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h2,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.bodyMedium,
    color: colors.text.secondary,
  },
  questions: {
    gap: spacing.xl,
  },
  questionContainer: {
    gap: spacing.md,
  },
  questionText: {
    ...typography.bodyLarge,
    color: colors.text.primary,
    fontWeight: '600',
  },
  optionsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  optionButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: spacing.radius.md,
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.default,
    overflow: 'hidden',
    minHeight: 44,
    justifyContent: 'center',
  },
  optionButtonSelected: {
    borderColor: colors.brand.accent,
    backgroundColor: 'transparent',
  },
  optionText: {
    ...typography.caption,
    color: colors.text.tertiary,
    textAlign: 'center',
    fontWeight: '500',
  },
  optionTextSelected: {
    color: colors.text.primary,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xxl,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: spacing.radius.md,
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  cancelText: {
    ...typography.bodyMedium,
    color: colors.text.secondary,
    textAlign: 'center',
    fontWeight: '600',
  },
  continueButton: {
    flex: 2,
    paddingVertical: spacing.md,
    borderRadius: spacing.radius.md,
    overflow: 'hidden',
    minHeight: 48,
    justifyContent: 'center',
  },
  continueButtonDisabled: {
    opacity: 0.5,
  },
  continueText: {
    ...typography.bodyMedium,
    color: colors.text.primary,
    textAlign: 'center',
    fontWeight: '600',
  },
});

export default PreSessionSurvey;