import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_STARTUP_PERMISSION_ASKED_STATE,
  orchestrateStartupPermissions,
  PermissionStatuses,
  requestNotificationPermission,
  StartupPermissionAskedState,
  getPermissionStatuses,
} from '@/services/permissions';
import { getOnboardingState } from '@/services/onboarding';
import { useDialog } from '@/context/DialogContext';
import { DIALOG_COPY } from '@/constants/dialogs';

export interface ParkingSpot {
  id: string;
  latitude: number;
  longitude: number;
  timestamp: number;
  bluetoothDeviceName?: string;
  photoUrl?: string;
  notes?: string;
  address?: string;
  level?: string;
  spotNumber?: string;
  timerEnd?: number;
  category?: 'mall' | 'airport' | 'street' | 'garage' | 'other';
}

export interface CarBluetoothDevice {
  id: string;
  name: string;
  address: string;
}

export interface ParkingStats {
  totalParkings: number;
  totalTimeParked: number;
  averageParkingDuration: number;
  favoriteLocation?: string;
  lastWeekParkings: number;
}

interface ParkingContextType {
  currentParking: ParkingSpot | null;
  parkingHistory: ParkingSpot[];
  savedBluetoothDevice: CarBluetoothDevice | null;
  isAutoDetectionEnabled: boolean;
  isLoading: boolean;
  parkingStats: ParkingStats;
  saveParkingLocation: (location?: Partial<ParkingSpot>) => Promise<void>;
  deleteParkingSpot: (id: string) => void;
  clearHistory: () => void;
  setSavedBluetoothDevice: (device: CarBluetoothDevice | null) => void;
  setAutoDetectionEnabled: (enabled: boolean) => void;
  updateParkingSpot: (id: string, updates: Partial<ParkingSpot>) => void;
  setParkingTimer: (minutes: number) => void;
  clearParkingTimer: () => void;
  endParkingSession: () => Promise<void>;
  getDistanceToCar: () => number | null;
  getDirectionToCar: () => number | null;
  getWalkingTimeToCar: () => number | null;
  refreshCurrentLocation: () => Promise<Location.LocationObject | null>;
  currentLocation: Location.LocationObject | null;
  timerRemaining: number | null;
  isTimerActive: boolean;
  permissionStatuses: PermissionStatuses;
  refreshPermissionStatuses: () => Promise<void>;
  requestNotificationAccess: () => Promise<boolean>;
}

const STORAGE_KEYS = {
  currentParking: '@parkping/current_parking',
  parkingHistory: '@parkping/parking_history',
  bluetoothDevice: '@parkping/bluetooth_device',
  autoDetection: '@parkping/auto_detection',
  parkingStats: '@parkping/parking_stats',
  permissionAsked: '@parkping/permission_asked',
};

export const [ParkingProvider, useParking] = createContextHook<ParkingContextType>(() => {
  const { showError } = useDialog();
  const [currentParking, setCurrentParking] = useState<ParkingSpot | null>(null);
  const [parkingHistory, setParkingHistory] = useState<ParkingSpot[]>([]);
  const [savedBluetoothDevice, setSavedBluetoothDeviceState] = useState<CarBluetoothDevice | null>(null);
  const [isAutoDetectionEnabled, setAutoDetectionEnabledState] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  const [timerRemaining, setTimerRemaining] = useState<number | null>(null);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [permissionStatuses, setPermissionStatuses] = useState<PermissionStatuses>({
    location: { foreground: 'not-requested', background: 'not-requested' },
    bluetooth: 'not-requested',
    notifications: 'not-requested',
  });
  const [permissionAskedState, setPermissionAskedState] = useState<StartupPermissionAskedState>(
    DEFAULT_STARTUP_PERMISSION_ASKED_STATE
  );
  const [hasInitializedStartupPermissions, setHasInitializedStartupPermissions] = useState(false);

  useEffect(() => {
    void loadSavedData();
  }, []);

  useEffect(() => {
    let locationSubscription: Location.LocationSubscription | null = null;

    const startLocationTracking = async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') return;

      locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 10,
          timeInterval: 5000,
        },
        (location) => {
          setCurrentLocation(location);
        }
      );
    };

    void startLocationTracking();

    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, []);

  useEffect(() => {
    if (!currentParking?.timerEnd) {
      setIsTimerActive(false);
      setTimerRemaining(null);
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const remaining = currentParking.timerEnd! - now;
      
      if (remaining <= 0) {
        setIsTimerActive(false);
        setTimerRemaining(null);
        clearInterval(interval);
      } else {
        setTimerRemaining(remaining);
        setIsTimerActive(true);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [currentParking?.timerEnd]);

  const loadSavedData = async () => {
    try {
      const onboardingState = await getOnboardingState();

      const [parkingData, historyData, deviceData, autoDetectionData, permissionAskedData] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.currentParking),
        AsyncStorage.getItem(STORAGE_KEYS.parkingHistory),
        AsyncStorage.getItem(STORAGE_KEYS.bluetoothDevice),
        AsyncStorage.getItem(STORAGE_KEYS.autoDetection),
        AsyncStorage.getItem(STORAGE_KEYS.permissionAsked),
      ]);

      if (onboardingState.completed) {
        if (parkingData) {
          setCurrentParking(JSON.parse(parkingData));
          console.log('[ParkingContext] hydrated current parking from storage');
        }
        if (historyData) setParkingHistory(JSON.parse(historyData));
      } else if (parkingData || historyData) {
        await AsyncStorage.multiRemove([STORAGE_KEYS.currentParking, STORAGE_KEYS.parkingHistory]);
        console.log('[ParkingContext] skipped parking hydration because onboarding is incomplete');
      }

      if (deviceData) setSavedBluetoothDeviceState(JSON.parse(deviceData));
      if (autoDetectionData) setAutoDetectionEnabledState(JSON.parse(autoDetectionData));
      if (permissionAskedData) {
        setPermissionAskedState({
          ...DEFAULT_STARTUP_PERMISSION_ASKED_STATE,
          ...JSON.parse(permissionAskedData),
        });
      }
    } catch (error) {
      console.error('Error loading saved data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshPermissionStatuses = useCallback(async () => {
    const latestStatuses = await getPermissionStatuses();
    setPermissionStatuses(latestStatuses);
  }, []);

  const runStartupPermissionOrchestrator = useCallback(async () => {
    try {
      const { statuses, askedState } = await orchestrateStartupPermissions({
        askedState: permissionAskedState,
        needsBackgroundLocation: isAutoDetectionEnabled,
      });

      setPermissionStatuses(statuses);
      setPermissionAskedState(askedState);
      await AsyncStorage.setItem(STORAGE_KEYS.permissionAsked, JSON.stringify(askedState));

      if (statuses.location.foreground !== 'granted') {
        showError(DIALOG_COPY.permissions.locationRequired.title, DIALOG_COPY.permissions.locationRequired.message);
      }
    } catch (error) {
      console.error('Error running permission orchestrator:', error);
      await refreshPermissionStatuses();
    }
  }, [isAutoDetectionEnabled, permissionAskedState, refreshPermissionStatuses, showError]);

  const requestNotificationAccess = useCallback(async () => {
    try {
      const nextStatuses = await requestNotificationPermission();
      setPermissionStatuses(nextStatuses);

      if (!permissionAskedState.notifications) {
        const nextAskedState = { ...permissionAskedState, notifications: true };
        setPermissionAskedState(nextAskedState);
        await AsyncStorage.setItem(STORAGE_KEYS.permissionAsked, JSON.stringify(nextAskedState));
      }

      return nextStatuses.notifications === 'granted' || nextStatuses.notifications === 'limited';
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }, [permissionAskedState]);

  useEffect(() => {
    if (isLoading || hasInitializedStartupPermissions) return;

    setHasInitializedStartupPermissions(true);
    void runStartupPermissionOrchestrator();
  }, [isLoading, hasInitializedStartupPermissions, runStartupPermissionOrchestrator]);

  const calculateStats = useCallback((): ParkingStats => {
    const allSpots = currentParking ? [currentParking, ...parkingHistory] : parkingHistory;
    
    if (allSpots.length === 0) {
      return {
        totalParkings: 0,
        totalTimeParked: 0,
        averageParkingDuration: 0,
        lastWeekParkings: 0,
      };
    }

    const now = Date.now();
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
    
    const lastWeekParkings = allSpots.filter(s => s.timestamp > oneWeekAgo).length;
    
    const addressCounts: Record<string, number> = {};
    let favoriteLocation: string | undefined;
    let maxCount = 0;
    
    allSpots.forEach(spot => {
      const addr = spot.address || 'Unknown';
      addressCounts[addr] = (addressCounts[addr] || 0) + 1;
      if (addressCounts[addr] > maxCount) {
        maxCount = addressCounts[addr];
        favoriteLocation = addr;
      }
    });

    return {
      totalParkings: allSpots.length,
      totalTimeParked: 0,
      averageParkingDuration: 0,
      favoriteLocation,
      lastWeekParkings,
    };
  }, [currentParking, parkingHistory]);

  const saveParkingLocation = useCallback(async (location?: Partial<ParkingSpot>) => {
    try {
      setIsLoading(true);
      
      let coords: { latitude: number; longitude: number };
      
      if (location?.latitude && location?.longitude) {
        coords = { latitude: location.latitude, longitude: location.longitude };
      } else {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') {
          showError(DIALOG_COPY.permissions.savePermissionRequired.title, DIALOG_COPY.permissions.savePermissionRequired.message);
          return;
        }
        
        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        coords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
      }

      let address: string | undefined;
      try {
        const [geocode] = await Location.reverseGeocodeAsync(coords);
        if (geocode) {
          address = [geocode.name, geocode.street, geocode.city]
            .filter(Boolean)
            .join(', ');
        }
      } catch {
        // Address lookup failed
      }

      const newParking: ParkingSpot = {
        id: Date.now().toString(),
        latitude: coords.latitude,
        longitude: coords.longitude,
        timestamp: Date.now(),
        bluetoothDeviceName: location?.bluetoothDeviceName,
        photoUrl: location?.photoUrl,
        notes: location?.notes,
        address,
        level: location?.level,
        spotNumber: location?.spotNumber,
        category: location?.category || 'other',
      };

      if (currentParking) {
        const updatedHistory = [currentParking, ...parkingHistory].slice(0, 50);
        setParkingHistory(updatedHistory);
        await AsyncStorage.setItem(STORAGE_KEYS.parkingHistory, JSON.stringify(updatedHistory));
      }

      setCurrentParking(newParking);
      await AsyncStorage.setItem(STORAGE_KEYS.currentParking, JSON.stringify(newParking));
    } catch (error) {
      console.error('Error saving parking location:', error);
      showError(DIALOG_COPY.errors.saveParking.title, DIALOG_COPY.errors.saveParking.message);
    } finally {
      setIsLoading(false);
    }
  }, [currentParking, parkingHistory, showError]);

  const updateParkingSpot = useCallback(async (id: string, updates: Partial<ParkingSpot>) => {
    try {
      if (currentParking?.id === id) {
        const updated = { ...currentParking, ...updates };
        setCurrentParking(updated);
        await AsyncStorage.setItem(STORAGE_KEYS.currentParking, JSON.stringify(updated));
      } else {
        const updatedHistory = parkingHistory.map(spot =>
          spot.id === id ? { ...spot, ...updates } : spot
        );
        setParkingHistory(updatedHistory);
        await AsyncStorage.setItem(STORAGE_KEYS.parkingHistory, JSON.stringify(updatedHistory));
      }
    } catch (error) {
      console.error('Error updating parking spot:', error);
    }
  }, [currentParking, parkingHistory]);

  const setParkingTimer = useCallback((minutes: number) => {
    if (!currentParking) return;
    
    const timerEnd = Date.now() + minutes * 60 * 1000;
    void updateParkingSpot(currentParking.id, { timerEnd });
    setTimerRemaining(minutes * 60 * 1000);
    setIsTimerActive(true);
  }, [currentParking, updateParkingSpot]);

  const clearParkingTimer = useCallback(() => {
    if (!currentParking) return;
    
    void updateParkingSpot(currentParking.id, { timerEnd: undefined });
    setTimerRemaining(null);
    setIsTimerActive(false);
  }, [currentParking, updateParkingSpot]);

  const endParkingSession = useCallback(async () => {
    if (!currentParking) return;

    try {
      const updatedHistory = [currentParking, ...parkingHistory].slice(0, 50);
      setParkingHistory(updatedHistory);
      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEYS.parkingHistory, JSON.stringify(updatedHistory)),
        AsyncStorage.removeItem(STORAGE_KEYS.currentParking),
      ]);
      setCurrentParking(null);
      setTimerRemaining(null);
      setIsTimerActive(false);
    } catch (error) {
      console.error('Error ending parking session:', error);
      showError(DIALOG_COPY.errors.generic.title, DIALOG_COPY.errors.generic.message);
    }
  }, [currentParking, parkingHistory, showError]);

  const deleteParkingSpot = useCallback(async (id: string) => {
    try {
      const updatedHistory = parkingHistory.filter(spot => spot.id !== id);
      setParkingHistory(updatedHistory);
      await AsyncStorage.setItem(STORAGE_KEYS.parkingHistory, JSON.stringify(updatedHistory));
      
      if (currentParking?.id === id) {
        setCurrentParking(null);
        await AsyncStorage.removeItem(STORAGE_KEYS.currentParking);
      }
    } catch (error) {
      console.error('Error deleting parking spot:', error);
    }
  }, [parkingHistory, currentParking]);

  const clearHistory = useCallback(async () => {
    try {
      setParkingHistory([]);
      await AsyncStorage.removeItem(STORAGE_KEYS.parkingHistory);
    } catch (error) {
      console.error('Error clearing history:', error);
    }
  }, []);

  const setSavedBluetoothDevice = useCallback(async (device: CarBluetoothDevice | null) => {
    try {
      setSavedBluetoothDeviceState(device);
      if (device) {
        await AsyncStorage.setItem(STORAGE_KEYS.bluetoothDevice, JSON.stringify(device));
      } else {
        await AsyncStorage.removeItem(STORAGE_KEYS.bluetoothDevice);
      }
    } catch (error) {
      console.error('Error saving bluetooth device:', error);
    }
  }, []);

  const setAutoDetectionEnabled = useCallback(async (enabled: boolean) => {
    try {
      setAutoDetectionEnabledState(enabled);
      await AsyncStorage.setItem(STORAGE_KEYS.autoDetection, JSON.stringify(enabled));
    } catch (error) {
      console.error('Error saving auto detection setting:', error);
    }
  }, []);

  const refreshCurrentLocation = useCallback(async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') return null;
      
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setCurrentLocation(location);
      return location;
    } catch (error) {
      console.error('Error getting current location:', error);
      return null;
    }
  }, []);

  const getDistanceToCar = useCallback(() => {
    if (!currentParking || !currentLocation) return null;
    
    const R = 6371e3;
    const φ1 = (currentLocation.coords.latitude * Math.PI) / 180;
    const φ2 = (currentParking.latitude * Math.PI) / 180;
    const Δφ = ((currentParking.latitude - currentLocation.coords.latitude) * Math.PI) / 180;
    const Δλ = ((currentParking.longitude - currentLocation.coords.longitude) * Math.PI) / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return Math.round(R * c);
  }, [currentParking, currentLocation]);

  const getDirectionToCar = useCallback(() => {
    if (!currentParking || !currentLocation) return null;
    
    const lat1 = (currentLocation.coords.latitude * Math.PI) / 180;
    const lat2 = (currentParking.latitude * Math.PI) / 180;
    const lon1 = (currentLocation.coords.longitude * Math.PI) / 180;
    const lon2 = (currentParking.longitude * Math.PI) / 180;

    const y = Math.sin(lon2 - lon1) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) -
              Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);
    
    let bearing = (Math.atan2(y, x) * 180) / Math.PI;
    bearing = (bearing + 360) % 360;
    
    return bearing;
  }, [currentParking, currentLocation]);

  const getWalkingTimeToCar = useCallback(() => {
    const distance = getDistanceToCar();
    if (distance === null) return null;
    
    const walkingSpeed = 1.4;
    return Math.ceil(distance / walkingSpeed / 60);
  }, [getDistanceToCar]);

  const parkingStats = useMemo(() => calculateStats(), [calculateStats]);

  return useMemo(() => ({
    currentParking,
    parkingHistory,
    savedBluetoothDevice,
    isAutoDetectionEnabled,
    isLoading,
    parkingStats,
    saveParkingLocation,
    deleteParkingSpot,
    clearHistory,
    setSavedBluetoothDevice,
    setAutoDetectionEnabled,
    updateParkingSpot,
    setParkingTimer,
    clearParkingTimer,
    endParkingSession,
    getDistanceToCar,
    getDirectionToCar,
    getWalkingTimeToCar,
    refreshCurrentLocation,
    currentLocation,
    timerRemaining,
    isTimerActive,
    permissionStatuses,
    refreshPermissionStatuses,
    requestNotificationAccess,
  }), [
    currentParking,
    parkingHistory,
    savedBluetoothDevice,
    isAutoDetectionEnabled,
    isLoading,
    parkingStats,
    saveParkingLocation,
    deleteParkingSpot,
    clearHistory,
    setSavedBluetoothDevice,
    setAutoDetectionEnabled,
    updateParkingSpot,
    setParkingTimer,
    clearParkingTimer,
    endParkingSession,
    getDistanceToCar,
    getDirectionToCar,
    getWalkingTimeToCar,
    refreshCurrentLocation,
    currentLocation,
    timerRemaining,
    isTimerActive,
    permissionStatuses,
    refreshPermissionStatuses,
    requestNotificationAccess,
  ]);
});
