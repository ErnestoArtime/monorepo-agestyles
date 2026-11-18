import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import {
  AGESTYLES_EVENTS,
  notifyCustomer,
  notifySellerMembers,
  orderCustomerId,
  orderSellerId,
  sellerName,
  withNotificationRetries,
} from "../lib/notifications";

type PaymentEvent = { payment_id: string; order_id: string };

/**
 * Proof submitted → the store reviews it; verified or rejected → the buyer is told.
 * The order decides both audiences, so a store never hears about another store's order.
 */
async function notifyManualPayments({ event, container }: SubscriberArgs<PaymentEvent>) {
  const { payment_id: paymentId, order_id: orderId } = event.data;
  const sellerId = await orderSellerId(container, orderId);
  const store = sellerId ? await sellerName(container, sellerId) : null;

  if (event.name === AGESTYLES_EVENTS.PAYMENT_SUBMITTED) {
    if (!sellerId) return;
    await notifySellerMembers(container, {
      event_code: "seller_payment_proof",
      seller_id: sellerId,
      params: { store, order_id: orderId },
      key: [event.name, paymentId],
    });
    return;
  }

  const customerId = await orderCustomerId(container, orderId);
  if (!customerId) return;
  await notifyCustomer(container, {
    event_code:
      event.name === AGESTYLES_EVENTS.PAYMENT_VERIFIED ? "payment_verified" : "payment_rejected",
    customer_id: customerId,
    params: { store, order_id: orderId },
    key: [event.name, paymentId],
  });
}

export default withNotificationRetries("notify-manual-payments", notifyManualPayments);

export const config: SubscriberConfig = {
  event: [
    AGESTYLES_EVENTS.PAYMENT_SUBMITTED,
    AGESTYLES_EVENTS.PAYMENT_VERIFIED,
    AGESTYLES_EVENTS.PAYMENT_REJECTED,
  ],
  context: { subscriberId: "agestyles-notify-manual-payments" },
};
