import type { NotificationTarget } from "@agestyles/api-client/notifications";
import { router } from "expo-router";
import { buyerHref, buyerPath } from "../config";

/**
 * Opens the screen a notification points to. A target the app does not know yet (or a
 * missing one) leaves the person where they are, unless `fallbackToInbox` asks for the inbox
 * (used when a push opens the app).
 */
export function openNotificationTarget(
  target: NotificationTarget,
  { fallbackToInbox = false }: { fallbackToInbox?: boolean } = {},
) {
  if (target?.screen === "order" && target.params?.id) {
    router.push({
      pathname: buyerPath("/(drawer)/(tabs)/account/orders/[id]"),
      params: { id: target.params.id },
    });
    return;
  }
  if (target?.screen === "orders") {
    router.push(buyerHref("/(drawer)/(tabs)/account/orders"));
    return;
  }
  if (fallbackToInbox) router.push(buyerHref("/notifications"));
}
