export type ParkingZoneType = 'street' | 'garage' | 'lot' | 'permit' | 'ev' | 'other';

export interface ParkingZone {
  id: string;
  name: string;
  polygon: Array<{ latitude: number; longitude: number }>;
  offlineTileRegionId?: string;
  zoneType: ParkingZoneType;
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
  createdAt: number;
}
