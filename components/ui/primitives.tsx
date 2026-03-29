import { ColorTheme } from '@/constants/colors';
import { elevation, radius, spacing, typography } from '@/constants/design-system';
import { ReactNode } from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

type ElevationLevel = keyof typeof elevation;

interface AppCardProps {
  colors: ColorTheme;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  elevated?: ElevationLevel;
}

export function AppCard({ colors, children, style, elevated = 'sm' }: AppCardProps) {
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          shadowColor: colors.shadow,
          ...elevation[elevated],
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

interface AppButtonProps {
  colors: ColorTheme;
  label?: string;
  onPress: () => void;
  icon?: ReactNode;
  trailingIcon?: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}

export function AppButton({
  colors,
  label,
  onPress,
  icon,
  trailingIcon,
  variant = 'secondary',
  style,
  disabled,
}: AppButtonProps) {
  const palette = {
    primary: {
      backgroundColor: colors.accent,
      color: colors.textOnAccent,
    },
    secondary: {
      backgroundColor: colors.surfaceSecondary,
      color: colors.text,
    },
    ghost: {
      backgroundColor: 'transparent',
      color: colors.text,
    },
    danger: {
      backgroundColor: colors.error,
      color: colors.textOnAccent,
    },
  }[variant];

  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: palette.backgroundColor, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      {icon}
      {label ? <Text style={[styles.buttonText, { color: palette.color }]}>{label}</Text> : null}
      {trailingIcon}
    </Pressable>
  );
}

interface SectionHeaderProps {
  colors: ColorTheme;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function SectionHeader({ colors, title, subtitle, right, style }: SectionHeaderProps) {
  return (
    <View style={[styles.sectionHeader, style]}>
      <View>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{title}</Text>
        {subtitle ? <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

interface StatTileProps {
  colors: ColorTheme;
  icon: ReactNode;
  value: string;
  label: string;
  style?: StyleProp<ViewStyle>;
}

export function StatTile({ colors, icon, value, label, style }: StatTileProps) {
  return (
    <View style={[styles.statTile, { backgroundColor: colors.surfaceSecondary }, style]}>
      {icon}
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}



type AppPrimaryButtonProps = Omit<AppButtonProps, 'variant'>;

export function AppPrimaryButton(props: AppPrimaryButtonProps) {
  return <AppButton {...props} variant="primary" />;
}

type AppSecondaryButtonProps = Omit<AppButtonProps, 'variant'>;

export function AppSecondaryButton(props: AppSecondaryButtonProps) {
  return <AppButton {...props} variant="secondary" />;
}

interface MetricChipProps {
  colors: ColorTheme;
  icon: ReactNode;
  value: string;
  label: string;
  style?: StyleProp<ViewStyle>;
}

export function MetricChip({ colors, icon, value, label, style }: MetricChipProps) {
  return <StatTile colors={colors} icon={icon} value={value} label={label} style={style} />;
}

interface InfoTileProps {
  colors: ColorTheme;
  icon: ReactNode;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function InfoTile({ colors, icon, children, style }: InfoTileProps) {
  return (
    <View style={[styles.infoTile, { backgroundColor: colors.card, borderColor: colors.border }, style]}>
      {icon}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    padding: spacing.lg,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  buttonText: {
    ...typography.button,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  headerTitle: {
    ...typography.title,
  },
  headerSubtitle: {
    ...typography.caption,
    marginTop: spacing.xxs,
  },
  statTile: {
    flex: 1,
    borderRadius: radius.md,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.xxs,
  },
  statValue: {
    fontSize: 17,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  infoTile: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
});
