import { Platform, PermissionsAndroid } from 'react-native';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';

export type PermissionBadgeStatus = 'granted' | 'denied' | 'limited' | 'not-requested';

export interface LocationPermissionStatus {
  foreground: PermissionBadgeStatus;
  background: PermissionBadgeStatus;
}

export interface PermissionStatuses {
  location: LocationPermissionStatus;
  bluetooth: PermissionBadgeStatus;
  notifications: PermissionBadgeStatus;
}

export interface StartupPermissionAskedState {
  locationForeground: boolean;
  locationBackground: boolean;
  bluetooth: boolean;
  notifications: boolean;
}

export const DEFAULT_STARTUP_PERMISSION_ASKED_STATE: StartupPermissionAskedState = {
  locationForeground: false,
  locationBackground: false,
  bluetooth: false,
  notifications: false,
};

const mapExpoStatus = (status: Location.PermissionStatus | Notifications.PermissionStatus): PermissionBadgeStatus => {
  switch (status) {
    case 'granted':
      return 'granted';
    case 'denied':
      return 'denied';
    case 'undetermined':
      return 'not-requested';
    default:
      return 'not-requested';
  }
};

export const getLocationPermissionStatus = async (): Promise<LocationPermissionStatus> => {
  const [foregroundPermissions, backgroundPermissions] = await Promise.all([
    Location.getForegroundPermissionsAsync(),
    Location.getBackgroundPermissionsAsync(),
  ]);

  return {
    foreground: mapExpoStatus(foregroundPermissions.status),
    background: mapExpoStatus(backgroundPermissions.status),
  };
};

export const getBluetoothPermissionStatus = async (): Promise<PermissionBadgeStatus> => {
  if (Platform.OS === 'android') {
    if (Platform.Version < 31) {
      return 'granted';
    }

    const [scanPermission, connectPermission] = await Promise.all([
      PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN),
      PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT),
    ]);

    if (scanPermission && connectPermission) {
      return 'granted';
    }

    if (scanPermission || connectPermission) {
      return 'limited';
    }

    return 'denied';
  }

  // iOS Bluetooth runtime permission is not directly exposed by Expo APIs.
  return 'not-requested';
};

export const getNotificationPermissionStatus = async (): Promise<PermissionBadgeStatus> => {
  const notificationPermissions = await Notifications.getPermissionsAsync();

  if (notificationPermissions.granted) {
    return 'granted';
  }

  if (notificationPermissions.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
    return 'limited';
  }

  return mapExpoStatus(notificationPermissions.status);
};

export const getPermissionStatuses = async (): Promise<PermissionStatuses> => {
  const [location, bluetooth, notifications] = await Promise.all([
    getLocationPermissionStatus(),
    getBluetoothPermissionStatus(),
    getNotificationPermissionStatus(),
  ]);

  return {
    location,
    bluetooth,
    notifications,
  };
};

const requestBluetoothPermissions = async () => {
  if (Platform.OS !== 'android' || Platform.Version < 31) {
    return;
  }

  await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
  ]);
};

export const orchestrateStartupPermissions = async ({
  askedState,
  needsBackgroundLocation,
}: {
  askedState: StartupPermissionAskedState;
  needsBackgroundLocation: boolean;
}): Promise<{ statuses: PermissionStatuses; askedState: StartupPermissionAskedState }> => {
  let statuses = await getPermissionStatuses();
  const nextAskedState: StartupPermissionAskedState = { ...askedState };

  if (statuses.location.foreground !== 'granted') {
    nextAskedState.locationForeground = true;
    await Location.requestForegroundPermissionsAsync();
    statuses = await getPermissionStatuses();
  }

  if (
    needsBackgroundLocation &&
    statuses.location.foreground === 'granted' &&
    statuses.location.background !== 'granted' &&
    Platform.OS === 'android'
  ) {
    nextAskedState.locationBackground = true;
    await Location.requestBackgroundPermissionsAsync();
    statuses = await getPermissionStatuses();
  }

  if (statuses.bluetooth !== 'granted') {
    nextAskedState.bluetooth = true;
    await requestBluetoothPermissions();
    statuses = await getPermissionStatuses();
  }

  if (statuses.notifications !== 'granted' && statuses.notifications !== 'limited') {
    nextAskedState.notifications = true;
    await Notifications.requestPermissionsAsync();
    statuses = await getPermissionStatuses();
  }

  return { statuses, askedState: nextAskedState };
};

export const requestNotificationPermission = async (): Promise<PermissionStatuses> => {
  await Notifications.requestPermissionsAsync();
  return getPermissionStatuses();
};

export const PERMISSION_STATUS_LABELS: Record<PermissionBadgeStatus, string> = {
  granted: 'Granted',
  denied: 'Denied',
  limited: 'Limited',
  'not-requested': 'Not requested',
};
