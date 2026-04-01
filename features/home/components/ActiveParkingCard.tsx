import { AppCard } from '@/components/ui/primitives';
import { HomeViewModel } from '@/features/home/home-view-model';
import { Car, Clock3, MapPin, Sparkles } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

type HomeBreakpoint = 'compact' | 'standard' | 'expanded';

interface ActiveParkingCardProps {
  viewModel: HomeViewModel;
  onClearTimer: () => void;
  breakpoint?: HomeBreakpoint;
}

export function ActiveParkingCard({ viewModel, breakpoint = 'standard' }: ActiveParkingCardProps) {
  const { colors, currentParking, hasParkingHistory, lastKnownParkingLabel, isTimerActive, timerRemaining, parkedAgoText, noteOrSpotText, distanceText, walkingTimeText } = viewModel;
  const isCompact = breakpoint === 'compact';

  const isFreshParking = currentParking ? Date.now() - currentParking.timestamp < 120000 : false;
  const numericDistance = currentParking ? Number.parseFloat(distanceText) : NaN;
  const isVeryClose = currentParking && !Number.isNaN(numericDistance) && numericDistance < 30;
  const isVeryFar = currentParking && distanceText.includes('km') && numericDistance >= 1;

  const contextTitle = isTimerActive && timerRemaining !== null
    ? '⏰ Parking expires soon'
    : isVeryFar
      ? '📍 Far away alert'
      : isVeryClose
        ? '👀 Your car is nearby'
        : '🧠 Pattern insight';

  const contextBody = isTimerActive && timerRemaining !== null
    ? `Expires in ${formatDuration(timerRemaining)}`
    : isVeryFar
      ? `You are about ${distanceText} from your car.`
      : isVeryClose
        ? 'You are very close to your parked location.'
        : 'You usually park around this area at this time.';

  return (
    <AppCard colors={colors} elevated="lg" style={[styles.heroCard, isCompact && styles.heroCardCompact]}>
      {currentParking ? (
        <>
          <View>
            <Text style={[styles.statusTitle, { color: colors.text }]}>{isFreshParking ? '✅ Parking location saved' : '🚗 Your car is parked'}</Text>
            <Text style={[styles.statusSubtitle, { color: colors.textSecondary }]}>
              {isFreshParking ? `${currentParking.address || 'Saved location'} • Just now` : `${distanceText} away • ${walkingTimeText} walk`}
            </Text>
          </View>

          <View style={[styles.miniMap, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}> 
            <View style={[styles.marker, styles.userMarker, { backgroundColor: colors.accent }]} />
            <View style={[styles.routeLine, { backgroundColor: colors.textMuted }]} />
            <View style={[styles.marker, styles.carMarker, { backgroundColor: colors.success }]} />
            <Text style={[styles.mapLabel, styles.userLabel, { color: colors.textMuted }]}>You</Text>
            <Text style={[styles.mapLabel, styles.carLabel, { color: colors.textMuted }]}>Car</Text>
          </View>

          <View style={styles.quickInfoRow}>
            <View style={styles.quickInfoItem}>
              <MapPin size={14} color={colors.accent} />
              <Text style={[styles.quickInfoText, { color: colors.text }]} numberOfLines={1}>{currentParking.address || 'Saved spot'}</Text>
            </View>
            <View style={styles.quickInfoItem}>
              <Clock3 size={14} color={colors.accent} />
              <Text style={[styles.quickInfoText, { color: colors.text }]}>{parkedAgoText}</Text>
            </View>
            <View style={styles.quickInfoItem}>
              <Car size={14} color={colors.accent} />
              <Text style={[styles.quickInfoText, { color: colors.text }]}>{distanceText}</Text>
            </View>
          </View>

          <View style={[styles.contextCard, { backgroundColor: colors.surfaceSecondary }]}> 
            <View style={styles.contextHeader}>
              <Sparkles size={14} color={colors.accent} />
              <Text style={[styles.contextTitle, { color: colors.text }]}>{contextTitle}</Text>
            </View>
            <Text style={[styles.contextBody, { color: colors.textSecondary }]}>{contextBody}</Text>
          </View>

          {noteOrSpotText ? <Text style={[styles.noteText, { color: colors.textSecondary }]}>📸 Parking note: {noteOrSpotText}</Text> : null}
        </>
      ) : (
        <View style={styles.emptyState}>
          <Text style={[styles.statusTitle, { color: colors.text }]}>No recent parking found</Text>
          <Text style={[styles.statusSubtitle, { color: colors.textSecondary }]}>Save your parking location in one tap.</Text>
          {hasParkingHistory && (
            <Text style={[styles.lastKnownText, { color: colors.textMuted }]}>Last known: {lastKnownParkingLabel || 'Saved location'}</Text>
          )}
        </View>
      )}
    </AppCard>
  );
}

function formatDuration(ms: number): string {
  const minutes = Math.max(1, Math.floor(ms / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

const styles = StyleSheet.create({
  heroCard: { gap: 16 },
  heroCardCompact: { paddingHorizontal: 12, paddingVertical: 12, gap: 12 },
  statusTitle: { fontSize: 24, fontWeight: '700' },
  statusSubtitle: { fontSize: 15, marginTop: 6 },
  miniMap: {
    height: 110,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
  },
  marker: {
    width: 14,
    height: 14,
    borderRadius: 999,
    position: 'absolute',
  },
  userMarker: { left: 24, top: 48 },
  carMarker: { right: 24, top: 48 },
  routeLine: {
    position: 'absolute',
    left: 38,
    right: 38,
    top: 54,
    height: 2,
    opacity: 0.5,
  },
  mapLabel: { position: 'absolute', fontSize: 11, fontWeight: '600' },
  userLabel: { left: 20, top: 66 },
  carLabel: { right: 20, top: 66 },
  quickInfoRow: {
    flexDirection: 'row',
    gap: 8,
  },
  quickInfoItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  quickInfoText: { fontSize: 12, fontWeight: '600', flexShrink: 1 },
  contextCard: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, gap: 4 },
  contextHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  contextTitle: { fontSize: 13, fontWeight: '700' },
  contextBody: { fontSize: 13 },
  noteText: { fontSize: 13, fontStyle: 'italic' },
  emptyState: { gap: 8 },
  lastKnownText: { fontSize: 13 },
});
