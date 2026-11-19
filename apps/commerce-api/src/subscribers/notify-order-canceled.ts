import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import {
  notifyCustomer,
  notifySellerMembers,
  orderCustomerId,
  orderSellerId,
  sellerName,
  withNotificationRetries,
} from "../lib/notifications";

/** The buyer and the store (so it does not prepare it) hear about a cancelled order. */
async function notifyOrderCanceled({ event, container }: SubscriberArgs<{ id: string }>) {
  const sellerId = await orderSellerId(container, event.data.id);
  const store = sellerId ? await sellerName(container, sellerId) : null;
  if (sellerId) {
    await notifySellerMembers(container, {
      event_code: "seller_order_canceled",
      seller_id: sellerId,
      params: { store, order_id: event.data.id },
      key: ["order.canceled", event.data.id, "seller"],
    });
  }
  const customerId = await orderCustomerId(container, event.data.id);
  if (!customerId) return;
  await notifyCustomer(container, {
    event_code: "order_canceled",
    customer_id: customerId,
    params: { store, order_id: event.data.id },
    key: ["order.canceled", event.data.id],
  });
}

export default withNotificationRetries("notify-order-canceled", notifyOrderCanceled);

export const config: SubscriberConfig = {
  event: "order.canceled",
  context: { subscriberId: "agestyles-notify-order-canceled" },
};
