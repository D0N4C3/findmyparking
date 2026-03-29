import { ColorTheme } from '@/constants/colors';
import { SectionHeader } from '@/components/ui/primitives';
import { Animated, StyleSheet, Text } from 'react-native';
import { Bluetooth } from 'lucide-react-native';

interface HomeHeaderProps {
  colors: ColorTheme;
  showAutoDetectionBadge: boolean;
  pulseAnim: Animated.Value;
}

/**
 * HomeHeader renders the top brand/title row for the home screen.
 *
 * Usage: place this at the top of the Home screen and pass `showAutoDetectionBadge`
 * with a pulsing `Animated.Value` to visualize active Bluetooth auto-detection.
 */
export function HomeHeader({ colors, showAutoDetectionBadge, pulseAnim }: HomeHeaderProps) {
  return (
    <SectionHeader
      colors={colors}
      title="ParkPing"
      subtitle="Never forget where you parked"
      right={showAutoDetectionBadge ? (
        <Animated.View style={[styles.bluetoothBadge, { backgroundColor: colors.surface, borderColor: colors.border, transform: [{ scale: pulseAnim }] }]}>
          <Bluetooth size={16} color={colors.success} />
          <Text style={[styles.bluetoothText, { color: colors.success }]}>Auto</Text>
        </Animated.View>
      ) : undefined}
    />
  );
}

const styles = StyleSheet.create({
  bluetoothBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  bluetoothText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
