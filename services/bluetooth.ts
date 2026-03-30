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

const DEFAULT_TIMEOUT_MS = 10_000;
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

    bleManager.startDeviceScan(null, null, (error, scannedDevice) => {
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
      const normalizedDevices = Array.from(devices.values());

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
