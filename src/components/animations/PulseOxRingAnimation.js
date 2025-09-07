import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSequence,
  withDelay,
  withRepeat,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import Svg, { Path, Circle, Ellipse, G, Defs, LinearGradient, Stop, Rect } from 'react-native-svg';

const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const PulseOxRingAnimation = ({ isPlaying = true, size = 300 }) => {
  const slideProgress = useSharedValue(0);
  const glowOpacity = useSharedValue(0);
  const pulseScale = useSharedValue(1);

  useEffect(() => {
    if (isPlaying) {
      // Reset and play animation
      slideProgress.value = 0;
      glowOpacity.value = 0;
      pulseScale.value = 1;

      // Slide ring onto thumb from above
      slideProgress.value = withSequence(
        withDelay(500, withTiming(1, { 
          duration: 2000, 
          easing: Easing.out(Easing.cubic) 
        })),
        withDelay(1000, withTiming(0, { duration: 0 })) // Reset after delay
      );

      // Glow effect when connected
      glowOpacity.value = withSequence(
        withDelay(2500, withTiming(1, { duration: 500 })),
        withDelay(1000, withTiming(0, { duration: 500 }))
      );

      // Pulse effect when reading
      pulseScale.value = withSequence(
        withDelay(2500, 
          withRepeat(
            withSequence(
              withTiming(1.05, { duration: 400 }),
              withTiming(1, { duration: 600 })
            ),
            3,
            false
          )
        )
      );
    }
  }, [isPlaying]);

  const ringAnimatedStyle = useAnimatedStyle(() => {
    // Ring slides from above onto thumb
    const translateY = interpolate(
      slideProgress.value,
      [0, 0.7, 1],
      [-150, -30, 20]
    );
    
    const translateX = interpolate(
      slideProgress.value,
      [0, 1],
      [0, -35]
    );
    
    const scale = interpolate(
      slideProgress.value,
      [0, 0.3, 1],
      [0.8, 0.95, 1]
    );

    return {
      transform: [
        { translateX },
        { translateY },
        { scale },
      ],
    };
  });

  const glowAnimatedStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: pulseScale.value }],
  }));

  const scale = size / 300; // Base size is 300

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox="0 0 400 400">
        <Defs>
          {/* Gradient for thumb */}
          <LinearGradient id="thumbGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#FDBCB4" />
            <Stop offset="100%" stopColor="#F5A097" />
          </LinearGradient>
          
          {/* Gradient for nail */}
          <LinearGradient id="nailGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#FFE5E5" />
            <Stop offset="100%" stopColor="#FFD4D4" />
          </LinearGradient>

          {/* Shadow gradient */}
          <LinearGradient id="shadowGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#00000020" />
            <Stop offset="100%" stopColor="#00000005" />
          </LinearGradient>

          {/* Device gradient - sleek black */}
          <LinearGradient id="deviceGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#3A3A3A" />
            <Stop offset="30%" stopColor="#2C2C2C" />
            <Stop offset="70%" stopColor="#1A1A1A" />
            <Stop offset="100%" stopColor="#0F0F0F" />
          </LinearGradient>

          {/* Device highlight gradient */}
          <LinearGradient id="highlightGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.3" />
            <Stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.1" />
            <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </LinearGradient>

          {/* LED glow gradient */}
          <LinearGradient id="ledGlow" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#00FF00" stopOpacity="0.8" />
            <Stop offset="100%" stopColor="#00FF00" stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {/* Full Hand */}
        <G transform={`translate(${200 * scale}, ${200 * scale})`}>
          {/* Palm shadow */}
          <Ellipse 
            cx="0" 
            cy="30" 
            rx="75" 
            ry="20" 
            fill="#00000020"
            opacity="0.4"
          />
          
          {/* Palm */}
          <Path 
            d="M -60 20 Q -70 -20 -65 -60 Q -60 -80 -50 -85 Q -30 -90 0 -85 Q 30 -90 50 -85 Q 60 -80 65 -60 Q 70 -20 60 20 Q 50 50 30 60 Q 0 70 -30 60 Q -50 50 -60 20"
            fill="url(#thumbGradient)"
          />
          
          {/* Index finger */}
          <G transform="translate(35, -85)">
            <Ellipse cx="0" cy="-25" rx="12" ry="30" fill="url(#thumbGradient)" />
            <Ellipse cx="0" cy="-45" rx="11" ry="8" fill="url(#nailGradient)" />
            <Path d="M -8 -15 Q 0 -13 8 -15" stroke="#E09080" strokeWidth="0.5" fill="none" opacity="0.3" />
            <Path d="M -8 -5 Q 0 -3 8 -5" stroke="#E09080" strokeWidth="0.5" fill="none" opacity="0.3" />
          </G>
          
          {/* Middle finger */}
          <G transform="translate(10, -90)">
            <Ellipse cx="0" cy="-28" rx="12" ry="33" fill="url(#thumbGradient)" />
            <Ellipse cx="0" cy="-50" rx="11" ry="8" fill="url(#nailGradient)" />
            <Path d="M -8 -18 Q 0 -16 8 -18" stroke="#E09080" strokeWidth="0.5" fill="none" opacity="0.3" />
            <Path d="M -8 -8 Q 0 -6 8 -8" stroke="#E09080" strokeWidth="0.5" fill="none" opacity="0.3" />
          </G>
          
          {/* Ring finger */}
          <G transform="translate(-15, -88)">
            <Ellipse cx="0" cy="-26" rx="11" ry="31" fill="url(#thumbGradient)" />
            <Ellipse cx="0" cy="-47" rx="10" ry="8" fill="url(#nailGradient)" />
            <Path d="M -7 -16 Q 0 -14 7 -16" stroke="#E09080" strokeWidth="0.5" fill="none" opacity="0.3" />
            <Path d="M -7 -6 Q 0 -4 7 -6" stroke="#E09080" strokeWidth="0.5" fill="none" opacity="0.3" />
          </G>
          
          {/* Pinky finger */}
          <G transform="translate(-40, -80)">
            <Ellipse cx="0" cy="-20" rx="10" ry="25" fill="url(#thumbGradient)" />
            <Ellipse cx="0" cy="-38" rx="9" ry="7" fill="url(#nailGradient)" />
            <Path d="M -6 -12 Q 0 -10 6 -12" stroke="#E09080" strokeWidth="0.5" fill="none" opacity="0.3" />
            <Path d="M -6 -2 Q 0 0 6 -2" stroke="#E09080" strokeWidth="0.5" fill="none" opacity="0.3" />
          </G>
          
          {/* Thumb - larger and positioned to the side */}
          <G transform="translate(-35, -20) rotate(-30)">
            <Ellipse cx="0" cy="-15" rx="18" ry="35" fill="url(#thumbGradient)" />
            <Ellipse cx="0" cy="-40" rx="15" ry="12" fill="url(#nailGradient)" />
            <Ellipse cx="-3" cy="-42" rx="5" ry="4" fill="#FFFFFF" opacity="0.5" />
            <Path d="M -12 -10 Q 0 -8 12 -10" stroke="#E09080" strokeWidth="0.7" fill="none" opacity="0.3" />
            <Path d="M -10 5 Q 0 7 10 5" stroke="#E09080" strokeWidth="0.7" fill="none" opacity="0.3" />
          </G>
          
          {/* Palm lines */}
          <Path d="M -40 -30 Q -20 -20 0 -25" stroke="#E09080" strokeWidth="1" fill="none" opacity="0.2" />
          <Path d="M -45 -10 Q -15 -5 10 -15" stroke="#E09080" strokeWidth="1" fill="none" opacity="0.2" />
          <Path d="M -40 10 Q -10 15 20 5" stroke="#E09080" strokeWidth="1" fill="none" opacity="0.2" />
        </G>

        {/* Modern Pulse Ox Ring Device */}
        <AnimatedG style={ringAnimatedStyle}>
          <G transform={`translate(${200 * scale}, ${160 * scale})`}>
            {/* Device shadow */}
            <Ellipse 
              cx="0" 
              cy="3" 
              rx="48" 
              ry="28" 
              fill="#00000030"
              opacity="0.5"
            />
            
            {/* Main device body - sleek oval shape */}
            <Ellipse 
              cx="0" 
              cy="0" 
              rx="45" 
              ry="26" 
              fill="url(#deviceGradient)"
            />
            
            {/* Top highlight for glossy effect */}
            <Ellipse 
              cx="0" 
              cy="-8" 
              rx="35" 
              ry="15" 
              fill="url(#highlightGradient)"
              opacity="0.4"
            />
            
            {/* Center sensor area - subtle indent */}
            <Ellipse 
              cx="0" 
              cy="0" 
              rx="25" 
              ry="14" 
              fill="#0A0A0A"
              opacity="0.8"
            />
            
            {/* LED indicator area */}
            <AnimatedG style={glowAnimatedStyle}>
              {/* Active LED indicator - green when reading */}
              <Circle 
                cx="0" 
                cy="0" 
                r="3" 
                fill="#00FF00"
                opacity="0.9"
              />
              {/* LED glow effect */}
              <Circle 
                cx="0" 
                cy="0" 
                r="8" 
                fill="url(#ledGlow)"
                opacity="0.6"
              />
            </AnimatedG>
            
            {/* Side indicators - subtle detail */}
            <Ellipse 
              cx="-20" 
              cy="0" 
              rx="3" 
              ry="2" 
              fill="#1A1A1A"
              opacity="0.5"
            />
            <Ellipse 
              cx="20" 
              cy="0" 
              rx="3" 
              ry="2" 
              fill="#1A1A1A"
              opacity="0.5"
            />
            
            {/* Bottom edge highlight for depth */}
            <Path 
              d="M -40 10 Q 0 15 40 10" 
              stroke="#333333" 
              strokeWidth="1" 
              fill="none" 
              opacity="0.3"
            />
          </G>
        </AnimatedG>

        {/* Instruction arrow (appears before animation) */}
        <G transform={`translate(${165 * scale}, ${30 * scale})`} opacity={slideProgress.value === 0 ? 1 : 0}>
          <Path 
            d="M 0 0 L 0 40 L -5 35 M 0 40 L 5 35" 
            stroke="#4A90E2" 
            strokeWidth="3" 
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </G>
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default PulseOxRingAnimation;