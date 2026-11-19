import { Platform } from "react-native";
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack, useGlobalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { useEffect, useMemo } from "react";

import { Colors } from "../constants/theme";
import { CartProvider } from "../context/cart-context";
import { NotificationsLayer } from "../components/notifications-layer";
import { CustomerProvider } from "../context/customer-context";
import { FavoritesProvider } from "../context/favorites-context";
import { RegionProvider } from "../context/region-context";
import { ThemePreferenceProvider } from "../context/theme-preference";
import { UiThemeProvider } from "@agestyles/ui-native";
import { useColorScheme } from "../hooks/use-color-scheme";
import { useResponsive } from "../hooks/use-responsive";
import { webContentStyle, webPageHeaderOption } from "../components/web-page-header";
import { rememberAgentCode } from "../lib/agent-code";
import { MaintenanceGate } from "../components/maintenance-gate";

export default function RootLayout() {
  return (
    <ThemePreferenceProvider>
      <RootNavigation />
    </ThemePreferenceProvider>
  );
}

function RootNavigation() {
  const colorScheme = useColorScheme();
  const { isWideWeb } = useResponsive();
  // A sales agent's link (`?gestor=CODE`) is remembered and offered at checkout (AG-06).
  const { gestor } = useGlobalSearchParams<{ gestor?: string }>();
  useEffect(() => {
    if (gestor) void rememberAgentCode(gestor);
  }, [gestor]);
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
    <UiThemeProvider scheme={colorScheme === "dark" ? "dark" : "light"}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ThemeProvider value={navigationTheme}>
          <RegionProvider>
            <CartProvider>
              <FavoritesProvider>
                <CustomerProvider>
                  <NotificationsLayer>
                    <Stack
                      screenOptions={{
                        // Wide browsers: a page heading under the website top bar, not a second app bar.
                        ...webPageHeaderOption(isWideWeb),
                        // In a browser the bar above the page belongs to the browser; Android Chrome still
                        // reports a top safe-area inset, which doubled the header height (AG-24).
                        ...(Platform.OS === "web" ? { headerStatusBarHeight: 0 } : {}),
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
                          ...(isWideWeb
                            ? {
                                contentStyle: [
                                  { backgroundColor: colors.background },
                                  webContentStyle,
                                ],
                              }
                            : {}),
                          title: "Finalizar compra",
                          presentation: "card",
                          headerBackButtonDisplayMode: "minimal",
                        }}
                      />
                      <Stack.Screen
                        name="notifications"
                        options={{
                          headerShown: true,
                          ...(isWideWeb
                            ? {
                                contentStyle: [
                                  { backgroundColor: colors.background },
                                  webContentStyle,
                                ],
                              }
                            : {}),
                          title: "Notificaciones",
                          headerBackButtonDisplayMode: "minimal",
                        }}
                      />
                      <Stack.Screen
                        name="notification-preferences"
                        options={{
                          headerShown: true,
                          ...(isWideWeb
                            ? {
                                contentStyle: [
                                  { backgroundColor: colors.background },
                                  webContentStyle,
                                ],
                              }
                            : {}),
                          title: "Avisos",
                          headerBackButtonDisplayMode: "minimal",
                        }}
                      />
                      <Stack.Screen
                        name="reset-password"
                        options={{
                          headerShown: true,
                          ...(isWideWeb
                            ? {
                                contentStyle: [
                                  { backgroundColor: colors.background },
                                  webContentStyle,
                                ],
                              }
                            : {}),
                          title: "Nueva contraseña",
                          headerBackButtonDisplayMode: "minimal",
                        }}
                      />
                      <Stack.Screen
                        name="order-confirmation/[id]"
                        options={{
                          headerShown: true,
                          ...(isWideWeb
                            ? {
                                contentStyle: [
                                  { backgroundColor: colors.background },
                                  webContentStyle,
                                ],
                              }
                            : {}),
                          title: "Compra confirmada",
                          headerLeft: () => null,
                          gestureEnabled: false,
                          headerBackVisible: false,
                        }}
                      />
                    </Stack>
                    <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
                  </NotificationsLayer>
                </CustomerProvider>
              </FavoritesProvider>
            </CartProvider>
          </RegionProvider>
        </ThemeProvider>
        <MaintenanceGate />
      </GestureHandlerRootView>
    </UiThemeProvider>
  );
}
