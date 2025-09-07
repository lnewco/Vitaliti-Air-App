import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
  ScrollView,
} from 'react-native';

const { width } = Dimensions.get('window');

const SURVEY_QUESTIONS = [
  {
    id: 'feeling',
    question: 'How are you feeling?',
    lowLabel: 'Poor',
    highLabel: 'Excellent',
  },
  {
    id: 'breathlessness',
    question: 'Breathlessness level?',
    lowLabel: 'None',
    highLabel: 'Severe',
  },
  {
    id: 'clarity',
    question: 'Mental clarity?',
    lowLabel: 'Foggy',
    highLabel: 'Sharp',
  },
  {
    id: 'energy',
    question: 'Energy level?',
    lowLabel: 'Exhausted',
    highLabel: 'Energized',
  },
];

export default function IntrasessionSurvey({ 
  visible, 
  onComplete, 
  previousHypoxicData,
  currentRecoveryData 
}) {
  const [responses, setResponses] = useState({
    feeling: null,
    breathlessness: null,
    clarity: null,
    energy: null,
  });

  const handleResponse = (questionId, value) => {
    setResponses(prev => ({
      ...prev,
      [questionId]: value,
    }));
  };

  const handleSubmit = () => {
    const surveyData = {
      feelingScore: responses.feeling,
      breathlessnessScore: responses.breathlessness,
      clarityScore: responses.clarity,
      energyScore: responses.energy,
    };
    onComplete(surveyData);
    // Reset for next time
    setResponses({
      feeling: null,
      breathlessness: null,
      clarity: null,
      energy: null,
    });
  };

  const isComplete = Object.values(responses).every(v => v !== null);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Quick Check-In</Text>
              <Text style={styles.subtitle}>Recovery Phase Feedback</Text>
            </View>

            {/* Context Info */}
            {previousHypoxicData && (
              <View style={styles.contextBox}>
                <Text style={styles.contextTitle}>Previous Altitude Phase</Text>
                <View style={styles.contextRow}>
                  <Text style={styles.contextLabel}>Dial: {previousHypoxicData.dialPosition}</Text>
                  <Text style={styles.contextLabel}>Avg SpO₂: {previousHypoxicData.avgSpo2}%</Text>
                  <Text style={styles.contextLabel}>Mask Lifts: {previousHypoxicData.maskLiftCount}</Text>
                </View>
              </View>
            )}

            {/* Current Recovery Info */}
            {currentRecoveryData && (
              <View style={styles.recoveryBox}>
                <Text style={styles.recoveryLabel}>Current SpO₂: {currentRecoveryData.currentSpO2}%</Text>
                <Text style={styles.recoveryLabel}>Heart Rate: {currentRecoveryData.currentHeartRate} bpm</Text>
              </View>
            )}

            {/* Survey Questions */}
            {SURVEY_QUESTIONS.map((question) => (
              <View key={question.id} style={styles.questionContainer}>
                <Text style={styles.questionText}>{question.question}</Text>
                
                <View style={styles.scaleContainer}>
                  <Text style={styles.scaleLabel}>{question.lowLabel}</Text>
                  <View style={styles.scaleButtons}>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => (
                      <TouchableOpacity
                        key={value}
                        style={[
                          styles.scaleButton,
                          responses[question.id] === value && styles.scaleButtonSelected,
                        ]}
                        onPress={() => handleResponse(question.id, value)}
                      >
                        <Text
                          style={[
                            styles.scaleButtonText,
                            responses[question.id] === value && styles.scaleButtonTextSelected,
                          ]}
                        >
                          {value}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={styles.scaleLabel}>{question.highLabel}</Text>
                </View>
              </View>
            ))}

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitButton, !isComplete && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={!isComplete}
            >
              <Text style={styles.submitButtonText}>
                {isComplete ? 'Continue Training' : 'Please answer all questions'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: width * 0.95,
    maxHeight: '85%',
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: '#8e8e93',
  },
  contextBox: {
    backgroundColor: '#0a0a0f',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
  },
  contextTitle: {
    fontSize: 12,
    color: '#8e8e93',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  contextRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  contextLabel: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  recoveryBox: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#0a0a0f',
    padding: 10,
    borderRadius: 10,
    marginBottom: 20,
  },
  recoveryLabel: {
    fontSize: 14,
    color: '#00ff88',
    fontWeight: '600',
  },
  questionContainer: {
    marginBottom: 25,
  },
  questionText: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 10,
    fontWeight: '600',
  },
  scaleContainer: {
    alignItems: 'center',
  },
  scaleButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginVertical: 10,
  },
  scaleButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#2a2a3e',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#2a2a3e',
  },
  scaleButtonSelected: {
    backgroundColor: '#0a84ff',
    borderColor: '#0a84ff',
  },
  scaleButtonText: {
    fontSize: 12,
    color: '#8e8e93',
    fontWeight: '600',
  },
  scaleButtonTextSelected: {
    color: '#fff',
  },
  scaleLabel: {
    fontSize: 12,
    color: '#8e8e93',
    fontStyle: 'italic',
  },
  submitButton: {
    backgroundColor: '#0a84ff',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  submitButtonDisabled: {
    backgroundColor: '#2a2a3e',
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
});