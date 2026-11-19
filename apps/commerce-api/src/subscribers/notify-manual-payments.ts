import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import {
  AGESTYLES_EVENTS,
  notifyAdmins,
  notifyCustomer,
  notifySellerMembers,
  orderCustomerId,
  orderSellerId,
  sellerName,
  withNotificationRetries,
} from "../lib/notifications";

type PaymentEvent = { payment_id: string; order_id: string };

/**
 * Proof submitted → the administration verifies it and the store is told; verified or
 * rejected → the buyer and the store are told (AG-19, AG-40).
 * The order decides both audiences, so a store never hears about another store's order.
 */
async function notifyManualPayments({ event, container }: SubscriberArgs<PaymentEvent>) {
  const { payment_id: paymentId, order_id: orderId } = event.data;
  const sellerId = await orderSellerId(container, orderId);
  const store = sellerId ? await sellerName(container, sellerId) : null;

  if (event.name === AGESTYLES_EVENTS.PAYMENT_SUBMITTED) {
    // The administration verifies proofs (AG-32); the store sees one is on its way.
    await notifyAdmins(container, {
      event_code: "admin_payment_proof",
      params: { store, order_id: orderId },
      key: [event.name, paymentId],
    });
    if (!sellerId) return;
    await notifySellerMembers(container, {
      event_code: "seller_payment_proof",
      seller_id: sellerId,
      params: { store, order_id: orderId },
      key: [event.name, paymentId],
    });
    return;
  }

  const verified = event.name === AGESTYLES_EVENTS.PAYMENT_VERIFIED;
  if (sellerId) {
    // The store learns whether it can prepare the order.
    await notifySellerMembers(container, {
      event_code: verified ? "seller_payment_verified" : "seller_payment_rejected",
      seller_id: sellerId,
      params: { store, order_id: orderId },
      key: [event.name, paymentId, "seller"],
    });
  }
  const customerId = await orderCustomerId(container, orderId);
  if (!customerId) return;
  await notifyCustomer(container, {
    event_code: verified ? "payment_verified" : "payment_rejected",
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
