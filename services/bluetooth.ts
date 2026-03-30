import { NativeModules, PermissionsAndroid, Platform } from 'react-native';
import { BleErrorCode, BleManager, Device, State } from 'react-native-ble-plx';

export interface BluetoothDevice {
  id: string;
  name: string;
  address: string;
  rssi?: number;
  lastSeenAt?: number;
  isPaired?: boolean;
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
const DEFAULT_SCAN_RETRIES = 1;
const bleManager = new BleManager();

const normalizeDevice = (device: Device): BluetoothDevice => {
  const name = device.name?.trim() || device.localName?.trim() || 'Unknown device';

  return {
    id: device.id,
    name,
    address: device.id,
    rssi: typeof device.rssi === 'number' ? device.rssi : undefined,
    lastSeenAt: Date.now(),
    isPaired: false,
  };
};

type NativePairedDevice = {
  id?: string;
  address?: string;
  macAddress?: string;
  deviceId?: string;
  name?: string;
  localName?: string;
  rssi?: number;
};

const normalizePairedDevice = (device: NativePairedDevice): BluetoothDevice | null => {
  const id = device.id ?? device.address ?? device.macAddress ?? device.deviceId;
  if (!id) {
    return null;
  }

  const name = device.name?.trim() || device.localName?.trim() || 'Unknown device';

  return {
    id,
    name,
    address: id,
    rssi: typeof device.rssi === 'number' ? device.rssi : undefined,
    lastSeenAt: Date.now(),
    isPaired: true,
  };
};

const mergeDevice = (target: Map<string, BluetoothDevice>, incomingDevice: BluetoothDevice) => {
  const existing = target.get(incomingDevice.id);
  if (!existing) {
    target.set(incomingDevice.id, incomingDevice);
    return;
  }

  const existingRssi = typeof existing.rssi === 'number' ? existing.rssi : -Infinity;
  const incomingRssi = typeof incomingDevice.rssi === 'number' ? incomingDevice.rssi : -Infinity;

  target.set(incomingDevice.id, {
    ...existing,
    ...incomingDevice,
    name:
      existing.name !== 'Unknown device' ? existing.name : incomingDevice.name,
    rssi: incomingRssi > existingRssi ? incomingDevice.rssi : existing.rssi,
    lastSeenAt: Math.max(existing.lastSeenAt ?? 0, incomingDevice.lastSeenAt ?? 0),
    isPaired: Boolean(existing.isPaired || incomingDevice.isPaired),
  });
};

const getPairedBluetoothDevices = async (): Promise<BluetoothDevice[]> => {
  if (Platform.OS !== 'android') {
    return [];
  }

  const bluetoothManager = NativeModules.BluetoothManager ?? NativeModules.BleManager ?? NativeModules.BluetoothModule;
  if (!bluetoothManager) {
    return [];
  }

  const getBonded =
    bluetoothManager.getBondedDevices ??
    bluetoothManager.getPairedDevices ??
    bluetoothManager.getBondedPeripherals;

  if (typeof getBonded !== 'function') {
    return [];
  }

  try {
    const rawDevices = await getBonded.call(bluetoothManager);
    if (!Array.isArray(rawDevices)) {
      return [];
    }

    return rawDevices
      .map((device) => normalizePairedDevice(device as NativePairedDevice))
      .filter((device): device is BluetoothDevice => Boolean(device));
  } catch {
    return [];
  }
};

const scanBluetoothDevicesPass = (timeoutMs: number): Promise<Map<string, BluetoothDevice>> =>
  new Promise<Map<string, BluetoothDevice>>((resolve, reject) => {
    const devices = new Map<string, BluetoothDevice>();
    let finished = false;

    const finishSuccess = () => {
      if (finished) return;
      finished = true;
      bleManager.stopDeviceScan();
      resolve(devices);
    };

    const finishError = (error: unknown) => {
      if (finished) return;
      finished = true;
      bleManager.stopDeviceScan();
      reject(error);
    };

    bleManager.startDeviceScan(null, { allowDuplicates: false, scanMode: 2 }, (error, scannedDevice) => {
      if (error) {
        finishError(error);
        return;
      }

      if (!scannedDevice) {
        return;
      }

      mergeDevice(devices, normalizeDevice(scannedDevice));
    });

    setTimeout(finishSuccess, timeoutMs);
  });

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
  const retries = Math.max(0, options.retries ?? DEFAULT_SCAN_RETRIES);
  const attempts = retries + 1;

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

  const mergedDevices = new Map<string, BluetoothDevice>();

  const pairedDevices = await getPairedBluetoothDevices();
  pairedDevices.forEach((device) => mergeDevice(mergedDevices, device));

  let completedAttempts = 0;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const passDevices = await scanBluetoothDevicesPass(timeoutMs);
      passDevices.forEach((device) => mergeDevice(mergedDevices, device));
      completedAttempts += 1;
    } catch (error) {
      if (error instanceof Error && 'errorCode' in error) {
        const maybeBleError = error as Error & { errorCode?: BleErrorCode };
        if (maybeBleError.errorCode === BleErrorCode.BluetoothUnauthorized) {
          return {
            status: 'permission-denied',
            devices: [],
            attempts: completedAttempts + 1,
            message: 'Bluetooth permissions were denied by the operating system.',
          };
        }
      }

      return {
        status: 'error',
        devices: [],
        attempts: completedAttempts + 1,
        message: 'Unable to scan for Bluetooth devices right now.',
      };
    }
  }

  const normalizedDevices = Array.from(mergedDevices.values()).sort((a, b) => {
    if (Boolean(a.isPaired) !== Boolean(b.isPaired)) return a.isPaired ? -1 : 1;
    if (a.name === 'Unknown device' && b.name !== 'Unknown device') return 1;
    if (a.name !== 'Unknown device' && b.name === 'Unknown device') return -1;
    const aRssi = typeof a.rssi === 'number' ? a.rssi : -Infinity;
    const bRssi = typeof b.rssi === 'number' ? b.rssi : -Infinity;
    if (aRssi !== bRssi) return bRssi - aRssi;
    return a.name.localeCompare(b.name);
  });

  if (normalizedDevices.length > 0) {
    return {
      status: 'success',
      devices: normalizedDevices,
      attempts: completedAttempts,
      message:
        completedAttempts > 1
          ? `Completed ${completedAttempts} scan passes and merged paired devices.`
          : undefined,
    };
  }

  return {
    status: 'empty',
    devices: [],
    attempts: completedAttempts,
    message: 'No Bluetooth devices found. Make sure your car is discoverable.',
  };
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
