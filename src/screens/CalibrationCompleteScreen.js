import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView
} from 'react-native';
import logger from '../utils/logger';

const log = logger.createModuleLogger('CalibrationCompleteScreen');

const CalibrationCompleteScreen = ({ navigation, route }) => {
  const { calibrationValue, sessionData, reason } = route.params || {};

  const getReasonText = () => {
    switch (reason) {
      case 'spo2_threshold':
        return 'SpO2 reached 85% threshold';
      case 'max_intensity':
        return 'Maximum intensity level reached';
      case 'user_ended':
        return 'Session ended by user';
      case 'device_disconnected':
        return 'Device disconnected';
      default:
        return 'Calibration completed';
    }
  };

  const getRecommendationText = () => {
    if (!calibrationValue) {
      return 'Calibration was not completed. Please try again to determine your optimal training intensity.';
    }

    if (calibrationValue <= 4) {
      return 'Your calibration indicates a lower altitude tolerance. Start with shorter training sessions and gradually increase duration.';
    } else if (calibrationValue <= 7) {
      return 'Your calibration shows moderate altitude tolerance. You can proceed with standard training protocols.';
    } else {
      return 'Your calibration indicates excellent altitude tolerance. You may benefit from more intensive training protocols.';
    }
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins} min ${secs} sec`;
  };

  const handleStartTraining = () => {
    // Navigate to session setup with calibration value
    navigation.navigate('SessionSetup', { 
      defaultHypoxiaLevel: calibrationValue 
    });
  };

  const handleReturnHome = () => {
    navigation.navigate('Dashboard');
  };

  const handleViewHistory = () => {
    navigation.navigate('SessionHistory', { 
      initialTab: 'calibration' 
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Success Icon */}
        <View style={styles.iconContainer}>
          <Text style={styles.successIcon}>
            {calibrationValue ? '✅' : '⚠️'}
          </Text>
        </View>

        {/* Title */}
        <Text style={styles.title}>
          {calibrationValue ? 'Calibration Complete!' : 'Calibration Incomplete'}
        </Text>

        {/* Main Result Card */}
        {calibrationValue && (
          <View style={styles.resultCard}>
            <Text style={styles.resultLabel}>Your Calibration Value</Text>
            <View style={styles.resultValueContainer}>
              <Text style={styles.resultValue}>{calibrationValue}</Text>
              <Text style={styles.resultUnit}>/10</Text>
            </View>
            <Text style={styles.resultDescription}>
              This value will be used as your default training intensity
            </Text>
          </View>
        )}

        {/* Session Details */}
        <View style={styles.detailsCard}>
          <Text style={styles.detailsTitle}>Session Details</Text>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Completion Reason:</Text>
            <Text style={styles.detailValue}>{getReasonText()}</Text>
          </View>

          {sessionData?.totalDuration && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Duration:</Text>
              <Text style={styles.detailValue}>
                {formatDuration(sessionData.totalDuration)}
              </Text>
            </View>
          )}

          {sessionData?.stats?.levels_completed !== undefined && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Levels Completed:</Text>
              <Text style={styles.detailValue}>
                {sessionData.stats.levels_completed}
              </Text>
            </View>
          )}

          {sessionData?.stats?.final_spo2 && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Final SpO2:</Text>
              <Text style={styles.detailValue}>
                {sessionData.stats.final_spo2}%
              </Text>
            </View>
          )}

          {sessionData?.stats?.avg_heart_rate && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Average Heart Rate:</Text>
              <Text style={styles.detailValue}>
                {Math.round(sessionData.stats.avg_heart_rate)} bpm
              </Text>
            </View>
          )}
        </View>

        {/* Recommendation Box */}
        <View style={styles.recommendationBox}>
          <Text style={styles.recommendationTitle}>💡 Recommendation</Text>
          <Text style={styles.recommendationText}>
            {getRecommendationText()}
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          {calibrationValue && (
            <TouchableOpacity 
              style={styles.primaryButton}
              onPress={handleStartTraining}
            >
              <Text style={styles.primaryButtonText}>Start Training Session</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity 
            style={styles.secondaryButton}
            onPress={handleViewHistory}
          >
            <Text style={styles.secondaryButtonText}>View Calibration History</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.tertiaryButton}
            onPress={handleReturnHome}
          >
            <Text style={styles.tertiaryButtonText}>Return to Home</Text>
          </TouchableOpacity>
        </View>

        {/* Info Note */}
        <View style={styles.infoNote}>
          <Text style={styles.infoNoteText}>
            Your calibration value has been saved and will be automatically used for future training sessions. 
            You can recalibrate at any time to adjust your training intensity.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollContent: {
    padding: 20,
  },
  iconContainer: {
    alignItems: 'center',
    marginVertical: 24,
  },
  successIcon: {
    fontSize: 72,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 24,
  },
  resultCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#10B981',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  resultLabel: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 12,
  },
  resultValueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  resultValue: {
    fontSize: 64,
    fontWeight: 'bold',
    color: '#10B981',
  },
  resultUnit: {
    fontSize: 24,
    color: '#6B7280',
    marginLeft: 8,
  },
  resultDescription: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  detailsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  detailsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
  },
  recommendationBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  recommendationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E40AF',
    marginBottom: 8,
  },
  recommendationText: {
    fontSize: 14,
    color: '#1E40AF',
    lineHeight: 20,
  },
  buttonContainer: {
    gap: 12,
    marginBottom: 24,
  },
  primaryButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  secondaryButtonText: {
    color: '#3B82F6',
    fontSize: 16,
    fontWeight: '600',
  },
  tertiaryButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  tertiaryButtonText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '500',
  },
  infoNote: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 12,
  },
  infoNoteText: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 18,
    textAlign: 'center',
  },
});

export default CalibrationCompleteScreen;