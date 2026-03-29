import { AppCard } from '@/components/ui/primitives';
import { HomeViewModel } from '@/features/home/home-view-model';
import { AlertCircle, Car, Clock3, LocateFixed, Timer } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type HomeBreakpoint = 'compact' | 'standard' | 'expanded';

interface ActiveParkingCardProps {
  viewModel: HomeViewModel;
  onClearTimer: () => void;
  breakpoint?: HomeBreakpoint;
}

/**
 * ActiveParkingCard renders the hero parking state for home.
 *
 * Usage: bind this to a `HomeViewModel`; the component only displays data and raises
 * timer-clear intent through `onClearTimer`.
 */
export function ActiveParkingCard({ viewModel, onClearTimer, breakpoint = 'standard' }: ActiveParkingCardProps) {
  const {
    colors,
    currentParking,
    isAutoDetectionEnabled,
    savedBluetoothDevice,
    isTimerActive,
    timerRemaining,
    parkedAgoText,
    noteOrSpotText,
    locationStatusText,
    distanceText,
    walkingTimeText,
  } = viewModel;

  const isCompact = breakpoint === 'compact';
  const isExpanded = breakpoint === 'expanded';

  return (
    <AppCard colors={colors} elevated="lg" style={[styles.heroCard, isCompact && styles.heroCardCompact, isExpanded && styles.heroCardExpanded]}>
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
              <Text style={[styles.captionText, { color: colors.textSecondary }]}>Parked {parkedAgoText}</Text>
            </View>
          </View>

          <Text style={[styles.heroTitle, isCompact && styles.heroTitleCompact, isExpanded && styles.heroTitleExpanded, { color: colors.text }]} numberOfLines={isCompact ? 3 : 2} ellipsizeMode="tail">
            {currentParking.address || 'Unknown location'}
          </Text>

          {noteOrSpotText && (
            <View style={[styles.noteBadge, { backgroundColor: colors.surfaceSecondary }]}> 
              <Text style={[styles.bodyText, { color: colors.textSecondary }]} numberOfLines={2} ellipsizeMode="tail">{noteOrSpotText}</Text>
            </View>
          )}

          <View style={[styles.statusPanel, { backgroundColor: colors.surfaceSecondary }]}> 
            <View style={styles.statusRow}>
              <LocateFixed size={14} color={colors.textMuted} />
              <Text style={[styles.captionText, styles.locationStatusText, { color: colors.textSecondary }]} numberOfLines={2} ellipsizeMode="tail">{locationStatusText}</Text>
            </View>
            <View style={styles.statusMetrics}>
              <View style={styles.statusRow}>
                <LocateFixed size={14} color={colors.accent} />
                <Text style={[styles.bodyText, { color: colors.text }]}>Distance: {distanceText}</Text>
              </View>
              <View style={styles.statusRow}>
                <Clock3 size={14} color={colors.accent} />
                <Text style={[styles.bodyText, { color: colors.text }]}>Walk: {walkingTimeText}</Text>
              </View>
            </View>
          </View>

          {isTimerActive && timerRemaining !== null && (
            <View style={[styles.timerAlert, { backgroundColor: colors.warning + '15' }]}>
              <Timer size={16} color={colors.warning} />
              <Text style={[styles.bodyText, { color: colors.warning }]}>Timer: {formatDuration(timerRemaining)} remaining</Text>
              <TouchableOpacity onPress={onClearTimer} style={styles.timerCancelButton}>
                <Text style={[styles.captionText, { color: colors.textMuted }]} numberOfLines={1}>Cancel</Text>
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
          <Text style={[styles.heroTitle, isCompact && styles.heroTitleCompact, isExpanded && styles.heroTitleExpanded, { color: colors.text }]}>No car parked yet</Text>
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
  );
}

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}

const styles = StyleSheet.create({
  heroCard: { gap: 16 },
  heroCardCompact: { paddingHorizontal: 12, paddingVertical: 12, gap: 12 },
  heroCardExpanded: { paddingHorizontal: 22, paddingVertical: 22, gap: 18 },
  carSection: { alignItems: 'center' },
  carIconBg: {
    width: 76,
    height: 76,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  heroTitle: { fontSize: 30, fontWeight: '600', textAlign: 'center', lineHeight: 36, width: '100%', flexShrink: 1 },
  heroTitleCompact: { fontSize: 24, lineHeight: 30 },
  heroTitleExpanded: { fontSize: 34, lineHeight: 40 },
  noteBadge: { marginTop: 8, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12, alignSelf: 'center' },
  bodyText: { fontSize: 15, fontWeight: '400' },
  captionText: { fontSize: 12, fontWeight: '500' },
  timerAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
  },
  statusPanel: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  statusMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  locationStatusText: {
    flex: 1,
    flexWrap: 'wrap',
  },
  timerCancelButton: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  emptyState: { alignItems: 'center', paddingVertical: 16 },
  emptyIconBg: {
    width: 100,
    height: 100,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptySubtitle: { textAlign: 'center', paddingHorizontal: 24, lineHeight: 22 },
  alertBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 12,
  },
});
