import { AppPrimaryButton, AppSecondaryButton } from '@/components/ui/primitives';
import { HomeViewModel } from '@/features/home/home-view-model';
import { ChevronRight, LocateFixed, Navigation, Plus } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

interface PrimaryActionBarProps {
  viewModel: HomeViewModel;
  onSaveParking: () => void;
  onNavigateExternal: () => void;
  onUpdateLocation: () => void;
}

/**
 * PrimaryActionBar renders the single highest-priority home action.
 *
 * Usage: provide callbacks from the screen controller; this widget is display-only
 * and chooses button label/icon based on `HomeViewModel.currentParking`.
 */
export function PrimaryActionBar({ viewModel, onSaveParking, onNavigateExternal, onUpdateLocation }: PrimaryActionBarProps) {
  const { colors, currentParking, isLoading, shouldShowUpdateLocation } = viewModel;

  if (currentParking) {
    return (
      <View style={styles.actionsWrap}>
        <AppPrimaryButton
          colors={colors}
          label="Navigate to Car"
          onPress={onNavigateExternal}
          icon={<Navigation size={20} color={colors.textOnAccent} />}
          trailingIcon={<ChevronRight size={20} color={colors.textOnAccent} />}
          style={styles.primaryAction}
        />
        {shouldShowUpdateLocation ? (
          <AppSecondaryButton
            colors={colors}
            label="Update Location"
            onPress={onUpdateLocation}
            icon={<LocateFixed size={18} color={colors.textPrimary ?? colors.text} />}
            style={styles.secondaryAction}
          />
        ) : null}
      </View>
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
  actionsWrap: {
    gap: 10,
  },
  primaryAction: {
    paddingVertical: 16,
    borderRadius: 16,
  },
  secondaryAction: {
    paddingVertical: 12,
    borderRadius: 14,
  },
});
