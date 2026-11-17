import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { BusinessProvider } from "../context/business-context";
import { useBusinessTheme } from "../hooks/use-business-theme";

export default function RootLayout() {
  const theme = useBusinessTheme();

  return (
    <BusinessProvider>
      <StatusBar style={theme.statusBarStyle} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.background },
        }}
      />
    </BusinessProvider>
  );
}
