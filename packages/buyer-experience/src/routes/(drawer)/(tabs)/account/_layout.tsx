import { Platform } from "react-native";
import { Stack } from "expo-router";
import { MenuButton } from "../../../../components/menu-button";
import { NotificationHeaderBell } from "../../../../components/notification-header-bell";
import { Colors } from "../../../../constants/theme";
import { useColorScheme } from "../../../../hooks/use-color-scheme";
import { useResponsive } from "../../../../hooks/use-responsive";
import {
  webContentStyle,
  webFormStyle,
  webPageHeaderOption,
} from "../../../../components/web-page-header";

export default function AccountLayout() {
  const colorScheme = useColorScheme();
  const { isWideWeb } = useResponsive();
  const colors = Colors[colorScheme ?? "light"];

  return (
    <Stack
      screenOptions={{
        // Wide browsers: a page heading under the website top bar, not a second app bar.
        ...webPageHeaderOption(isWideWeb),
        // In a browser the bar above the page belongs to the browser; Android Chrome still
        // reports a top safe-area inset, which doubled the header height (AG-24).
        ...(Platform.OS === "web" ? { headerStatusBarHeight: 0 } : {}),
        headerBackButtonDisplayMode: "minimal",
        headerStyle: { backgroundColor: colors.cardBackground },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        contentStyle: [{ backgroundColor: colors.background }, isWideWeb ? webContentStyle : null],
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: "Mi cuenta",
          headerRight: () => <NotificationHeaderBell />,
          // Wide browsers: the account area has its own heading and side menu, like a website.
          ...(isWideWeb ? { headerShown: false } : { headerLeft: () => <MenuButton /> }),
        }}
      />
      <Stack.Screen
        name="login"
        options={{
          title: "Iniciar sesión",
          ...(isWideWeb ? { contentStyle: webFormStyle(colors.background) } : {}),
        }}
      />
      <Stack.Screen
        name="register"
        options={{
          title: "Crear cuenta",
          ...(isWideWeb ? { contentStyle: webFormStyle(colors.background) } : {}),
        }}
      />
      <Stack.Screen
        name="forgot-password"
        options={{
          title: "Recuperar contraseña",
          ...(isWideWeb ? { contentStyle: webFormStyle(colors.background) } : {}),
        }}
      />
      <Stack.Screen
        name="orders"
        options={{
          title: "Mis compras",
          // Reached from the side menu: the menu button, not a way back to Cuenta.
          ...(isWideWeb ? {} : { headerLeft: () => <MenuButton /> }),
        }}
      />
      <Stack.Screen name="orders/[id]" options={{ title: "Detalles de compra" }} />
    </Stack>
  );
}
