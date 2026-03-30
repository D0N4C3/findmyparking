import { PermissionsAndroid, Platform } from 'react-native';
import { BleErrorCode, BleManager, Device, State } from 'react-native-ble-plx';

export interface BluetoothDevice {
  id: string;
  name: string;
  address: string;
}

export type BluetoothPermissionStatus = 'granted' | 'denied' | 'unsupported';

export interface BluetoothPermissionResult {
  status: BluetoothPermissionStatus;
  message?: string;
}

export interface ScanBluetoothDevicesOptions {
  timeoutMs?: number;
  retries?: number;
}

export type BluetoothScanStatus = 'success' | 'empty' | 'timeout' | 'permission-denied' | 'unsupported' | 'error';

export interface BluetoothScanResult {
  status: BluetoothScanStatus;
  devices: BluetoothDevice[];
  attempts: number;
  message?: string;
}

export type BluetoothConnectionStatus =
  | 'connected'
  | 'disconnected'
  | 'failed'
  | 'permission-denied'
  | 'unsupported';

export interface BluetoothConnectionResult {
  status: BluetoothConnectionStatus;
  message?: string;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_CONNECTION_TIMEOUT_MS = 8_000;
const bleManager = new BleManager();

const normalizeDevice = (device: Device): BluetoothDevice => {
  const name = device.name?.trim() || device.localName?.trim() || 'Unknown device';

  return {
    id: device.id,
    name,
    address: device.id,
  };
};

const waitForBluetoothPoweredOn = async (): Promise<boolean> => {
  const state = await bleManager.state();
  if (state === State.PoweredOn) {
    return true;
  }

  return new Promise<boolean>((resolve) => {
    const subscription = bleManager.onStateChange((nextState) => {
      if (nextState === State.PoweredOn) {
        subscription.remove();
        resolve(true);
      }
    }, true);

    setTimeout(() => {
      subscription.remove();
      resolve(false);
    }, 3_000);
  });
};

const getAndroidPermissions = () => {
  if (Platform.Version >= 31) {
    return [
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    ];
  }

  return [
    PermissionsAndroid.PERMISSIONS.BLUETOOTH,
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADMIN,
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  ];
};

export const requestBluetoothPermissions = async (): Promise<BluetoothPermissionResult> => {
  if (Platform.OS === 'android') {
    const permissions = getAndroidPermissions();

    const result = await PermissionsAndroid.requestMultiple(permissions);
    const hasAllPermissions = permissions.every(
      (permission) => result[permission] === PermissionsAndroid.RESULTS.GRANTED
    );

    return hasAllPermissions
      ? { status: 'granted' }
      : {
          status: 'denied',
          message: 'Bluetooth permissions are required to find your car device.',
        };
  }

  if (Platform.OS === 'ios') {
    return { status: 'granted' };
  }

  return {
    status: 'unsupported',
    message: 'Bluetooth scanning is not supported on this platform.',
  };
};

export const scanBluetoothDevices = async (
  options: ScanBluetoothDevicesOptions = {}
): Promise<BluetoothScanResult> => {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const permissionResult = await requestBluetoothPermissions();
  if (permissionResult.status !== 'granted') {
    return {
      status: permissionResult.status === 'unsupported' ? 'unsupported' : 'permission-denied',
      devices: [],
      attempts: 0,
      message: permissionResult.message,
    };
  }

  const bluetoothEnabled = await waitForBluetoothPoweredOn();
  if (!bluetoothEnabled) {
    return {
      status: 'error',
      devices: [],
      attempts: 1,
      message: 'Turn on Bluetooth and try scanning again.',
    };
  }

  return new Promise<BluetoothScanResult>((resolve) => {
    const devices = new Map<string, BluetoothDevice>();
    let settled = false;

    const finish = (result: BluetoothScanResult) => {
      if (settled) {
        return;
      }

      settled = true;
      bleManager.stopDeviceScan();
      resolve(result);
    };

    bleManager.startDeviceScan(null, { allowDuplicates: false, scanMode: 2 }, (error, scannedDevice) => {
      if (error) {
        if (error.errorCode === BleErrorCode.BluetoothUnauthorized) {
          finish({
            status: 'permission-denied',
            devices: [],
            attempts: 1,
            message: 'Bluetooth permissions were denied by the operating system.',
          });
          return;
        }

        finish({
          status: 'error',
          devices: [],
          attempts: 1,
          message: 'Unable to scan for Bluetooth devices right now.',
        });
        return;
      }

      if (!scannedDevice) {
        return;
      }

      devices.set(scannedDevice.id, normalizeDevice(scannedDevice));
    });

    setTimeout(() => {
      const normalizedDevices = Array.from(devices.values()).sort((a, b) => {
        if (a.name === 'Unknown device' && b.name !== 'Unknown device') return 1;
        if (a.name !== 'Unknown device' && b.name === 'Unknown device') return -1;
        return a.name.localeCompare(b.name);
      });

      if (normalizedDevices.length > 0) {
        finish({
          status: 'success',
          devices: normalizedDevices,
          attempts: 1,
        });
        return;
      }

      finish({
        status: 'empty',
        devices: [],
        attempts: 1,
        message: 'No Bluetooth devices found. Make sure your car is discoverable.',
      });
    }, timeoutMs);
  });
};

export const verifyBluetoothDeviceConnection = async (
  deviceId: string,
  timeoutMs = DEFAULT_CONNECTION_TIMEOUT_MS,
): Promise<BluetoothConnectionResult> => {
  const permissionResult = await requestBluetoothPermissions();
  if (permissionResult.status !== 'granted') {
    return {
      status: permissionResult.status === 'unsupported' ? 'unsupported' : 'permission-denied',
      message: permissionResult.message,
    };
  }

  const bluetoothEnabled = await waitForBluetoothPoweredOn();
  if (!bluetoothEnabled) {
    return {
      status: 'failed',
      message: 'Bluetooth is turned off. Please enable it and try again.',
    };
  }

  try {
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('connection-timeout')), timeoutMs);
    });

    const connectAttempt = (async () => {
      const device = await bleManager.connectToDevice(deviceId, { timeout: timeoutMs, autoConnect: false });
      await device.discoverAllServicesAndCharacteristics();
      return device;
    })();

    const connectedDevice = await Promise.race([connectAttempt, timeout]);

    await connectedDevice.cancelConnection();
    return { status: 'connected', message: 'Device reachable and ready for auto-detection.' };
  } catch (error) {
    const bleErrorCode = (error as { errorCode?: BleErrorCode })?.errorCode;
    if (bleErrorCode === BleErrorCode.BluetoothUnauthorized) {
      return {
        status: 'permission-denied',
        message: 'Bluetooth permissions are required to validate this device.',
      };
    }

    return {
      status: 'failed',
      message: 'Could not connect to this device. Make sure it is powered on and nearby.',
    };
  }
};
