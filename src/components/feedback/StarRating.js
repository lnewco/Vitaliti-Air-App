import React from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import SafeIcon from '../base/SafeIcon';
import { colors, spacing } from '../../design-system';

const StarRating = ({ rating, onRatingChange, size = 'lg' }) => {
  const [animations] = React.useState(
    Array(5).fill(null).map(() => new Animated.Value(1))
  );

  const handlePress = (value) => {
    // Animate the pressed star
    Animated.sequence([
      Animated.timing(animations[value - 1], {
        toValue: 1.3,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(animations[value - 1], {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();

    onRatingChange(value);
  };

  const iconSize = size === 'lg' ? 32 : 24;

  return (
    <View style={styles.container}>
      {[1, 2, 3, 4, 5].map((value) => (
        <Animated.View
          key={value}
          style={{
            transform: [{ scale: animations[value - 1] }],
          }}
        >
          <TouchableOpacity
            onPress={() => handlePress(value)}
            activeOpacity={0.7}
            style={styles.starButton}
          >
            <SafeIcon
              name={rating >= value ? 'star-filled' : 'star'}
              size={size}
              color={rating >= value ? colors.brand.accent : colors.text.quaternary}
            />
          </TouchableOpacity>
        </Animated.View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  starButton: {
    padding: spacing.xs,
  },
});

export default StarRating;