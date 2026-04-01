import { useParking } from '@/context/ParkingContext';
import { useTheme } from '@/context/ThemeContext';
import { Colors } from '@/constants/colors';
import { useDialog } from '@/context/DialogContext';
import { DIALOG_COPY } from '@/constants/dialogs';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Platform,
  Linking,
  Share,
  ActivityIndicator,
  useWindowDimensions,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import type * as Location from 'expo-location';
import {
  Car,
  Crosshair,
  Layers,
  Navigation,
  Route,
  Share2,
  MapPinned,
  LocateFixed,
  Timer,
  XCircle,
  Pin,
  EyeOff,
  Eye,
  Flashlight,
  Ellipsis,
  Volume2,
  Vibrate,
} from 'lucide-react-native';

type RouteStep = {
  instruction: string;
  distance: number;
};

type RouteMode = 'osrm' | 'direct';
type RouteErrorKind = 'network_timeout' | 'no_route' | 'api_error';

type RouteMeta = {
  mode: RouteMode;
  totalDistance: number | null;
  etaMinutes: number | null;
};

type Coordinates = {
  latitude: number;
  longitude: number;
};

type SheetState = 'hidden' | 'collapsed' | 'expanded';

const DEFAULT_REGION = {
  latitude: 37.7749,
  longitude: -122.4194,
  latitudeDelta: 0.07,
  longitudeDelta: 0.07,
};

const CANONICAL_ANDROID_KEY = 'EXPO_PUBLIC_GOOGLE_ANDROID_GEO_API_KEY';
const CANONICAL_IOS_KEY = 'EXPO_PUBLIC_GOOGLE_IOS_GEO_API_KEY';

function formatDistance(meters: number | null): string {
  if (meters == null) return '--';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatEta(minutes: number | null): string {
  if (minutes == null) return '--';
  return `${Math.max(1, Math.round(minutes))} min`;
}

function distanceBetween(a: Coordinates, b: Coordinates): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return earthRadius * c;
}

function calculateBearing(from: Coordinates, to: Coordinates): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const toDegrees = (radians: number) => (radians * 180) / Math.PI;
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);
  const dLon = toRadians(to.longitude - from.longitude);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
}

function getSimpleDirectionCue(relativeBearing: number): string {
  const normalized = ((relativeBearing + 540) % 360) - 180;
  const abs = Math.abs(normalized);
  if (abs <= 20) return '⬆️ Walk straight';
  if (abs <= 50) return normalized < 0 ? '↖ Slight left' : '↗ Slight right';
  if (abs <= 120) return normalized < 0 ? '⬅️ Turn left' : '➡️ Turn right';
  return '↩️ Turn around';
}

function decodePolyline(encoded: string): Coordinates[] {
  const points: Coordinates[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }

  return points;
}

function getGoogleKeys() {
  const android =
    Constants.expoConfig?.android?.config?.googleMaps?.apiKey ??
    Constants.manifest2?.extra?.expoClient?.android?.config?.googleMaps?.apiKey ??
    process.env.EXPO_PUBLIC_GOOGLE_ANDROID_GEO_API_KEY;

  const ios =
    Constants.expoConfig?.ios?.config?.googleMapsApiKey ??
    Constants.manifest2?.extra?.expoClient?.ios?.config?.googleMapsApiKey ??
    process.env.EXPO_PUBLIC_GOOGLE_IOS_GEO_API_KEY;

  return {
    androidDetected: Boolean(android),
    iosDetected: Boolean(ios),
  };
}

export default function MapScreen() {
  const {
    currentParking,
    currentLocation,
    getDistanceToCar,
    getWalkingTimeToCar,
    saveParkingLocation,
    addQuickNavigationPreset,
    endParkingSession,
    quickNavigationPresets,
    offlineParkingZones,
    manualDestination,
    navigationTarget,
    createManualDestination,
    updateManualDestination,
    removeManualDestination,
    setNavigationTarget,
  } = useParking();
  const { showError, showDestructive } = useDialog();
  const theme = useTheme();
  const isDark = theme?.isDark ?? false;
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { height: viewportHeight } = useWindowDimensions();
  const mapRef = useRef<MapView>(null);
  const [mapType, setMapType] = useState<'standard' | 'satellite'>('standard');
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [navigationSteps, setNavigationSteps] = useState<RouteStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [routeCoordinates, setRouteCoordinates] = useState<Coordinates[]>([]);
  const [routeMeta, setRouteMeta] = useState<RouteMeta>({ mode: 'osrm', totalDistance: null, etaMinutes: null });
  const [isPinDropMode, setIsPinDropMode] = useState(false);
  const [sheetState, setSheetState] = useState<SheetState>('expanded');
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [voiceGuidanceEnabled, setVoiceGuidanceEnabled] = useState(false);
  const [flashlightEnabled, setFlashlightEnabled] = useState(false);
  const [hasArrived, setHasArrived] = useState(false);
  const [lastProximityHint, setLastProximityHint] = useState<string | null>(null);

  const distance = getDistanceToCar();
  const walkingTime = getWalkingTimeToCar();
  const keys = getGoogleKeys();
  const isExpoGo = Constants.appOwnership === 'expo';

  const shouldUseGoogleProvider =
    Platform.OS === 'android'
      ? !isExpoGo && keys.androidDetected
      : Platform.OS === 'ios'
        ? !isExpoGo && keys.iosDetected
        : false;

  const needsMapSetup =
    Platform.OS === 'android'
      ? !keys.androidDetected && !isExpoGo
      : Platform.OS === 'ios'
        ? !keys.iosDetected && !isExpoGo
        : false;

  const initialRegion = useMemo(() => {
    if (currentLocation) {
      return {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
    }

    if (currentParking) {
      return {
        latitude: currentParking.latitude,
        longitude: currentParking.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
    }

    return DEFAULT_REGION;
  }, [currentLocation, currentParking]);

  const focusUser = useCallback(() => {
    if (!currentLocation || !mapRef.current) return;
    void Haptics.selectionAsync();
    mapRef.current.animateToRegion(
      {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        latitudeDelta: 0.006,
        longitudeDelta: 0.006,
      },
      300,
    );
  }, [currentLocation]);

  const focusCar = useCallback(() => {
    if (!currentParking || !mapRef.current) return;
    void Haptics.selectionAsync();
    mapRef.current.animateToRegion(
      {
        latitude: currentParking.latitude,
        longitude: currentParking.longitude,
        latitudeDelta: 0.006,
        longitudeDelta: 0.006,
      },
      300,
    );
  }, [currentParking]);

  const fetchRoute = useCallback(async (from: Location.LocationObject, to: Coordinates) => {
    const endpoint = `https://router.project-osrm.org/route/v1/walking/${from.coords.longitude},${from.coords.latitude};${to.longitude},${to.latitude}?overview=full&geometries=polyline&steps=true`;
    const maxAttempts = 3;
    const requestTimeoutMs = 7000;
    const backoffMs = [350, 900];
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);

      try {
        const response = await fetch(endpoint, { signal: controller.signal });
        if (!response.ok) {
          throw { kind: 'api_error' as const, status: response.status, message: `Route API error ${response.status}` };
        }

        const payload = await response.json();
        if (payload?.code === 'NoRoute') {
          throw { kind: 'no_route' as const, message: 'No walkable route available' };
        }

        const route = payload?.routes?.[0];
        if (!route?.geometry) {
          throw { kind: 'api_error' as const, message: 'Route payload missing geometry' };
        }

        const coordinates = decodePolyline(route.geometry);
        const steps = (route.legs?.[0]?.steps ?? []).map(
          (step: { distance?: number; maneuver?: { type?: string; modifier?: string; instruction?: string }; name?: string }) => ({
            instruction:
              step.maneuver?.instruction ??
              [step.maneuver?.type ?? 'Continue', step.maneuver?.modifier, step.name].filter(Boolean).join(' '),
            distance: Math.max(1, Math.round(step.distance ?? 0)),
          }),
        );

        return {
          coordinates,
          steps:
            steps.length > 0
              ? steps
              : [{ instruction: 'Continue to your parked car', distance: Math.max(1, Math.round(route.distance ?? 0)) }],
          totalDistance: Math.max(1, Math.round(route.distance ?? 0)),
          etaMinutes: route.duration ? Math.max(1, Math.round(route.duration / 60)) : null,
        };
      } catch (error) {
        const isAbortError = typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError';
        const typedError =
          isAbortError || error instanceof TypeError
            ? { kind: 'network_timeout' as const, message: 'Network timeout while fetching route' }
            : error;
        lastError = typedError;
        const kind = (typedError as { kind?: RouteErrorKind })?.kind;
        const shouldRetry = attempt < maxAttempts && kind === 'network_timeout';
        if (!shouldRetry) throw typedError;
        await new Promise((resolve) => setTimeout(resolve, backoffMs[attempt - 1] ?? backoffMs[backoffMs.length - 1]));
      } finally {
        clearTimeout(timeoutId);
      }
    }

    throw lastError;
  }, []);

  const resolvedNavigationTarget = useMemo(() => {
    if (navigationTarget) return navigationTarget;
    if (!currentParking) return null;
    return {
      kind: 'current-parking' as const,
      latitude: currentParking.latitude,
      longitude: currentParking.longitude,
      label: 'My parked car',
    };
  }, [currentParking, navigationTarget]);
  const activeTargetSource = resolvedNavigationTarget?.kind === 'manual-pin' ? 'Manual Pin' : 'Car';
  const liveDistanceMeters = useMemo(() => {
    if (!currentLocation || !resolvedNavigationTarget) return null;
    return Math.round(
      distanceBetween(
        { latitude: currentLocation.coords.latitude, longitude: currentLocation.coords.longitude },
        { latitude: resolvedNavigationTarget.latitude, longitude: resolvedNavigationTarget.longitude },
      ),
    );
  }, [currentLocation, resolvedNavigationTarget]);
  const liveEtaMinutes = useMemo(() => {
    if (liveDistanceMeters == null) return walkingTime;
    return Math.max(1, Math.round(liveDistanceMeters / 75));
  }, [liveDistanceMeters, walkingTime]);
  const heading = currentLocation?.coords.heading ?? null;
  const directionCue = useMemo(() => {
    if (!currentLocation || !resolvedNavigationTarget) return '⬆️ Start navigation';
    const bearing = calculateBearing(
      { latitude: currentLocation.coords.latitude, longitude: currentLocation.coords.longitude },
      { latitude: resolvedNavigationTarget.latitude, longitude: resolvedNavigationTarget.longitude },
    );
    if (heading == null || heading < 0) return '⬆️ Walk toward your car';
    return getSimpleDirectionCue(bearing - heading);
  }, [currentLocation, heading, resolvedNavigationTarget]);
  const gpsAccuracyText = useMemo(() => {
    const accuracy = currentLocation?.coords.accuracy;
    if (accuracy == null) return '📶 Accuracy: Unknown';
    if (accuracy <= 12) return '📶 Accuracy: High';
    if (accuracy <= 30) return '📶 Accuracy: Medium';
    return '📶 Low GPS accuracy — move slightly';
  }, [currentLocation?.coords.accuracy]);

  const buildNavigation = useCallback(async () => {
    if (!resolvedNavigationTarget) {
      showError(DIALOG_COPY.prompts.noParkingSaved.title, DIALOG_COPY.prompts.noParkingSaved.message);
      return;
    }

    if (!currentLocation) {
      showError(DIALOG_COPY.prompts.locationUnavailableForNavigation.title, DIALOG_COPY.prompts.locationUnavailableForNavigation.message);
      return;
    }

    setIsLoadingRoute(true);
    console.info('[MapScreen] navigation_build_started', {
      target: resolvedNavigationTarget,
    });

    try {
      const next = await fetchRoute(currentLocation, {
        latitude: resolvedNavigationTarget.latitude,
        longitude: resolvedNavigationTarget.longitude,
      });

      setRouteCoordinates(next.coordinates);
      setNavigationSteps(next.steps);
      setCurrentStepIndex(0);
      setRouteMeta({
        mode: 'osrm',
        totalDistance: next.totalDistance,
        etaMinutes: next.etaMinutes,
      });
      console.info('[MapScreen] navigation_build_success', {
        mode: 'osrm',
        steps: next.steps.length,
        totalDistance: next.totalDistance,
        etaMinutes: next.etaMinutes,
      });
      mapRef.current?.fitToCoordinates(next.coordinates, {
        edgePadding: { top: 140, right: 80, bottom: 320, left: 80 },
        animated: true,
      });
    } catch (error) {
      const errorKind = (error as { kind?: RouteErrorKind })?.kind ?? 'api_error';
      const fallbackDistance = Math.max(
        1,
        Math.round(
          distanceBetween(
            { latitude: currentLocation.coords.latitude, longitude: currentLocation.coords.longitude },
            { latitude: resolvedNavigationTarget.latitude, longitude: resolvedNavigationTarget.longitude },
          ),
        ),
      );
      setRouteCoordinates([
        { latitude: currentLocation.coords.latitude, longitude: currentLocation.coords.longitude },
        { latitude: resolvedNavigationTarget.latitude, longitude: resolvedNavigationTarget.longitude },
      ]);
      setNavigationSteps([{ instruction: 'Continue straight to your parked car', distance: fallbackDistance }]);
      setCurrentStepIndex(0);
      setRouteMeta({
        mode: 'direct',
        totalDistance: fallbackDistance,
        etaMinutes: walkingTime ?? null,
      });
      if (errorKind === 'network_timeout') {
        showError('Routing timed out', 'Network timeout while building route. Direct guidance mode is active.');
      } else if (errorKind === 'no_route') {
        showError('No walking route found', 'No route path available here. Direct guidance mode is active.');
      } else {
        showError('Live routing unavailable', 'Routing API error detected. Direct guidance mode is active.');
      }
      console.warn('[MapScreen] navigation_build_fallback', {
        reason: errorKind,
        fallbackDistance,
        error,
      });
    } finally {
      setIsLoadingRoute(false);
    }
  }, [resolvedNavigationTarget, currentLocation, fetchRoute, showError, walkingTime]);

  const saveManualAsQuickDestination = useCallback(async () => {
    if (!manualDestination) return;
    await addQuickNavigationPreset({
      label: manualDestination.label,
      destination: {
        latitude: manualDestination.latitude,
        longitude: manualDestination.longitude,
      },
      mode: 'walking',
    });
  }, [addQuickNavigationPreset, manualDestination]);

  const applyManualAsParkingTarget = useCallback(async () => {
    if (!manualDestination) return;
    await saveParkingLocation({
      latitude: manualDestination.latitude,
      longitude: manualDestination.longitude,
    });
    setNavigationTarget(null);
  }, [manualDestination, saveParkingLocation, setNavigationTarget]);

  const openExternalMaps = useCallback(() => {
    const target = resolvedNavigationTarget
      ? { latitude: resolvedNavigationTarget.latitude, longitude: resolvedNavigationTarget.longitude, label: resolvedNavigationTarget.label }
      : currentLocation
        ? { latitude: currentLocation.coords.latitude, longitude: currentLocation.coords.longitude, label: 'Current Location' }
        : null;

    if (!target) {
      showError('No destination available', 'Save parking or enable location to open maps.');
      return;
    }

    const mapsUrl = Platform.select({
      ios: `http://maps.apple.com/?dirflg=w&daddr=${target.latitude},${target.longitude}&q=${encodeURIComponent(target.label)}`,
      android: `google.navigation:q=${target.latitude},${target.longitude}&mode=w`,
      default: `https://maps.google.com/?daddr=${target.latitude},${target.longitude}&travelmode=walking`,
    });

    if (!mapsUrl) return;

    void Linking.openURL(mapsUrl).catch(() => {
      showError('Unable to open maps', 'Please try again.');
    });
  }, [currentLocation, resolvedNavigationTarget, showError]);

  const shareParking = useCallback(async () => {
    if (!currentParking) {
      showError(DIALOG_COPY.prompts.noParkingSaved.title, DIALOG_COPY.prompts.noParkingSaved.message);
      return;
    }

    try {
      await Share.share({
        title: 'My parking location',
        message: `I parked here: https://maps.google.com/?q=${currentParking.latitude},${currentParking.longitude}`,
      });
    } catch {
      showError(DIALOG_COPY.errors.shareLocation.title, DIALOG_COPY.errors.shareLocation.message);
    }
  }, [currentParking, showError]);

  const handleEndSession = useCallback(() => {
    if (!currentParking) return;

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    showDestructive({
      title: 'End parking session?',
      message: 'Your active parking location will be archived in history.',
      confirmLabel: 'End Session',
      onConfirm: () => {
        void endParkingSession();
        setNavigationSteps([]);
        setRouteCoordinates([]);
        setCurrentStepIndex(0);
        setRouteMeta({ mode: 'osrm', totalDistance: null, etaMinutes: null });
      },
    });
  }, [currentParking, endParkingSession, showDestructive]);

  const safeStepIndex = navigationSteps.length > 0 ? Math.min(currentStepIndex, navigationSteps.length - 1) : 0;
  const activeStep = navigationSteps[safeStepIndex];
  const nextStep = navigationSteps[safeStepIndex + 1];
  const remainingDistance = useMemo(
    () => navigationSteps.slice(safeStepIndex).reduce((sum, step) => sum + step.distance, 0),
    [navigationSteps, safeStepIndex],
  );
  const isSmallScreen = viewportHeight < 740;
  const sheetContentMaxHeight = Math.round(viewportHeight * (isSmallScreen ? 0.7 : 0.62));
  const sheetBottomOffset = tabBarHeight;
  const sheetSafeBottomPadding = Math.max(insets.bottom, 12);
  const isSheetHidden = sheetState === 'hidden';
  const isSheetCollapsed = sheetState === 'collapsed';
  const isSheetExpanded = sheetState === 'expanded';
  const proximityMessage =
    hasArrived
      ? '🎉 Your car is nearby!'
      : liveDistanceMeters != null && liveDistanceMeters <= 20
        ? 'Car marker pulsing — almost there'
        : liveDistanceMeters != null && liveDistanceMeters <= 50
          ? "You're getting close 👀"
          : null;
  const cycleSheetState = useCallback(() => {
    setSheetState((prev) => (prev === 'hidden' ? 'collapsed' : prev === 'collapsed' ? 'expanded' : 'collapsed'));
  }, []);

  useEffect(() => {
    if (liveDistanceMeters == null) {
      setHasArrived(false);
      setLastProximityHint(null);
      return;
    }
    if (liveDistanceMeters <= 15 && !hasArrived) {
      setHasArrived(true);
      setLastProximityHint('🎉 Your car is nearby!');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    }
    if (liveDistanceMeters <= 20 && lastProximityHint !== 'close') {
      setLastProximityHint('close');
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      return;
    }
    if (liveDistanceMeters <= 50 && lastProximityHint !== 'near') {
      setLastProximityHint('near');
    }
  }, [hasArrived, lastProximityHint, liveDistanceMeters]);

  useEffect(() => {
    if (!mapRef.current || liveDistanceMeters == null || !currentLocation) return;
    const zoomDelta = liveDistanceMeters > 300 ? 0.02 : liveDistanceMeters > 120 ? 0.01 : 0.005;
    mapRef.current.animateToRegion(
      {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        latitudeDelta: zoomDelta,
        longitudeDelta: zoomDelta,
      },
      450,
    );
  }, [currentLocation, liveDistanceMeters]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        provider={shouldUseGoogleProvider ? PROVIDER_GOOGLE : undefined}
        mapType={mapType}
        showsUserLocation={Platform.OS !== 'web'}
        showsMyLocationButton={false}
        toolbarEnabled={false}
        onPress={(event) => {
          if (!isPinDropMode) return;
          const coordinate = event.nativeEvent.coordinate;
          const nextTarget = {
            kind: 'manual-pin',
            destinationId: manualDestination?.id ?? `manual-${Date.now()}`,
            latitude: coordinate.latitude,
            longitude: coordinate.longitude,
            label: 'Manual pin',
          } as const;
          if (manualDestination) {
            void updateManualDestination({
              latitude: coordinate.latitude,
              longitude: coordinate.longitude,
              label: 'Manual pin',
            });
          } else {
            void createManualDestination({
              latitude: coordinate.latitude,
              longitude: coordinate.longitude,
              label: 'Manual pin',
            });
          }
          setNavigationTarget(nextTarget);
          setIsPinDropMode(false);
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }}
      >
        {currentParking && (
          <Marker coordinate={{ latitude: currentParking.latitude, longitude: currentParking.longitude }} title="Your car" description="Saved parking location">
            <View style={[styles.carPin, liveDistanceMeters != null && liveDistanceMeters <= 20 ? styles.carPinPulse : null, { backgroundColor: '#facc15' }]}>
              <Car size={14} color="#fff" />
            </View>
          </Marker>
        )}

        {routeCoordinates.length > 1 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor={colors.accent}
            strokeWidth={5}
            lineCap="round"
            lineJoin="round"
          />
        )}

        {manualDestination && (
          <Marker coordinate={{ latitude: manualDestination.latitude, longitude: manualDestination.longitude }} title="Manual pin" description="Custom navigation target">
            <View style={[styles.manualPin, { backgroundColor: colors.warning }]}>
              <Pin size={14} color="#fff" />
            </View>
          </Marker>
        )}
      </MapView>

      <View style={[styles.mapOverlay, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerRow}>
          <View style={styles.infoCard}>
            <Text style={styles.infoCardTitle}>🚗 Your Car</Text>
            <Text style={styles.infoCardStat}>
              Distance: {formatDistance(liveDistanceMeters ?? distance)} · ETA: {formatEta(liveEtaMinutes)}
            </Text>
            {proximityMessage ? <Text style={styles.proximityHint}>{proximityMessage}</Text> : null}
            <Text style={styles.accuracyHint}>{gpsAccuracyText}</Text>
          </View>

          <TouchableOpacity style={styles.iconAction} onPress={() => void shareParking()}>
            <Share2 size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.directionCard}>
          <Text style={styles.directionCue}>{directionCue}</Text>
        </View>

        <View style={styles.fabStack}>
          <TouchableOpacity style={styles.fab} onPress={() => setMapType((prev) => (prev === 'standard' ? 'satellite' : 'standard'))}>
            <Layers size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.fab} onPress={focusUser}>
            <Crosshair size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.fab} onPress={focusCar} disabled={!currentParking}>
            <Car size={20} color={currentParking ? '#fff' : 'rgba(255,255,255,0.45)'} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.fab, isPinDropMode ? styles.fabActive : null]}
            onPress={() => setIsPinDropMode((prev) => !prev)}
          >
            <Pin size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {needsMapSetup && (
          <View style={[styles.setupCard, { backgroundColor: colors.card, borderColor: colors.border }]}> 
            <Text style={[styles.setupTitle, { color: colors.text }]}>Google Maps setup required</Text>
            <Text style={[styles.setupBody, { color: colors.textSecondary }]}>Set the platform key, rebuild, and reopen this tab.</Text>
            <Text style={[styles.setupBody, { color: colors.textSecondary }]}>Android key ({CANONICAL_ANDROID_KEY}): {keys.androidDetected ? 'Detected' : 'Missing'}</Text>
            <Text style={[styles.setupBody, { color: colors.textSecondary }]}>iOS key ({CANONICAL_IOS_KEY}): {keys.iosDetected ? 'Detected' : 'Missing'}</Text>
          </View>
        )}
      </View>

      <View style={[styles.actionBar, { bottom: tabBarHeight + 18, backgroundColor: colors.cardElevated ?? colors.card, borderColor: colors.border }]}>
        <TouchableOpacity style={[styles.actionPill, { backgroundColor: colors.accent }]} onPress={() => void buildNavigation()} disabled={isLoadingRoute || !resolvedNavigationTarget}>
          {isLoadingRoute ? <ActivityIndicator size="small" color={colors.textOnAccent} /> : <Route size={16} color={colors.textOnAccent} />}
          <Text style={[styles.actionPillLabel, { color: colors.textOnAccent }]}>{isLoadingRoute ? 'Building...' : 'Start Navigation'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionPill, { backgroundColor: colors.surfaceSecondary }]}
          onPress={() => {
            setFlashlightEnabled((prev) => !prev);
            Alert.alert('Flashlight', 'Flashlight control can be connected to native torch permissions in production builds.');
          }}
        >
          <Flashlight size={16} color={colors.text} />
          <Text style={[styles.actionPillLabel, { color: colors.text }]}>{flashlightEnabled ? 'Flashlight On' : 'Flashlight'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionIcon, { backgroundColor: colors.surfaceSecondary }]} onPress={() => setIsMoreMenuOpen((prev) => !prev)}>
          <Ellipsis size={18} color={colors.text} />
        </TouchableOpacity>
      </View>

      {isMoreMenuOpen && (
        <View style={[styles.moreMenu, { bottom: tabBarHeight + 80, backgroundColor: colors.cardElevated ?? colors.card, borderColor: colors.border }]}>
          <TouchableOpacity style={styles.moreMenuItem} onPress={() => setVoiceGuidanceEnabled((prev) => !prev)}>
            <Volume2 size={15} color={colors.text} />
            <Text style={[styles.moreMenuText, { color: colors.text }]}>{voiceGuidanceEnabled ? 'Voice ON' : 'Voice OFF'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.moreMenuItem} onPress={() => void shareParking()}>
            <Share2 size={15} color={colors.text} />
            <Text style={[styles.moreMenuText, { color: colors.text }]}>Share location</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.moreMenuItem} onPress={openExternalMaps}>
            <Navigation size={15} color={colors.text} />
            <Text style={[styles.moreMenuText, { color: colors.text }]}>Open in Google Maps</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.moreMenuItem} onPress={() => void Haptics.selectionAsync()}>
            <Vibrate size={15} color={colors.text} />
            <Text style={[styles.moreMenuText, { color: colors.text }]}>Haptic check</Text>
          </TouchableOpacity>
        </View>
      )}

      <View pointerEvents={isSheetHidden ? 'box-none' : 'auto'} style={styles.sheetContainer}>
        <Pressable
          style={[styles.sheetToggle, { backgroundColor: colors.card, bottom: sheetBottomOffset + 10 }]}
          onPress={() => setSheetState((prev) => (prev === 'hidden' ? 'collapsed' : 'hidden'))}
        >
          {isSheetHidden ? <Eye size={16} color={colors.text} /> : <EyeOff size={16} color={colors.text} />}
          <Text style={[styles.sheetToggleLabel, { color: colors.text }]}>
            {isSheetHidden ? 'Show controls' : 'Hide controls'}
          </Text>
        </Pressable>

        {!isSheetHidden && (
          <View
            style={[
              styles.bottomSheet,
              {
                backgroundColor: colors.card,
                borderTopColor: colors.border,
                bottom: sheetBottomOffset,
                maxHeight: sheetContentMaxHeight,
              },
            ]}
          >
            <Pressable style={styles.dragHandleWrap} onPress={cycleSheetState}>
              <View style={[styles.dragHandle, { backgroundColor: colors.textMuted }]} />
              <Text style={[styles.dragHandleLabel, { color: colors.textSecondary }]}>
                {isSheetExpanded ? 'Tap to collapse' : 'Tap to expand'}
              </Text>
            </Pressable>

            <View
              style={[
                styles.sheetBody,
                {
                  paddingBottom: sheetSafeBottomPadding,
                },
              ]}
            >
              <View style={styles.metricsRow}>
                <View style={[styles.metricCard, { backgroundColor: colors.surfaceSecondary }]}>
                  <LocateFixed size={16} color={colors.accent} />
                  <Text style={[styles.metricValue, { color: colors.text }]}>{formatDistance(distance)}</Text>
                  <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Distance</Text>
                </View>

                <View style={[styles.metricCard, { backgroundColor: colors.surfaceSecondary }]}>
                  <Timer size={16} color={colors.accent} />
                  <Text style={[styles.metricValue, { color: colors.text }]}>{walkingTime != null ? `${walkingTime} min` : '--'}</Text>
                  <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Walk ETA</Text>
                </View>

                <View style={[styles.metricCard, { backgroundColor: colors.surfaceSecondary }]}>
                  <MapPinned size={16} color={colors.accent} />
                  <Text style={[styles.metricValue, { color: colors.text }]} numberOfLines={1}>{currentParking?.address ? 'Saved' : 'No pin'}</Text>
                  <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Parking</Text>
                </View>
              </View>

              {isSheetCollapsed ? (
                <TouchableOpacity style={[styles.expandButton, { backgroundColor: colors.surfaceSecondary }]} onPress={cycleSheetState}>
                  <Text style={[styles.expandButtonLabel, { color: colors.text }]}>Show full actions</Text>
                </TouchableOpacity>
              ) : (
                <ScrollView
                  style={styles.expandedScroll}
                  contentContainerStyle={styles.expandedContent}
                  showsVerticalScrollIndicator={false}
                >
                  {(routeMeta.totalDistance != null || routeMeta.etaMinutes != null) && (
                    <View style={styles.chipsRow}>
                      <View style={[styles.metaChip, { backgroundColor: colors.surfaceSecondary }]}>
                        <Text style={[styles.metaChipLabel, { color: colors.textSecondary }]}>Route</Text>
                        <Text style={[styles.metaChipValue, { color: colors.text }]}>
                          {routeMeta.mode === 'osrm' ? 'OSRM walk route' : 'Direct guidance'}
                        </Text>
                      </View>
                    <View style={[styles.metaChip, { backgroundColor: colors.surfaceSecondary }]}>
                      <Text style={[styles.metaChipLabel, { color: colors.textSecondary }]}>Target Source</Text>
                      <Text style={[styles.metaChipValue, { color: colors.text }]}>{activeTargetSource}</Text>
                    </View>
                    <View style={[styles.metaChip, { backgroundColor: colors.surfaceSecondary }]}>
                        <Text style={[styles.metaChipLabel, { color: colors.textSecondary }]}>Distance</Text>
                        <Text style={[styles.metaChipValue, { color: colors.text }]}>{formatDistance(routeMeta.totalDistance)}</Text>
                      </View>
                      <View style={[styles.metaChip, { backgroundColor: colors.surfaceSecondary }]}>
                        <Text style={[styles.metaChipLabel, { color: colors.textSecondary }]}>ETA</Text>
                        <Text style={[styles.metaChipValue, { color: colors.text }]}>{formatEta(routeMeta.etaMinutes)}</Text>
                      </View>
                    </View>
                  )}

                  {activeStep && (
                    <View style={[styles.stepCard, { backgroundColor: colors.surfaceSecondary }]}> 
                      <Route size={16} color={colors.accent} />
                      <View style={styles.stepTextWrap}>
                        <Text style={[styles.stepProgressLabel, { color: colors.textSecondary }]}>
                          Step {safeStepIndex + 1} of {navigationSteps.length}
                        </Text>
                        <Text style={[styles.stepTitle, { color: colors.text }]} numberOfLines={2}>{activeStep.instruction}</Text>
                        <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
                          {formatDistance(activeStep.distance)} now • {formatDistance(remainingDistance)} remaining
                        </Text>
                        {nextStep ? (
                          <Text style={[styles.stepUpcoming, { color: colors.textSecondary }]} numberOfLines={2}>
                            Next: {nextStep.instruction} ({formatDistance(nextStep.distance)})
                          </Text>
                        ) : (
                          <Text style={[styles.stepUpcoming, { color: colors.textSecondary }]} numberOfLines={1}>
                            Final segment to your car
                          </Text>
                        )}
                      </View>
                      <TouchableOpacity
                        style={[styles.stepAdvance, { backgroundColor: colors.accent }]}
                        onPress={() => setCurrentStepIndex((prev) => Math.min(prev + 1, navigationSteps.length - 1))}
                        disabled={safeStepIndex >= navigationSteps.length - 1}
                      >
                        <Text style={[styles.stepAdvanceLabel, { color: colors.textOnAccent }]}>Next</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  <View style={styles.actionsRow}>
                    <TouchableOpacity style={[styles.secondaryAction, { backgroundColor: colors.surfaceSecondary }]} onPress={openExternalMaps}>
                      <Navigation size={17} color={colors.text} />
                      <Text style={[styles.secondaryActionLabel, { color: colors.text }]}>Open Maps</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.primaryAction, { backgroundColor: colors.accent }]} onPress={() => void buildNavigation()} disabled={isLoadingRoute || !resolvedNavigationTarget}>
                      {isLoadingRoute ? (
                        <ActivityIndicator size="small" color={colors.textOnAccent} />
                      ) : (
                        <Route size={18} color={colors.textOnAccent} />
                      )}
                      <Text style={[styles.primaryActionLabel, { color: colors.textOnAccent }]}>{isLoadingRoute ? 'Building...' : 'Start Walk Route'}</Text>
                    </TouchableOpacity>
                  </View>
                  {manualDestination && (
                    <View style={styles.targetList}>
                      <TouchableOpacity style={[styles.secondaryAction, { backgroundColor: colors.surfaceSecondary }]} onPress={() => void saveManualAsQuickDestination()}>
                        <MapPinned size={16} color={colors.text} />
                        <Text style={[styles.secondaryActionLabel, { color: colors.text }]}>Set as quick destination</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.secondaryAction, { backgroundColor: colors.surfaceSecondary }]} onPress={() => void applyManualAsParkingTarget()}>
                        <Car size={16} color={colors.text} />
                        <Text style={[styles.secondaryActionLabel, { color: colors.text }]}>Use as parking target</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.secondaryAction, { backgroundColor: colors.surfaceSecondary }]} onPress={() => void removeManualDestination()}>
                        <XCircle size={16} color={colors.error} />
                        <Text style={[styles.secondaryActionLabel, { color: colors.error }]}>Clear pin</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  <View style={styles.targetList}>
                    {quickNavigationPresets.slice(0, 2).map((preset) => (
                      <TouchableOpacity
                        key={preset.id}
                        style={[styles.targetChip, { backgroundColor: colors.surfaceSecondary }]}
                        onPress={() =>
                          setNavigationTarget({
                            kind: 'quick-preset',
                            presetId: preset.id,
                            latitude: preset.destination.latitude,
                            longitude: preset.destination.longitude,
                            label: preset.label,
                          })
                        }
                      >
                        <Text style={[styles.targetChipText, { color: colors.text }]} numberOfLines={1}>Preset: {preset.label}</Text>
                      </TouchableOpacity>
                    ))}
                    {offlineParkingZones.slice(0, 2).map((zone) => (
                      <TouchableOpacity
                        key={zone.id}
                        style={[styles.targetChip, { backgroundColor: colors.surfaceSecondary }]}
                        onPress={() =>
                          setNavigationTarget({
                            kind: 'offline-zone',
                            zoneId: zone.id,
                            latitude: zone.center.latitude,
                            longitude: zone.center.longitude,
                            label: zone.name,
                          })
                        }
                      >
                        <Text style={[styles.targetChipText, { color: colors.text }]} numberOfLines={1}>Zone: {zone.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <TouchableOpacity
                    style={[styles.endSessionAction, { backgroundColor: colors.surfaceSecondary }]}
                    onPress={handleEndSession}
                    disabled={!currentParking}
                  >
                    <XCircle size={17} color={currentParking ? colors.error : colors.textMuted} />
                    <Text style={[styles.endSessionLabel, { color: currentParking ? colors.error : colors.textMuted }]}>End Session</Text>
                  </TouchableOpacity>
                </ScrollView>
              )}
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  mapOverlay: {
    ...StyleSheet.absoluteFillObject,
    paddingHorizontal: 16,
    justifyContent: 'space-between',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  infoCard: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 16,
    backgroundColor: 'rgba(17,24,39,0.72)',
    maxWidth: '86%',
  },
  infoCardTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  infoCardStat: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.92)',
    fontSize: 13,
    fontWeight: '600',
  },
  accuracyHint: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    fontWeight: '500',
  },
  proximityHint: {
    marginTop: 5,
    color: '#d1fae5',
    fontSize: 12,
    fontWeight: '700',
  },
  directionCard: {
    alignSelf: 'center',
    marginBottom: 172,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  directionCue: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '800',
  },
  iconAction: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.34)',
  },
  fabStack: {
    position: 'absolute',
    right: 14,
    top: 124,
    gap: 10,
  },
  fab: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.36)',
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 6,
  },
  fabActive: {
    backgroundColor: 'rgba(59,130,246,0.65)',
  },
  carPin: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: '#fff',
    borderWidth: 2,
  },
  carPinPulse: {
    shadowColor: '#facc15',
    shadowOpacity: 0.7,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  manualPin: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: '#fff',
    borderWidth: 2,
  },
  setupCard: {
    position: 'absolute',
    left: 14,
    right: 14,
    top: 118,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  setupTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  setupBody: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 17,
  },
  sheetContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    pointerEvents: 'box-none',
  },
  actionBar: {
    position: 'absolute',
    left: 14,
    right: 14,
    borderRadius: 18,
    borderWidth: 1,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionPill: {
    minHeight: 42,
    borderRadius: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  actionPillLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  actionIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 'auto',
  },
  moreMenu: {
    position: 'absolute',
    right: 14,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 8,
    minWidth: 180,
    gap: 2,
  },
  moreMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  moreMenuText: {
    fontSize: 13,
    fontWeight: '600',
  },
  sheetToggle: {
    alignSelf: 'center',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  sheetToggleLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  bottomSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  dragHandleWrap: {
    alignItems: 'center',
    paddingTop: 4,
    paddingBottom: 6,
  },
  dragHandleLabel: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '600',
  },
  dragHandle: {
    width: 44,
    height: 5,
    borderRadius: 999,
    opacity: 0.8,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  sheetBody: {
    gap: 12,
  },
  expandedScroll: {
    maxHeight: '100%',
  },
  expandedContent: {
    gap: 12,
  },
  expandButton: {
    marginTop: 2,
    borderRadius: 10,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandButtonLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  metricCard: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 4,
  },
  metricValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  stepCard: {
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  metaChip: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 2,
  },
  metaChipLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  metaChipValue: {
    fontSize: 12,
    fontWeight: '700',
  },
  stepTextWrap: {
    flex: 1,
  },
  stepProgressLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  stepSubtitle: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '500',
  },
  stepUpcoming: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: '500',
  },
  stepAdvance: {
    minWidth: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    alignSelf: 'stretch',
  },
  stepAdvanceLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  targetList: {
    gap: 8,
  },
  targetChip: {
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  targetChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  secondaryAction: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryActionLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  primaryAction: {
    flex: 1.25,
    minHeight: 46,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryActionLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  endSessionAction: {
    minHeight: 44,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  endSessionLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
});
