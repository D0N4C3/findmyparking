import { ColorTheme } from '@/constants/colors';
import { getDialogAccent, getDialogButtonVariant, DialogAction, DialogVariant } from '@/constants/dialogs';
import { spacing } from '@/constants/design-system';
import { AlertCircle, CircleHelp, ShieldAlert, TriangleAlert } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { AppButton } from '@/components/ui/primitives';
import { AppDialog } from '@/components/dialogs/AppDialog';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  description?: string;
  variant: Extract<DialogVariant, 'error' | 'confirm' | 'destructive' | 'info'>;
  actions: DialogAction[];
  colors: ColorTheme;
  onAction: (action: DialogAction) => void;
  onDismiss: () => void;
  accessibilityLabel: string;
}

const ICON_BY_VARIANT = {
  error: AlertCircle,
  confirm: CircleHelp,
  destructive: ShieldAlert,
  info: TriangleAlert,
};

export function ConfirmDialog({
  visible,
  title,
  description,
  variant,
  actions,
  colors,
  onAction,
  onDismiss,
  accessibilityLabel,
}: ConfirmDialogProps) {
  const Icon = ICON_BY_VARIANT[variant];
  const accent = getDialogAccent(colors, variant);

  return (
    <AppDialog
      visible={visible}
      title={title}
      description={description}
      colors={colors}
      onDismiss={onDismiss}
      accessibilityLabel={accessibilityLabel}
      icon={<Icon size={30} color={accent} accessibilityLabel={`${variant} dialog icon`} />}
      footer={
        <View style={styles.buttonGroup}>
          {actions.map((action, index) => (
            <AppButton
              key={action.id}
              colors={colors}
              label={action.label}
              variant={getDialogButtonVariant(action.role, index, actions.length)}
              onPress={() => onAction(action)}
              style={styles.button}
            />
          ))}
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  buttonGroup: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  button: {
    flex: 1,
  },
});
