import { NotificationBell } from "@agestyles/features-notifications";
import { router } from "expo-router";

import { useCustomer } from "@/context/customer-context";

/** Header bell for signed-in customers; hidden when nobody is signed in. */
export function NotificationHeaderBell() {
  const { customer } = useCustomer();
  if (!customer) return null;
  return <NotificationBell onPress={() => router.push("/notifications")} />;
}
