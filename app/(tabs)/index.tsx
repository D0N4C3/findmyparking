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
  Alert,
  Share,
  Linking,
  Platform,
  Modal,
  TextInput
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { AppButton, AppCard, SectionHeader, StatTile } from '@/components/ui/primitives';

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
        <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
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
        <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
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
  const colors = isDark ? Colors.dark : Colors.light;
  const router = useRouter();
  
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
      Alert.alert('Error', 'Failed to save parking location');
    }
  }, [saveParkingLocation]);

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
      Alert.alert('Error', 'Failed to share location');
    }
  }, [currentParking]);

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
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Main Status Card */}
        <Animated.View style={[styles.mainCard, { transform: [{ translateY: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }] }]}>
          <AppCard colors={colors} elevated="lg">
          {currentParking ? (
            <>
              {/* Car Icon & Status */}
              <View style={styles.carSection}>
                <LinearGradient
                  colors={colors.accentGradient.map(c => c + '30') as [string, string]}
                  style={styles.carIconBg}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Car size={40} color={colors.accent} />
                </LinearGradient>
                <View style={styles.statusBadge}>
                  <View style={[styles.statusDot, { backgroundColor: colors.success }]} />
                  <Text style={[styles.statusText, { color: colors.textSecondary }]}>
                    Parked {formatTimeAgo(currentParking.timestamp)}
                  </Text>
                </View>
              </View>

              {/* Location */}
              <View style={styles.locationSection}>
                <Text style={[styles.locationText, { color: colors.text }]} numberOfLines={2}>
                  {currentParking.address || 'Unknown location'}
                </Text>
                {(currentParking.notes || currentParking.spotNumber) && (
                  <View style={[styles.noteBadge, { backgroundColor: colors.surfaceSecondary }]}>
                    <Text style={[styles.noteText, { color: colors.textSecondary }]}>
                      {currentParking.spotNumber || currentParking.notes}
                    </Text>
                  </View>
                )}
              </View>

              {/* Stats Grid */}
              <View style={styles.statsGrid}>
                <StatTile colors={colors} icon={<Navigation size={18} color={colors.accent} />} value={formatDistance(distance)} label="away" />
                <StatTile colors={colors} icon={<Clock size={18} color={colors.accent} />} value={walkingTime !== null ? `${walkingTime}m` : '--'} label="walk time" />
                <StatTile colors={colors} icon={<Zap size={18} color={colors.accent} />} value={new Date(currentParking.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} label="parked at" />
              </View>

              {/* Timer Alert */}
              {isTimerActive && timerRemaining !== null && (
                <View style={[styles.timerAlert, { backgroundColor: colors.warning + '15' }]}>
                  <Timer size={18} color={colors.warning} />
                  <Text style={[styles.timerText, { color: colors.warning }]}>
                    Timer: {formatDuration(timerRemaining)} remaining
                  </Text>
                  <TouchableOpacity onPress={clearParkingTimer}>
                    <Text style={[styles.timerCancel, { color: colors.textMuted }]}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Primary Action */}
              <AppButton colors={colors} label="Navigate to Car" onPress={handleOpenExternalMaps} variant="primary" icon={<Navigation size={20} color={colors.textOnAccent} />} trailingIcon={<ChevronRight size={20} color={colors.textOnAccent} />} style={styles.navigateButton} />

              {/* Quick Actions Row */}
              <View style={styles.quickActions}>
                <AppButton colors={colors} label="Timer" variant="secondary" onPress={() => setTimerModalVisible(true)} icon={<Timer size={18} color={colors.text} />} style={styles.quickAction} />
                
                <AppButton colors={colors} label="Note" variant="secondary" onPress={() => setNoteModalVisible(true)} icon={<MapPin size={18} color={colors.text} />} style={styles.quickAction} />
                
                <AppButton colors={colors} label="Share" variant="secondary" onPress={handleShareLocation} icon={<Share2 size={18} color={colors.text} />} style={styles.quickAction} />
                
                <AppButton colors={colors} label="Map" variant="secondary" onPress={handleNavigateToCar} icon={<MoreHorizontal size={18} color={colors.text} />} style={styles.quickAction} />
              </View>
            </>
          ) : (
            <>
              <View style={styles.emptyState}>
                <LinearGradient
                  colors={[colors.surfaceSecondary, colors.surfaceTertiary]}
                  style={styles.emptyIconBg}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Car size={48} color={colors.textMuted} />
                </LinearGradient>
                
                <Text style={[styles.emptyTitle, { color: colors.text }]}>
                  No car parked yet
                </Text>
                
                <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                  {isAutoDetectionEnabled && savedBluetoothDevice 
                    ? `Auto-detection is active with ${savedBluetoothDevice.name}`
                    : 'Enable auto-detection or manually save your parking spot'}
                </Text>

                {!isAutoDetectionEnabled && (
                  <View style={[styles.alertBox, { backgroundColor: colors.warning + '15' }]}>
                    <AlertCircle size={20} color={colors.warning} />
                    <Text style={[styles.alertText, { color: colors.warning }]}>
                      Auto-detection is disabled
                    </Text>
                  </View>
                )}
              </View>
            </>
          )}
          </AppCard>
        </Animated.View>

        {/* Stats Summary */}
        {parkingStats.totalParkings > 0 && (
          <Animated.View style={[styles.statsCard, { transform: [{ translateY: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [50, 0] }) }] }]}>
            <AppCard colors={colors} elevated="md">
            <View style={styles.statsHeader}>
              <TrendingUp size={20} color={colors.accent} />
              <Text style={[styles.statsTitle, { color: colors.text }]}>Your Stats</Text>
            </View>
            
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={[styles.statBoxValue, { color: colors.text }]}>
                  {parkingStats.totalParkings}
                </Text>
                <Text style={[styles.statBoxLabel, { color: colors.textMuted }]}>
                  Total Parkings
                </Text>
              </View>
              
              <View style={styles.statBox}>
                <Text style={[styles.statBoxValue, { color: colors.text }]}>
                  {parkingStats.lastWeekParkings}
                </Text>
                <Text style={[styles.statBoxLabel, { color: colors.textMuted }]}>
                  This Week
                </Text>
              </View>
            </View>
            </AppCard>
          </Animated.View>
        )}

        {/* Quick Save Button */}
        <Animated.View 
          style={{
            transform: [{ translateY: slideAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [60, 0]
            }) }]
          }}
        >
          <AppButton
            colors={colors}
            onPress={handleSaveParking}
            disabled={isLoading}
            variant="primary"
            style={styles.saveButton}
            icon={isLoading ? <ActivityIndicator color={colors.textOnAccent} /> : <View style={[styles.saveButtonIcon, { backgroundColor: colors.surface }]}><Plus size={24} color={colors.accent} /></View>}
            label={isLoading ? 'Saving...' : currentParking ? 'Update Location' : 'Save Parking Spot'}
          />
        </Animated.View>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  bluetoothBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  bluetoothText: {
    fontSize: 13,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  mainCard: {
    borderRadius: 28,
    padding: 24,
    marginTop: 4,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  carSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  carIconBg: {
    width: 88,
    height: 88,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
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
  statusText: {
    fontSize: 13,
    fontWeight: '500',
  },
  locationSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  locationText: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 28,
  },
  noteBadge: {
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
  },
  noteText: {
    fontSize: 13,
    fontWeight: '500',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    gap: 6,
  },
  statValue: {
    fontSize: 17,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 11,
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
    marginBottom: 16,
  },
  timerText: {
    fontSize: 14,
    fontWeight: '600',
  },
  timerCancel: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 8,
  },
  navigateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  navigateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 8,
  },
  quickAction: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 4,
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyIconBg: {
    width: 100,
    height: 100,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 30,
    lineHeight: 20,
  },
  alertBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  alertText: {
    fontSize: 14,
    fontWeight: '500',
  },
  statsCard: {
    borderRadius: 24,
    padding: 20,
    marginTop: 16,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  statsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  statsTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 16,
  },
  statBoxValue: {
    fontSize: 28,
    fontWeight: '800',
  },
  statBoxLabel: {
    fontSize: 13,
    marginTop: 4,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 16,
    borderRadius: 16,
    marginTop: 16,
  },
  saveButtonIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
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
