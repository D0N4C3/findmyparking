import { Tabs } from "expo-router";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Home, Clock, Settings, Compass, Bluetooth } from "lucide-react-native";
import React, { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/colors";
import { elevation, radius, spacing, typography } from "@/constants/design-system";
import { useParking } from "@/context/ParkingContext";
import { useTheme } from "@/context/ThemeContext";

type TabRouteName = "index" | "map" | "history" | "settings";

const TAB_ICON_MAP: Record<TabRouteName, typeof Home> = {
  index: Home,
  map: Compass,
  history: Clock,
  settings: Settings,
};

function getTabLabel(options: BottomTabBarProps["descriptors"][string]["options"], routeName: string) {
  if (typeof options.tabBarLabel === "string") return options.tabBarLabel;
  if (typeof options.title === "string") return options.title;
  return routeName;
}

function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const isDark = theme?.isDark ?? false;
  const colors = isDark ? Colors.dark : Colors.light;
  const { currentParking, isAutoDetectionEnabled, savedBluetoothDevice } = useParking();

  const animatedValues = useRef<Record<string, Animated.Value>>({}).current;

  useEffect(() => {
    state.routes.forEach((route, index) => {
      if (!animatedValues[route.key]) {
        animatedValues[route.key] = new Animated.Value(index === state.index ? 1 : 0);
      }

      Animated.spring(animatedValues[route.key], {
        toValue: index === state.index ? 1 : 0,
        useNativeDriver: true,
        stiffness: 210,
        damping: 20,
        mass: 0.8,
      }).start();
    });
  }, [animatedValues, state.index, state.routes]);

  const containerStyle = useMemo<ViewStyle>(
    () => ({
      paddingBottom: Math.max(insets.bottom, 0),
      backgroundColor: isDark ? "rgba(10,18,34,0.96)" : "rgba(255,255,255,0.94)",
    }),
    [insets.bottom, isDark]
  );

  return (
    <View style={[styles.outerContainer, containerStyle]} pointerEvents="box-none">
      <BlurView intensity={isDark ? 44 : 58} tint={isDark ? "dark" : "light"} style={styles.blurShell}>
        <LinearGradient
          colors={
            isDark
              ? ["rgba(10,18,34,0.96)", "rgba(16,23,41,0.88)"]
              : ["rgba(255,255,255,0.94)", "rgba(241,245,249,0.9)"]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.gradientShell, { borderColor: colors.border }]}
        >
          {state.routes.map((route, index) => {
            const tabRouteName = route.name as TabRouteName;
            const descriptor = descriptors[route.key];
            const options = descriptor.options;
            const isFocused = state.index === index;
            const label = getTabLabel(options, route.name);

            const onPress = () => {
              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });

              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name, route.params);
              }
            };

            const onLongPress = () => {
              navigation.emit({
                type: "tabLongPress",
                target: route.key,
              });
            };

            const badgeText =
              tabRouteName === "index" && currentParking
                ? "Live"
                : tabRouteName === "settings" && isAutoDetectionEnabled && savedBluetoothDevice
                  ? "Auto"
                  : undefined;

            const tabAnim = animatedValues[route.key] ?? new Animated.Value(isFocused ? 1 : 0);
            const Icon = TAB_ICON_MAP[tabRouteName] ?? Home;

            return (
              <TouchableOpacity
                key={route.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: isFocused }}
                accessibilityLabel={options.tabBarAccessibilityLabel ?? `${label} tab`}
                accessibilityHint={`Navigates to ${label}`}
                testID={options.tabBarButtonTestID}
                onPress={onPress}
                onLongPress={onLongPress}
                activeOpacity={0.9}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.tabButton}
              >
                <Animated.View
                  style={[
                    styles.activePill,
                    {
                      backgroundColor: isDark ? "rgba(59,130,246,0.24)" : "rgba(37,99,235,0.15)",
                      borderColor: isDark ? "rgba(96,165,250,0.46)" : "rgba(37,99,235,0.34)",
                      opacity: tabAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }),
                      transform: [
                        {
                          scaleX: tabAnim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }),
                        },
                        {
                          scaleY: tabAnim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }),
                        },
                      ],
                    },
                  ]}
                />

                <Animated.View
                  style={{
                    transform: [
                      {
                        scale: tabAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }),
                      },
                    ],
                  }}
                >
                  <Icon
                    color={isFocused ? (isDark ? "#93C5FD" : "#1D4ED8") : colors.textMuted}
                    size={20}
                    strokeWidth={isFocused ? 2.5 : 2}
                  />
                </Animated.View>

                {badgeText ? (
                  <View
                    style={[
                      styles.contextBadge,
                      {
                        backgroundColor: tabRouteName === "index" ? colors.accent : colors.success,
                      },
                    ]}
                  >
                    {tabRouteName === "settings" ? <Bluetooth size={10} color="#fff" strokeWidth={2.2} /> : null}
                    <Text style={styles.contextBadgeText}>{badgeText}</Text>
                  </View>
                ) : null}

                <Animated.Text
                  style={[
                    styles.tabLabel,
                    {
                      color: isFocused ? (isDark ? "#E2F3FF" : "#0F172A") : colors.textMuted,
                      opacity: tabAnim.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] }),
                      transform: [
                        {
                          translateY: tabAnim.interpolate({ inputRange: [0, 1], outputRange: [2, 0] }),
                        },
                      ],
                    },
                  ]}
                  numberOfLines={1}
                >
                  {label}
                </Animated.Text>
              </TouchableOpacity>
            );
          })}
        </LinearGradient>
      </BlurView>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          display: "none",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: "Navigate",
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "History",
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  blurShell: {
    marginHorizontal: 0,
    marginBottom: 0,
    borderRadius: 0,
    overflow: "hidden",
  },
  gradientShell: {
    minHeight: 62,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderWidth: 0.5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#020617",
    ...elevation.lg,
  },
  tabButton: {
    flex: 1,
    minHeight: 42,
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xxs,
  },
  activePill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius.lg,
    borderWidth: 0.5,
  },
  tabLabel: {
    ...typography.caption,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  contextBadge: {
    position: "absolute",
    top: 0,
    right: 10,
    minHeight: 16,
    borderRadius: radius.pill,
    paddingHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 3,
  },
  contextBadgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
});
