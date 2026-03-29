import { ColorTheme } from '@/constants/colors';
import { CarBluetoothDevice, ParkingSpot, ParkingStats } from '@/context/ParkingContext';

export interface HomeViewModel {
  colors: ColorTheme;
  currentParking: ParkingSpot | null;
  hasParkingHistory: boolean;
  lastKnownParkingLabel: string | null;
  isLoading: boolean;
  isAutoDetectionEnabled: boolean;
  savedBluetoothDevice: CarBluetoothDevice | null;
  isTimerActive: boolean;
  timerRemaining: number | null;
  distanceText: string;
  walkingTimeText: string;
  parkedAtText: string;
  parkedAgoText: string;
  noteOrSpotText: string | null;
  locationStatusText: string;
  shouldShowUpdateLocation: boolean;
  parkingStats: ParkingStats;
}
