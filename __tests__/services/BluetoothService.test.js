import { BleManager } from 'react-native-ble-plx';
import BluetoothService from '../../src/services/BluetoothService';
import { Buffer } from 'buffer';

// Mock EnhancedSessionManager
jest.mock('../../src/services/EnhancedSessionManager', () => ({
  __esModule: true,
  default: {
    handleMaskLift: jest.fn(),
    logMetric: jest.fn()
  }
}));

describe('BluetoothService', () => {
  let bleManager;
  let bluetoothService;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock BLE manager
    bleManager = {
      startDeviceScan: jest.fn(),
      stopDeviceScan: jest.fn(),
      connectToDevice: jest.fn(),
      cancelDeviceConnection: jest.fn(),
      onStateChange: jest.fn(),
      state: jest.fn().mockResolvedValue('PoweredOn'),
      destroy: jest.fn()
    };

    BleManager.mockImplementation(() => bleManager);

    // Create new service instance
    bluetoothService = new (BluetoothService.constructor)();
  });

  describe('Initialization', () => {
    test('should initialize BleManager on construction', () => {
      expect(BleManager).toHaveBeenCalled();
      expect(bluetoothService.manager).toBeDefined();
      expect(bluetoothService.isDestroyed).toBe(false);
    });

    test('should handle BleManager initialization failure', () => {
      BleManager.mockImplementationOnce(() => {
        throw new Error('BLE not supported');
      });

      const service = new (BluetoothService.constructor)();

      expect(service.manager).toBeNull();
      expect(service.isDestroyed).toBe(true);
    });
  });

  describe('Reference Counting', () => {
    test('should increment reference count on acquire', () => {
      const count = bluetoothService.acquireReference();
      expect(count).toBe(1);
      expect(bluetoothService.referenceCount).toBe(1);
    });

    test('should decrement reference count on release', () => {
      bluetoothService.acquireReference();
      bluetoothService.acquireReference();

      const count = bluetoothService.releaseReference();
      expect(count).toBe(1);
      expect(bluetoothService.referenceCount).toBe(1);
    });

    test('should cleanup when reference count reaches zero', (done) => {
      bluetoothService.acquireReference();
      bluetoothService.stopScanning = jest.fn();
      bluetoothService.disconnect = jest.fn();

      bluetoothService.releaseReference();

      // Cleanup is delayed by 500ms
      setTimeout(() => {
        expect(bluetoothService.stopScanning).toHaveBeenCalled();
        expect(bluetoothService.disconnect).toHaveBeenCalled();
        expect(bleManager.destroy).toHaveBeenCalled();
        done();
      }, 600);
    });
  });

  describe('Device Scanning', () => {
    test('should start scanning for devices', async () => {
      const callback = jest.fn();
      bluetoothService.setOnDeviceFound(callback);

      bleManager.startDeviceScan.mockImplementation((uuids, options, cb) => {
        // Simulate finding a device
        cb(null, {
          id: 'device-1',
          name: 'Wellue O2Ring',
          serviceUUIDs: ['14839ac4-7d7e-415c-9a42-167340cf2339']
        });
      });

      await bluetoothService.startScanning('pulse-ox');

      expect(bluetoothService.isScanning).toBe(true);
      expect(bleManager.startDeviceScan).toHaveBeenCalled();
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'device-1',
          name: 'Wellue O2Ring',
          deviceType: 'pulse-ox'
        })
      );
    });

    test('should stop scanning', async () => {
      bluetoothService.isScanning = true;

      await bluetoothService.stopScanning();

      expect(bluetoothService.isScanning).toBe(false);
      expect(bleManager.stopDeviceScan).toHaveBeenCalled();
    });

    test('should filter duplicate devices during scan', async () => {
      const callback = jest.fn();
      bluetoothService.setOnDeviceFound(callback);

      const device = {
        id: 'device-1',
        name: 'Wellue O2Ring',
        serviceUUIDs: ['14839ac4-7d7e-415c-9a42-167340cf2339']
      };

      bleManager.startDeviceScan.mockImplementation((uuids, options, cb) => {
        // Simulate finding same device twice
        cb(null, device);
        cb(null, device);
      });

      await bluetoothService.startScanning('pulse-ox');

      // Should only be called once due to duplicate filtering
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('Device Connection', () => {
    test('should connect to a device', async () => {
      const device = {
        id: 'device-1',
        name: 'Wellue O2Ring',
        connect: jest.fn().mockResolvedValue({
          discoverAllServicesAndCharacteristics: jest.fn().mockResolvedValue({
            monitorCharacteristicForService: jest.fn(),
            writeCharacteristicWithResponseForService: jest.fn()
          })
        })
      };

      bleManager.connectToDevice.mockResolvedValue(device);

      const result = await bluetoothService.connectToDevice(device);

      expect(result).toBe(true);
      expect(bluetoothService.isPulseOxConnected).toBe(true);
      expect(bluetoothService.pulseOxDevice).toBe(device);
    });

    test('should handle connection failure', async () => {
      const device = { id: 'device-1', name: 'Test Device' };
      bleManager.connectToDevice.mockRejectedValue(new Error('Connection failed'));

      const result = await bluetoothService.connectToDevice(device);

      expect(result).toBe(false);
      expect(bluetoothService.isPulseOxConnected).toBe(false);
    });

    test('should disconnect from device', async () => {
      const device = {
        id: 'device-1',
        cancelConnection: jest.fn().mockResolvedValue(true)
      };

      bluetoothService.pulseOxDevice = device;
      bluetoothService.isPulseOxConnected = true;

      bleManager.cancelDeviceConnection.mockResolvedValue(true);

      const result = await bluetoothService.disconnect();

      expect(result).toBe(true);
      expect(bluetoothService.isPulseOxConnected).toBe(false);
      expect(bluetoothService.pulseOxDevice).toBeNull();
    });
  });

  describe('Data Parsing', () => {
    test('should parse Wellue 8-byte packet correctly', () => {
      const buffer = Buffer.from([0x55, 0xAA, 0x02, 0x08, 0x60, 0x48, 0x00, 0xEC]);
      const base64 = buffer.toString('base64');

      const result = bluetoothService.parseWellue8BytePacket(buffer, base64);

      expect(result).toMatchObject({
        spo2: 96,
        heartRate: 72,
        isFingerDetected: true
      });
    });

    test('should detect finger not in device', () => {
      const buffer = Buffer.from([0x55, 0xAA, 0x02, 0x08, 0x7F, 0xFF, 0x00, 0x00]);
      const base64 = buffer.toString('base64');

      const result = bluetoothService.parseWellue8BytePacket(buffer, base64);

      expect(result.isFingerDetected).toBe(false);
    });

    test('should parse BerryMed data packet', () => {
      const buffer = Buffer.from([0x01, 0x60, 0x48, 0x00, 0x00]);
      const base64 = buffer.toString('base64');

      const result = bluetoothService.parseBerryMedData(buffer, base64);

      expect(result).toMatchObject({
        spo2: 96,
        heartRate: 72,
        isFingerDetected: true
      });
    });

    test('should handle invalid packet formats', () => {
      const buffer = Buffer.from([0xFF, 0xFF]);
      const base64 = buffer.toString('base64');

      const result = bluetoothService.parseReceivedData(buffer, base64);

      expect(result).toBeNull();
    });
  });

  describe('Event Callbacks', () => {
    test('should set device found callback', () => {
      const callback = jest.fn();
      bluetoothService.setOnDeviceFound(callback);

      expect(bluetoothService.onDeviceFound).toBe(callback);
    });

    test('should set pulse ox data callback', () => {
      const callback = jest.fn();
      bluetoothService.setOnPulseOxDataReceived(callback);

      expect(bluetoothService.onPulseOxDataReceived).toBe(callback);
    });

    test('should set connection change callback and trigger immediately', () => {
      const callback = jest.fn();
      bluetoothService.isPulseOxConnected = true;

      bluetoothService.setOnConnectionChange(callback);

      expect(bluetoothService.onConnectionChangeCallback).toBe(callback);
      expect(callback).toHaveBeenCalledWith(true);
    });
  });

  describe('Device Type Detection', () => {
    test('should identify Wellue devices', () => {
      const wellueDevice = {
        name: 'Wellue O2Ring',
        serviceUUIDs: ['14839ac4-7d7e-415c-9a42-167340cf2339']
      };

      const type = bluetoothService.getDeviceType(wellueDevice);
      expect(type).toBe('pulse-ox');
    });

    test('should identify BerryMed devices', () => {
      const berryDevice = {
        name: 'BerryMed Oximeter',
        serviceUUIDs: ['49535343-FE7D-4AE5-8FA9-9FAFD205E455']
      };

      const type = bluetoothService.getDeviceType(berryDevice);
      expect(type).toBe('pulse-ox-berry');
    });

    test('should return unknown for unrecognized devices', () => {
      const unknownDevice = {
        name: 'Random Device',
        serviceUUIDs: ['00000000-0000-0000-0000-000000000000']
      };

      const type = bluetoothService.getDeviceType(unknownDevice);
      expect(type).toBe('unknown');
    });
  });
});