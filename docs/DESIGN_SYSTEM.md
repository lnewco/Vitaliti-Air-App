# Vitaliti Air Design System

## Quick Start

The Vitaliti Air design system provides a consistent, accessible, and theme-aware UI foundation for the app. 

```javascript
import { useTheme } from '../theme/useTheme';
import { Button, H1, Body, Container, Card } from '../components/base';

function MyScreen() {
  const { colors, spacing } = useTheme();
  
  return (
    <Container>
      <H1>Welcome</H1>
      <Body>Your session is ready</Body>
      <Button title="Start" onPress={handleStart} />
    </Container>
  );
}
```

## Core Principles

### Design Philosophy
- **Clarity First**: Medical data must be instantly readable
- **Consistency**: Same patterns across all screens
- **Accessibility**: Support for font scaling and high contrast
- **Safety**: Critical medical indicators always visible

### Medical UI Considerations
- SpO2 and heart rate colors remain constant across themes
- Warning/error states use high contrast colors
- Critical metrics use larger, bolder typography
- Safety indicators are always prominent

## Theme System

### Theme Architecture

The theme system supports automatic light/dark mode switching with semantic color tokens:

```javascript
// Access theme in any component
const { colors, typography, spacing, theme, toggleTheme } = useTheme();

// Theme-aware styling
style={{
  backgroundColor: colors.surface.primary,
  color: colors.text.primary
}}
```

### Color System

#### Semantic Color Tokens

Never use hardcoded colors. Always use semantic tokens:

```javascript
// ❌ Don't do this
backgroundColor: '#FFFFFF'
color: '#000000'

// ✅ Do this
backgroundColor: colors.surface.primary
color: colors.text.primary
```

#### Color Categories

**Surface Colors** - Backgrounds and containers
- `surface.primary` - Main background
- `surface.secondary` - Subtle background
- `surface.elevated` - Cards and modals
- `surface.overlay` - Overlays and backdrops

**Text Colors** - Typography
- `text.primary` - Main text
- `text.secondary` - Subtle text
- `text.tertiary` - Disabled text
- `text.inverse` - Text on inverted backgrounds

**Border Colors** - Dividers and outlines
- `border.default` - Standard borders
- `border.light` - Subtle borders
- `border.dark` - Strong borders

**Interactive Colors** - Actions and states
- `primary` - Primary actions and highlights
- `secondary` - Secondary actions
- `error` - Errors and destructive actions
- `warning` - Warnings and cautions
- `success` - Success states
- `info` - Informational elements

**Medical Colors** - Consistent across themes
- `medical.spo2` - SpO2 readings
- `medical.heartRate` - Heart rate display
- `medical.calibration` - Calibration states

### Typography

#### Type Scale

```javascript
import { H1, H2, H3, H4, H5, H6, Body, BodySmall, Label, Caption, Metric } from '../components/base/Typography';

// Headlines
<H1>Main Title</H1>           // 32px, bold
<H2>Section Title</H2>         // 28px, semibold
<H3>Subsection</H3>           // 24px, semibold

// Body Text
<Body>Regular text</Body>      // 16px, regular
<BodySmall>Small text</BodySmall> // 14px, regular

// Special Purpose
<Label>Form Label</Label>      // 14px, medium
<Caption>Help text</Caption>   // 12px, regular
<Metric>98%</Metric>          // 48px, bold (for large numbers)
```

#### Typography Guidelines
- Use semantic components (H1, Body) not Text with custom styles
- Headlines for navigation and section titles
- Body for content and descriptions
- Label for form fields and data labels
- Caption for secondary information
- Metric for large numeric displays

### Spacing & Layout

#### Grid System

Based on 4px grid with semantic spacing tokens:

```javascript
const { spacing } = useTheme();

// Base unit = 4px
spacing.xs   // 4px
spacing.sm   // 8px
spacing.md   // 16px
spacing.lg   // 24px
spacing.xl   // 32px
spacing.xxl  // 48px
spacing.xxxl // 64px
```

#### Component Spacing

```javascript
// Consistent padding for containers
padding: spacing.container  // 16px

// Card padding
padding: spacing.card       // 16px

// List item spacing
marginBottom: spacing.listItem  // 12px

// Section spacing
marginBottom: spacing.section   // 24px
```

## Components

### Base Components

#### Button

```javascript
import { Button } from '../components/base/Button';

// Variants
<Button title="Primary" variant="primary" />
<Button title="Secondary" variant="secondary" />
<Button title="Ghost" variant="ghost" />
<Button title="Danger" variant="danger" />

// Sizes
<Button title="Large" size="large" />
<Button title="Medium" size="medium" />
<Button title="Small" size="small" />

// States
<Button title="Loading" loading />
<Button title="Disabled" disabled />

// With icon
<Button 
  title="Settings" 
  icon="settings"
  iconPosition="left"
/>
```

#### Card

```javascript
import { Card } from '../components/base/Card';

<Card>
  <Card.Header>
    <H3>Session Summary</H3>
  </Card.Header>
  <Card.Body>
    <Body>Duration: 20 minutes</Body>
  </Card.Body>
  <Card.Footer>
    <Button title="View Details" variant="ghost" />
  </Card.Footer>
</Card>

// With custom styling
<Card elevated pressable onPress={handlePress}>
  <Card.Body>
    <Body>Clickable card</Body>
  </Card.Body>
</Card>
```

#### Container

```javascript
import { Container } from '../components/base/Container';

// Basic container with safe area
<Container>
  {/* Content */}
</Container>

// Scrollable container
<Container scrollable>
  {/* Long content */}
</Container>

// With keyboard avoiding
<Container keyboardAvoiding>
  {/* Form content */}
</Container>

// Custom background
<Container backgroundColor={colors.surface.secondary}>
  {/* Content */}
</Container>
```

### Medical Components

#### MetricDisplay

```javascript
import { MetricDisplay } from '../components/MetricDisplay';

<MetricDisplay
  label="SpO2"
  value={98}
  unit="%"
  status="normal"  // normal | warning | critical
  trend="stable"   // rising | falling | stable
/>
```

#### SafetyIndicator

```javascript
import { SafetyIndicator } from '../components/SafetyIndicator';

<SafetyIndicator
  spo2={98}
  heartRate={72}
  safetyScore={95}
/>
```

## Patterns

### Screen Templates

#### Onboarding Screen Pattern

```javascript
function OnboardingScreen({ title, subtitle, onNext, onBack }) {
  const { colors } = useTheme();
  
  return (
    <Container>
      <OnboardingProgressIndicator step={1} total={5} />
      
      <View style={styles.content}>
        <H1>{title}</H1>
        <Body color={colors.text.secondary}>{subtitle}</Body>
        
        {/* Screen specific content */}
      </View>
      
      <View style={styles.actions}>
        {onBack && (
          <Button 
            title="Back" 
            variant="ghost" 
            onPress={onBack} 
          />
        )}
        <Button 
          title="Continue" 
          variant="primary" 
          onPress={onNext} 
        />
      </View>
    </Container>
  );
}
```

#### Data Display Screen Pattern

```javascript
function DataScreen() {
  const { colors, spacing } = useTheme();
  
  return (
    <Container scrollable>
      <H1>Session Data</H1>
      
      <Card style={{ marginBottom: spacing.md }}>
        <Card.Header>
          <H3>Vitals</H3>
        </Card.Header>
        <Card.Body>
          <MetricDisplay label="SpO2" value={98} unit="%" />
          <MetricDisplay label="HR" value={72} unit="bpm" />
        </Card.Body>
      </Card>
      
      {/* More cards */}
    </Container>
  );
}
```

#### Form Screen Pattern

```javascript
function FormScreen() {
  const { colors } = useTheme();
  
  return (
    <Container keyboardAvoiding scrollable>
      <H1>Patient Information</H1>
      
      <View style={styles.form}>
        <Label>Name</Label>
        <FormTextInput 
          value={name}
          onChangeText={setName}
          placeholder="Enter name"
        />
        
        <Label>Age</Label>
        <FormTextInput 
          value={age}
          onChangeText={setAge}
          keyboardType="numeric"
          placeholder="Enter age"
        />
      </View>
      
      <Button 
        title="Save" 
        onPress={handleSave}
        disabled={!isValid}
      />
    </Container>
  );
}
```

### Theme Toggle Implementation

#### Using the Theme Hook

```javascript
function SettingsScreen() {
  const { theme, toggleTheme, setTheme } = useTheme();
  
  return (
    <Container>
      <H2>Appearance</H2>
      
      <Card>
        <Card.Body>
          <View style={styles.row}>
            <Body>Dark Mode</Body>
            <Switch 
              value={theme === 'dark'}
              onValueChange={toggleTheme}
            />
          </View>
        </Card.Body>
      </Card>
      
      {/* Or with explicit selection */}
      <Card>
        <Card.Body>
          <RadioGroup
            value={theme}
            onValueChange={setTheme}
            options={[
              { label: 'Light', value: 'light' },
              { label: 'Dark', value: 'dark' },
              { label: 'System', value: 'system' }
            ]}
          />
        </Card.Body>
      </Card>
    </Container>
  );
}
```

#### Testing Both Themes

Always test components in both light and dark themes:

```javascript
// During development
function ComponentPreview({ children }) {
  return (
    <>
      <ThemeProvider theme="light">
        <View style={styles.preview}>
          <Caption>Light Theme</Caption>
          {children}
        </View>
      </ThemeProvider>
      
      <ThemeProvider theme="dark">
        <View style={styles.preview}>
          <Caption>Dark Theme</Caption>
          {children}
        </View>
      </ThemeProvider>
    </>
  );
}
```

## Migration Guide

### Converting Legacy Screens

#### Step 1: Import Theme and Base Components

```javascript
// Before
import { View, Text, TouchableOpacity } from 'react-native';

// After
import { View } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { Container, H1, Body, Button, Card } from '../components/base';
```

#### Step 2: Replace Hardcoded Colors

```javascript
// Before
style={{ backgroundColor: '#FFFFFF', color: '#000000' }}

// After
const { colors } = useTheme();
style={{ backgroundColor: colors.surface.primary, color: colors.text.primary }}
```

#### Step 3: Replace Text Components

```javascript
// Before
<Text style={{ fontSize: 24, fontWeight: 'bold' }}>Title</Text>
<Text style={{ fontSize: 16 }}>Description</Text>

// After
<H2>Title</H2>
<Body>Description</Body>
```

#### Step 4: Replace Buttons

```javascript
// Before
<TouchableOpacity style={styles.button} onPress={handlePress}>
  <Text style={styles.buttonText}>Submit</Text>
</TouchableOpacity>

// After
<Button title="Submit" onPress={handlePress} variant="primary" />
```

#### Step 5: Use Container for Layout

```javascript
// Before
<SafeAreaView style={styles.container}>
  <ScrollView>
    {/* Content */}
  </ScrollView>
</SafeAreaView>

// After
<Container scrollable>
  {/* Content */}
</Container>
```

### Common Pitfalls

1. **Don't mix theme systems**
   - Use either semantic tokens or don't use colors at all
   - Never mix hardcoded colors with theme colors

2. **Don't create custom text styles**
   - Use Typography components for all text
   - If you need a variant, extend the Typography component

3. **Don't skip Container**
   - Always wrap screens in Container for consistent padding and safe areas
   - Use Container props instead of custom wrapper views

4. **Medical colors are special**
   - Don't theme medical indicators (SpO2, HR)
   - Keep safety colors consistent across themes

### Migration Checklist

- [ ] Replace all hardcoded colors with semantic tokens
- [ ] Replace all Text components with Typography components
- [ ] Replace TouchableOpacity buttons with Button component
- [ ] Wrap screen in Container component
- [ ] Replace custom cards/boxes with Card component
- [ ] Test in both light and dark themes
- [ ] Verify medical colors remain consistent
- [ ] Remove unused styles
- [ ] Update component imports

## Examples

### Complete Screen Example

```javascript
import React, { useState } from 'react';
import { View } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { 
  Container, 
  H1, 
  H2, 
  Body, 
  Button, 
  Card 
} from '../components/base';
import { MetricDisplay } from '../components/MetricDisplay';

function SessionSummaryScreen({ navigation, route }) {
  const { colors, spacing } = useTheme();
  const { session } = route.params;
  
  return (
    <Container scrollable>
      <H1>Session Complete</H1>
      <Body color={colors.text.secondary}>
        Great job! Here's your session summary.
      </Body>
      
      <Card style={{ marginTop: spacing.lg, marginBottom: spacing.md }}>
        <Card.Header>
          <H2>Vital Statistics</H2>
        </Card.Header>
        <Card.Body>
          <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
            <MetricDisplay
              label="Avg SpO2"
              value={session.avgSpO2}
              unit="%"
              status="normal"
            />
            <MetricDisplay
              label="Avg HR"
              value={session.avgHeartRate}
              unit="bpm"
              status="normal"
            />
          </View>
        </Card.Body>
      </Card>
      
      <Card style={{ marginBottom: spacing.md }}>
        <Card.Body>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Body>Duration</Body>
            <Body weight="semibold">{session.duration} min</Body>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm }}>
            <Body>Safety Score</Body>
            <Body weight="semibold">{session.safetyScore}%</Body>
          </View>
        </Card.Body>
      </Card>
      
      <Button 
        title="View Detailed Report" 
        variant="primary"
        onPress={() => navigation.navigate('DetailedReport', { session })}
        style={{ marginBottom: spacing.sm }}
      />
      
      <Button 
        title="Start New Session" 
        variant="secondary"
        onPress={() => navigation.navigate('SessionSetup')}
      />
    </Container>
  );
}

export default SessionSummaryScreen;
```

### Complex Component Composition

```javascript
import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { Card, H3, Body, Caption, Badge, VectorIcon } from '../components/base';

function SessionCard({ session, onPress }) {
  const { colors, spacing } = useTheme();
  
  const getStatusColor = () => {
    if (session.status === 'completed') return colors.success[500];
    if (session.status === 'cancelled') return colors.error[500];
    return colors.warning[500];
  };
  
  return (
    <Card pressable onPress={onPress} style={{ marginBottom: spacing.md }}>
      <Card.Body>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <H3>{session.type}</H3>
            <Caption>{new Date(session.date).toLocaleDateString()}</Caption>
          </View>
          <Badge 
            text={session.status} 
            color={getStatusColor()}
          />
        </View>
        
        <View style={{ 
          flexDirection: 'row', 
          marginTop: spacing.md,
          paddingTop: spacing.md,
          borderTopWidth: 1,
          borderTopColor: colors.border.light
        }}>
          <View style={{ flexDirection: 'row', flex: 1, alignItems: 'center' }}>
            <VectorIcon name="activity" size={16} color={colors.medical.heartRate} />
            <Body style={{ marginLeft: spacing.xs }}>{session.avgHeartRate} bpm</Body>
          </View>
          <View style={{ flexDirection: 'row', flex: 1, alignItems: 'center' }}>
            <VectorIcon name="droplet" size={16} color={colors.medical.spo2} />
            <Body style={{ marginLeft: spacing.xs }}>{session.avgSpO2}%</Body>
          </View>
        </View>
      </Card.Body>
    </Card>
  );
}
```

## Resources

- [Component Storybook](#) (Coming soon)
- [Figma Design Files](#) (Coming soon)
- [Theme Playground](#) (Coming soon)

## Contributing

When adding new components or patterns:

1. Follow existing naming conventions
2. Use semantic color tokens
3. Support both light and dark themes
4. Add usage examples to this guide
5. Test on both iOS and Android
6. Consider accessibility (font scaling, VoiceOver/TalkBack)

## Glass Morphism Implementation

### Premium UI Layer

The app implements a sophisticated glass morphism design system for a premium, Apple-quality experience:

#### Blur Effects

```javascript
import { BlurView } from 'expo-blur';

// Header blur (high intensity)
<BlurView 
  intensity={85} 
  style={styles.header}
  tint="dark"
>
  {/* Header content */}
</BlurView>

// Card blur (subtle)
<BlurView 
  intensity={20} 
  style={styles.card}
  tint="dark"
>
  {/* Card content */}
</BlurView>
```

#### Blur Intensity Guidelines

- **Navigation Headers**: 85 intensity for prominent glass effect
- **Cards & Panels**: 20 intensity for subtle background blur
- **Overlays**: 60 intensity for modal backgrounds
- **Tooltips**: 40 intensity for floating elements

#### Sticky Header Pattern

```javascript
// Glass morphism sticky header
const GlassHeader = ({ title, subtitle }) => {
  return (
    <View style={styles.fixedHeader}>
      <BlurView intensity={85} style={styles.blurContainer} tint="dark">
        <View style={styles.headerContent}>
          <Text style={styles.title}>{title}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
      </BlurView>
    </View>
  );
};

const styles = StyleSheet.create({
  fixedHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  blurContainer: {
    paddingTop: Platform.OS === 'ios' ? 60 : 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
  }
});
```

### Premium Visual Effects

#### Deep Shadows

```javascript
// Premium shadow configuration
shadowColor: '#000',
shadowOffset: { width: 0, height: 10 },
shadowOpacity: 0.3,
shadowRadius: 30,
elevation: 20,
```

#### Gradient Backgrounds

```javascript
// Dark gradient background
colors={['#000000', '#0A0B0F', '#14161B']}
locations={[0, 0.5, 1]}
style={StyleSheet.absoluteFillObject}
```

#### Spring Animations

```javascript
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring 
} from 'react-native-reanimated';

// Spring configuration
const springConfig = {
  damping: 15,
  stiffness: 100,
  mass: 1,
};

// Usage
const animatedStyle = useAnimatedStyle(() => {
  return {
    transform: [{ scale: withSpring(scale.value, springConfig) }]
  };
});
```

### Spacing Specifications

#### Consistent Layout Spacing

- **Header to Content**: 12px gap
- **Between Cards**: 16px spacing  
- **Card Internal Padding**: 20px
- **Button Margins**: 20px from edges
- **Section Separation**: 24px

#### Screen Content Positioning

```javascript
// For screens with sticky headers
content: {
  flex: 1,
  paddingTop: 138, // Account for glass header height
}

// For screens with progress bars
content: {
  flex: 1,
  paddingTop: 125, // Slightly less for integrated progress
}
```

### Typography Hierarchy

#### Apple-Style Type Scale

```javascript
// Display
fontSize: 34,  // Large titles
fontWeight: '800',
letterSpacing: -0.5,

// Navigation
fontSize: 17,  // Standard navigation
fontWeight: '600',
letterSpacing: -0.4,

// Body
fontSize: 15,  // Body text
fontWeight: '400',
letterSpacing: -0.2,

// Caption
fontSize: 13,  // Small text
fontWeight: '400',
letterSpacing: -0.1,
```

### Icon System Migration

#### Ionicons Standardization

All icons have been migrated from SafeIcon to Ionicons for consistency:

```javascript
import { Ionicons } from '@expo/vector-icons';

// Common icon mappings
'chevron-forward' // Navigation arrows
'checkmark-circle' // Success states
'alert-circle' // Warnings
'close-circle' // Errors
'star' / 'star-outline' // Ratings
'fitness' // Activity/health
'pulse' // Heart rate
'water' // SpO2/oxygen
```

### Color Refinements

#### Glass Morphism Palette

```javascript
// Border colors for glass effects
borderColor: 'rgba(255,255,255,0.08)', // Subtle glass borders
borderColor: 'rgba(255,255,255,0.15)', // Prominent dividers

// Background overlays
backgroundColor: 'rgba(0,0,0,0.4)', // Dark overlay
backgroundColor: 'rgba(255,255,255,0.05)', // Light tint

// Interactive states
activeOpacity: 0.7, // Touch feedback
pressedScale: 0.98, // Button press effect
```

## Version History

- **v1.0.0** - Initial design system with base components and theme support
- **v1.1.0** - Added light/dark theme toggle and semantic color system
- **v2.0.0** - Premium UI overhaul with glass morphism, Apple-style typography, and spring animations