import { useMemo } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Linking, ScrollView } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, CalendarDays, Car, Clock3, MapPin, Navigation } from 'lucide-react-native';
import Constants from 'expo-constants';
import { useParking } from '@/context/ParkingContext';
import { useTheme } from '@/context/ThemeContext';
import { Colors } from '@/constants/colors';

function formatDateTime(timestamp: number) {
  return new Date(timestamp).toLocaleString([], {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatElapsed(timestamp: number) {
  const diff = Date.now() - timestamp;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h ago`;
  if (hours > 0) return `${hours}h ago`;
  return 'Less than 1h ago';
}

function hasGoogleMapsKey() {
  const android =
    Constants.expoConfig?.android?.config?.googleMaps?.apiKey ??
    Constants.manifest2?.extra?.expoClient?.android?.config?.googleMaps?.apiKey ??
    process.env.EXPO_PUBLIC_GOOGLE_ANDROID_GEO_API_KEY;
  const ios =
    Constants.expoConfig?.ios?.config?.googleMapsApiKey ??
    Constants.manifest2?.extra?.expoClient?.ios?.config?.googleMapsApiKey ??
    process.env.EXPO_PUBLIC_GOOGLE_IOS_GEO_API_KEY;

  return Platform.OS === 'android' ? Boolean(android) : Boolean(ios);
}

export default function ParkingHistoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { currentParking, parkingHistory } = useParking();
  const theme = useTheme();
  const isDark = theme?.isDark ?? false;
  const colors = isDark ? Colors.dark : Colors.light;
  const router = useRouter();

  const spot = useMemo(
    () => [currentParking, ...parkingHistory].filter(Boolean).find((entry) => entry?.id === id),
    [currentParking, parkingHistory, id],
  );

  const isActiveParking = currentParking?.id === spot?.id;
  const shouldUseGoogleProvider = Platform.OS === 'android' || (Platform.OS === 'ios' && Constants.appOwnership !== 'expo' && hasGoogleMapsKey());

  const openExternalMaps = () => {
    if (!spot) return;
    const label = encodeURIComponent('Saved Parking Spot');
    const url = Platform.select({
      ios: `maps:0,0?q=${spot.latitude},${spot.longitude}(${label})`,
      android: `geo:${spot.latitude},${spot.longitude}?q=${spot.latitude},${spot.longitude}(${label})`,
      default: `https://www.google.com/maps/search/?api=1&query=${spot.latitude},${spot.longitude}`,
    });
    if (url) void Linking.openURL(url);
  };

  if (!spot) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.missingState}>
          <Text style={[styles.missingTitle, { color: colors.text }]}>Parking entry not found</Text>
          <TouchableOpacity style={[styles.backButton, { backgroundColor: colors.surfaceSecondary }]} onPress={() => router.back()}>
            <Text style={[styles.backButtonText, { color: colors.text }]}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.topRow}>
          <TouchableOpacity style={[styles.iconButton, { backgroundColor: colors.surfaceSecondary }]} onPress={() => router.back()}>
            <ArrowLeft size={18} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.screenTitle, { color: colors.text }]}>Parking Details</Text>
          <View style={styles.placeholder} />
        </View>

        <LinearGradient colors={[colors.accent + '26', colors.surfaceSecondary]} style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <Car size={18} color={colors.accent} />
            <Text style={[styles.heroTitle, { color: colors.text }]}>
              {isActiveParking ? 'Current Active Parking' : 'Past Parking Session'}
            </Text>
          </View>
          <Text style={[styles.heroAddress, { color: colors.text }]}>{spot.address || 'Saved Location'}</Text>
          <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
            {formatDateTime(spot.timestamp)}
          </Text>
        </LinearGradient>

        <View style={[styles.mapCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <MapView
            style={styles.map}
            provider={shouldUseGoogleProvider ? PROVIDER_GOOGLE : undefined}
            initialRegion={{
              latitude: spot.latitude,
              longitude: spot.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
            scrollEnabled={false}
            zoomEnabled={false}
            rotateEnabled={false}
            pitchEnabled={false}
          >
            <Marker coordinate={{ latitude: spot.latitude, longitude: spot.longitude }} title="Saved parking location" />
          </MapView>
        </View>

        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <CalendarDays size={16} color={colors.accent} />
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Saved</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>{formatDateTime(spot.timestamp)}</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Clock3 size={16} color={colors.accent} />
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Age</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>{formatElapsed(spot.timestamp)}</Text>
          </View>
        </View>

        <View style={[styles.detailsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.detailRow}>
            <MapPin size={14} color={colors.textMuted} />
            <Text style={[styles.detailText, { color: colors.textSecondary }]}>
              {spot.latitude.toFixed(6)}, {spot.longitude.toFixed(6)}
            </Text>
          </View>
          {spot.spotNumber ? (
            <Text style={[styles.detailText, { color: colors.text }]}>Spot: {spot.spotNumber}</Text>
          ) : null}
          {spot.level ? <Text style={[styles.detailText, { color: colors.text }]}>Level: {spot.level}</Text> : null}
          {spot.notes ? <Text style={[styles.detailText, { color: colors.text }]}>Notes: {spot.notes}</Text> : null}
        </View>

        <TouchableOpacity style={[styles.ctaButton, { backgroundColor: colors.accent }]} onPress={openExternalMaps}>
          <Navigation size={16} color="#FFFFFF" />
          <Text style={styles.ctaText}>Open in Maps</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 36, gap: 14 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconButton: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  screenTitle: { fontSize: 20, fontWeight: '700' },
  placeholder: { width: 40 },
  heroCard: { borderRadius: 20, padding: 16, gap: 6 },
  heroHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroTitle: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  heroAddress: { fontSize: 22, fontWeight: '800' },
  heroSubtitle: { fontSize: 14, fontWeight: '500' },
  mapCard: { borderRadius: 18, overflow: 'hidden', borderWidth: 1 },
  map: { height: 240 },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 12, gap: 6 },
  statLabel: { fontSize: 12, fontWeight: '600' },
  statValue: { fontSize: 13, fontWeight: '700' },
  detailsCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 10 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailText: { fontSize: 14, fontWeight: '500' },
  ctaButton: {
    borderRadius: 14,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  ctaText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  missingState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 12 },
  missingTitle: { fontSize: 20, fontWeight: '700' },
  backButton: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  backButtonText: { fontSize: 14, fontWeight: '700' },
});
