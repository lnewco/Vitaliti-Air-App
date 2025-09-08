import React, { useState, useEffect, useRef } from 'react';
import { Text, StyleSheet, Animated } from 'react-native';
import { ALTITUDE_CONVERSION } from '../screens/IHHTSessionSimple';

const AltitudeSlotMachine = ({ 
  fromLevel = 0, 
  toLevel = 0, 
  duration = 3000, // Reduced to 3 seconds
  onComplete,
  isActive = false 
}) => {
  // Animation state  
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const timeoutRef = useRef(null);
  const [displayLevel, setDisplayLevel] = useState(toLevel);
  
  // Validate ALTITUDE_CONVERSION exists
  if (!ALTITUDE_CONVERSION) {
    console.error('❌ AltitudeSlotMachine: ALTITUDE_CONVERSION is not available');
    return null;
  }
  
  // Validate and sanitize display level
  const safeLevel = typeof displayLevel === 'number' ? Math.max(0, Math.min(11, displayLevel)) : 0;
  
  // Get altitude values for display level
  const altitude = safeLevel === 0 ? 0 : (ALTITUDE_CONVERSION[safeLevel]?.altitude || 0);
  const meters = safeLevel === 0 ? 0 : (ALTITUDE_CONVERSION[safeLevel]?.meters || 0);
  
  // Format number with commas
  const formatNumber = (num) => {
    if (num === 0) return '0';
    return num.toLocaleString();
  };
  
  // Flash animation and altitude change
  useEffect(() => {
    if (!isActive) return;
    
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    // Start showing the FROM altitude
    setDisplayLevel(fromLevel);
    fadeAnim.setValue(1);
    
    // Create slower flashing animation (3 flashes at half speed)
    const flashSequence = Animated.sequence([
      // First flash (500ms fade out, 500ms fade in)
      Animated.timing(fadeAnim, {
        toValue: 0.3,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      // Second flash (500ms fade out, 500ms fade in)
      Animated.timing(fadeAnim, {
        toValue: 0.3,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      // Third flash (500ms fade out, 500ms fade in)
      Animated.timing(fadeAnim, {
        toValue: 0.3,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
    ]);
    
    // Start the animation
    flashSequence.start(() => {
      // After flashing completes (3 seconds), immediately change to new altitude
      setDisplayLevel(toLevel);
      
      // Call onComplete after the remaining duration
      if (onComplete) {
        timeoutRef.current = setTimeout(() => {
          onComplete();
        }, Math.max(0, duration - 3000)); // 3 flashes = 3 seconds
      }
    });
    
    // Cleanup
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      fadeAnim.stopAnimation();
    };
  }, [isActive, fromLevel, toLevel]); // Added fromLevel and toLevel to dependencies
  
  // Render with fade animation
  return (
    <>
      <Animated.Text style={[styles.altitudeValue, { opacity: fadeAnim }]}>
        {formatNumber(altitude)}
      </Animated.Text>
      <Animated.Text style={[styles.altitudeUnit, { opacity: fadeAnim }]}>
        ft
      </Animated.Text>
      <Animated.Text style={[styles.altitudeMeters, { opacity: fadeAnim }]}>
        {formatNumber(meters)}m
      </Animated.Text>
    </>
  );
};

const styles = StyleSheet.create({
  altitudeValue: {
    fontSize: 42,
    fontWeight: '300',
    color: '#FFF',
    lineHeight: 42,
    textAlign: 'center',
    minWidth: 150,  // Match the parent container width to prevent shifting
  },
  altitudeUnit: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
    fontWeight: '400',
  },
  altitudeMeters: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 4,
  },
});

export default AltitudeSlotMachine;