import { useParking } from '@/context/ParkingContext';
import { useTheme } from '@/context/ThemeContext';
import { Colors } from '@/constants/colors';
import { 
  Car, 
  MapPin, 
  Navigation, 
  Bluetooth, 
  Plus,
  ChevronRight,
  Clock,
  AlertCircle,
  Timer,
  TrendingUp,
  Zap,
  Share2,
  MoreHorizontal
} from 'lucide-react-native';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView,
  Animated,
  ActivityIndicator,
  Share,
  Linking,
  Platform,
  Modal,
  TextInput
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { AppButton, AppCard, SectionHeader, StatTile } from '@/components/ui/primitives';
import { useDialog } from '@/context/DialogContext';
import { DIALOG_COPY } from '@/constants/dialogs';

const SPACING = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

const TYPE_SCALE = {
  title: 30,
  sectionTitle: 18,
  body: 15,
  caption: 12,
} as const;

function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

function formatDistance(meters: number | null): string {
  if (meters === null) return '--';
  if (meters < 1000) return `${meters}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}

interface TimerModalProps {
  visible: boolean;
  onClose: () => void;
  onSetTimer: (minutes: number) => void;
  colors: typeof Colors.light | typeof Colors.dark;
}

function TimerModal({ visible, onClose, onSetTimer, colors }: TimerModalProps) {
  const insets = useSafeAreaInsets();
  const [minutes, setMinutes] = useState('60');

  const handleSet = () => {
    const mins = parseInt(minutes, 10);
    if (mins > 0) {
      onSetTimer(mins);
      onClose();
    }
  };

  const quickTimes = [15, 30, 60, 120];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
        <View style={[styles.modalContent, { backgroundColor: colors.card, marginBottom: Math.max(insets.bottom, 12) }]}>
          <View style={styles.modalHeader}>
            <Timer size={24} color={colors.accent} />
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Set Parking Timer
            </Text>
          </View>
          
          <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
            Get notified before your parking expires
          </Text>

          <View style={styles.quickTimesContainer}>
            {quickTimes.map((time) => (
              <TouchableOpacity
                key={time}
                style={[
                  styles.quickTimeButton,
                  { backgroundColor: colors.surfaceSecondary },
                  minutes === time.toString() && { backgroundColor: colors.accent }
                ]}
                onPress={() => setMinutes(time.toString())}
              >
                <Text style={[
                  styles.quickTimeText,
                  { color: minutes === time.toString() ? '#FFFFFF' : colors.text }
                ]}>
                  {time}m
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            style={[
              styles.timerInput,
              { 
                backgroundColor: colors.surfaceSecondary,
                color: colors.text,
                borderColor: colors.border
              }
            ]}
            value={minutes}
            onChangeText={setMinutes}
            keyboardType="number-pad"
            placeholder="Minutes"
            placeholderTextColor={colors.textMuted}
          />

            <View style={styles.modalButtons}>
            <AppButton colors={colors} label="Cancel" variant="secondary" onPress={onClose} style={styles.modalButton} />
            <AppButton colors={colors} label="Set Timer" variant="primary" onPress={handleSet} style={styles.modalButton} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

interface NoteModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (note: string) => void;
  initialNote?: string;
  colors: typeof Colors.light | typeof Colors.dark;
}

function NoteModal({ visible, onClose, onSave, initialNote, colors }: NoteModalProps) {
  const insets = useSafeAreaInsets();
  const [note, setNote] = useState(initialNote || '');

  useEffect(() => {
    setNote(initialNote || '');
  }, [initialNote, visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
        <View style={[styles.modalContent, { backgroundColor: colors.card, marginBottom: Math.max(insets.bottom, 12) }]}>
          <Text style={[styles.modalTitle, { color: colors.text }]}>Add Note</Text>
          <TextInput
            style={[
              styles.noteInput,
              { 
                backgroundColor: colors.surfaceSecondary,
                color: colors.text,
                borderColor: colors.border
              }
            ]}
            value={note}
            onChangeText={setNote}
            placeholder="e.g., Level 3, Spot 42A"
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={100}
          />
          <View style={styles.modalButtons}>
            <AppButton colors={colors} label="Cancel" variant="secondary" onPress={onClose} style={styles.modalButton} />
            <AppButton colors={colors} label="Save" variant="primary" onPress={() => { onSave(note); onClose(); }} style={styles.modalButton} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function HomeScreen() {
  const { 
    currentParking, 
    isLoading, 
    saveParkingLocation, 
    getDistanceToCar,
    getWalkingTimeToCar,
    savedBluetoothDevice,
    isAutoDetectionEnabled,
    parkingStats,
    setParkingTimer,
    clearParkingTimer,
    timerRemaining,
    isTimerActive,
    updateParkingSpot,
  } = useParking();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const colors = isDark ? Colors.dark : Colors.light;
  const router = useRouter();
  const { showError } = useDialog();
  
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const [timerModalVisible, setTimerModalVisible] = useState(false);
  const [noteModalVisible, setNoteModalVisible] = useState(false);

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, [slideAnim]);

  useEffect(() => {
    if (isAutoDetectionEnabled && savedBluetoothDevice) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
    return () => {
      pulseAnim.setValue(1);
    };
  }, [isAutoDetectionEnabled, savedBluetoothDevice, pulseAnim]);

  const handleSaveParking = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await saveParkingLocation();
    } catch {
      showError(DIALOG_COPY.errors.saveParking.title, DIALOG_COPY.errors.saveParking.message);
    }
  }, [saveParkingLocation, showError]);

  const handleNavigateToCar = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/map');
  }, [router]);

  const handleOpenExternalMaps = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!currentParking) return;
    
    const { latitude, longitude } = currentParking;
    const label = 'My Car';
    const url = Platform.select({
      ios: `maps:0,0?q=${latitude},${longitude}(${label})`,
      android: `geo:0,0?q=${latitude},${longitude}(${label})`,
      default: `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
    });
    
    void Linking.openURL(url);
  }, [currentParking]);

  const handleShareLocation = useCallback(async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!currentParking) return;
    
    try {
      await Share.share({
        message: `I parked my car here: https://maps.google.com/?q=${currentParking.latitude},${currentParking.longitude}`,
        title: 'My Parking Location',
      });
    } catch {
      showError(DIALOG_COPY.errors.shareLocation.title, DIALOG_COPY.errors.shareLocation.message);
    }
  }, [currentParking, showError]);

  const handleSetTimer = useCallback((minutes: number) => {
    setParkingTimer(minutes);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [setParkingTimer]);

  const handleSaveNote = useCallback((note: string) => {
    if (currentParking) {
      updateParkingSpot(currentParking.id, { notes: note });
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [currentParking, updateParkingSpot]);

  const distance = getDistanceToCar();
  const walkingTime = getWalkingTimeToCar();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <SectionHeader
        colors={colors}
        title="ParkPing"
        subtitle="Never forget where you parked"
        right={isAutoDetectionEnabled && savedBluetoothDevice ? (
          <Animated.View style={[styles.bluetoothBadge, { backgroundColor: colors.surface, borderColor: colors.border, transform: [{ scale: pulseAnim }] }]}>
            <Bluetooth size={16} color={colors.success} />
            <Text style={[styles.bluetoothText, { color: colors.success }]}>Auto</Text>
          </Animated.View>
        ) : undefined}
      />

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 124 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[styles.section, { transform: [{ translateY: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Active Parking Summary</Text>
          <AppCard colors={colors} elevated="lg" style={styles.heroCard}>
            {currentParking ? (
              <>
                <View style={styles.carSection}>
                  <LinearGradient
                    colors={colors.accentGradient.map(c => c + '30') as [string, string]}
                    style={styles.carIconBg}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Car size={34} color={colors.accent} />
                  </LinearGradient>
                  <View style={styles.statusBadge}>
                    <View style={[styles.statusDot, { backgroundColor: colors.success }]} />
                    <Text style={[styles.captionText, { color: colors.textSecondary }]}>
                      Parked {formatTimeAgo(currentParking.timestamp)}
                    </Text>
                  </View>
                </View>

                <Text style={[styles.heroTitle, { color: colors.text }]} numberOfLines={2}>
                  {currentParking.address || 'Unknown location'}
                </Text>

                {(currentParking.notes || currentParking.spotNumber) && (
                  <View style={[styles.noteBadge, { backgroundColor: colors.surfaceSecondary }]}>
                    <Text style={[styles.bodyText, { color: colors.textSecondary }]}>
                      {currentParking.spotNumber || currentParking.notes}
                    </Text>
                  </View>
                )}

                {isTimerActive && timerRemaining !== null && (
                  <View style={[styles.timerAlert, { backgroundColor: colors.warning + '15' }]}>
                    <Timer size={16} color={colors.warning} />
                    <Text style={[styles.bodyText, { color: colors.warning }]}>
                      Timer: {formatDuration(timerRemaining)} remaining
                    </Text>
                    <TouchableOpacity onPress={clearParkingTimer}>
                      <Text style={[styles.captionText, { color: colors.textMuted }]}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            ) : (
              <View style={styles.emptyState}>
                <LinearGradient
                  colors={[colors.surfaceSecondary, colors.surfaceTertiary]}
                  style={styles.emptyIconBg}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Car size={42} color={colors.textMuted} />
                </LinearGradient>
                <Text style={[styles.heroTitle, { color: colors.text }]}>No car parked yet</Text>
                <Text style={[styles.bodyText, styles.emptySubtitle, { color: colors.textSecondary }]}>
                  {isAutoDetectionEnabled && savedBluetoothDevice
                    ? `Auto-detection is active with ${savedBluetoothDevice.name}`
                    : 'Enable auto-detection or manually save your parking spot'}
                </Text>
                {!isAutoDetectionEnabled && (
                  <View style={[styles.alertBox, { backgroundColor: colors.warning + '15' }]}>
                    <AlertCircle size={18} color={colors.warning} />
                    <Text style={[styles.bodyText, { color: colors.warning }]}>Auto-detection is disabled</Text>
                  </View>
                )}
              </View>
            )}
          </AppCard>
        </Animated.View>

        <Animated.View style={[styles.section, { transform: [{ translateY: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [32, 0] }) }] }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Primary Actions</Text>
          {currentParking ? (
            <AppButton
              colors={colors}
              label="Navigate to Car"
              onPress={handleOpenExternalMaps}
              variant="primary"
              icon={<Navigation size={20} color={colors.textOnAccent} />}
              trailingIcon={<ChevronRight size={20} color={colors.textOnAccent} />}
              style={styles.primaryAction}
            />
          ) : (
            <AppButton
              colors={colors}
              onPress={handleSaveParking}
              disabled={isLoading}
              variant="primary"
              style={styles.primaryAction}
              icon={isLoading ? <ActivityIndicator color={colors.textOnAccent} /> : <Plus size={20} color={colors.textOnAccent} />}
              label={isLoading ? 'Saving...' : 'Save Parking Spot'}
            />
          )}
        </Animated.View>

        {currentParking && (
          <Animated.View style={[styles.section, { transform: [{ translateY: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }] }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Secondary Tools</Text>
            <View style={styles.toolsGrid}>
              <TouchableOpacity style={[styles.toolItem, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={handleShareLocation}>
                <Share2 size={16} color={colors.text} />
                <Text style={[styles.captionText, { color: colors.textSecondary }]}>Share</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.toolItem, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => setNoteModalVisible(true)}>
                <MapPin size={16} color={colors.text} />
                <Text style={[styles.captionText, { color: colors.textSecondary }]}>Note</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.toolItem, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={handleNavigateToCar}>
                <MoreHorizontal size={16} color={colors.text} />
                <Text style={[styles.captionText, { color: colors.textSecondary }]}>Map</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.toolItem, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => setTimerModalVisible(true)}>
                <Timer size={16} color={colors.text} />
                <Text style={[styles.captionText, { color: colors.textSecondary }]}>Timer</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}

        {currentParking && (
          <Animated.View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Insights / Stats</Text>
            <View style={styles.statsGrid}>
              <StatTile colors={colors} icon={<Navigation size={16} color={colors.accent} />} value={formatDistance(distance)} label="away" />
              <StatTile colors={colors} icon={<Clock size={16} color={colors.accent} />} value={walkingTime !== null ? `${walkingTime}m` : '--'} label="walk" />
              <StatTile colors={colors} icon={<Zap size={16} color={colors.accent} />} value={new Date(currentParking.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} label="parked" />
            </View>
          </Animated.View>
        )}

        {parkingStats.totalParkings > 0 && (
          <Animated.View style={[styles.section, { transform: [{ translateY: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [46, 0] }) }] }]}>
            <View style={[styles.statsSummaryRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.summaryItem}>
                <TrendingUp size={16} color={colors.accent} />
                <Text style={[styles.bodyText, { color: colors.text }]}>Total: {parkingStats.totalParkings}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Clock size={16} color={colors.accent} />
                <Text style={[styles.bodyText, { color: colors.text }]}>Week: {parkingStats.lastWeekParkings}</Text>
              </View>
            </View>
          </Animated.View>
        )}
      </ScrollView>

      <TimerModal
        visible={timerModalVisible}
        onClose={() => setTimerModalVisible(false)}
        onSetTimer={handleSetTimer}
        colors={colors}
      />

      <NoteModal
        visible={noteModalVisible}
        onClose={() => setNoteModalVisible(false)}
        onSave={handleSaveNote}
        initialNote={currentParking?.notes}
        colors={colors}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  bluetoothBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: 20,
    borderWidth: 1,
  },
  bluetoothText: {
    fontSize: TYPE_SCALE.caption,
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    gap: SPACING.lg,
  },
  section: {
    gap: SPACING.sm,
  },
  sectionTitle: {
    fontSize: TYPE_SCALE.sectionTitle,
    fontWeight: '600',
  },
  heroCard: {
    gap: SPACING.md,
  },
  carSection: {
    alignItems: 'center',
  },
  carIconBg: {
    width: 76,
    height: 76,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  heroTitle: {
    fontSize: TYPE_SCALE.title,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 36,
  },
  noteBadge: {
    marginTop: SPACING.xs,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'center',
  },
  bodyText: {
    fontSize: TYPE_SCALE.body,
    fontWeight: '400',
  },
  captionText: {
    fontSize: TYPE_SCALE.caption,
    fontWeight: '500',
  },
  timerAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
  },
  primaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderRadius: 16,
  },
  toolsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  toolItem: {
    width: '48%',
    borderWidth: 1,
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderRadius: 12,
    gap: SPACING.xs,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  emptyIconBg: {
    width: 100,
    height: 100,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  emptySubtitle: {
    textAlign: 'center',
    paddingHorizontal: SPACING.lg,
    lineHeight: 22,
  },
  alertBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: SPACING.sm,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  statsSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 24,
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  modalSubtitle: {
    fontSize: 14,
    marginBottom: 20,
  },
  quickTimesContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  quickTimeButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  quickTimeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  timerInput: {
    fontSize: 18,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    textAlign: 'center',
    marginBottom: 20,
  },
  noteInput: {
    fontSize: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
