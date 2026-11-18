import { Stack, usePathname } from "expo-router";
import { View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NotificationsShell } from "../components/notifications-shell";
import { WebSidebar } from "../components/web-sidebar";
import { BusinessProvider, useBusiness } from "../context/business-context";
import { useResponsive } from "../hooks/use-responsive";
import { useBusinessTheme } from "../hooks/use-business-theme";
import { UiThemeProvider } from "@agestyles/ui-native";

const AUTH_PATHS = ["/forgot-password", "/reset-password"];

/** Wide browsers with a store selected get a fixed side menu next to the pages (web layout). */
function Shell() {
  const theme = useBusinessTheme();
  const { seller } = useBusiness();
  const { isWideWeb } = useResponsive();
  const pathname = usePathname();
  const stack = (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.background },
      }}
    />
  );
  const sidebar = isWideWeb && !!seller && !AUTH_PATHS.some((path) => pathname.startsWith(path));
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
      <BusinessProvider>
        <NotificationsShell>
          <StatusBar style={theme.statusBarStyle} />
          <Shell />
        </NotificationsShell>
      </BusinessProvider>
    </UiThemeProvider>
  );
}
