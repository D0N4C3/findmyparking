import { useParking, ParkingSpot } from '@/context/ParkingContext';
import { useTheme } from '@/context/ThemeContext';
import { Colors } from '@/constants/colors';
import { 
  MapPin, 
  Trash2, 
  ChevronRight,
  Calendar,
  Bluetooth,
  Search,
  Filter,
  Clock
} from 'lucide-react-native';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView,
  Alert,
  Animated,
  Image,
  TextInput,
  Modal
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatFullDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface HistoryItemProps {
  spot: ParkingSpot;
  onDelete: (id: string) => void;
  onPress: (spot: ParkingSpot) => void;
  colors: typeof Colors.light | typeof Colors.dark;
  isActive: boolean;
}

function HistoryItem({ spot, onDelete, onPress, colors, isActive }: HistoryItemProps) {
  const swipeRef = useRef<Swipeable>(null);

  const renderRightActions = useCallback(() => (
    <TouchableOpacity 
      style={[styles.deleteAction, { backgroundColor: colors.error }]}
      onPress={() => {
        swipeRef.current?.close();
        Alert.alert(
          'Delete Parking Spot',
          'Are you sure you want to delete this parking location?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => onDelete(spot.id) }
          ]
        );
      }}
    >
      <Trash2 size={24} color="#FFFFFF" />
    </TouchableOpacity>
  ), [colors.error, onDelete, spot.id]);

  const getCategoryIcon = () => {
    switch (spot.category) {
      case 'mall': return '🏢';
      case 'airport': return '✈️';
      case 'street': return '🛣️';
      case 'garage': return '🅿️';
      default: return '🚗';
    }
  };

  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={renderRightActions}
      rightThreshold={40}
    >
      <TouchableOpacity 
        style={[
          styles.historyItem, 
          { backgroundColor: colors.card },
          isActive && { borderColor: colors.accent, borderWidth: 2 }
        ]}
        onPress={() => onPress(spot)}
        activeOpacity={0.7}
      >
        <View style={[styles.iconContainer, { backgroundColor: colors.accent + '15' }]}>
          {spot.photoUrl ? (
            <Image source={{ uri: spot.photoUrl }} style={styles.thumbnail} />
          ) : (
            <Text style={styles.categoryIcon}>{getCategoryIcon()}</Text>
          )}
          {isActive && (
            <View style={[styles.activeBadge, { backgroundColor: colors.success }]}>
              <View style={styles.activeDot} />
            </View>
          )}
        </View>

        <View style={styles.itemContent}>
          <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={1}>
            {spot.address || 'Unknown Location'}
          </Text>
          
          <View style={styles.itemMeta}>
            <View style={styles.metaItem}>
              <Calendar size={12} color={colors.textMuted} />
              <Text style={[styles.metaText, { color: colors.textMuted }]}>
                {formatFullDate(spot.timestamp)}
              </Text>
            </View>
            
            {spot.bluetoothDeviceName && (
              <View style={styles.metaItem}>
                <Bluetooth size={12} color={colors.success} />
                <Text style={[styles.metaText, { color: colors.success }]}>
                  Auto
                </Text>
              </View>
            )}
          </View>

          {(spot.notes || spot.spotNumber) && (
            <View style={[styles.noteBadge, { backgroundColor: colors.surfaceSecondary }]}>
              <MapPin size={10} color={colors.textMuted} />
              <Text style={[styles.noteText, { color: colors.textSecondary }]} numberOfLines={1}>
                {spot.spotNumber || spot.notes}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.itemRight}>
          <View style={[styles.dateBadge, { backgroundColor: colors.surfaceSecondary }]}>
            <Text style={[styles.dateText, { color: colors.text }]}>
              {formatDate(spot.timestamp)}
            </Text>
            <Text style={[styles.timeText, { color: colors.textMuted }]}>
              {formatTime(spot.timestamp)}
            </Text>
          </View>
          <ChevronRight size={18} color={colors.textMuted} />
        </View>
      </TouchableOpacity>
    </Swipeable>
  );
}

interface FilterModalProps {
  visible: boolean;
  onClose: () => void;
  selectedFilter: string | null;
  onSelectFilter: (filter: string | null) => void;
  colors: typeof Colors.light | typeof Colors.dark;
}

const FILTER_OPTIONS = [
  { id: 'all', label: 'All', icon: '📋' },
  { id: 'mall', label: 'Malls', icon: '🏢' },
  { id: 'airport', label: 'Airports', icon: '✈️' },
  { id: 'street', label: 'Street', icon: '🛣️' },
  { id: 'garage', label: 'Garages', icon: '🅿️' },
];

function FilterModal({ visible, onClose, selectedFilter, onSelectFilter, colors }: FilterModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
        <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Filter By</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={[styles.doneText, { color: colors.accent }]}>Done</Text>
            </TouchableOpacity>
          </View>
          
          {FILTER_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.id}
              style={[
                styles.filterOption,
                { backgroundColor: selectedFilter === option.id ? colors.accent + '20' : 'transparent' }
              ]}
              onPress={() => {
                onSelectFilter(option.id === 'all' ? null : option.id);
                onClose();
              }}
            >
              <Text style={styles.filterIcon}>{option.icon}</Text>
              <Text style={[
                styles.filterLabel,
                { color: selectedFilter === option.id ? colors.accent : colors.text }
              ]}>
                {option.label}
              </Text>
              {selectedFilter === option.id && (
                <View style={[styles.filterCheck, { backgroundColor: colors.accent }]} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </Modal>
  );
}

export default function HistoryScreen() {
  const { parkingHistory, currentParking, deleteParkingSpot, clearHistory, updateParkingSpot } = useParking();
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  const router = useRouter();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const listAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(listAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [listAnim]);

  const filteredSpots = useMemo(() => {
    let spots = currentParking 
      ? [currentParking, ...parkingHistory] 
      : parkingHistory;

    if (searchQuery) {
      spots = spots.filter(spot => 
        spot.address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        spot.notes?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (selectedFilter) {
      spots = spots.filter(spot => spot.category === selectedFilter);
    }

    return spots;
  }, [currentParking, parkingHistory, searchQuery, selectedFilter]);

  const stats = useMemo(() => {
    return {
      total: parkingHistory.length + (currentParking ? 1 : 0),
      thisMonth: [...(currentParking ? [currentParking] : []), ...parkingHistory].filter(
        s => new Date(s.timestamp).getMonth() === new Date().getMonth()
      ).length,
    };
  }, [parkingHistory, currentParking]);

  const handleDelete = useCallback((id: string) => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    deleteParkingSpot(id);
  }, [deleteParkingSpot]);

  const handleClearHistory = useCallback(() => {
    Alert.alert(
      'Clear All History',
      'Are you sure you want to clear all parking history? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear', 
          style: 'destructive', 
          onPress: () => {
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            clearHistory();
          }
        }
      ]
    );
  }, [clearHistory]);

  const handleItemPress = useCallback((spot: ParkingSpot) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Set as current parking
    updateParkingSpot(spot.id, { ...spot });
    router.push('/map');
  }, [router, updateParkingSpot]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.text }]}>History</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            {stats.total} {stats.total === 1 ? 'parking' : 'parkings'} saved
          </Text>
        </View>
        
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={[styles.iconButton, { backgroundColor: colors.surface }]}
            onPress={() => setFilterModalVisible(true)}
          >
            <Filter size={20} color={selectedFilter ? colors.accent : colors.text} />
          </TouchableOpacity>
          
          {parkingHistory.length > 0 && (
            <TouchableOpacity 
              style={[styles.iconButton, { backgroundColor: colors.error + '15' }]}
              onPress={handleClearHistory}
            >
              <Trash2 size={20} color={colors.error} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: colors.card }]}>
        <Search size={18} color={colors.textMuted} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search parking locations..."
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <View style={[styles.clearButton, { backgroundColor: colors.surfaceSecondary }]}>
              <Text style={[styles.clearText, { color: colors.textMuted }]}>×</Text>
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <LinearGradient
          colors={[colors.accent + '20', colors.accent + '10']}
          style={styles.statPill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <Clock size={14} color={colors.accent} />
          <Text style={[styles.statPillText, { color: colors.text }]}>
            {stats.thisMonth} this month
          </Text>
        </LinearGradient>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {filteredSpots.length === 0 ? (
          <Animated.View 
            style={[
              styles.emptyState,
              { opacity: listAnim }
            ]}
          >
            <LinearGradient
              colors={[colors.surfaceSecondary, colors.surfaceTertiary]}
              style={styles.emptyIconBg}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <MapPin size={48} color={colors.textMuted} />
            </LinearGradient>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {searchQuery ? 'No results found' : 'No parking history'}
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              {searchQuery 
                ? 'Try adjusting your search terms'
                : 'Your saved parking spots will appear here'
              }
            </Text>
          </Animated.View>
        ) : (
          <Animated.View 
            style={{
              opacity: listAnim,
              transform: [{
                translateY: listAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0]
                })
              }]
            }}
          >
            {filteredSpots.map((spot) => (
              <HistoryItem
                key={spot.id}
                spot={spot}
                onDelete={handleDelete}
                onPress={handleItemPress}
                colors={colors}
                isActive={currentParking?.id === spot.id}
              />
            ))}
          </Animated.View>
        )}
      </ScrollView>

      <FilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        selectedFilter={selectedFilter}
        onSelectFilter={setSelectedFilter}
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
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
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
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  clearButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearText: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 20,
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statPillText: {
    fontSize: 13,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    paddingTop: 8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 40,
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
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  categoryIcon: {
    fontSize: 24,
  },
  activeBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  itemContent: {
    flex: 1,
    marginLeft: 14,
    marginRight: 8,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 11,
    fontWeight: '500',
  },
  noteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  noteText: {
    fontSize: 11,
    fontWeight: '500',
  },
  itemRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  dateBadge: {
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  dateText: {
    fontSize: 13,
    fontWeight: '700',
  },
  timeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  deleteAction: {
    width: 70,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
    marginBottom: 10,
    marginLeft: 8,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  doneText: {
    fontSize: 16,
    fontWeight: '600',
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    marginBottom: 6,
  },
  filterIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  filterLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  filterCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
});
