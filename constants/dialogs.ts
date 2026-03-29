import { ColorTheme } from '@/constants/colors';

export type DialogVariant = 'error' | 'confirm' | 'destructive' | 'picker' | 'info';

export interface DialogAction {
  id: string;
  label: string;
  role?: 'cancel' | 'default' | 'destructive';
}

export const DIALOG_COPY = {
  errors: {
    generic: {
      title: 'Something went wrong',
      message: 'Please try again in a moment.',
    },
    saveParking: {
      title: 'Could not save parking spot',
      message: 'Please check location access and try again.',
    },
    shareLocation: {
      title: 'Unable to share location',
      message: 'Please try sharing again.',
    },
    shareApp: {
      title: 'Unable to share CarPing',
      message: 'Please try again in a moment.',
    },
  },
  permissions: {
    locationRequired: {
      title: 'Location access required',
      message: 'CarPing needs location access to save and find your parking spot.',
    },
    savePermissionRequired: {
      title: 'Location access required',
      message: 'Please allow location access to save your parking spot.',
    },
    notificationsSettings: {
      title: 'Manage notifications in Settings',
      message: 'Notification permission can only be changed in system settings.',
    },
  },
  prompts: {
    clearAllData: {
      title: 'Clear all data?',
      message: 'This removes your parking history and preferences. This action cannot be undone.',
    },
    selectBluetooth: {
      title: 'Choose your car Bluetooth',
      message: 'Pick the car Bluetooth device used for automatic parking detection.',
    },
    noParkingSaved: {
      title: 'No parking spot saved yet',
      message: 'Save a parking spot and make sure GPS is enabled to continue.',
    },
  },
  actions: {
    ok: { id: 'ok', label: 'OK', role: 'default' as const },
    cancel: { id: 'cancel', label: 'Cancel', role: 'cancel' as const },
    clearAll: { id: 'clear-all', label: 'Clear All', role: 'destructive' as const },
    removeDevice: { id: 'remove-device', label: 'Remove Device', role: 'destructive' as const },
    openSettings: { id: 'open-settings', label: 'Open Settings', role: 'default' as const },
  },
};

export const getDialogButtonVariant = (
  role: DialogAction['role'],
  index: number,
  total: number
): 'primary' | 'secondary' | 'danger' => {
  if (role === 'destructive') return 'danger';
  if (role === 'cancel') return 'secondary';
  if (index === total - 1) return 'primary';
  return 'secondary';
};

export const getDialogAccent = (colors: ColorTheme, variant: DialogVariant) => {
  switch (variant) {
    case 'error':
      return colors.error;
    case 'destructive':
      return colors.error;
    case 'confirm':
      return colors.warning;
    case 'picker':
    case 'info':
    default:
      return colors.accent;
  }
};
