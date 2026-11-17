import { useColorScheme } from "@/hooks/use-color-scheme";
import { DrawerActions } from "@react-navigation/native";
import { Stack, useNavigation } from "expo-router";
import React from "react";
import { TouchableOpacity } from "react-native";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { BrandLockup } from "@/components/brand-lockup";
import { Colors } from "@/constants/theme";

export default function HomeStackLayout() {
  const colorScheme = useColorScheme();
  const navigation = useNavigation();
  const colors = Colors[colorScheme ?? "light"];

  return (
    <Stack
      screenOptions={{
        headerShown: true,
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          headerTitle: () => <BrandLockup />,
          headerStyle: { backgroundColor: colors.cardBackground },
          headerTintColor: colors.text,
          headerShadowVisible: false,
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
          title: "Detalles del producto",
          presentation: "card",
          headerBackButtonDisplayMode: "minimal",
        }}
      />
    </Stack>
  );
}
