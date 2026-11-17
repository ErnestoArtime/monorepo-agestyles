import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { useMemo } from "react";

import { Colors } from "@/constants/theme";
import { CartProvider } from "@/context/cart-context";
import { CustomerProvider } from "@/context/customer-context";
import { FavoritesProvider } from "@/context/favorites-context";
import { RegionProvider } from "@/context/region-context";
import { useColorScheme } from "@/hooks/use-color-scheme";

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const navigationTheme = useMemo(() => {
    const baseTheme = colorScheme === "dark" ? DarkTheme : DefaultTheme;
    return {
      ...baseTheme,
      colors: {
        ...baseTheme.colors,
        primary: colors.tint,
        background: colors.background,
        card: colors.cardBackground,
        text: colors.text,
        border: colors.border,
        notification: colors.tint,
      },
    };
  }, [colorScheme, colors]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={navigationTheme}>
        <RegionProvider>
          <CartProvider>
            <FavoritesProvider>
              <CustomerProvider>
                <Stack
                  screenOptions={{
                    headerShown: false,
                    headerStyle: { backgroundColor: colors.cardBackground },
                    headerTintColor: colors.text,
                    headerTitleStyle: { color: colors.text },
                    headerShadowVisible: false,
                    contentStyle: { backgroundColor: colors.background },
                  }}
                >
                  <Stack.Screen name="(drawer)" options={{ headerShown: false }} />
                  <Stack.Screen
                    name="checkout"
                    options={{
                      headerShown: true,
                      title: "Finalizar compra",
                      presentation: "card",
                      headerBackButtonDisplayMode: "minimal",
                    }}
                  />
                  <Stack.Screen
                    name="order-confirmation/[id]"
                    options={{
                      headerShown: true,
                      title: "Compra confirmada",
                      headerLeft: () => null,
                      gestureEnabled: false,
                      headerBackVisible: false,
                    }}
                  />
                </Stack>
                <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
              </CustomerProvider>
            </FavoritesProvider>
          </CartProvider>
        </RegionProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
