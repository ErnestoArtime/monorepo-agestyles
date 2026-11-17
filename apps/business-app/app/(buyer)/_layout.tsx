import { Stack } from "expo-router"

export default function BuyerModeLayout() {
  return <Stack screenOptions={{ headerShown: true, headerStyle: { backgroundColor: "#fff" }, headerTintColor: "#111B2D" }}>
    <Stack.Screen name="index" options={{ title: "Comprar" }} />
  </Stack>
}
