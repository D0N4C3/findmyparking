import { AppSecondaryButton } from '@/components/ui/primitives';
import { HomeViewModel } from '@/features/home/home-view-model';
import { Camera, FileText, History, Share2 } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

type HomeBreakpoint = 'compact' | 'standard' | 'expanded';

interface SecondaryActionGridProps {
  viewModel: HomeViewModel;
  onShare: () => void;
  onOpenNote: () => void;
  onOpenMap: () => void;
  onOpenTimer: () => void;
  onEndSession: () => void;
  breakpoint?: HomeBreakpoint;
}

export function SecondaryActionGrid({ viewModel, onShare, onOpenNote, onOpenMap, breakpoint = 'standard' }: SecondaryActionGridProps) {
  const { colors } = viewModel;
  const isCompact = breakpoint === 'compact';

  return (
    <View style={[styles.row, isCompact && styles.rowCompact]}>
      <AppSecondaryButton colors={colors} label="Add Photo" icon={<Camera size={16} color={colors.textPrimary ?? colors.text} />} onPress={onOpenMap} style={styles.item} />
      <AppSecondaryButton colors={colors} label="Add Note" icon={<FileText size={16} color={colors.textPrimary ?? colors.text} />} onPress={onOpenNote} style={styles.item} />
      <AppSecondaryButton colors={colors} label="Share" icon={<Share2 size={16} color={colors.textPrimary ?? colors.text} />} onPress={onShare} style={styles.item} />
      <AppSecondaryButton colors={colors} label="History" icon={<History size={16} color={colors.textPrimary ?? colors.text} />} onPress={onOpenMap} style={styles.item} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  rowCompact: {
    flexDirection: 'column',
  },
  item: {
    minHeight: 44,
    borderRadius: 12,
    paddingVertical: 8,
    flexBasis: '48%',
    flexGrow: 1,
  },
});
