import { Stack } from "expo-router";
import { NotificationHeaderBell } from "@/components/notification-header-bell";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

export default function AccountLayout() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];

  return (
    <Stack
      screenOptions={{
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
