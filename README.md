# Vitaliti Air

IHHT training app with Bluetooth pulse oximeter monitoring.

## Quick Start

```bash
npm install
npx expo start
```

## Project Map

- `src/screens/` - All UI screens
- `src/services/` - Business logic & API clients  
- `src/components/` - Reusable UI components
- `src/context/` - Global state providers
- `src/config/` - Configuration files
- `supabase/migrations/` - Database schema

## Key Files

- `MainAppContent.js` - Navigation structure
- `IHHTTrainingScreen.js` - Main training UI
- `BluetoothService.js` - BLE device communication
- `EnhancedSessionManager.js` - Session orchestration
- `WearablesDataService.js` - Whoop/Oura sync

## Documentation

- [Architecture](docs/architecture.md) - How components interact
- [Data Flow](docs/data-flow.md) - State & data pipelines
- [Patterns](docs/patterns.md) - Common code patterns
- [Design System](docs/design-system.md) - UI guidelines

## Commands

```bash
# Development
npm start
npm run ios
npm run android

# Building
eas build --profile preview --platform ios
eas build --profile production --platform ios
```