import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import Svg, { Path, Circle, Line, G } from 'react-native-svg';

const { width: screenWidth } = Dimensions.get('window');

// Altitude mapping
const ALTITUDE_MAP = {
  0: { feet: 0, meters: 0 },
  1: { feet: 2000, meters: 610 },
  2: { feet: 4000, meters: 1219 },
  3: { feet: 6000, meters: 1829 },
  4: { feet: 8000, meters: 2438 },
  5: { feet: 10000, meters: 3048 },
  6: { feet: 16000, meters: 4877 },
  7: { feet: 18000, meters: 5486 },
  8: { feet: 19000, meters: 5791 },
  9: { feet: 20000, meters: 6096 },
  10: { feet: 21000, meters: 6401 },
  11: { feet: 22000, meters: 6706 },
  12: { feet: 23000, meters: 7010 }, // MAX
};

export default function AppleMetricsDisplay({ 
  spo2 = 95, 
  heartRate = 72, 
  dialPosition = 6,
  phaseProgress = 0,
  currentPhase = 'altitude'
}) {
  // Animation values
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.3)).current;
  const ekgProgress = useRef(new Animated.Value(0)).current;
  const [ekgPath, setEkgPath] = useState('');
  
  // Get altitude from dial position
  const altitude = ALTITUDE_MAP[dialPosition] || ALTITUDE_MAP[6];
  
  // Pulse animation for SpO2
  useEffect(() => {
    const pulseDuration = 60000 / heartRate; // Convert BPM to milliseconds per beat
    
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
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
  }, [heartRate]);

  // Glow animation for adapting status
  useEffect(() => {
    const glowAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.3,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    
    glowAnimation.start();
    return () => glowAnimation.stop();
  }, []);

  // EKG animation
  useEffect(() => {
    const ekgAnimation = Animated.loop(
      Animated.timing(ekgProgress, {
        toValue: 1,
        duration: 60000 / heartRate,
        useNativeDriver: false,
      })
    );
    
    ekgAnimation.start();
    return () => ekgAnimation.stop();
  }, [heartRate]);

  // Generate EKG path
  useEffect(() => {
    const width = 120;
    const height = 40;
    const path = `
      M 0 ${height/2}
      L ${width * 0.2} ${height/2}
      L ${width * 0.25} ${height * 0.3}
      L ${width * 0.3} ${height * 0.7}
      L ${width * 0.35} ${height * 0.1}
      L ${width * 0.4} ${height * 0.9}
      L ${width * 0.45} ${height/2}
      L ${width * 0.6} ${height/2}
      L ${width * 0.65} ${height * 0.4}
      L ${width * 0.7} ${height * 0.6}
      L ${width * 0.75} ${height/2}
      L ${width} ${height/2}
    `;
    setEkgPath(path);
  }, []);

  // Determine SpO2 color
  const getSpo2Color = () => {
    if (spo2 >= 95) return '#10B981'; // Green
    if (spo2 >= 90) return '#3B82F6'; // Blue
    if (spo2 >= 85) return '#F59E0B'; // Orange
    return '#EF4444'; // Red
  };

  // Determine HR color
  const getHRColor = () => {
    if (heartRate < 50 || heartRate > 150) return '#EF4444'; // Red
    if (heartRate < 60 || heartRate > 120) return '#F59E0B'; // Orange
    return '#EC4899'; // Pink
  };

  return (
    <View style={styles.container}>
      {/* Main Metrics Grid */}
      <View style={styles.metricsGrid}>
        
        {/* SpO2 - Top Center */}
        <Animated.View 
          style={[
            styles.spo2Container,
            { transform: [{ scale: pulseAnim }] }
          ]}
        >
          <Text style={[styles.spo2Value, { color: getSpo2Color() }]}>
            {spo2}
          </Text>
          <Text style={styles.spo2Label}>SpO₂</Text>
          <View style={[styles.spo2Indicator, { backgroundColor: getSpo2Color() }]} />
        </Animated.View>

        {/* Heart Rate - Right */}
        <View style={styles.heartRateContainer}>
          <View style={styles.hrValueContainer}>
            <Text style={[styles.hrValue, { color: getHRColor() }]}>
              {heartRate}
            </Text>
            <Text style={styles.hrUnit}>BPM</Text>
          </View>
          
          {/* EKG Line */}
          <View style={styles.ekgContainer}>
            <Svg width={120} height={40} style={styles.ekgSvg}>
              <Path
                d={ekgPath}
                stroke={getHRColor()}
                strokeWidth={2}
                fill="none"
              />
              <Animated.View
                style={[
                  styles.ekgDot,
                  {
                    transform: [
                      {
                        translateX: ekgProgress.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, 120],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <Circle
                  cx={6}
                  cy={20}
                  r={4}
                  fill={getHRColor()}
                />
              </Animated.View>
            </Svg>
          </View>
        </View>

        {/* Altitude - Left */}
        <View style={styles.altitudeContainer}>
          <Text style={styles.altitudeValue}>
            {altitude.feet.toLocaleString()}
          </Text>
          <Text style={styles.altitudeUnit}>ft</Text>
          <Text style={styles.altitudeMeters}>
            {altitude.meters.toLocaleString()}m
          </Text>
        </View>
      </View>

      {/* Status Bar */}
      <View style={styles.statusContainer}>
        {currentPhase === 'altitude' && (
          <Animated.View 
            style={[
              styles.statusBar,
              { opacity: glowAnim }
            ]}
          >
            <View style={styles.statusContent}>
              <Text style={styles.statusText}>ADAPTING</Text>
              <View style={[styles.statusDot, { backgroundColor: '#10B981' }]} />
            </View>
          </Animated.View>
        )}
        {currentPhase === 'recovery' && (
          <View style={styles.statusBar}>
            <View style={styles.statusContent}>
              <Text style={[styles.statusText, { color: '#60A5FA' }]}>RECOVERING</Text>
              <View style={[styles.statusDot, { backgroundColor: '#60A5FA' }]} />
            </View>
          </View>
        )}
      </View>

      {/* Phase Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View 
            style={[
              styles.progressFill,
              { 
                width: `${phaseProgress * 100}%`,
                backgroundColor: currentPhase === 'altitude' ? '#3B82F6' : '#10B981'
              }
            ]}
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
    paddingHorizontal: 20,
  },
  metricsGrid: {
    width: '100%',
    alignItems: 'center',
  },
  
  // SpO2 Styles
  spo2Container: {
    alignItems: 'center',
    marginBottom: 60,
  },
  spo2Value: {
    fontSize: 96,
    fontWeight: '200',
    letterSpacing: -2,
  },
  spo2Label: {
    fontSize: 18,
    fontWeight: '500',
    color: '#6B7280',
    marginTop: -10,
    letterSpacing: 1,
  },
  spo2Indicator: {
    width: 40,
    height: 3,
    borderRadius: 1.5,
    marginTop: 8,
  },

  // Heart Rate Styles
  heartRateContainer: {
    position: 'absolute',
    right: 20,
    top: 80,
    alignItems: 'flex-end',
  },
  hrValueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  hrValue: {
    fontSize: 48,
    fontWeight: '300',
    letterSpacing: -1,
  },
  hrUnit: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginLeft: 4,
    letterSpacing: 0.5,
  },
  ekgContainer: {
    marginTop: 8,
    height: 40,
    width: 120,
  },
  ekgSvg: {
    backgroundColor: 'transparent',
  },
  ekgDot: {
    position: 'absolute',
    width: 12,
    height: 40,
    justifyContent: 'center',
  },

  // Altitude Styles
  altitudeContainer: {
    position: 'absolute',
    left: 20,
    top: 80,
    alignItems: 'flex-start',
  },
  altitudeValue: {
    fontSize: 42,
    fontWeight: '300',
    color: '#E5E7EB',
    letterSpacing: -1,
  },
  altitudeUnit: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: -4,
    letterSpacing: 0.5,
  },
  altitudeMeters: {
    fontSize: 12,
    color: '#4B5563',
    marginTop: 2,
  },

  // Status Styles
  statusContainer: {
    marginTop: 40,
    height: 40,
    justifyContent: 'center',
  },
  statusBar: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  statusContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 2,
    color: '#10B981',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 12,
  },

  // Progress Bar
  progressContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 40,
  },
  progressBar: {
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 1,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 1,
  },
});