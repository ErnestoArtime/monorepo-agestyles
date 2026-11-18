import { Platform } from "react-native";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Tabs } from "expo-router";
import React from "react";

import { HapticTab } from "@/components/haptic-tab";
import { Icon } from "@agestyles/icons";
import { Colors } from "@/constants/theme";
import { useCart } from "@/context/cart-context";
import { useResponsive } from "@/hooks/use-responsive";

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { cart } = useCart();
  const { isWideWeb } = useResponsive();

  const itemCount = cart?.items?.length || 0;

  return (
    <Tabs
      screenOptions={{
        // In a browser the bar above the page belongs to the browser; Android Chrome still
        // reports a top safe-area inset, which doubled the header height (AG-24).
        ...(Platform.OS === "web" ? { headerStatusBarHeight: 0 } : {}),
        tabBarActiveTintColor: Colors[colorScheme ?? "light"].tint,
        tabBarInactiveTintColor: Colors[colorScheme ?? "light"].tabIconDefault,
        tabBarStyle: {
          // Wide browsers get the website top bar instead of the app's tab bar.
          ...(isWideWeb ? { display: "none" as const } : {}),
          backgroundColor: Colors[colorScheme ?? "light"].cardBackground,
          borderTopColor: Colors[colorScheme ?? "light"].border,
          height: 68,
          paddingTop: 8,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "500" },
        headerShown: true,
        headerStyle: { backgroundColor: Colors[colorScheme ?? "light"].cardBackground },
        headerTintColor: Colors[colorScheme ?? "light"].text,
        headerShadowVisible: false,
        tabBarButton: HapticTab,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen name="compare" options={{ href: null, title: "Comparar productos" }} />
      <Tabs.Screen name="stores" options={{ href: null, title: "Tiendas" }} />
      <Tabs.Screen
        name="(home)"
        options={{
          title: "Catálogo",
          tabBarIcon: ({ color }) => <Icon name="home" size={24} color={color} />,
          headerShown: false, // Let the home stack manage its own headers
        }}
      />
      <Tabs.Screen
        name="(cart)"
        options={{
          title: "Carrito",
          tabBarIcon: ({ color }) => <Icon name="shoppingCart" size={24} color={color} />,
          tabBarBadge: itemCount > 0 ? itemCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: Colors[colorScheme ?? "light"].tint,
          },
          headerShown: false, // Let the cart stack manage its own headers
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          // The page has its own title; the website top bar replaces the app header.
          headerShown: !isWideWeb,
          title: "Favoritos",
          tabBarIcon: ({ color }) => <Icon name="heart" size={23} color={color} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: "Cuenta",
          tabBarIcon: ({ color }) => <Icon name="user" size={24} color={color} />,
          headerShown: false,
        }}
      />
    </Tabs>
  );
}
