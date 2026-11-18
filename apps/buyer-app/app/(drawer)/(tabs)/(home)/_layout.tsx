import { useColorScheme } from "@/hooks/use-color-scheme";
import { DrawerActions } from "@react-navigation/native";
import { Stack, useNavigation } from "expo-router";
import React from "react";
import { TouchableOpacity, Platform } from "react-native";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { BrandLockup } from "@/components/brand-lockup";
import { NotificationHeaderBell } from "@/components/notification-header-bell";
import { Colors } from "@/constants/theme";
import { useResponsive } from "@/hooks/use-responsive";

export default function HomeStackLayout() {
  const colorScheme = useColorScheme();
  const navigation = useNavigation();
  const colors = Colors[colorScheme ?? "light"];
  const { isWideWeb } = useResponsive();

  return (
    <Stack
      screenOptions={{
        // In a browser the bar above the page belongs to the browser; Android Chrome still
        // reports a top safe-area inset, which doubled the header height (AG-24).
        ...(Platform.OS === "web" ? { headerStatusBarHeight: 0 } : {}),
        headerShown: true,
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          // The website top bar already carries the brand, the menu and the bell.
          headerShown: !isWideWeb,
          headerTitle: () => <BrandLockup />,
          headerStyle: { backgroundColor: colors.cardBackground },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          headerRight: () => <NotificationHeaderBell />,
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
              accessibilityRole="button"
              accessibilityLabel="Abrir menú de navegación"
              style={{
                height: 44,
                width: 44,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <IconSymbol size={24} name="line.3.horizontal" color={colors.icon} />
            </TouchableOpacity>
          ),
        }}
      />
      <Stack.Screen
        name="product/[id]"
        options={{
          headerShown: !isWideWeb,
          title: "Detalles del producto",
          presentation: "card",
          headerBackButtonDisplayMode: "minimal",
        }}
      />
    </Stack>
  );
}
