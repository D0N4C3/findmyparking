import { AppPrimaryButton } from '@/components/ui/primitives';
import { HomeViewModel } from '@/features/home/home-view-model';
import { ChevronRight, Navigation, Plus } from 'lucide-react-native';
import { StyleSheet } from 'react-native';

interface PrimaryActionBarProps {
  viewModel: HomeViewModel;
  onSaveParking: () => void;
  onNavigateExternal: () => void;
}

/**
 * PrimaryActionBar renders the single highest-priority home action.
 *
 * Usage: provide callbacks from the screen controller; this widget is display-only
 * and chooses button label/icon based on `HomeViewModel.currentParking`.
 */
export function PrimaryActionBar({ viewModel, onSaveParking, onNavigateExternal }: PrimaryActionBarProps) {
  const { colors, currentParking, isLoading } = viewModel;

  if (currentParking) {
    return (
      <AppPrimaryButton
        colors={colors}
        label="Navigate to Car"
        onPress={onNavigateExternal}
        icon={<Navigation size={20} color={colors.textOnAccent} />}
        trailingIcon={<ChevronRight size={20} color={colors.textOnAccent} />}
        style={styles.primaryAction}
      />
    );
  }

  return (
    <AppPrimaryButton
      colors={colors}
      onPress={onSaveParking}
      disabled={isLoading}
      loading={isLoading}
      style={styles.primaryAction}
      icon={<Plus size={20} color={colors.textOnAccent} />}
      label="Save Parking Spot"
    />
  );
}

const styles = StyleSheet.create({
  primaryAction: {
    paddingVertical: 16,
    borderRadius: 16,
  },
});
