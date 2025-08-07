# Agent Instructions for Vitaliti Air App

## Build/Test Commands
- **Start Dev Server**: `npm start` or `expo start`
- **Run iOS**: `npm run ios` or `expo run:ios`  
- **Run Android**: `npm run android` or `expo run:android`
- **Web**: `npm run web` or `expo start --web`
- **No tests configured** - use Jest/React Native Testing Library if adding tests

## Architecture
- **React Native + Expo** app for Bluetooth pulse oximetry monitoring
- **Main modules**: `/src/screens` (DashboardScreen, SessionHistoryScreen, IHHTTrainingScreen), `/src/components` (HeartRateDisplay, SpO2Display, OptimizedConnectionManager), `/src/services` (BluetoothService, DatabaseService, EnhancedSessionManager), `/src/context` (BluetoothContext)
- **Database**: SQLite locally + Supabase cloud (PostgreSQL)
- **Bluetooth**: react-native-ble-plx for BCI Protocol communication
- **Data flow**: BluetoothService → BluetoothContext → UI components
- **Logging**: Centralized logger utility with log levels

## Code Style
- **Imports**: Relative imports from `/src`, absolute for external packages
- **Components**: Functional components with hooks, StyleSheet at bottom
- **Naming**: camelCase for variables/functions, PascalCase for components
- **State**: Context API for Bluetooth state, local useState for UI state
- **Error handling**: console.error with emoji prefixes (❌, ✅, 🎯, 📱)
- **Colors**: Primary blue #2196F3, backgrounds #f5f5f5/#ffffff
