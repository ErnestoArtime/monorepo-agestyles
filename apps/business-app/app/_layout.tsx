import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { NotificationsShell } from "../components/notifications-shell";
import { BusinessProvider } from "../context/business-context";
import { useBusinessTheme } from "../hooks/use-business-theme";
import { UiThemeProvider } from "@agestyles/ui-native";

export default function RootLayout() {
  const theme = useBusinessTheme();

  return (
    <UiThemeProvider scheme={theme.scheme}>
      <BusinessProvider>
        <NotificationsShell>
          <StatusBar style={theme.statusBarStyle} />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: theme.background },
            }}
          />
        </NotificationsShell>
      </BusinessProvider>
    </UiThemeProvider>
  );
}
