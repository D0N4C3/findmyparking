import { useParking } from '@/context/ParkingContext';
import { useTheme } from '@/context/ThemeContext';
import { Colors } from '@/constants/colors';
import { 
  Navigation, 
  Layers,
  Crosshair,
  Car,
  Share2,
  Footprints,
  Clock,
  MapPinned,
  X,
  Volume2,
  VolumeX,
  Navigation2
} from 'lucide-react-native';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Share,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline, UrlTile, PROVIDER_DEFAULT } from 'react-native-maps';
import { Component, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { AppButton, SectionHeader, StatTile } from '@/components/ui/primitives';
import { useDialog } from '@/context/DialogContext';
import { DIALOG_COPY } from '@/constants/dialogs';

function getDirectionArrow(bearing: number): string {
  const directions = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];
  const index = Math.round(bearing / 45) % 8;
  return directions[index];
}

function getDirectionLabel(bearing: number): string {
  const labels = ['North', 'Northeast', 'East', 'Southeast', 'South', 'Southwest', 'West', 'Northwest'];
  const index = Math.round(bearing / 45) % 8;
  return labels[index];
}

function formatDistance(meters: number | null): string {
  if (meters === null) return '--';
  if (meters < 1000) return `${meters}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

interface RouteStep {
  instruction: string;
  distance: number;
  maneuver: string;
}

interface MapRenderBoundaryProps {
  colors: typeof Colors.light;
  onRetry: () => void;
  onOpenExternalMaps: () => void;
  onDiagnostics: () => void;
  children: ReactNode;
}

interface MapRenderBoundaryState {
  hasError: boolean;
}

class MapRenderBoundary extends Component<MapRenderBoundaryProps, MapRenderBoundaryState> {
  state: MapRenderBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): MapRenderBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[MapScreen] map-subtree-crash', {
      errorName: error.name,
      errorMessage: error.message,
      componentStack: errorInfo.componentStack,
    });
  }

  render() {
    const { hasError } = this.state;
    const { colors, children, onRetry, onOpenExternalMaps, onDiagnostics } = this.props;

    if (!hasError) {
      return children;
    }

    return (
      <View style={[styles.mapFallbackCard, { backgroundColor: colors.card }]}>
        <Text style={[styles.mapFallbackTitle, { color: colors.text }]}>Map crashed safely</Text>
        <Text style={[styles.mapFallbackSubtitle, { color: colors.textSecondary }]}>
          We could not render the in-app map. You can keep using navigation options below.
        </Text>
        <View style={styles.mapFallbackActions}>
          <AppButton colors={colors} label="Open external maps" onPress={onOpenExternalMaps} variant="primary" />
          <AppButton colors={colors} label="Retry map" onPress={onRetry} variant="secondary" />
          <AppButton colors={colors} label="Diagnostics" onPress={onDiagnostics} variant="ghost" />
        </View>
      </View>
    );
  }
}

function logMapEvent(event: string, details: Record<string, unknown>) {
  console.info('[MapScreenTelemetry]', {
    event,
    screen: 'map',
    ...details,
    timestamp: new Date().toISOString(),
  });
}

export default function MapScreen() {
  const { 
    currentParking, 
    currentLocation,
    getDistanceToCar,
    getDirectionToCar,
    getWalkingTimeToCar
  } = useParking();
  const theme = useTheme();
  const isDark = theme?.isDark ?? false;
  const colors = isDark ? Colors.dark : Colors.light;
  const { showError } = useDialog();
  
  const mapRef = useRef<MapView>(null);
  const [mapType, setMapType] = useState<'standard' | 'satellite'>('standard');
  const [, setHeading] = useState(0);
  const [navigationState, setNavigationState] = useState({
    isActive: false,
    routeSteps: [] as RouteStep[],
    currentStepIndex: 0,
  });
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const slideAnim = useRef(new Animated.Value(100)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const navigationInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const arrivalNotifiedRef = useRef(false);
  const [mapBoundaryKey, setMapBoundaryKey] = useState(0);
  const didLogRenderPath = useRef(false);
  const didLogMount = useRef(false);
  const isNavigating = navigationState.isActive;
  const routeSteps = navigationState.routeSteps;
  const currentStepIndex = navigationState.currentStepIndex;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [slideAnim]);

  useEffect(() => {
    if (isNavigating) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isNavigating, pulseAnim]);

  // Watch heading changes
  useEffect(() => {
    let headingSubscription: Location.LocationSubscription | null = null;

    const startHeadingUpdates = async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') return;

        headingSubscription = await Location.watchHeadingAsync((headingData) => {
          setHeading(headingData.trueHeading ?? headingData.magHeading);
        });
        // Using heading for future compass rotation feature
      } catch (error) {
        console.warn('Heading sensor unavailable; disabling heading updates.', error);
      }
    };

    void startHeadingUpdates();

    return () => {
      if (headingSubscription) {
        headingSubscription.remove();
      }
    };
  }, []);

  const distance = getDistanceToCar();
  const direction = getDirectionToCar();
  const walkingTime = getWalkingTimeToCar();
  const directionArrow = direction !== null ? getDirectionArrow(direction) : '•';
  const directionLabel = direction !== null ? getDirectionLabel(direction) : 'Unknown';

  const handleRecenter = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (currentLocation && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }, 500);
    }
  }, [currentLocation]);

  const handleFocusOnCar = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    if (currentParking && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: currentParking.latitude,
        longitude: currentParking.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }, 500);
    }
  }, [currentParking]);

  const calculateRouteSteps = useCallback((from: Location.LocationObject, to: { latitude: number; longitude: number }): RouteStep[] => {
    const distance = getDistanceToCar() || 0;
    const steps: RouteStep[] = [];
    
    // Generate simple walking directions based on relative position
    const latDiff = to.latitude - from.coords.latitude;
    const lonDiff = to.longitude - from.coords.longitude;
    
    // Determine primary direction
    let primaryDirection = '';
    let secondaryDirection = '';
    
    if (Math.abs(latDiff) > Math.abs(lonDiff)) {
      primaryDirection = latDiff > 0 ? 'Head north' : 'Head south';
      secondaryDirection = lonDiff > 0 ? 'east' : 'west';
    } else {
      primaryDirection = lonDiff > 0 ? 'Head east' : 'Head west';
      secondaryDirection = latDiff > 0 ? 'north' : 'south';
    }
    
    // Create route steps
    steps.push({
      instruction: `${primaryDirection}${Math.abs(latDiff) > 0.0001 && Math.abs(lonDiff) > 0.0001 ? `, then turn ${secondaryDirection}` : ''}`,
      distance: Math.min(50, Math.floor(distance * 0.3)),
      maneuver: 'depart'
    });
    
    if (distance > 100) {
      steps.push({
        instruction: `Continue walking ${secondaryDirection || 'straight'}`,
        distance: Math.floor(distance * 0.4),
        maneuver: 'continue'
      });
    }
    
    steps.push({
      instruction: 'Arrive at your car',
      distance: Math.max(10, Math.floor(distance * 0.3)),
      maneuver: 'arrive'
    });
    
    return steps;
  }, [getDistanceToCar]);

  const startInAppNavigation = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!currentParking || !currentLocation) {
      showError(DIALOG_COPY.prompts.noParkingSaved.title, DIALOG_COPY.prompts.noParkingSaved.message);
      return;
    }

    const steps = calculateRouteSteps(currentLocation, {
      latitude: currentParking.latitude,
      longitude: currentParking.longitude
    });

    arrivalNotifiedRef.current = false;
    setNavigationState({
      isActive: true,
      routeSteps: steps,
      currentStepIndex: 0,
    });

    // Center on user and start following
    if (mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        latitudeDelta: 0.002,
        longitudeDelta: 0.002,
      }, 500);
    }
  }, [calculateRouteSteps, currentLocation, currentParking, showError]);

  const stopNavigation = useCallback(() => {
    arrivalNotifiedRef.current = false;
    setNavigationState({
      isActive: false,
      routeSteps: [],
      currentStepIndex: 0,
    });
    if (navigationInterval.current) {
      clearInterval(navigationInterval.current);
      navigationInterval.current = null;
    }
  }, []);

  const toggleVoice = useCallback(() => {
    setVoiceEnabled(prev => !prev);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  useEffect(() => {
    if (!navigationState.isActive) {
      if (navigationInterval.current) {
        clearInterval(navigationInterval.current);
        navigationInterval.current = null;
      }
      return;
    }

    if (!currentParking || !currentLocation || navigationState.routeSteps.length === 0) {
      stopNavigation();
      return;
    }

    navigationInterval.current = setInterval(() => {
      const dist = getDistanceToCar();
      if (dist === null) return;

      if (dist < 20 && !arrivalNotifiedRef.current) {
        arrivalNotifiedRef.current = true;
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      setNavigationState((prev) => {
        if (!prev.isActive || prev.routeSteps.length === 0) return prev;

        let nextStepIndex = 0;
        if (dist < 20) {
          nextStepIndex = prev.routeSteps.length - 1;
        } else if (prev.routeSteps.length > 2 && dist < prev.routeSteps[0].distance + prev.routeSteps[1].distance) {
          nextStepIndex = 1;
        }

        return nextStepIndex === prev.currentStepIndex
          ? prev
          : { ...prev, currentStepIndex: nextStepIndex };
      });
    }, 3000);

    return () => {
      if (navigationInterval.current) {
        clearInterval(navigationInterval.current);
        navigationInterval.current = null;
      }
    };
  }, [currentLocation, currentParking, getDistanceToCar, navigationState.isActive, navigationState.routeSteps.length, stopNavigation]);

  const handleShareLocation = useCallback(async () => {
    if (!currentParking) {
      showError(DIALOG_COPY.prompts.noParkingSaved.title, DIALOG_COPY.prompts.noParkingSaved.message);
      return;
    }

    try {
      await Share.share({
        message: `I parked my car here: https://maps.google.com/?q=${currentParking.latitude},${currentParking.longitude}`,
        title: 'My Parking Location',
      });
    } catch {
      showError(DIALOG_COPY.errors.shareLocation.title, DIALOG_COPY.errors.shareLocation.message);
    }
  }, [currentParking, showError]);

  const toggleMapType = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMapType(prev => prev === 'standard' ? 'satellite' : 'standard');
  }, []);


  const canRenderUrlTiles = Platform.OS === 'web' && typeof UrlTile !== 'undefined';
  const canRenderMapView = typeof MapView !== 'undefined';
  const canRenderMarkers = typeof Marker !== 'undefined';
  const canRenderPolyline = typeof Polyline !== 'undefined';
  const canRenderAdvancedFeatures = canRenderMapView && canRenderMarkers;

  const mapDiagnostics = useMemo(() => ({
    os: Platform.OS,
    canRenderMapView,
    canRenderMarkers,
    canRenderPolyline,
    canRenderUrlTiles,
    hasCurrentParking: Boolean(currentParking),
    hasCurrentLocation: Boolean(currentLocation),
  }), [canRenderMapView, canRenderMarkers, canRenderPolyline, canRenderUrlTiles, currentLocation, currentParking]);

  useEffect(() => {
    if (!didLogMount.current) {
      didLogMount.current = true;
      logMapEvent('map-screen-mounted', mapDiagnostics);
    }
  }, [mapDiagnostics]);

  useEffect(() => {
    if (!didLogRenderPath.current) {
      didLogRenderPath.current = true;
      logMapEvent('map-first-render-path', {
        ...mapDiagnostics,
        renderPath: canRenderMapView ? 'native-map' : 'fallback-card',
      });
    }
  }, [canRenderMapView, mapDiagnostics]);

  const handleOpenExternalMaps = useCallback(() => {
    const targetLat = currentParking?.latitude ?? currentLocation?.coords.latitude;
    const targetLon = currentParking?.longitude ?? currentLocation?.coords.longitude;
    if (typeof targetLat !== 'number' || typeof targetLon !== 'number') {
      showError('Map unavailable', 'We could not determine a map destination to open.');
      return;
    }
    const label = currentParking ? 'Parked Car' : 'Current Location';
    const mapsUrl = Platform.select({
      ios: `http://maps.apple.com/?ll=${targetLat},${targetLon}&q=${encodeURIComponent(label)}`,
      android: `geo:${targetLat},${targetLon}?q=${targetLat},${targetLon}(${encodeURIComponent(label)})`,
      default: `https://maps.google.com/?q=${targetLat},${targetLon}`,
    });
    if (!mapsUrl) {
      showError('Map unavailable', 'External maps are not supported on this platform.');
      return;
    }
    logMapEvent('open-external-maps', { ...mapDiagnostics, mapsUrl });
    void Linking.openURL(mapsUrl).catch((error: unknown) => {
      console.error('[MapScreen] external-maps-open-failed', { error });
      showError('Unable to open maps', 'Please try again in a moment.');
    });
  }, [currentLocation?.coords.latitude, currentLocation?.coords.longitude, currentParking, mapDiagnostics, showError]);

  const handleRetryMapRender = useCallback(() => {
    logMapEvent('map-retry-requested', mapDiagnostics);
    setMapBoundaryKey(prev => prev + 1);
  }, [mapDiagnostics]);

  const handleMapDiagnostics = useCallback(() => {
    logMapEvent('map-diagnostics', mapDiagnostics);
    showError(
      'Map diagnostics',
      `OS: ${String(mapDiagnostics.os)}\nMapView: ${String(mapDiagnostics.canRenderMapView)}\nMarkers: ${String(mapDiagnostics.canRenderMarkers)}\nPolyline: ${String(mapDiagnostics.canRenderPolyline)}\nUrlTile: ${String(mapDiagnostics.canRenderUrlTiles)}`
    );
  }, [mapDiagnostics, showError]);

  const initialRegion = currentLocation ? {
    latitude: currentLocation.coords.latitude,
    longitude: currentLocation.coords.longitude,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  } : currentParking ? {
    latitude: currentParking.latitude,
    longitude: currentParking.longitude,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  } : {
    latitude: 37.7749,
    longitude: -122.4194,
    latitudeDelta: 0.1,
    longitudeDelta: 0.1,
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <SectionHeader
        colors={colors}
        title="Find Your Car"
        subtitle={distance !== null ? `${formatDistance(distance)} away` : 'Save your parking spot'}
        right={<AppButton colors={colors} onPress={() => { void handleShareLocation(); }} icon={<Share2 size={20} color={colors.text} />} variant="secondary" style={styles.iconButton} />}
        style={[styles.header, { backgroundColor: colors.background }]}
      />

      {/* Map */}
      <View style={styles.mapContainer}>
        <MapRenderBoundary
          key={mapBoundaryKey}
          colors={colors}
          onRetry={handleRetryMapRender}
          onOpenExternalMaps={handleOpenExternalMaps}
          onDiagnostics={handleMapDiagnostics}
        >
          {canRenderMapView ? (
            <MapView
              ref={mapRef}
              style={styles.map}
              provider={PROVIDER_DEFAULT}
              initialRegion={initialRegion}
              showsUserLocation={Platform.OS !== 'web'}
              showsMyLocationButton={false}
              showsCompass={false}
              rotateEnabled={canRenderAdvancedFeatures}
              pitchEnabled={canRenderAdvancedFeatures}
              mapType={mapType}
              customMapStyle={isDark ? darkMapStyle : []}
              onMapReady={() => {
                logMapEvent('map-ready', mapDiagnostics);
              }}
            >
              {canRenderUrlTiles && (
                <UrlTile
                  urlTemplate={colors.mapTile}
                  maximumZ={19}
                  flipY={false}
                />
              )}
              {canRenderMarkers && currentParking && (
                <Marker
                  coordinate={{
                    latitude: currentParking.latitude,
                    longitude: currentParking.longitude,
                  }}
                  title="Your Car"
                  description="Parked here"
                >
                  <View style={[styles.carMarker, { backgroundColor: colors.accent }]}>
                    <Car size={20} color="#FFFFFF" />
                  </View>
                </Marker>
              )}
              {canRenderPolyline && currentParking && currentLocation && (
                <Polyline
                  coordinates={[
                    {
                      latitude: currentLocation.coords.latitude,
                      longitude: currentLocation.coords.longitude,
                    },
                    {
                      latitude: currentParking.latitude,
                      longitude: currentParking.longitude,
                    },
                  ]}
                  strokeColor={colors.accent}
                  strokeWidth={4}
                  lineDashPattern={[8, 6]}
                />
              )}
            </MapView>
          ) : (
            <View style={[styles.webMapFallback, { backgroundColor: colors.surfaceSecondary }]}>
              <Text style={[styles.webMapFallbackTitle, { color: colors.text }]}>Map preview unavailable</Text>
              <Text style={[styles.webMapFallbackSubtitle, { color: colors.textSecondary }]}>
                The current platform does not support map rendering in this build.
              </Text>
            </View>
          )}
        </MapRenderBoundary>

        {/* Map Controls */}
        <View style={styles.mapControls}>
          <AppButton colors={colors} style={[styles.controlButton, { backgroundColor: colors.card }]} onPress={toggleMapType} icon={<Layers size={22} color={colors.text} />} />
          
          <AppButton colors={colors} style={[styles.controlButton, { backgroundColor: colors.card }]} onPress={handleRecenter} icon={<Crosshair size={22} color={colors.text} />} />

          <AppButton colors={colors} style={[styles.controlButton, { backgroundColor: colors.card }]} onPress={handleFocusOnCar} disabled={!currentParking} icon={<Car size={22} color={currentParking ? colors.accent : colors.textMuted} />} />
        </View>

        {/* Full Navigation Overlay */}
        {isNavigating && (
          <Animated.View 
            style={[
              styles.navigationOverlay,
              { backgroundColor: colors.card },
            ]}
          >
            {/* Top Bar */}
            <View style={styles.navTopBar}>
              <View style={styles.navStatus}>
                <Navigation size={20} color={colors.accent} />
                <Text style={[styles.navStatusText, { color: colors.text }]}>
                  Navigating to Car
                </Text>
              </View>
              <TouchableOpacity 
                onPress={stopNavigation}
                style={[styles.closeNavButton, { backgroundColor: colors.error + '15' }]}
              >
                <X size={20} color={colors.error} />
              </TouchableOpacity>
            </View>

            {/* Current Direction Card */}
            <View style={[styles.directionCard, { backgroundColor: colors.surfaceSecondary }]}>
              <LinearGradient
                colors={colors.accentGradient.map(c => c + '25') as [string, string]}
                style={styles.directionIconBg}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={[styles.directionArrow, { color: colors.accent }]}>
                  {directionArrow}
                </Text>
              </LinearGradient>
              <View style={styles.directionTextContainer}>
                <Text style={[styles.directionInstruction, { color: colors.text }]} numberOfLines={2}>
                  {routeSteps[currentStepIndex]?.instruction || 'Continue to your car'}
                </Text>
                <Text style={[styles.directionDistance, { color: colors.accent }]}>
                  {routeSteps[currentStepIndex]?.distance ? `${routeSteps[currentStepIndex].distance}m` : formatDistance(distance)}
                </Text>
              </View>
            </View>

            {/* Progress Bar */}
            <View style={[styles.progressBar, { backgroundColor: colors.surfaceSecondary }]}>
              <View style={[styles.progressFill, { 
                backgroundColor: colors.accent,
                width: `${((currentStepIndex + 1) / Math.max(1, routeSteps.length)) * 100}%`
              }]} />
            </View>

            {/* Bottom Info */}
            <View style={styles.navBottomInfo}>
              <View style={styles.navInfoItem}>
                <Footprints size={16} color={colors.textMuted} />
                <Text style={[styles.navInfoText, { color: colors.textSecondary }]}>
                  {walkingTime !== null ? `${walkingTime} min` : '--'}
                </Text>
              </View>
              <View style={styles.navInfoItem}>
                <Navigation size={16} color={colors.textMuted} />
                <Text style={[styles.navInfoText, { color: colors.textSecondary }]}>
                  {formatDistance(distance)}
                </Text>
              </View>
              <TouchableOpacity 
                style={[styles.voiceButton, { backgroundColor: voiceEnabled ? colors.accent + '20' : colors.surfaceSecondary }]}
                onPress={toggleVoice}
              >
                {voiceEnabled ? (
                  <Volume2 size={18} color={colors.accent} />
                ) : (
                  <VolumeX size={18} color={colors.textMuted} />
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}
      </View>

      {/* Bottom Panel */}
      <Animated.View 
        style={[
          styles.bottomPanel, 
          { 
            backgroundColor: colors.card,
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
        {currentParking ? (
          <>
            {/* Direction Compass */}
            <View style={styles.directionSection}>
              <LinearGradient
                colors={colors.accentGradient.map(c => c + '20') as [string, string]}
                style={styles.compassContainer}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={[styles.compassArrow, { color: colors.accent }]}>
                  {directionArrow}
                </Text>
                <Text style={[styles.compassLabel, { color: colors.textMuted }]}>
                  {directionLabel}
                </Text>
              </LinearGradient>

              <View style={styles.distanceInfo}>
                <Text style={[styles.distanceValue, { color: colors.text }]}>
                  {formatDistance(distance)}
                </Text>
                <Text style={[styles.distanceLabel, { color: colors.textSecondary }]}>
                  to your car
                </Text>
                
                <View style={styles.walkingInfo}>
                  <Footprints size={14} color={colors.textMuted} />
                  <Text style={[styles.walkingTime, { color: colors.textMuted }]}>
                    {walkingTime !== null ? `${walkingTime} min walk` : '--'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Quick Stats */}
            <View style={[styles.quickStats, { backgroundColor: colors.surfaceSecondary }]}>
              <StatTile
                colors={colors}
                icon={<Clock size={16} color={colors.textMuted} />}
                value={currentParking?.timestamp ? new Date(currentParking.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                label="parked at"
              />
            </View>

            {/* Navigate Button */}
            <AppButton colors={colors} variant="primary" onPress={startInAppNavigation} label="Start Navigation" icon={<Navigation2 size={22} color={colors.textOnAccent} />} style={styles.navigateButton} />
          </>
        ) : (
          <View style={styles.emptyState}>
            <LinearGradient
              colors={[colors.surfaceSecondary, colors.surfaceTertiary]}
              style={styles.emptyIconBg}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <MapPinned size={40} color={colors.textMuted} />
            </LinearGradient>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No car parked</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              Save your parking location first to see it on the map
            </Text>
          </View>
        )}
      </Animated.View>
    </SafeAreaView>
  );
}

const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#263c3f' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#6b9a76' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#38414e' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#212a37' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9ca5b3' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#746855' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#1f2835' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#f3d19c' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2f3948' }] },
  { featureType: 'transit.station', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#17263c' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#515c6d' }] },
  { featureType: 'water', elementType: 'labels.text.stroke', stylers: [{ color: '#17263c' }] },
];

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  webMapFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 8,
  },
  webMapFallbackTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  webMapFallbackSubtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  mapFallbackCard: {
    flex: 1,
    borderRadius: 20,
    margin: 16,
    padding: 20,
    justifyContent: 'center',
    gap: 14,
  },
  mapFallbackTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  mapFallbackSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  mapFallbackActions: {
    gap: 10,
  },
  mapControls: {
    position: 'absolute',
    right: 16,
    top: 16,
    gap: 10,
  },
  controlButton: {
    width: 50,
    height: 50,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  carMarker: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  navigationOverlay: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  navTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  navStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  navStatusText: {
    fontSize: 15,
    fontWeight: '700',
  },
  closeNavButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  directionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
    gap: 16,
  },
  directionIconBg: {
    width: 64,
    height: 64,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  directionArrow: {
    fontSize: 32,
    fontWeight: '800',
  },
  directionTextContainer: {
    flex: 1,
  },
  directionInstruction: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
    marginBottom: 4,
  },
  directionDistance: {
    fontSize: 24,
    fontWeight: '800',
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    marginBottom: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  navBottomInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  navInfoText: {
    fontSize: 14,
    fontWeight: '600',
  },
  voiceButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomPanel: {
    padding: 24,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 10,
  },
  directionSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    marginBottom: 20,
  },
  compassContainer: {
    width: 90,
    height: 90,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  compassArrow: {
    fontSize: 42,
    fontWeight: '800',
  },
  compassLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: -4,
  },
  distanceInfo: {
    flex: 1,
  },
  distanceValue: {
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: -1,
  },
  distanceLabel: {
    fontSize: 16,
    marginTop: 2,
  },
  walkingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  walkingTime: {
    fontSize: 14,
    fontWeight: '500',
  },
  quickStats: {
    flexDirection: 'row',
    padding: 14,
    borderRadius: 16,
    marginBottom: 16,
  },
  quickStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quickStatText: {
    fontSize: 13,
    fontWeight: '500',
  },
  navigateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 16,
  },
  navigateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  emptyIconBg: {
    width: 80,
    height: 80,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
});
