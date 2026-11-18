import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { creditOnlineAgentSale, orderIdForPayment } from "../lib/agent-online-sales";
import { AGESTYLES_EVENTS, withNotificationRetries } from "../lib/notifications";

type PaymentEvent = { id?: string; payment_id?: string; order_id?: string };

/**
 * AG-06 phase 4: the online agent sale earns its commission when the payment is confirmed,
 * either by the administration verifying a manual payment or by Medusa capturing one.
 */
async function creditAgentSaleOnPayment({ event, container }: SubscriberArgs<PaymentEvent>) {
  const orderId =
    event.data.order_id ??
    (event.data.id ? await orderIdForPayment(container, event.data.id) : null);
  if (!orderId) return;
  await creditOnlineAgentSale(container, orderId);
}

export default withNotificationRetries("agent-sale-payment", creditAgentSaleOnPayment);

export const config: SubscriberConfig = {
  event: [AGESTYLES_EVENTS.PAYMENT_VERIFIED, "payment.captured"],
  context: { subscriberId: "agestyles-agent-sale-payment" },
};
