import React from 'react';
import { View, Image, StyleSheet } from 'react-native';

const VitalitiLogo = ({ size = 'medium', style }) => {
  const sizes = {
    small: { width: 100, height: 30 },
    medium: { width: 140, height: 42 },
    large: { width: 180, height: 54 },
  };

  const selectedSize = sizes[size] || sizes.medium;

  return (
    <View style={[styles.container, style]}>
      <Image
        source={require('../../assets/IMG_4490.png')}
        style={[selectedSize]}
        resizeMode="contain"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default VitalitiLogo;