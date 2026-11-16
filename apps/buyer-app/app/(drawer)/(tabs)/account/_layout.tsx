import { Stack } from "expo-router";

export default function AccountLayout() {
  return (
    <Stack screenOptions={{
      headerBackButtonDisplayMode: "minimal",
      headerStyle: { backgroundColor: "#FFFFFF" },
      headerTintColor: "#171717",
      headerShadowVisible: false,
      contentStyle: { backgroundColor: "#F7F7F4" },
    }}>
      <Stack.Screen name="index" options={{ title: "Account" }} />
      <Stack.Screen name="login" options={{ title: "Sign in" }} />
      <Stack.Screen name="register" options={{ title: "Create account" }} />
      <Stack.Screen name="orders" options={{ title: "My purchases" }} />
      <Stack.Screen name="orders/[id]" options={{ title: "Purchase details" }} />
    </Stack>
  );
}
