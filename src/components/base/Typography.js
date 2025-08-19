import React from 'react';
import { Text as RNText, StyleSheet } from 'react-native';
import { useAppTheme } from '../../theme';

// Base Text component
const Text = ({ 
  children, 
  style, 
  variant = 'body',
  color = 'primary',
  align = 'left',
  numberOfLines,
  ellipsizeMode = 'tail',
  weight,
  ...props 
}) => {
  const { colors, typography } = useAppTheme();
  
  const getColor = (colorProp) => {
    // Check if it's a semantic color
    const semanticColors = {
      primary: colors.text.primary,
      secondary: colors.text.secondary,
      tertiary: colors.text.tertiary,
      inverse: colors.text.inverse,
      link: colors.text.link,
      disabled: colors.text.disabled,
      error: colors.error[500],
      warning: colors.warning[500],
      success: colors.success[500],
    };

    if (semanticColors[colorProp]) {
      return semanticColors[colorProp];
    }

    // Check if it's a direct color value (hex, rgb, etc.)
    if (typeof colorProp === 'string' && (colorProp.startsWith('#') || colorProp.startsWith('rgb'))) {
      return colorProp;
    }

    // Default to primary
    return colors.text.primary;
  };
  
  const variantMap = {
    h1: 'h1',
    h2: 'h2',
    h3: 'h3',
    h4: 'h4',
    h5: 'h5',
    h6: 'h6',
    body: 'bodyMedium',
    bodyLarge: 'bodyLarge',
    bodySmall: 'bodySmall',
    label: 'labelMedium',
    labelLarge: 'labelLarge',
    labelSmall: 'labelSmall',
    caption: 'caption',
    captionBold: 'captionBold',
    button: 'buttonMedium',
    buttonLarge: 'buttonLarge',
    buttonSmall: 'buttonSmall',
    metric: 'metric',
    metricLabel: 'metricLabel',
  };

  const textStyles = [
    styles.base,
    typography.styles[variantMap[variant] || 'bodyMedium'],
    { color: getColor(color) },
    { textAlign: align },
    weight && { fontWeight: weight },
    style,
  ];

  return (
    <RNText 
      style={textStyles}
      numberOfLines={numberOfLines}
      ellipsizeMode={ellipsizeMode}
      {...props}
    >
      {children}
    </RNText>
  );
};

// Heading components
export const H1 = (props) => <Text variant="h1" {...props} />;
export const H2 = (props) => <Text variant="h2" {...props} />;
export const H3 = (props) => <Text variant="h3" {...props} />;
export const H4 = (props) => <Text variant="h4" {...props} />;
export const H5 = (props) => <Text variant="h5" {...props} />;
export const H6 = (props) => <Text variant="h6" {...props} />;

// Body text components
export const Body = (props) => <Text variant="body" {...props} />;
export const BodyLarge = (props) => <Text variant="bodyLarge" {...props} />;
export const BodySmall = (props) => <Text variant="bodySmall" {...props} />;

// Special text components
export const Label = (props) => <Text variant="label" {...props} />;
export const Caption = (props) => <Text variant="caption" {...props} />;
export const Metric = (props) => <Text variant="metric" {...props} />;
export const MetricLabel = (props) => <Text variant="metricLabel" {...props} />;

const styles = StyleSheet.create({
  base: {
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
});

export default Text;