import { AppSecondaryButton } from '@/components/ui/primitives';
import { HomeViewModel } from '@/features/home/home-view-model';
import { MapPin, MoreHorizontal, Share2, Timer } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

interface SecondaryActionGridProps {
  viewModel: HomeViewModel;
  onShare: () => void;
  onOpenNote: () => void;
  onOpenMap: () => void;
  onOpenTimer: () => void;
}

/**
 * SecondaryActionGrid displays supporting actions for an active parking session.
 *
 * Usage: render when parking exists and pass action callbacks from parent state/controller.
 */
export function SecondaryActionGrid({ viewModel, onShare, onOpenNote, onOpenMap, onOpenTimer }: SecondaryActionGridProps) {
  const { colors } = viewModel;

  return (
    <View style={styles.toolsGrid}>
      <AppSecondaryButton colors={colors} label="Share" icon={<Share2 size={18} color={colors.textPrimary ?? colors.text} />} onPress={onShare} style={styles.toolItem} />
      <AppSecondaryButton colors={colors} label="Note" icon={<MapPin size={18} color={colors.textPrimary ?? colors.text} />} onPress={onOpenNote} style={styles.toolItem} />
      <AppSecondaryButton colors={colors} label="Map" icon={<MoreHorizontal size={18} color={colors.textPrimary ?? colors.text} />} onPress={onOpenMap} style={styles.toolItem} />
      <AppSecondaryButton colors={colors} label="Timer" icon={<Timer size={18} color={colors.textPrimary ?? colors.text} />} onPress={onOpenTimer} style={styles.toolItem} />
    </View>
  );
}

const styles = StyleSheet.create({
  toolsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  toolItem: {
    width: '48%',
    borderWidth: 1,
    minHeight: 56,
    paddingVertical: 10,
    borderRadius: 14,
    gap: 6,
    justifyContent: 'center',
  },
});
