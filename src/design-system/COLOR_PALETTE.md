# Vitaliti Air Color Palette

## Brand Colors

### Primary Colors
| Color | Hex | RGB | Usage |
|-------|-----|-----|-------|
| Primary Blue | `#007AFF` | rgb(0, 122, 255) | Primary actions, links, focus states |
| Secondary Purple | `#5856D6` | rgb(88, 86, 214) | Secondary actions, accents |
| Accent Blue | `#64D2FF` | rgb(100, 210, 255) | Highlights, notifications |

### Semantic Colors
| Color | Hex | RGB | Usage |
|-------|-----|-----|-------|
| Success | `#34C759` | rgb(52, 199, 89) | Success states, positive metrics |
| Warning | `#FF9500` | rgb(255, 149, 0) | Warnings, caution states |
| Error | `#FF3B30` | rgb(255, 59, 48) | Errors, destructive actions |
| Info | `#007AFF` | rgb(0, 122, 255) | Information, tips |

## Text Colors

### White-based Text (Dark Mode)
| Level | RGBA | Opacity | Usage |
|-------|------|---------|-------|
| Primary | `rgba(255, 255, 255, 1.0)` | 100% | Headings, primary content |
| Secondary | `rgba(255, 255, 255, 0.7)` | 70% | Body text, descriptions |
| Tertiary | `rgba(255, 255, 255, 0.5)` | 50% | Captions, metadata |
| Quaternary | `rgba(255, 255, 255, 0.3)` | 30% | Disabled, placeholder |
| Inverted | `#000000` | - | Text on light backgrounds |

## Background Colors

### Gradient Backgrounds
```javascript
// Primary Background
['#000000', '#1a1a2e', '#16213e']

// Secondary Background  
['#0f0f0f', '#1a1a1a', '#2a2a2a']

// Accent Background
['#007AFF', '#5856D6']
```

### Surface Colors
| Surface | RGBA | Usage |
|---------|------|-------|
| Primary | `rgba(255, 255, 255, 0.1)` | Cards, containers |
| Secondary | `rgba(255, 255, 255, 0.05)` | Subtle backgrounds |
| Elevated | `rgba(255, 255, 255, 0.15)` | Elevated elements |
| Overlay | `rgba(0, 0, 0, 0.5)` | Modals, overlays |

## Chart & Visualization Colors

### Data Visualization Palette
```javascript
chart: {
  primary: '#007AFF',   // Primary data series
  secondary: '#5856D6', // Secondary data series
  tertiary: '#64D2FF',  // Tertiary data series
  quaternary: '#FF9500', // Fourth data series
  success: '#34C759',   // Positive trends
  danger: '#FF3B30',    // Negative trends
}
```

### Metric Colors
| Metric | Color | Usage |
|--------|-------|-------|
| SpO2 Good | `#4ADE80` | SpO2 > 90% |
| SpO2 Warning | `#FFA500` | SpO2 85-90% |
| SpO2 Critical | `#FF6B6B` | SpO2 < 85% |
| Heart Rate Normal | `#34C759` | HR 60-100 bpm |
| Heart Rate Elevated | `#FF9500` | HR > 100 bpm |
| Heart Rate Low | `#007AFF` | HR < 60 bpm |

## Session-Specific Colors

### Session States
| State | Color | Hex |
|-------|-------|-----|
| Active | Green | `#34C759` |
| Paused | Yellow | `#FF9500` |
| Completed | Blue | `#007AFF` |
| Error | Red | `#FF3B30` |

### Phase Colors
| Phase | Color | Hex |
|-------|-------|-----|
| Hypoxic | Blue | `#007AFF` |
| Hyperoxic/Recovery | Green | `#34C759` |
| Transition | Yellow | `#FF9500` |

## Accessibility

### Contrast Ratios
All text colors meet WCAG AA standards:
- Primary text on dark: 15.3:1 ✅
- Secondary text on dark: 10.7:1 ✅
- Tertiary text on dark: 7.6:1 ✅
- Primary brand on dark: 8.6:1 ✅

### Color Blind Considerations
- Avoid relying solely on color to convey information
- Use icons and patterns alongside colors
- Test with color blind simulation tools

## Usage Guidelines

### Do's ✅
- Use semantic colors for their intended purpose
- Maintain consistency across similar elements
- Use opacity for hierarchy, not different colors
- Test color combinations for accessibility

### Don'ts ❌
- Don't use brand colors for semantic meanings
- Don't create new colors without adding to palette
- Don't use pure black (#000000) for text
- Don't use colors with insufficient contrast

## Implementation

### Import Colors
```javascript
import { colors } from '../design-system';

// Usage
backgroundColor: colors.background.primary
color: colors.text.secondary
borderColor: colors.border.default
```

### Creating New Colors
If a new color is needed:
1. Add to `src/design-system/colors.js`
2. Update this documentation
3. Test contrast ratios
4. Get design approval

## Tools & Resources

### Color Tools
- [Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [Color Blind Simulator](https://www.color-blindness.com/coblis-color-blindness-simulator/)
- [Adobe Color](https://color.adobe.com/)

### Design Tokens
Colors are exported as JavaScript constants for:
- Type safety
- Autocomplete support
- Easy theme switching
- Consistent updates