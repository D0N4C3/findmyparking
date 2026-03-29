import { InfoTile, MetricChip } from '@/components/ui/primitives';
import { HomeViewModel } from '@/features/home/home-view-model';
import { Clock, Navigation, TrendingUp, Zap } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

interface StatsSummaryCardProps {
  viewModel: HomeViewModel;
}

/**
 * StatsSummaryCard presents quick parking metrics and rolling totals.
 *
 * Usage: render beneath active parking actions; pass a `HomeViewModel` with prepared
 * display strings to keep formatting logic in the screen layer.
 */
export function StatsSummaryCard({ viewModel }: StatsSummaryCardProps) {
  const { colors, distanceText, walkingTimeText, parkedAtText, parkingStats } = viewModel;

  return (
    <View style={styles.wrapper}>
      <View style={styles.statsGrid}>
        <MetricChip colors={colors} icon={<Navigation size={16} color={colors.accent} />} value={distanceText} label="away" />
        <MetricChip colors={colors} icon={<Clock size={16} color={colors.accent} />} value={walkingTimeText} label="walk" />
        <MetricChip colors={colors} icon={<Zap size={16} color={colors.accent} />} value={parkedAtText} label="parked" />
      </View>

      {parkingStats.totalParkings > 0 && (
        <View style={styles.summaryRow}>
          <InfoTile colors={colors} icon={<TrendingUp size={16} color={colors.accent} />}>
            <Text style={[styles.bodyText, { color: colors.text }]}>Total: {parkingStats.totalParkings}</Text>
          </InfoTile>
          <InfoTile colors={colors} icon={<Clock size={16} color={colors.accent} />}>
            <Text style={[styles.bodyText, { color: colors.text }]}>Week: {parkingStats.lastWeekParkings}</Text>
          </InfoTile>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  bodyText: {
    fontSize: 15,
    fontWeight: '400',
  },
});
