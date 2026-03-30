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
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { useCallback, useMemo, useRef, useState } from 'react';
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
} from 'lucide-react-native';

type RouteStep = {
  instruction: string;
  distance: number;
};

type Coordinates = {
  latitude: number;
  longitude: number;
};

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
  const { currentParking, currentLocation, getDistanceToCar, getWalkingTimeToCar, endParkingSession } = useParking();
  const { showError, showDestructive } = useDialog();
  const theme = useTheme();
  const isDark = theme?.isDark ?? false;
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const mapRef = useRef<MapView>(null);
  const [mapType, setMapType] = useState<'standard' | 'satellite'>('standard');
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [navigationSteps, setNavigationSteps] = useState<RouteStep[]>([]);
  const [routeCoordinates, setRouteCoordinates] = useState<Coordinates[]>([]);
  const [manualPin, setManualPin] = useState<Coordinates | null>(null);
  const [isPinDropMode, setIsPinDropMode] = useState(false);
  const [isSheetHidden, setIsSheetHidden] = useState(false);

  const distance = getDistanceToCar();
  const walkingTime = getWalkingTimeToCar();
  const keys = getGoogleKeys();
  const isExpoGo = Constants.appOwnership === 'expo';

  const shouldUseGoogleProvider =
    Platform.OS === 'android' || (Platform.OS === 'ios' && !isExpoGo && keys.iosDetected);

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
    const response = await fetch(endpoint);
    if (!response.ok) throw new Error(`Route API error ${response.status}`);
    const payload = await response.json();

    const route = payload?.routes?.[0];
    if (!route?.geometry) throw new Error('Route payload missing geometry');

    const coordinates = decodePolyline(route.geometry);
    const steps = (route.legs?.[0]?.steps ?? []).map((step: { distance?: number; maneuver?: { type?: string; modifier?: string } }) => ({
      instruction: `${step.maneuver?.type ?? 'Continue'}${step.maneuver?.modifier ? ` ${step.maneuver.modifier}` : ''}`,
      distance: Math.max(1, Math.round(step.distance ?? 0)),
    }));

    return {
      coordinates,
      steps: steps.length > 0 ? steps : [{ instruction: 'Continue to your parked car', distance: Math.max(1, Math.round(route.distance ?? 0)) }],
    };
  }, []);

  const navigationTarget = useMemo(
    () =>
      manualPin ??
      (currentParking
        ? { latitude: currentParking.latitude, longitude: currentParking.longitude }
        : null),
    [currentParking, manualPin],
  );

  const buildNavigation = useCallback(async () => {
    if (!navigationTarget) {
      showError(DIALOG_COPY.prompts.noParkingSaved.title, DIALOG_COPY.prompts.noParkingSaved.message);
      return;
    }

    if (!currentLocation) {
      showError(DIALOG_COPY.prompts.locationUnavailableForNavigation.title, DIALOG_COPY.prompts.locationUnavailableForNavigation.message);
      return;
    }

    setIsLoadingRoute(true);

    try {
      const next = await fetchRoute(currentLocation, {
        latitude: navigationTarget.latitude,
        longitude: navigationTarget.longitude,
      });

      setRouteCoordinates(next.coordinates);
      setNavigationSteps(next.steps);
      mapRef.current?.fitToCoordinates(next.coordinates, {
        edgePadding: { top: 140, right: 80, bottom: 320, left: 80 },
        animated: true,
      });
    } catch (error) {
      setRouteCoordinates([
        { latitude: currentLocation.coords.latitude, longitude: currentLocation.coords.longitude },
        { latitude: navigationTarget.latitude, longitude: navigationTarget.longitude },
      ]);
      setNavigationSteps([{ instruction: 'Continue straight to your parked car', distance: Math.max(1, Math.round(getDistanceToCar() ?? 0)) }]);
      showError('Live routing unavailable', 'Using direct guidance line right now.');
      console.warn('[MapScreen] route fallback', error);
    } finally {
      setIsLoadingRoute(false);
    }
  }, [navigationTarget, currentLocation, fetchRoute, getDistanceToCar, showError]);

  const openExternalMaps = useCallback(() => {
    const target = navigationTarget
      ? { latitude: navigationTarget.latitude, longitude: navigationTarget.longitude, label: manualPin ? 'Manual Pin' : 'Parked Car' }
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
  }, [currentLocation, manualPin, navigationTarget, showError]);

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
      },
    });
  }, [currentParking, endParkingSession, showDestructive]);

  const firstStep = navigationSteps[0];

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
          setManualPin({ latitude: coordinate.latitude, longitude: coordinate.longitude });
          setIsPinDropMode(false);
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }}
      >
        {currentParking && (
          <Marker coordinate={{ latitude: currentParking.latitude, longitude: currentParking.longitude }} title="Your car" description="Saved parking location">
            <View style={[styles.carPin, { backgroundColor: colors.accent }]}>
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

        {manualPin && (
          <Marker coordinate={manualPin} title="Manual pin" description="Custom navigation target">
            <View style={[styles.manualPin, { backgroundColor: colors.warning }]}>
              <Pin size={14} color="#fff" />
            </View>
          </Marker>
        )}
      </MapView>

      <View style={[styles.mapOverlay, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.title, { color: '#fff' }]}>Navigate to car</Text>
            <Text style={[styles.subtitle, { color: 'rgba(255,255,255,0.82)' }]}>Premium walk-first guidance</Text>
          </View>

          <TouchableOpacity style={styles.iconAction} onPress={() => void shareParking()}>
            <Share2 size={18} color="#fff" />
          </TouchableOpacity>
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

      <View pointerEvents={isSheetHidden ? 'box-none' : 'auto'} style={styles.sheetContainer}>
        <Pressable
          style={[styles.sheetToggle, { backgroundColor: colors.card, bottom: tabBarHeight + Math.max(insets.bottom, 10) }]}
          onPress={() => setIsSheetHidden((prev) => !prev)}
        >
          {isSheetHidden ? <Eye size={16} color={colors.text} /> : <EyeOff size={16} color={colors.text} />}
          <Text style={[styles.sheetToggleLabel, { color: colors.text }]}>{isSheetHidden ? 'Show controls' : 'Hide controls'}</Text>
        </Pressable>

        {!isSheetHidden && (
          <View
            style={[
              styles.bottomSheet,
              {
                backgroundColor: colors.card,
                borderTopColor: colors.border,
                paddingBottom: tabBarHeight + Math.max(insets.bottom, 12),
              },
            ]}
          >
            <View style={styles.dragHandleWrap}>
              <View style={[styles.dragHandle, { backgroundColor: colors.textMuted }]} />
            </View>

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

        {firstStep && (
          <View style={[styles.stepCard, { backgroundColor: colors.surfaceSecondary }]}> 
            <Route size={16} color={colors.accent} />
            <View style={styles.stepTextWrap}>
              <Text style={[styles.stepTitle, { color: colors.text }]} numberOfLines={2}>{firstStep.instruction}</Text>
              <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>{formatDistance(firstStep.distance)} to next point</Text>
            </View>
          </View>
        )}

        <View style={styles.actionsRow}>
          <TouchableOpacity style={[styles.secondaryAction, { backgroundColor: colors.surfaceSecondary }]} onPress={openExternalMaps}>
            <Navigation size={17} color={colors.text} />
            <Text style={[styles.secondaryActionLabel, { color: colors.text }]}>Open Maps</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.primaryAction, { backgroundColor: colors.accent }]} onPress={() => void buildNavigation()} disabled={isLoadingRoute || !navigationTarget}>
            {isLoadingRoute ? (
              <ActivityIndicator size="small" color={colors.textOnAccent} />
            ) : (
              <Route size={18} color={colors.textOnAccent} />
            )}
            <Text style={[styles.primaryActionLabel, { color: colors.textOnAccent }]}>{isLoadingRoute ? 'Building...' : 'Start Walk Route'}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.endSessionAction, { backgroundColor: colors.surfaceSecondary }]}
          onPress={handleEndSession}
          disabled={!currentParking}
        >
          <XCircle size={17} color={currentParking ? colors.error : colors.textMuted} />
          <Text style={[styles.endSessionLabel, { color: currentParking ? colors.error : colors.textMuted }]}>End Session</Text>
        </TouchableOpacity>
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
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 3,
    fontSize: 15,
    fontWeight: '600',
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
    bottom: 0,
    borderTopWidth: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 12,
    minHeight: 300,
    maxHeight: '56%',
  },
  dragHandleWrap: {
    alignItems: 'center',
    paddingTop: 4,
    paddingBottom: 6,
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
  stepTextWrap: {
    flex: 1,
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
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
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
