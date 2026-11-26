import { Stack, useRouter, usePathname } from "expo-router";
import { View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NotificationBell } from "@agestyles/features-notifications";
import { MenuButton, MobileMenuProvider } from "../components/mobile-menu";
import { NotificationsShell } from "../components/notifications-shell";
import { WebSidebar } from "../components/web-sidebar";
import { AdminProvider, useAdmin } from "../context/admin-context";
import { BusinessProvider, useBusiness } from "../context/business-context";
import { useResponsive } from "../hooks/use-responsive";
import { useBusinessTheme } from "../hooks/use-business-theme";
import { UiThemeProvider } from "@agestyles/ui-native";

const AUTH_PATHS = ["/forgot-password", "/reset-password", "/aceptar-invitacion"];

/** Wide browsers with a store selected get a fixed side menu next to the pages (web layout). */
function Shell() {
  const theme = useBusinessTheme();
  const { seller } = useBusiness();
  const { admin } = useAdmin();
  const { isWideWeb } = useResponsive();
  const pathname = usePathname();
  const router = useRouter();
  // Phones and narrow browsers: every page after sign-in gets the app header (menu button,
  // title, bell). The pages that are not part of the managed area (sign-in, recovery, the
  // shared Tienda, tabs which bring their own header) opt out below.
  const signedIn = !!seller || !!admin;
  const appHeader = !isWideWeb && signedIn;
  const stack = (
    <Stack
      screenOptions={{
        headerShown: appHeader,
        headerStyle: { backgroundColor: theme.surface },
        headerTitleStyle: { color: theme.text, fontWeight: "600" },
        headerTintColor: theme.text,
        headerShadowVisible: false,
        headerLeft: () => <MenuButton />,
        headerRight: () => (
          <View style={{ marginRight: 8 }}>
            <NotificationBell onPress={() => router.push("/notifications")} />
          </View>
        ),
        contentStyle: { backgroundColor: theme.background },
      }}
    >
      {/* The tabs, the shared Tienda and the entry screen draw their own header. */}
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="tienda" options={{ headerShown: false }} />
      <Stack.Screen name="(buyer)" options={{ headerShown: false }} />
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
      <Stack.Screen name="reset-password" options={{ headerShown: false }} />
      <Stack.Screen name="aceptar-invitacion" options={{ headerShown: false }} />
      {/* Page names for the phone header (Spanish; the route names are not user-facing). */}
      <Stack.Screen name="analytics" options={{ title: "Análisis" }} />
      <Stack.Screen name="catalog-import" options={{ title: "Importar catálogo" }} />
      <Stack.Screen name="category-requests" options={{ title: "Solicitar categoría" }} />
      <Stack.Screen name="commissions" options={{ title: "Comisiones" }} />
      <Stack.Screen name="movements" options={{ title: "Movimientos" }} />
      <Stack.Screen name="product-new" options={{ title: "Nuevo producto" }} />
      <Stack.Screen name="store-home" options={{ title: "Portada de mi tienda" }} />
      <Stack.Screen name="store-info" options={{ title: "Información de la tienda" }} />
      <Stack.Screen name="store-profile" options={{ title: "Perfil de la tienda" }} />
      <Stack.Screen name="store-sections" options={{ title: "Secciones de mi tienda" }} />
      <Stack.Screen name="agent-sale" options={{ title: "Registrar venta" }} />
      <Stack.Screen name="notifications" options={{ title: "Notificaciones" }} />
      <Stack.Screen name="notification-preferences" options={{ title: "Avisos" }} />
      <Stack.Screen name="admin" options={{ title: "Administración" }} />
    </Stack>
  );
  // The shared Tienda (/tienda) brings its own navigation and a «Mi negocio» way back.
  const inStore = pathname === "/tienda" || pathname.startsWith("/tienda/");
  const sidebar =
    isWideWeb &&
    (!!seller || !!admin) &&
    !inStore &&
    !AUTH_PATHS.some((path) => pathname.startsWith(path));
  // The same tree with or without the menu, so the navigator is never remounted.
  return (
    <View style={{ flex: 1, flexDirection: "row", backgroundColor: theme.background }}>
      {sidebar ? <WebSidebar /> : null}
      <View style={{ flex: 1 }}>{stack}</View>
    </View>
  );
}

export default function RootLayout() {
  const theme = useBusinessTheme();

  return (
    <UiThemeProvider scheme={theme.scheme}>
      <AdminProvider>
        <BusinessProvider>
          <NotificationsShell>
            <StatusBar style={theme.statusBarStyle} />
            <MobileMenuProvider>
              <Shell />
            </MobileMenuProvider>
          </NotificationsShell>
        </BusinessProvider>
      </AdminProvider>
    </UiThemeProvider>
  );
}
