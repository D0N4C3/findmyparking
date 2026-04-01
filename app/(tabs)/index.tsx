import { Colors } from '@/constants/colors';
import { useDialog } from '@/context/DialogContext';
import { useParking } from '@/context/ParkingContext';
import { useTheme } from '@/context/ThemeContext';
import { Camera, CircleDashed, Layers, MapPin, NotebookPen } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

function formatDistance(meters: number | null): string {
  if (meters === null) return '--';
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

function formatWalk(minutes: number | null): string {
  if (minutes === null) return '--';
  return `${minutes} min walk`;
}

function formatParkedAgo(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getDirectionHint(bearing: number | null): string {
  if (bearing === null) return 'Keep straight';
  if (bearing < 30 || bearing >= 330) return '↑ Straight ahead';
  if (bearing < 80) return '↗ Slight right';
  if (bearing < 120) return '→ Turn right';
  if (bearing < 170) return '↘ Back-right';
  if (bearing < 210) return '↓ Turn around';
  if (bearing < 260) return '↙ Back-left';
  if (bearing < 300) return '← Turn left';
  return '↖ Slight left';
}

export default function HomeScreen() {
  const {
    currentParking,
    getDistanceToCar,
    getDirectionToCar,
    getWalkingTimeToCar,
    saveParkingLocation,
    updateParkingSpot,
    setNavigationTarget,
    isLoading,
  } = useParking();
  const theme = useTheme();
  const isDark = theme?.isDark ?? false;
  const colors = isDark ? Colors.dark : Colors.light;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showError, showInfo } = useDialog();

  const [isSaveSheetVisible, setSaveSheetVisible] = useState(false);
  const [isDetailModalVisible, setDetailModalVisible] = useState(false);
  const [levelInput, setLevelInput] = useState('');
  const [spotInput, setSpotInput] = useState('');
  const [notesInput, setNotesInput] = useState('');
  const [photoUri, setPhotoUri] = useState<string | undefined>(undefined);

  const hasParking = !!currentParking;
  const distance = getDistanceToCar();
  const direction = getDirectionToCar();
  const walking = getWalkingTimeToCar();

  const distanceValueText = useMemo(() => formatDistance(distance), [distance]);
  const walkText = useMemo(() => formatWalk(walking), [walking]);
  const parkedText = currentParking ? formatParkedAgo(currentParking.timestamp) : 'No parking location saved';
  const directionHint = useMemo(() => getDirectionHint(direction), [direction]);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const contentRiseAnim = useRef(new Animated.Value(10)).current;
  const livePulse = useRef(new Animated.Value(0.2)).current;
  const movingDot = useRef(new Animated.Value(0.2)).current;
  const animatedDistance = useRef(new Animated.Value(distance ?? 0)).current;
  const [animatedDistanceText, setAnimatedDistanceText] = useState(distanceValueText);
  const previousProgressRef = useRef(0.2);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.timing(contentRiseAnim, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      }),
    ]).start();
  }, [contentRiseAnim, fadeAnim]);

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(livePulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(livePulse, { toValue: 0.2, duration: 900, useNativeDriver: true }),
      ])
    );

    pulseLoop.start();

    return () => {
      pulseLoop.stop();
    };
  }, [livePulse]);

  useEffect(() => {
    const listener = animatedDistance.addListener(({ value }) => {
      setAnimatedDistanceText(formatDistance(value));
    });

    return () => {
      animatedDistance.removeListener(listener);
    };
  }, [animatedDistance]);

  useEffect(() => {
    Animated.timing(animatedDistance, {
      toValue: distance ?? 0,
      duration: 260,
      useNativeDriver: false,
    }).start();
  }, [animatedDistance, distance]);

  useEffect(() => {
    if (!hasParking) return;
    const safeDistance = distance ?? 200;
    const clamped = Math.min(Math.max(safeDistance, 10), 200);
    const progress = 0.2 + ((200 - clamped) / 190) * 0.7;

    if (Math.abs(progress - previousProgressRef.current) < 0.05) return;
    previousProgressRef.current = progress;

    Animated.timing(movingDot, {
      toValue: progress,
      duration: 450,
      useNativeDriver: true,
    }).start();
  }, [distance, hasParking, movingDot]);

  useEffect(() => {
    setLevelInput(currentParking?.level ?? '');
    setSpotInput(currentParking?.spotNumber ?? '');
    setNotesInput(currentParking?.notes ?? '');
    setPhotoUri(currentParking?.photoUrl);
  }, [currentParking]);

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

  const pickPhoto = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showError('Permission needed', 'Please allow photo library access to attach a parking photo.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      setPhotoUri(result.assets[0].uri);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [showError]);

  const saveDetails = useCallback(async () => {
    try {
      if (currentParking) {
        await updateParkingSpot(currentParking.id, {
          level: levelInput.trim() || undefined,
          spotNumber: spotInput.trim() || undefined,
          notes: notesInput.trim() || undefined,
          photoUrl: photoUri,
        });
      } else {
        await saveParkingLocation({
          level: levelInput.trim() || undefined,
          spotNumber: spotInput.trim() || undefined,
          notes: notesInput.trim() || undefined,
          photoUrl: photoUri,
        });
      }

      setDetailModalVisible(false);
      setSaveSheetVisible(false);
      showInfo('✅ Parking saved', 'Don’t worry, I’ll remember this for you.');
    } catch {
      showError('Could not save details', 'Please try again.');
    }
  }, [currentParking, levelInput, notesInput, photoUri, saveParkingLocation, showError, showInfo, spotInput, updateParkingSpot]);

  const saveOnlyLocation = useCallback(async () => {
    try {
      await saveParkingLocation();
      setSaveSheetVisible(false);
      showInfo('✅ Parking saved', 'Don’t worry, I’ll remember this for you.');
    } catch {
      showError('Could not save parking', 'Please ensure location permission is enabled and try again.');
    }
  }, [saveParkingLocation, showError, showInfo]);

  const openDetailsEditor = useCallback(() => {
    setSaveSheetVisible(false);
    setDetailModalVisible(true);
  }, []);

  const parkingDetails = [currentParking?.level ? `Level ${currentParking.level}` : '', currentParking?.spotNumber ? `Spot ${currentParking.spotNumber}` : '', currentParking?.notes ? currentParking.notes : '']
    .filter(Boolean)
    .join(' • ');

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 128, 148) }]} showsVerticalScrollIndicator={false}>
        <View style={styles.brandRow}>
          <Text style={styles.brandText}>
            <Text style={{ color: '#FFFFFF' }}>Car</Text>
            <Text style={{ color: colors.accent }}>Ping</Text>
          </Text>
        </View>

        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: contentRiseAnim }] }}>
          <LinearGradient colors={isDark ? ['#1A2740', '#0E1729'] : ['#FAFCFF', '#ECF3FF']} style={[styles.mainCard, { borderColor: isDark ? 'rgba(148,163,184,0.18)' : 'rgba(37,99,235,0.12)' }]}>
            <View style={styles.mainTopRow}>
              <View style={styles.liveRow}>
                <Text style={[styles.carLabel, { color: colors.text }]}>🚗 Your Car</Text>
                <Animated.View style={[styles.liveDot, { backgroundColor: colors.success, opacity: livePulse, transform: [{ scale: livePulse }] }]} />
                <Text style={[styles.liveText, { color: colors.textMuted }]}>Live</Text>
              </View>
            </View>

            {hasParking ? (
              <>
                <View style={styles.mainInfoRow}>
                  <Text style={[styles.distanceValue, { color: colors.text }]}>{animatedDistanceText}</Text>
                  <Text style={[styles.directionHint, { color: colors.text }]}>{directionHint}</Text>
                </View>
                <Text style={[styles.microContext, { color: colors.textSecondary }]}>{walkText} • {currentParking?.address || '2V4J+XF7'}</Text>
                <Text style={[styles.subtleStatus, { color: colors.textMuted }]}>{parkedText}</Text>

                <Pressable
                  onPress={goToNavigation}
                  style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.primary, transform: [{ scale: pressed ? 0.97 : 1 }] }]}
                >
                  <Text style={[styles.primaryButtonText, { color: colors.textOnAccent }]}>Navigate</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>No parking location saved</Text>
                <Text style={[styles.microContext, { color: colors.textSecondary }]}>Save your location and add details so you can find your exact spot fast.</Text>
              </>
            )}
          </LinearGradient>
        </Animated.View>

        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: contentRiseAnim }] }}>
        <View style={[styles.detailsCard, { backgroundColor: colors.card, borderColor: colors.border }]}> 
          <Text style={[styles.detailsTitle, { color: colors.text }]}>Parking Details</Text>
          {parkingDetails ? (
            <Text style={[styles.detailsText, { color: colors.textSecondary }]}>{parkingDetails}</Text>
          ) : (
            <>
              <Pressable onPress={() => setDetailModalVisible(true)} style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
                <Text style={[styles.addDetailsCta, { color: colors.primary }]}>Add level, spot, or note</Text>
              </Pressable>
              <View style={styles.detailsIconsRow}>
                <Layers size={15} color={colors.textMuted} />
                <NotebookPen size={15} color={colors.textMuted} />
                <Camera size={15} color={colors.textMuted} />
              </View>
            </>
          )}
        </View>
        </Animated.View>

        {hasParking ? (
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: contentRiseAnim }] }}>
          <View style={[styles.navPreviewCard, { backgroundColor: colors.card, borderColor: colors.border }]}> 
            <Text style={[styles.previewTitle, { color: colors.text }]}>Mini Navigation Preview</Text>
            <View style={styles.previewLane}>
              <Text style={[styles.previewLabel, { color: colors.textMuted }]}>You</Text>
              <View style={[styles.previewLine, { backgroundColor: colors.textMuted }]}>
                <Animated.View
                  style={[
                    styles.movingDot,
                    {
                      backgroundColor: colors.accent,
                      transform: [{ translateX: movingDot.interpolate({ inputRange: [0, 1], outputRange: [0, 220] }) }],
                    },
                  ]}
                />
              </View>
              <Text style={[styles.previewLabel, { color: colors.textMuted }]}>Car</Text>
            </View>
            <Text style={[styles.previewSubtitle, { color: colors.textMuted }]}>You → Car</Text>
          </View>
          </Animated.View>
        ) : null}

        <Pressable
          onPress={() => setSaveSheetVisible(true)}
          disabled={isLoading}
          style={({ pressed }) => [
            styles.saveButton,
            {
              backgroundColor: colors.primary,
              transform: [{ scale: pressed ? 0.97 : 1 }],
              opacity: isLoading ? 0.6 : 1,
            },
          ]}
        >
          <MapPin size={18} color={colors.textOnAccent} />
          <Text style={[styles.saveButtonText, { color: colors.textOnAccent }]}>{isLoading ? 'Saving...' : 'Save Parking'}</Text>
        </Pressable>

        {hasParking ? (
          <View style={[styles.confidenceCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
            <Text style={[styles.confidenceText, { color: colors.textSecondary }]}>✔ Location saved accurately</Text>
            <Text style={[styles.confidenceText, { color: colors.textSecondary }]}>📶 GPS strong</Text>
            <Text style={[styles.confidenceText, { color: colors.textSecondary }]}>🚶 You walked away {parkedText}</Text>
          </View>
        ) : (
          <View style={[styles.emptyIdeasCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.emptyIdeasHeader}>
              <CircleDashed size={14} color={colors.accent} />
              <Text style={[styles.emptyIdeasTitle, { color: colors.text }]}>Make your next save smarter</Text>
            </View>
            <Text style={[styles.emptyIdeasItem, { color: colors.textSecondary }]}>• Add the level and spot so your future self can find it instantly.</Text>
            <Text style={[styles.emptyIdeasItem, { color: colors.textSecondary }]}>• Attach a photo near landmarks like elevators or exits.</Text>
            <Text style={[styles.emptyIdeasItem, { color: colors.textSecondary }]}>• Save right after parking to lock in a precise GPS point.</Text>
          </View>
        )}

      </ScrollView>

      <Modal animationType="slide" transparent visible={isSaveSheetVisible} onRequestClose={() => setSaveSheetVisible(false)}>
        <View style={styles.sheetBackdrop}>
          <View style={[styles.sheetContent, { backgroundColor: colors.card, paddingBottom: Math.max(insets.bottom + 10, 18) }]}>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Save parking location?</Text>
            <Pressable onPress={() => void saveOnlyLocation()} style={({ pressed }) => [styles.sheetButton, { backgroundColor: colors.primary, transform: [{ scale: pressed ? 0.97 : 1 }] }]}> 
              <Text style={[styles.sheetButtonText, { color: colors.textOnAccent }]}>Save only location</Text>
            </Pressable>
            <Pressable onPress={openDetailsEditor} style={({ pressed }) => [styles.sheetButton, { borderColor: colors.border, borderWidth: 1, transform: [{ scale: pressed ? 0.97 : 1 }] }]}> 
              <Text style={[styles.sheetSecondaryButtonText, { color: colors.text }]}>+ Add details (recommended)</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal animationType="slide" transparent visible={isDetailModalVisible} onRequestClose={() => setDetailModalVisible(false)}>
        <View style={styles.sheetBackdrop}>
          <KeyboardAvoidingView behavior="padding">
            <ScrollView
              contentContainerStyle={[styles.detailModal, { backgroundColor: colors.card, paddingBottom: Math.max(insets.bottom + 10, 18) }]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={[styles.sheetTitle, { color: colors.text }]}>Parking Details</Text>
              <TextInput value={levelInput} onChangeText={setLevelInput} placeholder="Level/Floor (B2)" placeholderTextColor={colors.textMuted} style={[styles.input, { color: colors.text, borderColor: colors.border }]} />
              <TextInput value={spotInput} onChangeText={setSpotInput} placeholder="Spot Number (17)" placeholderTextColor={colors.textMuted} style={[styles.input, { color: colors.text, borderColor: colors.border }]} />
              <TextInput value={notesInput} onChangeText={setNotesInput} placeholder="Notes (Near elevator)" placeholderTextColor={colors.textMuted} style={[styles.input, { color: colors.text, borderColor: colors.border }]} />

              <Pressable onPress={pickPhoto} style={({ pressed }) => [styles.photoButton, { borderColor: colors.border, transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
                <Camera size={16} color={colors.text} />
                <Text style={[styles.photoButtonText, { color: colors.text }]}>{photoUri ? 'Photo added ✓' : '📸 Add Photo'}</Text>
              </Pressable>

              <Pressable onPress={() => void saveDetails()} style={({ pressed }) => [styles.sheetButton, { backgroundColor: colors.primary, transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
                <Text style={[styles.sheetButtonText, { color: colors.textOnAccent }]}>Save Details</Text>
              </Pressable>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 14,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandText: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  mainCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
    gap: 8,
  },
  mainTopRow: { gap: 4 },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  carLabel: {
    fontSize: 22,
    fontWeight: '800',
  },
  liveDot: { width: 9, height: 9, borderRadius: 999 },
  liveText: { fontSize: 12, fontWeight: '700' },
  subtleStatus: { fontSize: 13 },
  mainInfoRow: {
    marginTop: 3,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
  },
  distanceValue: {
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: -1,
  },
  directionHint: {
    fontSize: 30,
    fontWeight: '700',
  },
  microContext: {
    fontSize: 13,
  },
  primaryButton: {
    marginTop: 8,
    minHeight: 45,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: { fontSize: 16, fontWeight: '700' },
  emptyTitle: { fontSize: 22, fontWeight: '700' },
  detailsCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  detailsTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  detailsText: {
    fontSize: 14,
    lineHeight: 20,
  },
  addDetailsCta: {
    fontSize: 14,
    fontWeight: '700',
  },
  detailsIconsRow: {
    flexDirection: 'row',
    gap: 12,
    opacity: 0.5,
  },
  navPreviewCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  previewTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  previewLane: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  previewLabel: { fontSize: 12, fontWeight: '600' },
  previewLine: {
    flex: 1,
    height: 3,
    borderRadius: 99,
    justifyContent: 'center',
  },
  movingDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  previewSubtitle: { fontSize: 12, textAlign: 'center' },
  saveButton: {
    minHeight: 52,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  confidenceCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 6,
  },
  confidenceText: { fontSize: 13, fontWeight: '500' },
  emptyIdeasCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 7,
  },
  emptyIdeasHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  emptyIdeasTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  emptyIdeasItem: {
    fontSize: 12,
    lineHeight: 18,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheetContent: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 18,
    gap: 10,
  },
  detailModal: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 18,
    gap: 10,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  sheetButton: {
    minHeight: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  sheetSecondaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    minHeight: 46,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  photoButton: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  photoButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
