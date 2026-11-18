import { Platform } from "react-native";
import { Stack } from "expo-router";
import { useBusinessTheme } from "../../hooks/use-business-theme";

export default function BuyerModeLayout() {
  const theme = useBusinessTheme();

  return (
    <Stack
      screenOptions={{
        // In a browser the bar above the page belongs to the browser; Android Chrome still
        // reports a top safe-area inset, which doubled the header height (AG-24).
        ...(Platform.OS === "web" ? { headerStatusBarHeight: 0 } : {}),
        headerShown: true,
        headerStyle: { backgroundColor: theme.surface },
        headerTintColor: theme.action,
        headerTitleStyle: { color: theme.text },
        contentStyle: { backgroundColor: theme.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Comprar" }} />
    </Stack>
  );
}
