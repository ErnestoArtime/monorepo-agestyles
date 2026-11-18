import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { notifySellerMembers, orderSellerId, sellerName } from "../lib/notifications";

/** Mercur emits `order.placed` once per child order, so each store hears only about its own. */
export default async function notifyOrderPlaced({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const orderId = event.data.id;
  const sellerId = await orderSellerId(container, orderId);
  if (!sellerId) return;
  await notifySellerMembers(container, {
    event_code: "seller_order_placed",
    seller_id: sellerId,
    params: { store: await sellerName(container, sellerId), order_id: orderId },
    key: ["order.placed", orderId],
  });
}

export const config: SubscriberConfig = {
  event: "order.placed",
  context: { subscriberId: "agestyles-notify-order-placed" },
};
