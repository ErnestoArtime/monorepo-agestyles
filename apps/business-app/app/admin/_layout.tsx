import { Stack } from "expo-router";
import { AdminGate } from "../../components/admin-gate";
import { AdminNav } from "../../components/admin-nav";
import { useBusinessTheme } from "../../hooks/use-business-theme";

/** Marketplace administration (AG-32): users, stores, orders and products under review. */
export default function AdminLayout() {
  const theme = useBusinessTheme();
  return (
    <AdminGate>
      <AdminNav />
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.background } }}
      />
    </AdminGate>
  );
}
