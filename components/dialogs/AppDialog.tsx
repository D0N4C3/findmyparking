import { ColorTheme } from '@/constants/colors';
import { elevation, radius, spacing, typography } from '@/constants/design-system';
import { ReactNode, useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

interface AppDialogProps {
  visible: boolean;
  title: string;
  description?: string;
  colors: ColorTheme;
  icon?: ReactNode;
  footer?: ReactNode;
  onDismiss: () => void;
  accessibilityLabel: string;
}

export function AppDialog({
  visible,
  title,
  description,
  colors,
  icon,
  footer,
  onDismiss,
  accessibilityLabel,
}: AppDialogProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.96)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, friction: 10, tension: 120, useNativeDriver: true }),
      ]).start();
    } else {
      opacity.setValue(0);
      scale.setValue(0.96);
    }
  }, [opacity, scale, visible]);

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onDismiss}>
      <Animated.View style={[styles.overlay, { backgroundColor: colors.overlay, opacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} accessibilityLabel="Dismiss dialog" />
        <Animated.View
          accessible
          accessibilityRole="alert"
          accessibilityLabel={accessibilityLabel}
          style={[
            styles.dialog,
            {
              backgroundColor: colors.cardElevated,
              borderColor: colors.border,
              shadowColor: colors.shadow,
              transform: [{ scale }],
            },
          ]}
        >
          {icon ? <View style={styles.iconContainer}>{icon}</View> : null}
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          {description ? <Text style={[styles.description, { color: colors.textSecondary }]}>{description}</Text> : null}
          {footer}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  dialog: {
    width: '100%',
    maxWidth: 420,
    borderRadius: radius.hero,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.sm,
    ...elevation.md,
  },
  iconContainer: {
    alignSelf: 'center',
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.sectionTitle,
    textAlign: 'center',
  },
  description: {
    ...typography.body,
    textAlign: 'center',
    lineHeight: 22,
  },
});
