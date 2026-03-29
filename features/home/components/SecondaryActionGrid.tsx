import { AppSecondaryButton } from '@/components/ui/primitives';
import { HomeViewModel } from '@/features/home/home-view-model';
import { ChevronDown, ChevronUp, MapPin, Route, Share2, Timer } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

type HomeBreakpoint = 'compact' | 'standard' | 'expanded';

interface SecondaryActionGridProps {
  viewModel: HomeViewModel;
  onShare: () => void;
  onOpenNote: () => void;
  onOpenMap: () => void;
  onOpenTimer: () => void;
  breakpoint?: HomeBreakpoint;
}

/**
 * SecondaryActionGrid displays supporting actions for an active parking session.
 *
 * Usage: render when parking exists and pass action callbacks from parent state/controller.
 */
export function SecondaryActionGrid({ viewModel, onShare, onOpenNote, onOpenMap, onOpenTimer, breakpoint = 'standard' }: SecondaryActionGridProps) {
  const { colors } = viewModel;
  const [isExpanded, setIsExpanded] = useState(false);
  const columnCount = breakpoint === 'compact' ? 1 : breakpoint === 'expanded' ? 4 : 2;
  const itemWidth = `${100 / columnCount - (columnCount - 1) * 2}%` as const;

  return (
    <View style={styles.container}>
      <AppSecondaryButton
        colors={colors}
        label={isExpanded ? 'Hide tools' : 'More tools'}
        onPress={() => setIsExpanded((prev) => !prev)}
        icon={isExpanded ? <ChevronUp size={18} color={colors.textPrimary ?? colors.text} /> : <ChevronDown size={18} color={colors.textPrimary ?? colors.text} />}
        style={styles.toggleButton}
      />

      {isExpanded ? (
        <>
          <Text style={[styles.helperText, { color: colors.textMuted }]}>Tertiary actions for note sharing and parking timers.</Text>
          <View style={styles.toolsGrid}>
            <AppSecondaryButton colors={colors} label="Share" icon={<Share2 size={18} color={colors.textPrimary ?? colors.text} />} onPress={onShare} style={[styles.toolItem, { width: itemWidth }]} />
            <AppSecondaryButton colors={colors} label="Note" icon={<MapPin size={18} color={colors.textPrimary ?? colors.text} />} onPress={onOpenNote} style={[styles.toolItem, { width: itemWidth }]} />
            <AppSecondaryButton colors={colors} label="Route" icon={<Route size={18} color={colors.textPrimary ?? colors.text} />} onPress={onOpenMap} style={[styles.toolItem, { width: itemWidth }]} />
            <AppSecondaryButton colors={colors} label="Timer" icon={<Timer size={18} color={colors.textPrimary ?? colors.text} />} onPress={onOpenTimer} style={[styles.toolItem, { width: itemWidth }]} />
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  toggleButton: {
    minHeight: 52,
    borderRadius: 14,
  },
  helperText: {
    fontSize: 12,
    fontWeight: '500',
  },
  toolsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  toolItem: {
    borderWidth: 1,
    minHeight: 56,
    paddingVertical: 10,
    borderRadius: 14,
    gap: 6,
    justifyContent: 'center',
  },
});
