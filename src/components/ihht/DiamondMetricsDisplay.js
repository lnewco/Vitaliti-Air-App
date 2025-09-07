import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

export default function DiamondMetricsDisplay({ 
  spo2, 
  heartRate, 
  altitude, 
  dialPosition,
  isStressing,
  showMaskLift,
  maskLiftInstruction 
}) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const stressAnim = useRef(new Animated.Value(0)).current;

  // Pulse animation synced with heart rate
  useEffect(() => {
    if (heartRate && heartRate > 0) {
      const pulseDuration = 60000 / heartRate; // Convert BPM to milliseconds per beat
      
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: pulseDuration * 0.3,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: pulseDuration * 0.7,
            useNativeDriver: true,
          }),
        ])
      );
      
      pulseAnimation.start();
      return () => pulseAnimation.stop();
    }
  }, [heartRate, pulseAnim]);

  // Stress indicator animation
  useEffect(() => {
    Animated.timing(stressAnim, {
      toValue: isStressing ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isStressing, stressAnim]);

  const getSpo2Color = () => {
    if (spo2 >= 90) return '#00ff88'; // Green
    if (spo2 >= 85) return '#ffaa00'; // Orange
    if (spo2 >= 80) return '#ff6600'; // Dark Orange
    return '#ff0000'; // Red
  };

  const getStatusText = () => {
    if (showMaskLift) return null; // Hide when showing mask lift
    return isStressing ? 'STRESSING' : 'ADAPTING';
  };

  const getStatusColor = () => {
    return isStressing ? '#ff6600' : '#00ff88';
  };

  return (
    <View style={styles.container}>
      {/* Diamond Container */}
      <View style={styles.diamondContainer}>
        
        {/* Top - SpO2 */}
        <View style={[styles.metricBox, styles.topBox]}>
          <Text style={[styles.spo2Value, { color: getSpo2Color() }]}>
            {spo2 || '--'}
          </Text>
          <Text style={styles.spo2Label}>SpO₂</Text>
        </View>

        {/* Left - Altitude */}
        <View style={[styles.metricBox, styles.leftBox]}>
          <View style={styles.altitudeContent}>
            <Text style={styles.mountainIcon}>🏔️</Text>
            <Text style={styles.altitudeValue}>
              {altitude ? `${altitude.toLocaleString()}ft` : '--'}
            </Text>
            <Text style={styles.dialLabel}>Dial {dialPosition}</Text>
          </View>
        </View>

        {/* Right - Heart Rate */}
        <View style={[styles.metricBox, styles.rightBox]}>
          <Animated.View 
            style={[
              styles.heartRateContent,
              { transform: [{ scale: pulseAnim }] }
            ]}
          >
            <Text style={styles.heartIcon}>❤️</Text>
            <Text style={styles.heartRateValue}>{heartRate || '--'}</Text>
            <Text style={styles.bpmLabel}>BPM</Text>
          </Animated.View>
        </View>

        {/* Bottom - Status or Mask Lift */}
        <View style={[styles.metricBox, styles.bottomBox]}>
          {showMaskLift ? (
            <Animated.View style={styles.maskLiftContainer}>
              <Text style={styles.maskLiftText}>{maskLiftInstruction}</Text>
              <View style={styles.maskLiftVisual}>
                <Text style={styles.maskEmoji}>😷</Text>
                <Text style={styles.liftArrow}>↑</Text>
              </View>
            </Animated.View>
          ) : (
            <Animated.View 
              style={[
                styles.statusContainer,
                {
                  transform: [{ scale: pulseAnim }],
                  opacity: stressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 0.8],
                  }),
                }
              ]}
            >
              <Text style={[styles.statusText, { color: getStatusColor() }]}>
                {getStatusText()}
              </Text>
            </Animated.View>
          )}
        </View>

        {/* Center Diamond Shape Overlay */}
        <View style={styles.diamondCenter}>
          <LinearGradient
            colors={isStressing ? ['#ff660020', '#ff000010'] : ['#00ff8820', '#00ff8810']}
            style={styles.diamondGradient}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  diamondContainer: {
    width: width * 0.8,
    height: width * 0.8,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  metricBox: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    padding: 20,
    borderWidth: 2,
    borderColor: '#2a2a3e',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  topBox: {
    top: 0,
    minWidth: 120,
    minHeight: 100,
  },
  leftBox: {
    left: 0,
    top: '35%',
    minWidth: 110,
    minHeight: 90,
  },
  rightBox: {
    right: 0,
    top: '35%',
    minWidth: 110,
    minHeight: 90,
  },
  bottomBox: {
    bottom: 0,
    minWidth: 140,
    minHeight: 80,
  },
  spo2Value: {
    fontSize: 48,
    fontWeight: 'bold',
  },
  spo2Label: {
    fontSize: 14,
    color: '#8e8e93',
    marginTop: 5,
  },
  altitudeContent: {
    alignItems: 'center',
  },
  mountainIcon: {
    fontSize: 24,
    marginBottom: 5,
  },
  altitudeValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  dialLabel: {
    fontSize: 12,
    color: '#8e8e93',
    marginTop: 5,
  },
  heartRateContent: {
    alignItems: 'center',
  },
  heartIcon: {
    fontSize: 24,
    marginBottom: 5,
  },
  heartRateValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  bpmLabel: {
    fontSize: 12,
    color: '#8e8e93',
    marginTop: 2,
  },
  statusContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  statusText: {
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  maskLiftContainer: {
    alignItems: 'center',
  },
  maskLiftText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ff6600',
    marginBottom: 5,
  },
  maskLiftVisual: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  maskEmoji: {
    fontSize: 24,
  },
  liftArrow: {
    fontSize: 20,
    color: '#ff6600',
    marginLeft: 5,
  },
  diamondCenter: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    transform: [{ rotate: '45deg' }],
  },
  diamondGradient: {
    width: '60%',
    height: '60%',
    position: 'absolute',
    top: '20%',
    left: '20%',
    borderRadius: 20,
  },
});