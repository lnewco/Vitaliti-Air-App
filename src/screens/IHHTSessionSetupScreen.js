import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../services/SupabaseService';
import HypoxiaExperienceModal from '../components/ihht/HypoxiaExperienceModal';
import BluetoothService from '../services/BluetoothService';

const { width, height } = Dimensions.get('window');

export default function IHHTSessionSetupScreen() {
  const navigation = useNavigation();
  const [currentStep, setCurrentStep] = useState(1);
  const [dialPosition, setDialPosition] = useState(null);
  const [showExperienceModal, setShowExperienceModal] = useState(true); // Always show on first visit
  const [userId, setUserId] = useState(null);
  const [isFirstSession, setIsFirstSession] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [devices, setDevices] = useState([]);

  useEffect(() => {
    checkUserExperience();
  }, []);

  useEffect(() => {
    if (countdown !== null && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
      startSession();
    }
  }, [countdown]);

  const checkUserExperience = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      setUserId(user.id);

      // Check if user has experience record
      const { data: experience } = await supabase
        .from('user_hypoxia_experience')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (!experience) {
        setIsFirstSession(true);
        setShowExperienceModal(true);
      } else {
        // Use their last dial position or initial
        setDialPosition(experience.last_dial_position || experience.initial_dial_position);
      }
    } catch (error) {
      console.error('Error checking experience:', error);
      setDialPosition(6); // Default
    }
  };

  const handleExperienceComplete = (selectedDial) => {
    setDialPosition(selectedDial);
    setShowExperienceModal(false);
    setIsFirstSession(false);
  };

  const scanForDevices = async () => {
    setScanning(true);
    setDevices([]); // Clear previous devices
    
    try {
      // Request permissions first
      const hasPermissions = await BluetoothService.requestPermissions();
      if (!hasPermissions) {
        Alert.alert('Permission Required', 'Bluetooth permissions are required to scan for devices');
        setScanning(false);
        return;
      }

      // Start scanning and collect devices
      const devicesList = [];
      
      await BluetoothService.startScanning('pulse-ox');
      
      // Listen for devices for 5 seconds
      setTimeout(async () => {
        await BluetoothService.stopScanning();
        setScanning(false);
        
        // For now, show mock devices if no real devices found
        if (devicesList.length === 0) {
          setDevices([
            { id: '1', name: 'Wellue O2Ring', connected: false },
            { id: '2', name: 'Demo Device', connected: false }
          ]);
        }
      }, 5000);
      
    } catch (error) {
      console.error('Scan error:', error);
      Alert.alert('Scan Error', 'Failed to scan for devices. Please ensure Bluetooth is enabled.');
      setScanning(false);
    }
  };

  const connectToDevice = async (device) => {
    try {
      await BluetoothService.connectToDevice(device);
      setSelectedDevice(device);
      setCurrentStep(4);
      // Start countdown
      setCountdown(10);
    } catch (error) {
      Alert.alert('Connection Failed', 'Could not connect to pulse oximeter');
    }
  };

  const startSession = () => {
    // Navigate to training screen with dial position
    navigation.navigate('ActiveIHHTSession', {
      dialPosition,
      userId,
      isFirstSession,
    });
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepNumber}>Step 1</Text>
            <Text style={styles.instruction}>Turn on your machine</Text>
            <Text style={styles.subInstruction}>
              Ensure the Vitaliti Air device is powered on and ready
            </Text>
            <TouchableOpacity
              style={styles.confirmButton}
              onPress={() => setCurrentStep(2)}
            >
              <Text style={styles.confirmButtonText}>Machine is ON</Text>
            </TouchableOpacity>
          </View>
        );

      case 2:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepNumber}>Step 2</Text>
            <Text style={styles.instruction}>Set dial to {dialPosition || '...'}</Text>
            <View style={styles.dialVisual}>
              <Text style={styles.dialNumber}>{dialPosition}</Text>
              <Text style={styles.dialLabel}>
                {dialPosition === 6 ? 'Default Start' : 'Experienced Start'}
              </Text>
            </View>
            <Text style={styles.subInstruction}>
              Turn the dial on your device to position {dialPosition}
            </Text>
            <TouchableOpacity
              style={styles.confirmButton}
              onPress={() => setCurrentStep(3)}
              disabled={!dialPosition}
            >
              <Text style={styles.confirmButtonText}>Dial Set to {dialPosition}</Text>
            </TouchableOpacity>
          </View>
        );

      case 3:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepNumber}>Step 3</Text>
            <Text style={styles.instruction}>Connect Pulse Oximeter</Text>
            <Text style={styles.subInstruction}>
              Place the pulse oximeter on your left thumb
            </Text>
            
            {devices.length > 0 ? (
              <ScrollView style={styles.deviceList}>
                {devices.map((device, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.deviceItem}
                    onPress={() => connectToDevice(device)}
                  >
                    <Text style={styles.deviceName}>{device.name}</Text>
                    <Text style={styles.deviceId}>{device.id}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <TouchableOpacity
                style={[styles.confirmButton, scanning && styles.scanningButton]}
                onPress={scanForDevices}
                disabled={scanning}
              >
                <Text style={styles.confirmButtonText}>
                  {scanning ? 'Scanning...' : 'Scan for Devices'}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.skipButton}
              onPress={() => {
                setCurrentStep(4);
                setCountdown(10);
              }}
            >
              <Text style={styles.skipButtonText}>Use Demo Mode</Text>
            </TouchableOpacity>
          </View>
        );

      case 4:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepNumber}>Get Ready</Text>
            <Text style={styles.instruction}>Put on your altitude mask</Text>
            
            <View style={styles.countdownContainer}>
              <Text style={styles.countdownNumber}>{countdown}</Text>
              <Text style={styles.countdownLabel}>Starting session...</Text>
            </View>

            <Text style={styles.subInstruction}>
              Ensure mask fits snugly around nose and mouth
            </Text>

            <TouchableOpacity
              style={styles.skipButton}
              onPress={startSession}
            >
              <Text style={styles.skipButtonText}>Start Now</Text>
            </TouchableOpacity>
          </View>
        );
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Air Session Setup</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.progressBar}>
        {[1, 2, 3, 4].map((step) => (
          <View
            key={step}
            style={[
              styles.progressStep,
              currentStep >= step && styles.progressStepActive,
            ]}
          />
        ))}
      </View>

      {renderStep()}

      {isFirstSession && (
        <HypoxiaExperienceModal
          visible={showExperienceModal}
          onComplete={handleExperienceComplete}
          userId={userId}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
  },
  backButton: {
    fontSize: 28,
    color: '#fff',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  progressBar: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 30,
    gap: 10,
  },
  progressStep: {
    flex: 1,
    height: 4,
    backgroundColor: '#1a1a2e',
    borderRadius: 2,
  },
  progressStepActive: {
    backgroundColor: '#0a84ff',
  },
  stepContainer: {
    flex: 1,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumber: {
    fontSize: 14,
    color: '#8e8e93',
    marginBottom: 10,
  },
  instruction: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 20,
  },
  subInstruction: {
    fontSize: 16,
    color: '#8e8e93',
    textAlign: 'center',
    marginBottom: 40,
    paddingHorizontal: 40,
  },
  confirmButton: {
    backgroundColor: '#0a84ff',
    paddingVertical: 18,
    paddingHorizontal: 40,
    borderRadius: 15,
    minWidth: width * 0.7,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  scanningButton: {
    opacity: 0.6,
  },
  skipButton: {
    marginTop: 20,
    padding: 10,
  },
  skipButtonText: {
    color: '#8e8e93',
    fontSize: 16,
  },
  dialVisual: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
    borderWidth: 3,
    borderColor: '#0a84ff',
  },
  dialNumber: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#0a84ff',
  },
  dialLabel: {
    fontSize: 12,
    color: '#8e8e93',
    marginTop: 5,
  },
  deviceList: {
    maxHeight: 200,
    width: '100%',
    marginBottom: 20,
  },
  deviceItem: {
    backgroundColor: '#1a1a2e',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  deviceId: {
    fontSize: 12,
    color: '#8e8e93',
    marginTop: 5,
  },
  countdownContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  countdownNumber: {
    fontSize: 72,
    fontWeight: 'bold',
    color: '#0a84ff',
  },
  countdownLabel: {
    fontSize: 16,
    color: '#8e8e93',
    marginTop: 10,
  },
});