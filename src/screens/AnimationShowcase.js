import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { colors, spacing } from '../design-system';
import PulseOxRingAnimation from '../components/animations/PulseOxRingAnimation';
// Import other animations as we create them
// import DiamondMetricsDisplay from '../components/training/DiamondMetricsDisplay';
// import MaskLiftAnimation from '../components/animations/MaskLiftAnimation';

const AnimationShowcase = ({ navigation }) => {
  const [activeAnimation, setActiveAnimation] = useState('pulseOx');
  const [isPlaying, setIsPlaying] = useState(true);

  const animations = [
    {
      id: 'pulseOx',
      title: 'Pulse Oximeter Setup',
      description: 'Shows how to place the pulse oximeter on thumb',
      component: <PulseOxRingAnimation isPlaying={isPlaying} size={250} />,
    },
    {
      id: 'diamond',
      title: 'Diamond Metrics Display',
      description: 'Main training screen with SpO2, HR, altitude metrics',
      component: (
        <View style={styles.placeholderBox}>
          <Text style={styles.placeholderText}>Diamond Display Coming Soon</Text>
        </View>
      ),
    },
    {
      id: 'maskLift',
      title: 'Mask Lift Instruction',
      description: 'Shows proper mask lifting technique for recovery',
      component: (
        <View style={styles.placeholderBox}>
          <Text style={styles.placeholderText}>Mask Lift Animation Coming Soon</Text>
        </View>
      ),
    },
    {
      id: 'dialAdjust',
      title: 'Dial Adjustment',
      description: 'Shows how to adjust the altitude dial',
      component: (
        <View style={styles.placeholderBox}>
          <Text style={styles.placeholderText}>Dial Animation Coming Soon</Text>
        </View>
      ),
    },
    {
      id: 'breathing',
      title: 'Breathing Pattern',
      description: 'Visual breathing guide for training',
      component: (
        <View style={styles.placeholderBox}>
          <Text style={styles.placeholderText}>Breathing Guide Coming Soon</Text>
        </View>
      ),
    },
  ];

  const currentAnimation = animations.find(a => a.id === activeAnimation);

  const handleReplay = () => {
    setIsPlaying(false);
    setTimeout(() => setIsPlaying(true), 100);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background.primary} />
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Animation Showcase</Text>
          <View style={styles.backButton} />
        </View>

        {/* Animation Display Area */}
        <View style={styles.animationArea}>
          <Text style={styles.animationTitle}>{currentAnimation.title}</Text>
          <Text style={styles.animationDescription}>{currentAnimation.description}</Text>
          
          <View style={styles.animationContainer}>
            {currentAnimation.component}
          </View>

          <TouchableOpacity style={styles.replayButton} onPress={handleReplay}>
            <Text style={styles.replayButtonText}>Replay Animation</Text>
          </TouchableOpacity>
        </View>

        {/* Animation Selector */}
        <View style={styles.selectorContainer}>
          <Text style={styles.selectorTitle}>Available Animations:</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.selectorScroll}
          >
            {animations.map((anim) => (
              <TouchableOpacity
                key={anim.id}
                style={[
                  styles.selectorButton,
                  activeAnimation === anim.id && styles.selectorButtonActive
                ]}
                onPress={() => {
                  setActiveAnimation(anim.id);
                  handleReplay();
                }}
              >
                <Text style={[
                  styles.selectorButtonText,
                  activeAnimation === anim.id && styles.selectorButtonTextActive
                ]}>
                  {anim.title}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Debug Info */}
        <View style={styles.debugInfo}>
          <Text style={styles.debugText}>Animation ID: {activeAnimation}</Text>
          <Text style={styles.debugText}>Playing: {isPlaying ? 'Yes' : 'No'}</Text>
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 60,
  },
  backText: {
    color: colors.primary,
    fontSize: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text.primary,
  },
  animationArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.screenPadding,
  },
  animationTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: 8,
    textAlign: 'center',
  },
  animationDescription: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 20,
    textAlign: 'center',
  },
  animationContainer: {
    width: 300,
    height: 300,
    backgroundColor: colors.background.secondary,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  replayButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    marginTop: 10,
  },
  replayButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  selectorContainer: {
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 15,
  },
  selectorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 10,
  },
  selectorScroll: {
    flexGrow: 0,
  },
  selectorButton: {
    backgroundColor: colors.background.secondary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectorButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '20',
  },
  selectorButtonText: {
    color: colors.text.secondary,
    fontSize: 14,
    fontWeight: '500',
  },
  selectorButtonTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  placeholderBox: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.tertiary,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  placeholderText: {
    color: colors.text.secondary,
    fontSize: 16,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  debugInfo: {
    backgroundColor: colors.background.secondary,
    padding: 10,
    paddingHorizontal: spacing.screenPadding,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  debugText: {
    fontSize: 12,
    color: colors.text.secondary,
    fontFamily: 'monospace',
  },
});

export default AnimationShowcase;