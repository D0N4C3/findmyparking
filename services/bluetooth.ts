import { NativeModules, PermissionsAndroid, Platform } from 'react-native';

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

interface BluetoothNativeModule {
  getPairedDevices?: () => Promise<unknown[]>;
  scanForDevices?: (timeoutMs?: number) => Promise<unknown[]>;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RETRIES = 1;

const resolveBluetoothModule = (): BluetoothNativeModule | null => {
  const modules = NativeModules as Record<string, BluetoothNativeModule | undefined>;
  return modules.RNBluetoothClassic ?? modules.BluetoothClassic ?? modules.BluetoothManager ?? null;
};

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number) => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('timeout')), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

const normalizeDevice = (device: unknown): BluetoothDevice | null => {
  if (!device || typeof device !== 'object') {
    return null;
  }

  const rawDevice = device as Record<string, unknown>;
  const address =
    (typeof rawDevice.address === 'string' && rawDevice.address) ||
    (typeof rawDevice.macAddress === 'string' && rawDevice.macAddress) ||
    (typeof rawDevice.id === 'string' && rawDevice.id) ||
    '';

  if (!address) {
    return null;
  }

  const name =
    (typeof rawDevice.name === 'string' && rawDevice.name.trim()) ||
    (typeof rawDevice.deviceName === 'string' && rawDevice.deviceName.trim()) ||
    'Unknown device';

  return {
    id: address,
    name,
    address,
  };
};

const dedupeDevices = (devices: BluetoothDevice[]) => {
  const map = new Map<string, BluetoothDevice>();

  for (const device of devices) {
    const key = device.id || device.address;
    if (!map.has(key)) {
      map.set(key, device);
    }
  }

  return Array.from(map.values());
};

export const requestBluetoothPermissions = async (): Promise<BluetoothPermissionResult> => {
  if (Platform.OS === 'android') {
    if (Platform.Version < 31) {
      return { status: 'granted' };
    }

    const permissions = [
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    ];

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
    // iOS prompts for Bluetooth usage based on Info.plist keys and first Bluetooth access.
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
  const retries = options.retries ?? DEFAULT_RETRIES;

  const permissionResult = await requestBluetoothPermissions();
  if (permissionResult.status !== 'granted') {
    return {
      status: permissionResult.status === 'unsupported' ? 'unsupported' : 'permission-denied',
      devices: [],
      attempts: 0,
      message: permissionResult.message,
    };
  }

  const bluetoothModule = resolveBluetoothModule();
  if (!bluetoothModule?.getPairedDevices && !bluetoothModule?.scanForDevices) {
    return {
      status: 'unsupported',
      devices: [],
      attempts: 0,
      message: 'Bluetooth scanner module is unavailable on this build.',
    };
  }

  let timeoutCount = 0;

  for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
    try {
      const scanPromises: Promise<unknown[]>[] = [];

      if (bluetoothModule.getPairedDevices) {
        scanPromises.push(withTimeout(bluetoothModule.getPairedDevices(), timeoutMs));
      }

      if (bluetoothModule.scanForDevices) {
        scanPromises.push(withTimeout(bluetoothModule.scanForDevices(timeoutMs), timeoutMs));
      }

      const batches = await Promise.all(scanPromises);
      const normalized = dedupeDevices(
        batches
          .flat()
          .map(normalizeDevice)
          .filter((device): device is BluetoothDevice => device !== null)
      );

      if (normalized.length > 0) {
        return {
          status: 'success',
          devices: normalized,
          attempts: attempt,
        };
      }
    } catch (error) {
      if (error instanceof Error && error.message === 'timeout') {
        timeoutCount += 1;
      } else if (attempt === retries + 1) {
        return {
          status: 'error',
          devices: [],
          attempts: attempt,
          message: 'Unable to scan for Bluetooth devices right now.',
        };
      }
    }
  }

  if (timeoutCount > 0) {
    return {
      status: 'timeout',
      devices: [],
      attempts: retries + 1,
      message: 'Bluetooth scan timed out. Please move closer to your car and try again.',
    };
  }

  return {
    status: 'empty',
    devices: [],
    attempts: retries + 1,
    message: 'No Bluetooth devices found. Make sure your car is discoverable.',
  };
};
