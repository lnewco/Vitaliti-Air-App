import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
  ActivityIndicator
} from 'react-native';
import { useBluetooth } from '../context/BluetoothContext';
import DeviceSelectionModal from '../components/DeviceSelectionModal';
import logger from '../utils/logger';

const log = logger.createModuleLogger('CalibrationSetupScreen');

const CalibrationSetupScreen = ({ navigation }) => {
  const { 
    isPulseOxConnected: isConnected, 
    isScanning: isSearching,
    connectedPulseOxDevice: connectedDevice,
    startScanning,
    pulseOximeterData: currentReadings 
  } = useBluetooth();
  
  const [isConnecting, setIsConnecting] = useState(false);
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [step, setStep] = useState('connect'); // 'connect' or 'instructions'

  useEffect(() => {
    // If device is already connected, move to instructions
    if (isConnected && connectedDevice) {
      setStep('instructions');
    }
  }, [isConnected, connectedDevice]);

  const handleConnectDevice = () => {
    log.info('Opening device selection modal for calibration');
    setShowDeviceModal(true);
  };

  const handleDeviceConnected = () => {
    log.info('Device connected successfully');
    setShowDeviceModal(false);
    // Device is now connected via context, UI will update automatically
  };

  const handleModalClose = () => {
    log.info('Device selection modal closed');
    setShowDeviceModal(false);
  };

  const handleStartCalibration = () => {
    if (!isConnected) {
      Alert.alert(
        'Device Required',
        'Please connect your pulse oximeter before starting calibration.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Navigate to main calibration screen
    navigation.navigate('Calibration');
  };

  const renderConnectionStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>📱</Text>
      </View>
      
      <Text style={styles.stepTitle}>Connect Your Pulse Oximeter</Text>
      <Text style={styles.stepDescription}>
        Calibration requires continuous SpO2 monitoring to determine your optimal training intensity.
      </Text>

      {!isConnected ? (
        <>
          <TouchableOpacity
            style={[styles.connectButton, isSearching && styles.connectButtonDisabled]}
            onPress={handleConnectDevice}
            disabled={isSearching}
          >
            {isSearching ? (
              <View style={styles.searchingContainer}>
                <ActivityIndicator color="#FFFFFF" size="small" />
                <Text style={styles.connectButtonText}>Searching...</Text>
              </View>
            ) : (
              <Text style={styles.connectButtonText}>Search for Devices</Text>
            )}
          </TouchableOpacity>

          <View style={styles.requirementBox}>
            <Text style={styles.requirementTitle}>Requirements:</Text>
            <Text style={styles.requirementText}>
              • Bluetooth-enabled pulse oximeter{'\n'}
              • Device must support BLE (Bluetooth Low Energy){'\n'}
              • Keep device within 3 feet during calibration
            </Text>
          </View>
        </>
      ) : (
        <View style={styles.connectedContainer}>
          <View style={styles.connectedBadge}>
            <Text style={styles.connectedIcon}>✓</Text>
            <Text style={styles.connectedText}>Connected</Text>
          </View>
          
          <View style={styles.deviceInfo}>
            <Text style={styles.deviceName}>{connectedDevice?.name || 'Pulse Oximeter'}</Text>
            {currentReadings && (
              <View style={styles.readingsRow}>
                <Text style={styles.readingLabel}>SpO2: </Text>
                <Text style={styles.readingValue}>{currentReadings.spo2 || '--'}%</Text>
                <Text style={styles.readingLabel}>  HR: </Text>
                <Text style={styles.readingValue}>{currentReadings.heartRate || '--'} bpm</Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={styles.continueButton}
            onPress={() => setStep('instructions')}
          >
            <Text style={styles.continueButtonText}>Continue to Instructions</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderInstructionsStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>🎯</Text>
      </View>
      
      <Text style={styles.stepTitle}>Calibration Instructions</Text>
      
      <ScrollView style={styles.instructionsScroll} showsVerticalScrollIndicator={false}>
        <View style={styles.instructionSection}>
          <Text style={styles.instructionTitle}>How Calibration Works</Text>
          <Text style={styles.instructionText}>
            The calibration session will progressively increase the simulated altitude 
            (starting at level 2) by one level each minute until your SpO2 drops to 85% 
            or you reach the maximum level of 10.
          </Text>
        </View>

        <View style={styles.instructionSection}>
          <Text style={styles.instructionTitle}>What You'll Do</Text>
          <Text style={styles.instructionText}>
            1. Sit comfortably with the pulse oximeter on your finger{'\n'}
            2. When prompted, adjust the altitude dial to the indicated level{'\n'}
            3. Confirm each change by pressing the button on screen{'\n'}
            4. Breathe normally through the mask for 1 minute{'\n'}
            5. The session ends automatically when your threshold is found
          </Text>
        </View>

        <View style={styles.instructionSection}>
          <Text style={styles.instructionTitle}>Important Notes</Text>
          <Text style={styles.instructionText}>
            • Keep the pulse oximeter on throughout the session{'\n'}
            • Breathe normally - don't force deep breaths{'\n'}
            • The session typically takes 5-10 minutes{'\n'}
            • You can end the session at any time if uncomfortable{'\n'}
            • Your calibration value will be saved for future training
          </Text>
        </View>

        <View style={styles.warningBox}>
          <Text style={styles.warningTitle}>⚠️ Safety First</Text>
          <Text style={styles.warningText}>
            Stop immediately if you feel dizzy, nauseous, or experience any discomfort. 
            The calibration will automatically stop if your SpO2 drops to 85%.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.buttonContainer}>
        {!isConnected && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setStep('connect')}
          >
            <Text style={styles.backButtonText}>← Back to Connection</Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity
          style={[styles.startButton, !isConnected && styles.startButtonDisabled]}
          onPress={handleStartCalibration}
          disabled={!isConnected}
        >
          <Text style={styles.startButtonText}>Start Calibration</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <DeviceSelectionModal
        visible={showDeviceModal}
        deviceType="pulse-ox"
        onDeviceSelected={handleDeviceConnected}
        onClose={handleModalClose}
        title="Find Pulse Oximeter"
        instructions="Select your pulse oximeter from the list below. Make sure it's turned on and ready to pair."
      />
      
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backArrow}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backArrowText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Calibration Setup</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressStep, styles.progressStepActive]}>
            <Text style={styles.progressNumber}>1</Text>
          </View>
          <View style={[styles.progressLine, step === 'instructions' && styles.progressLineActive]} />
          <View style={[styles.progressStep, step === 'instructions' && styles.progressStepActive]}>
            <Text style={styles.progressNumber}>2</Text>
          </View>
        </View>
        <View style={styles.progressLabels}>
          <Text style={styles.progressLabel}>Connect</Text>
          <Text style={styles.progressLabel}>Instructions</Text>
        </View>
      </View>

      {step === 'connect' ? renderConnectionStep() : renderInstructionsStep()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backArrow: {
    padding: 8,
  },
  backArrowText: {
    fontSize: 24,
    color: '#374151',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  headerSpacer: {
    width: 40,
  },
  progressContainer: {
    paddingVertical: 24,
    paddingHorizontal: 40,
    backgroundColor: '#FFFFFF',
  },
  progressBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressStep: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressStepActive: {
    backgroundColor: '#F59E0B',
  },
  progressNumber: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  progressLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 8,
  },
  progressLineActive: {
    backgroundColor: '#F59E0B',
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  stepContainer: {
    flex: 1,
    padding: 20,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  icon: {
    fontSize: 64,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 12,
  },
  stepDescription: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  connectButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  connectButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  connectButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  searchingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  requirementBox: {
    backgroundColor: '#F3F4F6',
    padding: 16,
    borderRadius: 12,
  },
  requirementTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  requirementText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  connectedContainer: {
    alignItems: 'center',
  },
  connectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginBottom: 16,
  },
  connectedIcon: {
    color: '#FFFFFF',
    fontSize: 16,
    marginRight: 8,
  },
  connectedText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  deviceInfo: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 24,
    minWidth: 200,
    alignItems: 'center',
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  readingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  readingLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  readingValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  continueButton: {
    backgroundColor: '#F59E0B',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  instructionsScroll: {
    flex: 1,
    marginBottom: 20,
  },
  instructionSection: {
    marginBottom: 24,
  },
  instructionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  instructionText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 22,
  },
  warningBox: {
    backgroundColor: '#FEF3C7',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
    marginBottom: 4,
  },
  warningText: {
    fontSize: 14,
    color: '#92400E',
    lineHeight: 20,
  },
  buttonContainer: {
    gap: 12,
  },
  backButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '500',
  },
  startButton: {
    backgroundColor: '#F59E0B',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  startButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default CalibrationSetupScreen;