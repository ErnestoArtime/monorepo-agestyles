import { Platform } from "react-native";
import { Stack } from "expo-router";
import { NotificationHeaderBell } from "../../../../components/notification-header-bell";
import { Colors } from "../../../../constants/theme";
import { useColorScheme } from "../../../../hooks/use-color-scheme";

export default function AccountLayout() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];

  return (
    <Stack
      screenOptions={{
        // In a browser the bar above the page belongs to the browser; Android Chrome still
        // reports a top safe-area inset, which doubled the header height (AG-24).
        ...(Platform.OS === "web" ? { headerStatusBarHeight: 0 } : {}),
        headerBackButtonDisplayMode: "minimal",
        headerStyle: { backgroundColor: colors.cardBackground },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen
        name="index"
        options={{ title: "Cuenta", headerRight: () => <NotificationHeaderBell /> }}
      />
      <Stack.Screen name="login" options={{ title: "Iniciar sesión" }} />
      <Stack.Screen name="register" options={{ title: "Crear cuenta" }} />
      <Stack.Screen name="forgot-password" options={{ title: "Recuperar contraseña" }} />
      <Stack.Screen name="orders" options={{ title: "Mis compras" }} />
      <Stack.Screen name="orders/[id]" options={{ title: "Detalles de compra" }} />
    </Stack>
  );
}
