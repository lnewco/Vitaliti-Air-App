# Typography & Spacing Guidelines

## Typography System

### Font Stack

#### iOS
```css
font-family: -apple-system, SF Pro Display, SF Pro Text, system-ui
```

#### Android  
```css
font-family: Roboto, system-ui, sans-serif
```

### Type Scale

#### Display
| Style | Size | Weight | Line Height | Letter Spacing | Usage |
|-------|------|--------|-------------|----------------|-------|
| Display Large | 57px | 400 | 64px | -0.25px | Hero text |
| Display Medium | 45px | 400 | 52px | 0 | Section headers |
| Display Small | 36px | 400 | 44px | 0 | Large titles |

#### Headlines
| Style | Size | Weight | Line Height | Letter Spacing | Usage |
|-------|------|--------|-------------|----------------|-------|
| H1 | 34px | 700 | 41px | 0.37px | Screen titles |
| H2 | 28px | 600 | 34px | 0 | Section headers |
| H3 | 22px | 600 | 28px | 0 | Card titles |
| H4 | 20px | 600 | 24px | 0.38px | Subsections |
| H5 | 17px | 600 | 22px | -0.43px | Component headers |
| H6 | 15px | 600 | 20px | -0.23px | Small headers |

#### Body Text
| Style | Size | Weight | Line Height | Letter Spacing | Usage |
|-------|------|--------|-------------|----------------|-------|
| Body Large | 17px | 400 | 22px | -0.43px | Main content |
| Body Medium | 15px | 400 | 20px | -0.23px | Default text |
| Body Small | 13px | 400 | 18px | -0.08px | Secondary text |

#### Special Text
| Style | Size | Weight | Line Height | Letter Spacing | Usage |
|-------|------|--------|-------------|----------------|-------|
| Label | 11px | 500 | 13px | 0.5px | Form labels, tags |
| Caption | 12px | 400 | 16px | 0 | Descriptions |
| Metric | 48px | 200 | 56px | -0.5px | Large numbers |
| Metric Label | 11px | 600 | 13px | 1px | Metric descriptions |
| Button | 17px | 600 | 22px | -0.43px | Button text |

### Font Weights

| Weight | Value | Name | Usage |
|--------|-------|------|-------|
| Thin | 100 | - | Not used |
| Extra Light | 200 | - | Metrics, display |
| Light | 300 | - | Large text only |
| Regular | 400 | Regular | Body text |
| Medium | 500 | Medium | Emphasis |
| Semibold | 600 | Semibold | Headers, buttons |
| Bold | 700 | Bold | Primary headers |
| Extra Bold | 800 | - | Not used |
| Black | 900 | - | Not used |

### Implementation

```javascript
import { typography } from '../design-system';

// Headers
<Text style={typography.h1}>Main Title</Text>
<Text style={typography.h2}>Section Header</Text>

// Body Text
<Text style={typography.body.large}>Main content</Text>
<Text style={typography.body.medium}>Description</Text>
<Text style={typography.body.small}>Caption</Text>

// Special
<Text style={typography.metric}>98</Text>
<Text style={typography.metricLabel}>SPO2</Text>
```

## Spacing System

### Base Unit
8px grid system for consistent spacing

### Scale
| Token | Value | Pixels | Usage |
|-------|-------|--------|-------|
| xxs | 0.25 | 2px | Micro adjustments |
| xs | 0.5 | 4px | Tight spacing |
| sm | 1 | 8px | Compact spacing |
| md | 2 | 16px | Default spacing |
| lg | 3 | 24px | Comfortable spacing |
| xl | 4 | 32px | Section spacing |
| xxl | 6 | 48px | Large spacing |
| xxxl | 8 | 64px | Maximum spacing |

### Common Patterns

#### Component Padding
```javascript
// Small components
padding: spacing.sm  // 8px

// Default components
padding: spacing.md  // 16px

// Large components
padding: spacing.lg  // 24px
```

#### Margin Between Elements
```javascript
// Inline elements
marginRight: spacing.xs  // 4px

// Related elements
marginBottom: spacing.sm  // 8px

// Separate elements
marginBottom: spacing.md  // 16px

// Sections
marginBottom: spacing.xl  // 32px
```

#### List Items
```javascript
// Compact list
gap: spacing.xs  // 4px

// Default list
gap: spacing.sm  // 8px

// Comfortable list
gap: spacing.md  // 16px
```

### Layout Spacing

#### Screen Padding
```javascript
screenPadding: {
  horizontal: spacing.lg,  // 24px
  vertical: spacing.md,    // 16px
}
```

#### Card Spacing
```javascript
card: {
  padding: spacing.md,      // 16px internal
  marginBottom: spacing.md, // 16px between cards
  borderRadius: 12,
}
```

#### Form Spacing
```javascript
form: {
  fieldSpacing: spacing.md,    // 16px between fields
  labelSpacing: spacing.xs,    // 4px label to input
  sectionSpacing: spacing.xl,  // 32px between sections
}
```

### Implementation

```javascript
import { spacing } from '../design-system';

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  section: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
});
```

## Responsive Typography

### Dynamic Sizing
```javascript
// Responsive font size based on screen width
const responsiveFontSize = (baseSize) => {
  const { width } = Dimensions.get('window');
  const scale = width / 375; // iPhone 11 Pro width
  return Math.round(baseSize * Math.min(scale, 1.2));
};
```

### Accessibility Scaling
```javascript
// Support system font scaling
import { PixelRatio } from 'react-native';

const scaledFontSize = (size) => {
  const scale = PixelRatio.getFontScale();
  return size * scale;
};
```

## Best Practices

### Typography

#### ✅ Do's
- Use semantic styles (h1, body, etc.)
- Maintain consistent hierarchy
- Limit font weights to 3-4 per screen
- Use system fonts for better performance

#### ❌ Don'ts
- Don't use more than 2 font families
- Don't go below 11px for any text
- Don't use thin weights on small text
- Don't override line heights

### Spacing

#### ✅ Do's
- Use spacing tokens consistently
- Follow the 8px grid
- Group related content with less space
- Separate sections with more space

#### ❌ Don'ts
- Don't use arbitrary pixel values
- Don't mix spacing systems
- Don't use negative margins (except for specific cases)
- Don't forget touch target minimums (44x44)

## Platform-Specific Adjustments

### iOS
```javascript
ios: {
  h1: { letterSpacing: 0.37 },
  body: { letterSpacing: -0.43 },
}
```

### Android
```javascript
android: {
  h1: { letterSpacing: 0 },
  body: { letterSpacing: 0.25 },
  // Include font family explicitly
  fontFamily: 'Roboto',
}
```

## Accessibility Guidelines

### Minimum Sizes
- Body text: 15px minimum
- Captions: 12px minimum
- Interactive text: 15px minimum

### Line Height
- Minimum 1.4x font size for body text
- Minimum 1.2x for headings

### Touch Targets
- Minimum 44x44 points (iOS)
- Minimum 48x48 dp (Android)

### Contrast Requirements
- Normal text: 4.5:1 minimum
- Large text (18px+): 3:1 minimum
- All text in app meets WCAG AA standards