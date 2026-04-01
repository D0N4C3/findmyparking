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
import {
  FavoritePlace,
  ManualDestination,
  NavigationTargetEntity,
  ParkingZone,
  QuickNavigationPreset,
} from '@/types/parking';

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
  favoritePlaces: FavoritePlace[];
  offlineParkingZones: ParkingZone[];
  quickNavigationPresets: QuickNavigationPreset[];
  manualDestination: ManualDestination | null;
  navigationTarget: NavigationTargetEntity | null;
  addFavoritePlace: (favorite: Omit<FavoritePlace, 'id' | 'createdAt'>) => Promise<void>;
  removeFavoritePlace: (favoriteId: string) => Promise<void>;
  addOfflineParkingZone: (zone: Omit<ParkingZone, 'id' | 'createdAt' | 'updatedAt'>) => Promise<ParkingZone>;
  updateOfflineParkingZone: (zoneId: string, updates: Partial<Omit<ParkingZone, 'id' | 'createdAt'>>) => Promise<void>;
  removeOfflineParkingZone: (zoneId: string) => Promise<void>;
  listOfflineParkingZones: () => ParkingZone[];
  addQuickNavigationPreset: (preset: Omit<QuickNavigationPreset, 'id' | 'createdAt' | 'updatedAt'>) => Promise<QuickNavigationPreset>;
  updateQuickNavigationPreset: (presetId: string, updates: Partial<Omit<QuickNavigationPreset, 'id' | 'createdAt'>>) => Promise<void>;
  removeQuickNavigationPreset: (presetId: string) => Promise<void>;
  listQuickNavigationPresets: () => QuickNavigationPreset[];
  createManualDestination: (destination: Pick<ManualDestination, 'latitude' | 'longitude'> & Partial<Pick<ManualDestination, 'label'>>) => Promise<ManualDestination>;
  updateManualDestination: (updates: Partial<Pick<ManualDestination, 'latitude' | 'longitude' | 'label'>>) => Promise<void>;
  removeManualDestination: () => Promise<void>;
  setNavigationTarget: (target: NavigationTargetEntity | null) => void;
}

const STORAGE_KEYS = {
  currentParking: '@parkping/current_parking',
  parkingHistory: '@parkping/parking_history',
  bluetoothDevice: '@parkping/bluetooth_device',
  autoDetection: '@parkping/auto_detection',
  parkingStats: '@parkping/parking_stats',
  permissionAsked: '@parkping/permission_asked',
  favoritePlaces: '@parkping/favorite_places',
  offlineParkingZones: '@parkping/offline_parking_zones',
  quickNavigationPresets: '@parkping/quick_nav_presets',
  manualDestination: '@parkping/manual_destination',
};

function createParkingSpotId() {
  return `park-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function prependUniqueParking(spot: ParkingSpot, history: ParkingSpot[]) {
  const dedupedHistory = history.filter((item) => !(item.id === spot.id && item.timestamp === spot.timestamp));
  return [spot, ...dedupedHistory].slice(0, 50);
}

function parseStoredValue<T>(raw: string | null, guard: (value: unknown) => value is T, fallback: T): T {
  if (!raw) return fallback;
  try {
    const parsed: unknown = JSON.parse(raw);
    return guard(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function hasCoordinate(value: unknown): value is { latitude: number; longitude: number } {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { latitude?: unknown }).latitude === 'number' &&
    typeof (value as { longitude?: unknown }).longitude === 'number'
  );
}

function isParkingZone(value: unknown): value is ParkingZone {
  const zone = value as ParkingZone;
  return (
    typeof zone?.id === 'string' &&
    typeof zone?.name === 'string' &&
    Array.isArray(zone?.polygon) &&
    zone.polygon.every(hasCoordinate) &&
    hasCoordinate(zone?.center) &&
    typeof zone?.zoneType === 'string' &&
    typeof zone?.cacheStatus === 'string' &&
    typeof zone?.source === 'string' &&
    typeof zone?.createdAt === 'number' &&
    typeof zone?.updatedAt === 'number'
  );
}

function isQuickPreset(value: unknown): value is QuickNavigationPreset {
  const preset = value as QuickNavigationPreset;
  return (
    typeof preset?.id === 'string' &&
    typeof preset?.label === 'string' &&
    hasCoordinate(preset?.destination) &&
    (preset?.mode === 'walking' || preset?.mode === 'driving') &&
    typeof preset?.createdAt === 'number' &&
    typeof preset?.updatedAt === 'number'
  );
}

function isManualDestination(value: unknown): value is ManualDestination {
  const destination = value as ManualDestination;
  return (
    typeof destination?.id === 'string' &&
    typeof destination?.label === 'string' &&
    typeof destination?.latitude === 'number' &&
    typeof destination?.longitude === 'number' &&
    typeof destination?.createdAt === 'number' &&
    typeof destination?.updatedAt === 'number'
  );
}

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
  const [favoritePlaces, setFavoritePlaces] = useState<FavoritePlace[]>([]);
  const [offlineParkingZones, setOfflineParkingZones] = useState<ParkingZone[]>([]);
  const [quickNavigationPresets, setQuickNavigationPresets] = useState<QuickNavigationPreset[]>([]);
  const [manualDestination, setManualDestination] = useState<ManualDestination | null>(null);
  const [navigationTarget, setNavigationTarget] = useState<NavigationTargetEntity | null>(null);

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

      const [
        parkingData,
        historyData,
        deviceData,
        autoDetectionData,
        permissionAskedData,
        favoritePlacesData,
        offlineParkingZonesData,
        quickNavigationPresetsData,
        manualDestinationData,
      ] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.currentParking),
        AsyncStorage.getItem(STORAGE_KEYS.parkingHistory),
        AsyncStorage.getItem(STORAGE_KEYS.bluetoothDevice),
        AsyncStorage.getItem(STORAGE_KEYS.autoDetection),
        AsyncStorage.getItem(STORAGE_KEYS.permissionAsked),
        AsyncStorage.getItem(STORAGE_KEYS.favoritePlaces),
        AsyncStorage.getItem(STORAGE_KEYS.offlineParkingZones),
        AsyncStorage.getItem(STORAGE_KEYS.quickNavigationPresets),
        AsyncStorage.getItem(STORAGE_KEYS.manualDestination),
      ]);

      if (onboardingState.completed) {
        if (parkingData) {
          setCurrentParking(parseStoredValue(parkingData, (value): value is ParkingSpot => typeof value === 'object' && value !== null && typeof (value as ParkingSpot).id === 'string' && typeof (value as ParkingSpot).latitude === 'number' && typeof (value as ParkingSpot).longitude === 'number' && typeof (value as ParkingSpot).timestamp === 'number', null));
          console.log('[ParkingContext] hydrated current parking from storage');
        }
        if (historyData) {
          const nextHistory = parseStoredValue(historyData, (value): value is ParkingSpot[] =>
            Array.isArray(value) &&
            value.every((item) => typeof item === 'object' && item !== null && typeof (item as ParkingSpot).id === 'string'),
          []);
          setParkingHistory(nextHistory);
        }
      } else if (parkingData || historyData) {
        await AsyncStorage.multiRemove([STORAGE_KEYS.currentParking, STORAGE_KEYS.parkingHistory]);
        console.log('[ParkingContext] skipped parking hydration because onboarding is incomplete');
      }

      if (deviceData) {
        setSavedBluetoothDeviceState(
          parseStoredValue(
            deviceData,
            (value): value is CarBluetoothDevice =>
              typeof value === 'object' &&
              value !== null &&
              typeof (value as CarBluetoothDevice).id === 'string' &&
              typeof (value as CarBluetoothDevice).name === 'string' &&
              typeof (value as CarBluetoothDevice).address === 'string',
            null,
          ),
        );
      }
      if (autoDetectionData) setAutoDetectionEnabledState(parseStoredValue(autoDetectionData, (value): value is boolean => typeof value === 'boolean', true));
      if (permissionAskedData) {
        setPermissionAskedState({
          ...DEFAULT_STARTUP_PERMISSION_ASKED_STATE,
          ...parseStoredValue(
            permissionAskedData,
            (value): value is Partial<StartupPermissionAskedState> => typeof value === 'object' && value !== null,
            {},
          ),
        });
      }
      if (favoritePlacesData) {
        setFavoritePlaces(
          parseStoredValue(
            favoritePlacesData,
            (value): value is FavoritePlace[] =>
              Array.isArray(value) && value.every((item) => typeof item === 'object' && item !== null && typeof (item as FavoritePlace).id === 'string'),
            [],
          ),
        );
      }
      if (offlineParkingZonesData) {
        setOfflineParkingZones(parseStoredValue(offlineParkingZonesData, (value): value is ParkingZone[] => Array.isArray(value) && value.every(isParkingZone), []));
      }
      if (quickNavigationPresetsData) {
        setQuickNavigationPresets(
          parseStoredValue(
            quickNavigationPresetsData,
            (value): value is QuickNavigationPreset[] => Array.isArray(value) && value.every(isQuickPreset),
            [],
          ),
        );
      }
      if (manualDestinationData) {
        setManualDestination(parseStoredValue(manualDestinationData, isManualDestination, null));
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
        id: createParkingSpotId(),
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
        const updatedHistory = prependUniqueParking(currentParking, parkingHistory);
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
      const updatedHistory = prependUniqueParking(currentParking, parkingHistory);
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

  const addFavoritePlace = useCallback(async (favorite: Omit<FavoritePlace, 'id' | 'createdAt'>) => {
    const nextFavorite: FavoritePlace = {
      ...favorite,
      id: `fav-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: Date.now(),
    };

    const nextList = [nextFavorite, ...favoritePlaces].slice(0, 20);
    setFavoritePlaces(nextList);
    await AsyncStorage.setItem(STORAGE_KEYS.favoritePlaces, JSON.stringify(nextList));
  }, [favoritePlaces]);

  const removeFavoritePlace = useCallback(async (favoriteId: string) => {
    const nextList = favoritePlaces.filter((favorite) => favorite.id !== favoriteId);
    setFavoritePlaces(nextList);
    await AsyncStorage.setItem(STORAGE_KEYS.favoritePlaces, JSON.stringify(nextList));
  }, [favoritePlaces]);

  const addOfflineParkingZone = useCallback(async (zone: Omit<ParkingZone, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = Date.now();
    const nextZone: ParkingZone = {
      ...zone,
      id: `zone-${now}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: now,
      updatedAt: now,
    };
    const nextList = [nextZone, ...offlineParkingZones];
    setOfflineParkingZones(nextList);
    await AsyncStorage.setItem(STORAGE_KEYS.offlineParkingZones, JSON.stringify(nextList));
    return nextZone;
  }, [offlineParkingZones]);

  const updateOfflineParkingZone = useCallback(async (zoneId: string, updates: Partial<Omit<ParkingZone, 'id' | 'createdAt'>>) => {
    const nextList = offlineParkingZones.map((zone) => (zone.id === zoneId ? { ...zone, ...updates, updatedAt: Date.now() } : zone));
    setOfflineParkingZones(nextList);
    await AsyncStorage.setItem(STORAGE_KEYS.offlineParkingZones, JSON.stringify(nextList));
  }, [offlineParkingZones]);

  const removeOfflineParkingZone = useCallback(async (zoneId: string) => {
    const nextList = offlineParkingZones.filter((zone) => zone.id !== zoneId);
    setOfflineParkingZones(nextList);
    await AsyncStorage.setItem(STORAGE_KEYS.offlineParkingZones, JSON.stringify(nextList));
    setNavigationTarget((prev) => (prev?.kind === 'offline-zone' && prev.zoneId === zoneId ? null : prev));
  }, [offlineParkingZones]);

  const listOfflineParkingZones = useCallback(() => offlineParkingZones, [offlineParkingZones]);

  const addQuickNavigationPreset = useCallback(async (preset: Omit<QuickNavigationPreset, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = Date.now();
    const nextPreset: QuickNavigationPreset = {
      ...preset,
      id: `preset-${now}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: now,
      updatedAt: now,
    };
    const nextList = [nextPreset, ...quickNavigationPresets].slice(0, 30);
    setQuickNavigationPresets(nextList);
    await AsyncStorage.setItem(STORAGE_KEYS.quickNavigationPresets, JSON.stringify(nextList));
    return nextPreset;
  }, [quickNavigationPresets]);

  const updateQuickNavigationPreset = useCallback(async (presetId: string, updates: Partial<Omit<QuickNavigationPreset, 'id' | 'createdAt'>>) => {
    const nextList = quickNavigationPresets.map((preset) => (preset.id === presetId ? { ...preset, ...updates, updatedAt: Date.now() } : preset));
    setQuickNavigationPresets(nextList);
    await AsyncStorage.setItem(STORAGE_KEYS.quickNavigationPresets, JSON.stringify(nextList));
  }, [quickNavigationPresets]);

  const removeQuickNavigationPreset = useCallback(async (presetId: string) => {
    const nextList = quickNavigationPresets.filter((preset) => preset.id !== presetId);
    setQuickNavigationPresets(nextList);
    await AsyncStorage.setItem(STORAGE_KEYS.quickNavigationPresets, JSON.stringify(nextList));
    setNavigationTarget((prev) => (prev?.kind === 'quick-preset' && prev.presetId === presetId ? null : prev));
  }, [quickNavigationPresets]);

  const listQuickNavigationPresets = useCallback(() => quickNavigationPresets, [quickNavigationPresets]);

  const createManualDestination = useCallback(
    async (destination: Pick<ManualDestination, 'latitude' | 'longitude'> & Partial<Pick<ManualDestination, 'label'>>) => {
      const now = Date.now();
      const nextDestination: ManualDestination = {
        id: `manual-${now}-${Math.random().toString(36).slice(2, 6)}`,
        latitude: destination.latitude,
        longitude: destination.longitude,
        label: destination.label?.trim() || 'Manual pin',
        createdAt: now,
        updatedAt: now,
      };
      setManualDestination(nextDestination);
      await AsyncStorage.setItem(STORAGE_KEYS.manualDestination, JSON.stringify(nextDestination));
      return nextDestination;
    },
    [],
  );

  const updateManualDestination = useCallback(
    async (updates: Partial<Pick<ManualDestination, 'latitude' | 'longitude' | 'label'>>) => {
      if (!manualDestination) return;
      const nextDestination: ManualDestination = {
        ...manualDestination,
        ...updates,
        label: updates.label?.trim() || manualDestination.label,
        updatedAt: Date.now(),
      };
      setManualDestination(nextDestination);
      await AsyncStorage.setItem(STORAGE_KEYS.manualDestination, JSON.stringify(nextDestination));
    },
    [manualDestination],
  );

  const removeManualDestination = useCallback(async () => {
    setManualDestination(null);
    setNavigationTarget((prev) => (prev?.kind === 'manual-pin' ? null : prev));
    await AsyncStorage.removeItem(STORAGE_KEYS.manualDestination);
  }, []);

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
    favoritePlaces,
    offlineParkingZones,
    quickNavigationPresets,
    manualDestination,
    navigationTarget,
    addFavoritePlace,
    removeFavoritePlace,
    addOfflineParkingZone,
    updateOfflineParkingZone,
    removeOfflineParkingZone,
    listOfflineParkingZones,
    addQuickNavigationPreset,
    updateQuickNavigationPreset,
    removeQuickNavigationPreset,
    listQuickNavigationPresets,
    createManualDestination,
    updateManualDestination,
    removeManualDestination,
    setNavigationTarget,
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
    favoritePlaces,
    offlineParkingZones,
    quickNavigationPresets,
    manualDestination,
    navigationTarget,
    addFavoritePlace,
    removeFavoritePlace,
    addOfflineParkingZone,
    updateOfflineParkingZone,
    removeOfflineParkingZone,
    listOfflineParkingZones,
    addQuickNavigationPreset,
    updateQuickNavigationPreset,
    removeQuickNavigationPreset,
    listQuickNavigationPresets,
    createManualDestination,
    updateManualDestination,
    removeManualDestination,
    setNavigationTarget,
  ]);
});
