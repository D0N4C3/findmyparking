import { Tabs } from "expo-router";
import { Home, Clock, Settings, Compass } from "lucide-react-native";
import React from "react";
import { View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";

function TabIcon({ 
  Icon, 
  color, 
  isFocused 
}: { 
  Icon: typeof Home; 
  color: string; 
  isFocused: boolean;
}) {
  return (
    <View style={[styles.iconContainer, isFocused && styles.iconContainerFocused]}>
      <Icon 
        color={color} 
        size={22} 
        strokeWidth={isFocused ? 2.5 : 2}
      />
      {isFocused && (
        <View style={[styles.activeDot, { backgroundColor: color }]} />
      )}
    </View>
  );
}

export default function TabLayout() {
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();

  const tabBarBaseHeight = 84;
  const tabBarTopPadding = 8;
  const minimumBottomPadding = 10;

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.card,
          position: "absolute",
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          elevation: 0,
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.1,
          shadowRadius: 12,
          height: tabBarBaseHeight + insets.bottom,
          paddingTop: tabBarTopPadding,
          paddingBottom: Math.max(insets.bottom, minimumBottomPadding),
        },
        tabBarItemStyle: {
          justifyContent: 'center',
          alignItems: 'center',
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 4,
        },
        tabBarIcon: ({ color, focused }) => {
          let Icon = Home;
          if (route.name === "index") Icon = Home;
          else if (route.name === "map") Icon = Compass;
          else if (route.name === "history") Icon = Clock;
          else if (route.name === "settings") Icon = Settings;

          return <TabIcon Icon={Icon} color={color} isFocused={focused} />;
        },
      })}
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
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    borderRadius: 16,
    minWidth: 44,
  },
  iconContainerFocused: {
    transform: [{ scale: 1.05 }],
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 4,
  },
});
