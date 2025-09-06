import React from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../../design-system';

const StarRating = ({ rating, onRatingChange, size = 'lg' }) => {
  const [animations] = React.useState(
    Array(5).fill(null).map(() => new Animated.Value(1))
  );

  const handlePress = (value) => {
    // Animate all stars up to the selected one
    const animationPromises = [];
    for (let i = 0; i < value; i++) {
      animationPromises.push(
        Animated.sequence([
          Animated.timing(animations[i], {
            toValue: 1.4,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.spring(animations[i], {
            toValue: 1,
            speed: 14,
            bounciness: 8,
            useNativeDriver: true,
          }),
        ]).start
      );
    }
    
    // Run animations with slight delay between each star
    animationPromises.forEach((anim, index) => {
      setTimeout(() => anim(), index * 50);
    });

    onRatingChange(value);
  };

  const starSize = size === 'lg' ? 40 : 28;

  return (
    <View style={styles.container}>
      {[1, 2, 3, 4, 5].map((value) => {
        const isSelected = rating >= value;
        return (
          <Animated.View
            key={value}
            style={{
              transform: [{ scale: animations[value - 1] }],
            }}
          >
            <TouchableOpacity
              onPress={() => handlePress(value)}
              activeOpacity={0.7}
              style={[
                styles.starButton,
                size === 'lg' && styles.starButtonLarge
              ]}
            >
              <Ionicons
                name={isSelected ? 'star' : 'star-outline'}
                size={starSize}
                color={isSelected ? colors.brand.accent : 'rgba(255, 255, 255, 0.3)'}
                style={isSelected ? styles.starIconSelected : styles.starIcon}
              />
            </TouchableOpacity>
          </Animated.View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
  },
  starButton: {
    padding: spacing.xs,
  },
  starButtonLarge: {
    padding: spacing.sm,
  },
  starIcon: {
    // No shadow for unselected stars
  },
  starIconSelected: {
    shadowColor: colors.brand.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
});

export default StarRating;