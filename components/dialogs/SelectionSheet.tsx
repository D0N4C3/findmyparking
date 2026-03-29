import { ColorTheme } from '@/constants/colors';
import { radius, spacing, typography } from '@/constants/design-system';
import { Bluetooth, Check, ChevronRight } from 'lucide-react-native';
import { ReactNode, useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export interface SelectionItem {
  id: string;
  label: string;
  subtitle?: string;
  icon?: ReactNode;
  destructive?: boolean;
  selected?: boolean;
}

interface SelectionSheetProps {
  visible: boolean;
  title: string;
  description?: string;
  items: SelectionItem[];
  colors: ColorTheme;
  onSelect: (id: string) => void;
  onDismiss: () => void;
  accessibilityLabel: string;
}

export function SelectionSheet({
  visible,
  title,
  description,
  items,
  colors,
  onSelect,
  onDismiss,
  accessibilityLabel,
}: SelectionSheetProps) {
  const translateY = useRef(new Animated.Value(30)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, friction: 10, tension: 120, useNativeDriver: true }),
      ]).start();
    } else {
      opacity.setValue(0);
      translateY.setValue(30);
    }
  }, [opacity, translateY, visible]);

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onDismiss}>
      <Animated.View style={[styles.overlay, { backgroundColor: colors.overlay, opacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} accessibilityLabel="Dismiss selection sheet" />
        <Animated.View
          accessible
          accessibilityRole="menu"
          accessibilityLabel={accessibilityLabel}
          style={[
            styles.sheet,
            {
              backgroundColor: colors.cardElevated,
              borderTopColor: colors.border,
              transform: [{ translateY }],
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <View style={styles.headerRow}>
            <Bluetooth size={20} color={colors.accent} />
            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          </View>
          {description ? <Text style={[styles.description, { color: colors.textSecondary }]}>{description}</Text> : null}

          <View style={styles.list}>
            {items.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.item, { backgroundColor: colors.surfaceSecondary }]}
                onPress={() => onSelect(item.id)}
                accessibilityRole="button"
                accessibilityLabel={item.label}
              >
                <View style={styles.itemLeft}>
                  {item.icon ?? <Bluetooth size={16} color={colors.accent} />}
                  <View>
                    <Text style={[styles.itemLabel, { color: item.destructive ? colors.error : colors.text }]}>{item.label}</Text>
                    {item.subtitle ? <Text style={[styles.itemSubtitle, { color: colors.textMuted }]}>{item.subtitle}</Text> : null}
                  </View>
                </View>

                {item.selected ? <Check size={16} color={colors.success} /> : <ChevronRight size={16} color={colors.textMuted} />}
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: radius.hero,
    borderTopRightRadius: radius.hero,
    borderTopWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  handle: {
    width: 44,
    height: 5,
    borderRadius: radius.pill,
    alignSelf: 'center',
    marginBottom: spacing.xs,
  },
  headerRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    alignItems: 'center',
  },
  title: {
    ...typography.sectionTitle,
  },
  description: {
    ...typography.body,
    lineHeight: 22,
  },
  list: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  item: {
    borderRadius: radius.standard,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  itemLabel: {
    ...typography.body,
    fontWeight: '700',
  },
  itemSubtitle: {
    ...typography.caption,
    marginTop: 2,
  },
});
