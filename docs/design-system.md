# Design System

## Core Principles

- **Use semantic tokens** - Never hardcode colors, always use `colors.surface.*`, `colors.text.*`, etc.
- **Medical colors are fixed** - SpO2 and HR colors don't change with theme
- **4px spacing grid** - Use `spacing.xs/sm/md/lg/xl` (4/8/16/24/32px)

## Component Hierarchy

```
Container (screen wrapper)
  └── Card (content groups)
      └── Typography (H1-H6, Body, Caption, Metric)
          └── Button (actions)
```

## Quick Reference

```javascript
import { useTheme } from '../theme/useTheme';
const { colors, spacing, theme, toggleTheme } = useTheme();
```

**Don't:**
- Hardcode colors (`#FFFFFF`)
- Use raw `Text` components
- Create custom spacing values

**Do:**
- Use theme tokens (`colors.surface.primary`)
- Use Typography components (`<H1>`, `<Body>`)
- Use spacing constants (`spacing.md`)