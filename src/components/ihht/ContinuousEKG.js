import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';

// Create a singleton instance that persists across all uses
let globalAnimation = null;
let globalScrollX = null;
let globalStartTime = Date.now();

// Initialize global animation values
if (!globalScrollX) {
  globalScrollX = new Animated.Value(0);
}

const ContinuousEKG = ({ width = 120, height = 40 }) => {
  console.log('🔴 ContinuousEKG MOUNTING - This should NOT happen on heart rate change!');
  const pathRef = useRef(null);
  const gradientId = useRef(`ekg-gradient-static`).current; // Static ID, never changes
  
  const generateEKGPath = (offset) => {
    const segments = [];
    const segmentWidth = width / 2;
    const baselineY = height / 2;
    
    for (let i = -1; i < 3; i++) {
      const x = i * segmentWidth - (offset % segmentWidth);
      
      if (x > -segmentWidth && x < width + segmentWidth) {
        // Start with QRS complex first, not flat line!
        // QRS complex (sharp spike)
        segments.push(`M ${x + segmentWidth * 0.28} ${baselineY + height * 0.1}`);
        segments.push(`L ${x + segmentWidth * 0.32} ${baselineY - height * 0.35}`);
        segments.push(`L ${x + segmentWidth * 0.35} ${baselineY + height * 0.2}`);
        segments.push(`L ${x + segmentWidth * 0.38} ${baselineY}`);
        
        // T wave (recovery bump)
        segments.push(`C ${x + segmentWidth * 0.45} ${baselineY - height * 0.15},
                         ${x + segmentWidth * 0.55} ${baselineY - height * 0.15},
                         ${x + segmentWidth * 0.6} ${baselineY}`);
        
        // Flat line to next beat
        segments.push(`L ${x + segmentWidth} ${baselineY}`);
        
        // Continue to next beat's P wave
        segments.push(`L ${x + segmentWidth + segmentWidth * 0.0} ${baselineY}`);
        segments.push(`C ${x + segmentWidth + segmentWidth * 0.05} ${baselineY - height * 0.1},
                         ${x + segmentWidth + segmentWidth * 0.1} ${baselineY - height * 0.1},
                         ${x + segmentWidth + segmentWidth * 0.15} ${baselineY}`);
        
        // Flat line before next QRS
        segments.push(`L ${x + segmentWidth + segmentWidth * 0.25} ${baselineY}`);
      }
    }
    
    return segments.join(' ');
  };
  
  useEffect(() => {
    // Calculate where the animation should be based on elapsed time
    const elapsedTime = Date.now() - globalStartTime;
    const FIXED_BPM = 72;
    const beatDuration = 60000 / FIXED_BPM;
    const scrollDuration = beatDuration * 2;
    const currentProgress = (elapsedTime % scrollDuration) / scrollDuration;
    const currentOffset = width * currentProgress;
    
    // Set up listener
    const listenerId = globalScrollX.addListener(({ value }) => {
      if (pathRef.current) {
        const path = generateEKGPath(value);
        pathRef.current.setNativeProps({ d: path });
      }
    });
    
    // Start global animation if not already running
    if (!globalAnimation) {
      globalScrollX.setValue(currentOffset); // Start from current position
      
      globalAnimation = Animated.loop(
        Animated.timing(globalScrollX, {
          toValue: width,
          duration: scrollDuration,
          useNativeDriver: false,
          isInteraction: false,
        })
      );
      
      globalAnimation.start();
    }
    
    // Set initial path to current position
    if (pathRef.current) {
      const path = generateEKGPath(currentOffset);
      pathRef.current.setNativeProps({ d: path });
    }
    
    return () => {
      globalScrollX.removeListener(listenerId);
      // Don't stop the global animation - let it continue
    };
  }, [width, height]);
  
  return (
    <View style={[styles.container, { width, height }]}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFillObject}>
        <Defs>
          <LinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#EC4899" stopOpacity="0" />
            <Stop offset="10%" stopColor="#EC4899" stopOpacity="1" />
            <Stop offset="90%" stopColor="#EC4899" stopOpacity="1" />
            <Stop offset="100%" stopColor="#EC4899" stopOpacity="0" />
          </LinearGradient>
        </Defs>
        
        <Path
          ref={pathRef}
          d="" // Start with empty path - will be set by animation
          stroke={`url(#${gradientId})`}
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
});

export default ContinuousEKG;