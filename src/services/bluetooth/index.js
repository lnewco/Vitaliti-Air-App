/**
 * Bluetooth Services - Barrel export
 */

// Main coordinator (primary export)
export { default as BluetoothCoordinator } from './BluetoothCoordinator';
export { default } from './BluetoothCoordinator'; // Default export

// Individual services (for testing)
export { default as BluetoothScanner } from './BluetoothScanner';
export { default as BluetoothPermissions } from './BluetoothPermissions';
export { default as BluetoothConnectionManager } from './BluetoothConnectionManager';

// Protocol exports
export { default as ProtocolFactory } from './protocols/ProtocolFactory';
export { default as WellueProtocol } from './protocols/wellue/WellueProtocol';
export { default as BCIProtocol } from './protocols/bci/BCIProtocol';

// Base classes
export { default as PulseOxReading } from './protocols/base/PulseOxReading';
export { default as DataValidator } from './protocols/base/DataValidator';