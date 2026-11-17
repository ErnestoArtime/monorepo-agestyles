import { Stack } from "expo-router";
import { useBusinessTheme } from "../../hooks/use-business-theme";

export default function BuyerModeLayout() {
  const theme = useBusinessTheme();

  return (
    <Stack
      screenOptions={{
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
