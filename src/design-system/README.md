# Vitaliti Air Design System

## Overview
The Vitaliti Air design system provides a consistent, scalable foundation for the app's visual language and user interface components.

## Directory Structure
```
design-system/
├── colors.js              # Color tokens and palette
├── typography.js          # Typography system
├── spacing.js            # Spacing scale
├── index.js              # Main export file
└── components/           # Design system components
    ├── MetricRing.js     # Circular metric display
    ├── PremiumCard.js    # Premium card container
    ├── PremiumButton.js  # Premium button styles
    └── FloatingTabBar.js # Custom tab bar
```

## Color System

### Brand Colors
```javascript
primary: '#007AFF'      // Primary blue
secondary: '#5856D6'    // Purple accent
accent: '#64D2FF'       // Light blue
success: '#34C759'      // Green
warning: '#FF9500'      // Orange
error: '#FF3B30'        // Red
```

### Semantic Colors
- **Background**: Gradient-based dark theme
  - `primary`: Black to dark gray gradients
  - `secondary`: Subtle gray variations
  - `tertiary`: Accent overlay colors

- **Text Colors**:
  - `primary`: #FFFFFF (100% white)
  - `secondary`: rgba(255, 255, 255, 0.7)
  - `tertiary`: rgba(255, 255, 255, 0.5)
  - `quaternary`: rgba(255, 255, 255, 0.3)

### Surface Colors
```javascript
surface: {
  primary: 'rgba(255, 255, 255, 0.1)',
  secondary: 'rgba(255, 255, 255, 0.05)',
  elevated: 'rgba(255, 255, 255, 0.15)',
}
```

## Typography System

### Font Families
- **iOS**: SF Pro Display, SF Pro Text, System
- **Android**: Roboto, System

### Type Scale
```javascript
// Headings
h1: { fontSize: 34, fontWeight: '700', lineHeight: 41 }
h2: { fontSize: 28, fontWeight: '600', lineHeight: 34 }
h3: { fontSize: 22, fontWeight: '600', lineHeight: 28 }
h4: { fontSize: 20, fontWeight: '600', lineHeight: 24 }
h5: { fontSize: 17, fontWeight: '600', lineHeight: 22 }
h6: { fontSize: 15, fontWeight: '600', lineHeight: 20 }

// Body Text
body.large: { fontSize: 17, fontWeight: '400', lineHeight: 22 }
body.medium: { fontSize: 15, fontWeight: '400', lineHeight: 20 }
body.small: { fontSize: 13, fontWeight: '400', lineHeight: 18 }

// Special Text
label: { fontSize: 11, fontWeight: '500', letterSpacing: 0.5 }
caption: { fontSize: 12, fontWeight: '400', lineHeight: 16 }
metric: { fontSize: 48, fontWeight: '200' }
metricLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 1 }
```

## Spacing System

Based on an 8-point grid system:

```javascript
xxs: 2   // Micro spacing
xs: 4    // Extra small
sm: 8    // Small
md: 16   // Medium (base)
lg: 24   // Large
xl: 32   // Extra large
xxl: 48  // Extra extra large
xxxl: 64 // Maximum spacing
```

### Usage Guidelines
- Use `xs` for inline spacing between text elements
- Use `sm` for padding within components
- Use `md` as the default spacing between components
- Use `lg` for section spacing
- Use `xl` and above for major layout divisions

## Component Patterns

### Cards
Use `PremiumCard` for content containers:
```javascript
<PremiumCard>
  <PremiumCard.Header title="Section Title" />
  <PremiumCard.Body>
    {/* Content */}
  </PremiumCard.Body>
</PremiumCard>
```

### Buttons
Use `PremiumButton` for primary actions:
```javascript
<PremiumButton 
  onPress={handlePress}
  variant="primary" // or "secondary", "outline"
>
  Button Text
</PremiumButton>
```

### Metrics Display
Use `MetricRing` for circular progress indicators:
```javascript
<MetricRing
  value={85}
  maxValue={100}
  size={120}
  strokeWidth={8}
  color={colors.brand.success}
/>
```

## Animation Presets

### Spring Animations
```javascript
animations.spring.default: { damping: 15, stiffness: 150 }
animations.spring.bouncy: { damping: 10, stiffness: 100 }
animations.spring.stiff: { damping: 20, stiffness: 300 }
```

### Timing Animations
```javascript
animations.timing.fast: 200ms
animations.timing.medium: 300ms
animations.timing.slow: 500ms
```

## Haptic Feedback

Standardized haptic patterns:
```javascript
haptics.light: 'impactLight'
haptics.medium: 'impactMedium'
haptics.heavy: 'impactHeavy'
haptics.success: 'notificationSuccess'
haptics.warning: 'notificationWarning'
haptics.error: 'notificationError'
haptics.selection: 'selection'
```

## Best Practices

### 1. Always Use Theme Tokens
```javascript
// ✅ Good
color: colors.text.primary

// ❌ Bad
color: '#FFFFFF'
```

### 2. Consistent Spacing
```javascript
// ✅ Good
padding: spacing.md

// ❌ Bad
padding: 16
```

### 3. Typography Hierarchy
```javascript
// ✅ Good
<Text style={typography.h2}>Title</Text>
<Text style={typography.body.medium}>Description</Text>

// ❌ Bad
<Text style={{ fontSize: 28 }}>Title</Text>
```

### 4. Semantic Colors
```javascript
// ✅ Good
backgroundColor: colors.surface.elevated

// ❌ Bad
backgroundColor: 'rgba(255, 255, 255, 0.15)'
```

## Accessibility

- Maintain WCAG AA contrast ratios (4.5:1 for normal text, 3:1 for large text)
- All interactive elements should be at least 44x44 points
- Use semantic color names that convey meaning
- Provide haptic feedback for important interactions

## Dark Mode Support

The design system is built with a dark-first approach:
- All colors are optimized for dark backgrounds
- Surface colors use transparency for elevation
- Text colors use opacity for hierarchy

## Platform Considerations

### iOS
- Uses SF Pro font family
- Respects iOS safe areas
- Follows iOS Human Interface Guidelines

### Android
- Uses Roboto font family
- Implements Material Design elevation
- Follows Material Design Guidelines

## Migration Guide

When updating existing components:

1. Replace hardcoded colors with theme tokens
2. Update spacing values to use the spacing scale
3. Apply typography styles from the system
4. Use design system components where applicable
5. Add haptic feedback to interactions

## Component Library

### Available Components
- `MetricRing` - Circular progress indicators
- `PremiumCard` - Content containers
- `PremiumButton` - Action buttons
- `FloatingTabBar` - Navigation tab bar
- `StatusBadge` - Status indicators
- `DashboardHeader` - Screen headers

### Usage Example
```javascript
import { 
  colors, 
  typography, 
  spacing,
  PremiumCard,
  PremiumButton,
  MetricRing 
} from '../design-system';

const MyComponent = () => (
  <PremiumCard style={{ margin: spacing.md }}>
    <Text style={typography.h3}>Title</Text>
    <MetricRing value={75} />
    <PremiumButton onPress={handleAction}>
      Take Action
    </PremiumButton>
  </PremiumCard>
);
```

## Future Enhancements

- [ ] Light mode theme variant
- [ ] Dynamic color schemes
- [ ] Animated transitions between themes
- [ ] Additional component variants
- [ ] Storybook integration for component preview