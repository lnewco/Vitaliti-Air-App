# Patterns

## Adding a Screen

1. Create in `src/screens/`
2. Add to navigation in `MainAppContent.js`
3. Wrap in `Container` component
4. Use `useTheme()` for styling

## Adding a Service  

1. Create in `src/services/`
2. Export singleton or class instance
3. Error handling: try/catch with `console.error()`
4. Add to `ServiceFactory.js` if needed

## Adding a Database Table

1. Create migration in `supabase/migrations/`
2. Add RLS policies for user_id
3. Create methods in `SupabaseService.js`

## Component Structure

```javascript
// Screen pattern
export default function YourScreen() {
  const { colors, spacing } = useTheme();
  const { bluetoothData } = useContext(BluetoothContext);
  
  return (
    <Container>
      {/* Content */}
    </Container>
  );
}
```

## Service Structure

```javascript
// Singleton service pattern
class YourService {
  static instance = null;
  
  static getInstance() {
    if (!this.instance) {
      this.instance = new YourService();
    }
    return this.instance;
  }
}
```

## Testing Modes

- `MOCK_BLUETOOTH` flag in BluetoothService
- `MockWearablesData.js` for UI development
- Preview builds for real device testing