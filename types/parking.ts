export type ParkingZoneType = 'street' | 'garage' | 'lot' | 'permit' | 'ev' | 'other';
export type OfflineZoneCacheStatus = 'not_cached' | 'cached' | 'stale';

export interface ParkingZone {
  id: string;
  name: string;
  polygon: Array<{ latitude: number; longitude: number }>;
  center: { latitude: number; longitude: number };
  offlineTileRegionId?: string;
  zoneType: ParkingZoneType;
  cacheStatus: OfflineZoneCacheStatus;
  source: 'manual' | 'imported';
  createdAt: number;
  updatedAt: number;
}

export interface FavoritePlace {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  notes?: string;
  createdAt: number;
}

export interface QuickNavigationPreset {
  id: string;
  label: string;
  destination: {
    latitude: number;
    longitude: number;
  };
  mode: 'walking' | 'driving';
  sourceZoneId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ManualDestination {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  createdAt: number;
  updatedAt: number;
}

export type NavigationTargetEntity =
  | {
      kind: 'current-parking';
      latitude: number;
      longitude: number;
      label: string;
    }
  | {
      kind: 'quick-preset';
      presetId: string;
      latitude: number;
      longitude: number;
      label: string;
    }
  | {
      kind: 'offline-zone';
      zoneId: string;
      latitude: number;
      longitude: number;
      label: string;
    }
  | {
      kind: 'manual-pin';
      destinationId: string;
      latitude: number;
      longitude: number;
      label: string;
    };
