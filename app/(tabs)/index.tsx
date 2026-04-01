import { Colors } from '@/constants/colors';
import { useParking } from '@/context/ParkingContext';
import { useTheme } from '@/context/ThemeContext';
import { MapPin, Navigation, Car, History, Settings } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Alert,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

function formatDistance(meters: number | null): string {
  if (meters === null) return '--';
  if (meters < 1000) return `${Math.round(meters)}m away`;
  return `${(meters / 1000).toFixed(1)}km away`;
}

function formatWalk(minutes: number | null): string {
  if (minutes === null) return '--';
  return `${minutes} min walk`;
}

function formatParkedAgo(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Parked just now';
  if (mins < 60) return `Parked ${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Parked ${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `Parked ${days} day${days === 1 ? '' : 's'} ago`;
}

export default function HomeScreen() {
  const {
    currentParking,
    getDistanceToCar,
    getWalkingTimeToCar,
    saveParkingLocation,
    setNavigationTarget,
    isLoading,
  } = useParking();
  const theme = useTheme();
  const isDark = theme?.isDark ?? false;
  const colors = isDark ? Colors.dark : Colors.light;
  const router = useRouter();

  const hasParking = !!currentParking;
  const distance = getDistanceToCar();
  const walking = getWalkingTimeToCar();

  const distanceText = useMemo(() => formatDistance(distance), [distance]);
  const walkText = useMemo(() => formatWalk(walking), [walking]);
  const parkedText = currentParking ? formatParkedAgo(currentParking.timestamp) : 'No parking location saved';

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const distanceAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  useEffect(() => {
    distanceAnim.setValue(0);
    Animated.timing(distanceAnim, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [distanceText, distanceAnim]);

  const goToNavigation = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (currentParking) {
      setNavigationTarget({
        kind: 'current-parking',
        label: 'My parked car',
        latitude: currentParking.latitude,
        longitude: currentParking.longitude,
      });
    }
    router.push('/map');
  }, [currentParking, router, setNavigationTarget]);

  const handleParkHere = useCallback(async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await saveParkingLocation();
      Alert.alert('✅ Parking location saved');
    } catch {
      Alert.alert('Could not save parking', 'Please ensure location permission is enabled and try again.');
    }
  }, [saveParkingLocation]);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topSection}>
          <Text style={[styles.headerLabel, { color: colors.textMuted }]}>Your Car</Text>
          <Text style={[styles.headerStatus, { color: colors.textSecondary }]}>{parkedText}</Text>
        </View>

        <Animated.View
          style={[
            styles.mainCard,
            {
              backgroundColor: colors.card,
              shadowColor: colors.shadowStrong,
              opacity: fadeAnim,
              transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
            },
          ]}
        >
          {hasParking ? (
            <>
              <View style={styles.carRow}>
                <Car size={22} color={colors.text} />
                <Text style={[styles.carLabel, { color: colors.text }]}>Your Car</Text>
              </View>

              <Animated.Text
                style={[
                  styles.distance,
                  {
                    color: colors.text,
                    opacity: distanceAnim,
                    transform: [{ translateY: distanceAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
                  },
                ]}
              >
                {distanceText}
              </Animated.Text>

              <Text style={[styles.walkInfo, { color: colors.textSecondary }]}>{walkText}</Text>

              {currentParking?.address ? (
                <Text style={[styles.locationName, { color: colors.textMuted }]} numberOfLines={1}>
                  {currentParking.address}
                </Text>
              ) : null}

              <Pressable
                onPress={goToNavigation}
                style={({ pressed }) => [
                  styles.primaryButton,
                  { backgroundColor: colors.primary, transform: [{ scale: pressed ? 0.98 : 1 }] },
                ]}
              >
                <Navigation size={18} color={colors.textOnAccent} />
                <Text style={[styles.primaryButtonText, { color: colors.textOnAccent }]}>Navigate to Car</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No parking location saved</Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>Save your location in one tap.</Text>
            </>
          )}
        </Animated.View>

        <Pressable
          onPress={() => void handleParkHere()}
          disabled={isLoading}
          style={({ pressed }) => [
            styles.secondaryButton,
            { borderColor: colors.primary, backgroundColor: colors.surface, transform: [{ scale: pressed ? 0.98 : 1 }], opacity: isLoading ? 0.6 : 1 },
          ]}
        >
          <MapPin size={18} color={colors.primary} />
          <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>{isLoading ? 'Saving...' : 'Park Here'}</Text>
        </Pressable>

        {hasParking ? (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={goToNavigation}
            style={[styles.mapCard, { backgroundColor: colors.card, shadowColor: colors.shadow }]}
          >
            <View style={[styles.mapPreview, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}> 
              <View style={[styles.previewMarker, styles.userMarker, { backgroundColor: colors.accent }]} />
              <View style={[styles.routeLine, { backgroundColor: colors.textMuted }]} />
              <View style={[styles.previewMarker, styles.carMarker, { backgroundColor: colors.success }]} />
              <Text style={[styles.markerText, styles.userMarkerText, { color: colors.textMuted }]}>You</Text>
              <Text style={[styles.markerText, styles.carMarkerText, { color: colors.textMuted }]}>Car</Text>
            </View>
          </TouchableOpacity>
        ) : null}

        {hasParking ? (
          <View style={styles.quickInfoRow}>
            <Text style={[styles.quickInfoText, { color: colors.textSecondary }]}>🕒 {parkedText.replace('Parked ', '')}</Text>
            <Text style={[styles.quickInfoText, { color: colors.textSecondary }]}>📍 {distanceText.replace(' away', '')}</Text>
          </View>
        ) : null}

        <View style={styles.bottomRow}>
          <Pressable onPress={() => router.push('/history')} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }, styles.bottomAction]}>
            <History size={16} color={colors.textMuted} />
            <Text style={[styles.bottomActionText, { color: colors.textMuted }]}>History</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/settings')} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }, styles.bottomAction]}>
            <Settings size={16} color={colors.textMuted} />
            <Text style={[styles.bottomActionText, { color: colors.textMuted }]}>Settings</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: {
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 16,
  },
  topSection: {
    gap: 4,
  },
  headerLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  headerStatus: {
    fontSize: 13,
  },
  mainCard: {
    borderRadius: 20,
    padding: 20,
    gap: 10,
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  carRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  carLabel: {
    fontSize: 20,
    fontWeight: '700',
  },
  distance: {
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  walkInfo: {
    fontSize: 16,
    fontWeight: '500',
  },
  locationName: {
    fontSize: 14,
    marginBottom: 6,
  },
  primaryButton: {
    marginTop: 8,
    width: '100%',
    minHeight: 54,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    borderWidth: 1,
    minHeight: 50,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  emptySubtitle: {
    fontSize: 14,
  },
  mapCard: {
    borderRadius: 16,
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  mapPreview: {
    borderRadius: 16,
    borderWidth: 1,
    height: 132,
    position: 'relative',
    overflow: 'hidden',
  },
  previewMarker: {
    width: 14,
    height: 14,
    borderRadius: 999,
    position: 'absolute',
  },
  userMarker: { left: 24, top: 58 },
  carMarker: { right: 24, top: 30 },
  routeLine: {
    position: 'absolute',
    left: 38,
    right: 38,
    top: 52,
    height: 2,
    opacity: 0.5,
  },
  markerText: {
    position: 'absolute',
    fontSize: 11,
    fontWeight: '600',
  },
  userMarkerText: { left: 18, top: 76 },
  carMarkerText: { right: 18, top: 48 },
  quickInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  quickInfoText: {
    fontSize: 13,
    fontWeight: '500',
  },
  bottomRow: {
    marginTop: 8,
    flexDirection: 'row',
    gap: 18,
  },
  bottomAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bottomActionText: {
    fontSize: 13,
    fontWeight: '500',
  },
});
