import { useParking } from '@/context/ParkingContext';
import { useTheme } from '@/context/ThemeContext';
import { Colors } from '@/constants/colors';
import { Timer } from 'lucide-react-native';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Share,
  Linking,
  Platform,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { AppButton } from '@/components/ui/primitives';
import { useDialog } from '@/context/DialogContext';
import { DIALOG_COPY } from '@/constants/dialogs';
import { HomeHeader } from '@/features/home/components/HomeHeader';
import { ActiveParkingCard } from '@/features/home/components/ActiveParkingCard';
import { PrimaryActionBar } from '@/features/home/components/PrimaryActionBar';
import { SecondaryActionGrid } from '@/features/home/components/SecondaryActionGrid';
import { StatsSummaryCard } from '@/features/home/components/StatsSummaryCard';
import { HomeViewModel } from '@/features/home/home-view-model';

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
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}> 
        <View style={[styles.modalContent, { backgroundColor: colors.card, marginBottom: Math.max(insets.bottom, 12) }]}> 
          <View style={styles.modalHeader}>
            <Timer size={24} color={colors.accent} />
            <Text style={[styles.modalTitle, { color: colors.text }]}>Set Parking Timer</Text>
          </View>

          <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>Get notified before your parking expires</Text>

          <View style={styles.quickTimesContainer}>
            {quickTimes.map((time) => (
              <TouchableOpacity
                key={time}
                style={[
                  styles.quickTimeButton,
                  { backgroundColor: colors.surfaceSecondary },
                  minutes === time.toString() && { backgroundColor: colors.accent },
                ]}
                onPress={() => setMinutes(time.toString())}
              >
                <Text style={[styles.quickTimeText, { color: minutes === time.toString() ? '#FFFFFF' : colors.text }]}>{time}m</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            style={[styles.timerInput, { backgroundColor: colors.surfaceSecondary, color: colors.text, borderColor: colors.border }]}
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
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}> 
        <View style={[styles.modalContent, { backgroundColor: colors.card, marginBottom: Math.max(insets.bottom, 12) }]}> 
          <Text style={[styles.modalTitle, { color: colors.text }]}>Add Note</Text>
          <TextInput
            style={[styles.noteInput, { backgroundColor: colors.surfaceSecondary, color: colors.text, borderColor: colors.border }]}
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
    Animated.timing(slideAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, [slideAnim]);

  useEffect(() => {
    if (isAutoDetectionEnabled && savedBluetoothDevice) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 1200, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
        ])
      ).start();
    }
    return () => pulseAnim.setValue(1);
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

  const viewModel: HomeViewModel = {
    colors,
    currentParking,
    isLoading,
    isAutoDetectionEnabled,
    savedBluetoothDevice,
    isTimerActive,
    timerRemaining,
    distanceText: formatDistance(distance),
    walkingTimeText: walkingTime !== null ? `${walkingTime}m` : '--',
    parkedAtText: currentParking ? new Date(currentParking.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--',
    parkedAgoText: currentParking ? formatTimeAgo(currentParking.timestamp) : '',
    noteOrSpotText: currentParking ? currentParking.spotNumber || currentParking.notes || null : null,
    parkingStats,
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <HomeHeader colors={colors} showAutoDetectionBadge={isAutoDetectionEnabled && !!savedBluetoothDevice} pulseAnim={pulseAnim} />

      <ScrollView style={styles.scrollView} contentContainerStyle={[styles.scrollContent, { paddingBottom: 124 + insets.bottom }]} showsVerticalScrollIndicator={false}>
        <Animated.View style={[styles.section, { transform: [{ translateY: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Active Parking Summary</Text>
          <ActiveParkingCard viewModel={viewModel} onClearTimer={clearParkingTimer} />
        </Animated.View>

        <Animated.View style={[styles.section, { transform: [{ translateY: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [32, 0] }) }] }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Primary Actions</Text>
          <PrimaryActionBar viewModel={viewModel} onSaveParking={handleSaveParking} onNavigateExternal={handleOpenExternalMaps} />
        </Animated.View>

        {currentParking && (
          <Animated.View style={[styles.section, { transform: [{ translateY: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }] }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Secondary Tools</Text>
            <SecondaryActionGrid
              viewModel={viewModel}
              onShare={handleShareLocation}
              onOpenNote={() => setNoteModalVisible(true)}
              onOpenMap={handleNavigateToCar}
              onOpenTimer={() => setTimerModalVisible(true)}
            />
          </Animated.View>
        )}

        {currentParking && (
          <Animated.View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Insights / Stats</Text>
            <StatsSummaryCard viewModel={viewModel} />
          </Animated.View>
        )}
      </ScrollView>

      <TimerModal visible={timerModalVisible} onClose={() => setTimerModalVisible(false)} onSetTimer={handleSetTimer} colors={colors} />

      <NoteModal visible={noteModalVisible} onClose={() => setNoteModalVisible(false)} onSave={handleSaveNote} initialNote={currentParking?.notes} colors={colors} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    gap: 24,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
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
});
