import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Dimensions,
} from 'react-native';
import { supabase } from '../../services/SupabaseService';

const { width } = Dimensions.get('window');

export default function HypoxiaExperienceModal({ visible, onComplete, userId }) {
  const [step, setStep] = useState(1);
  const [hasPriorExperience, setHasPriorExperience] = useState(null);
  const [sessionCount, setSessionCount] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleFirstQuestion = (hasExperience) => {
    setHasPriorExperience(hasExperience);
    if (hasExperience) {
      setStep(2);
    } else {
      // No experience = start at dial 6
      saveExperience(false, 0, 6);
    }
  };

  const handleSecondQuestion = (moreThanFive) => {
    const sessions = moreThanFive ? 6 : 3; // Store approximate count
    const dialPosition = moreThanFive ? 7 : 6;
    saveExperience(true, sessions, dialPosition);
  };

  const saveExperience = async (hasExperience, sessions, dialPosition) => {
    setLoading(true);
    try {
      // Save to database
      const { error } = await supabase
        .from('user_hypoxia_experience')
        .upsert({
          user_id: userId,
          has_prior_experience: hasExperience,
          sessions_completed: sessions,
          initial_dial_position: dialPosition,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      // Return the dial position to parent
      onComplete(dialPosition);
    } catch (error) {
      console.error('Error saving hypoxia experience:', error);
      // Default to dial 6 on error
      onComplete(6);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {step === 1 ? (
            <>
              <Text style={styles.title}>Hypoxia Experience Assessment</Text>
              <Text style={styles.question}>
                Have you done hypoxia training in the past?
              </Text>
              <Text style={styles.subtitle}>
                This helps us set your optimal starting altitude level
              </Text>

              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={[styles.button, styles.noButton]}
                  onPress={() => handleFirstQuestion(false)}
                  disabled={loading}
                >
                  <Text style={styles.buttonText}>No</Text>
                  <Text style={styles.buttonSubtext}>First time</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.button, styles.yesButton]}
                  onPress={() => handleFirstQuestion(true)}
                  disabled={loading}
                >
                  <Text style={styles.buttonText}>Yes</Text>
                  <Text style={styles.buttonSubtext}>I have experience</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.title}>Experience Level</Text>
              <Text style={styles.question}>
                Have you done more than 5 hypoxia sessions?
              </Text>
              <Text style={styles.subtitle}>
                Experienced users can start at a higher altitude
              </Text>

              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={[styles.button, styles.noButton]}
                  onPress={() => handleSecondQuestion(false)}
                  disabled={loading}
                >
                  <Text style={styles.buttonText}>No</Text>
                  <Text style={styles.buttonSubtext}>Less than 5 sessions</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.button, styles.yesButton]}
                  onPress={() => handleSecondQuestion(true)}
                  disabled={loading}
                >
                  <Text style={styles.buttonText}>Yes</Text>
                  <Text style={styles.buttonSubtext}>5+ sessions</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {loading && (
            <Text style={styles.loadingText}>Setting up your profile...</Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: width * 0.9,
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
    textAlign: 'center',
  },
  question: {
    fontSize: 18,
    color: '#fff',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#8e8e93',
    marginBottom: 30,
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 15,
  },
  button: {
    flex: 1,
    paddingVertical: 20,
    borderRadius: 15,
    alignItems: 'center',
    borderWidth: 2,
  },
  noButton: {
    backgroundColor: '#2a2a3e',
    borderColor: '#3a3a4e',
  },
  yesButton: {
    backgroundColor: '#0a84ff',
    borderColor: '#0a84ff',
  },
  buttonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  buttonSubtext: {
    fontSize: 12,
    color: '#a8a8b3',
  },
  loadingText: {
    marginTop: 20,
    color: '#8e8e93',
    fontSize: 14,
  },
});