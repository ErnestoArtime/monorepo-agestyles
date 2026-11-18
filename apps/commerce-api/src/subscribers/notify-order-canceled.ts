import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { notifyCustomer, orderCustomerId, orderSellerId, sellerName } from "../lib/notifications";

export default async function notifyOrderCanceled({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const customerId = await orderCustomerId(container, event.data.id);
  if (!customerId) return;
  const sellerId = await orderSellerId(container, event.data.id);
  await notifyCustomer(container, {
    event_code: "order_canceled",
    customer_id: customerId,
    params: {
      store: sellerId ? await sellerName(container, sellerId) : null,
      order_id: event.data.id,
    },
    key: ["order.canceled", event.data.id],
  });
}

export const config: SubscriberConfig = {
  event: "order.canceled",
  context: { subscriberId: "agestyles-notify-order-canceled" },
};
