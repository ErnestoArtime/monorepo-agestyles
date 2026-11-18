import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import type { EventCode } from "@agestyles/notifications";
import {
  AGESTYLES_EVENTS,
  notifyCustomer,
  orderCustomerId,
  orderSellerId,
  sellerName,
  withNotificationRetries,
} from "../lib/notifications";

const STAGES: Record<string, EventCode> = {
  start: "order_preparing",
  ready: "order_ready",
  dispatch: "order_dispatched",
  deliver: "order_delivered",
};

type StageEvent = { order_id: string; fulfillment_id: string; action: string };

/**
 * The fulfillments route (AG-04) emits one event per stage change. Medusa has no
 * event for «listo» and emits separate ones for the rest, so this single event keeps
 * the four stages uniform and avoids duplicates.
 */
async function notifyOrderStage({ event, container }: SubscriberArgs<StageEvent>) {
  const code = STAGES[event.data.action];
  if (!code) return;
  const customerId = await orderCustomerId(container, event.data.order_id);
  if (!customerId) return;
  const sellerId = await orderSellerId(container, event.data.order_id);
  await notifyCustomer(container, {
    event_code: code,
    customer_id: customerId,
    params: {
      store: sellerId ? await sellerName(container, sellerId) : null,
      order_id: event.data.order_id,
    },
    key: [AGESTYLES_EVENTS.ORDER_STAGE, event.data.fulfillment_id, event.data.action],
  });
}

export default withNotificationRetries("notify-order-stage", notifyOrderStage);

export const config: SubscriberConfig = {
  event: AGESTYLES_EVENTS.ORDER_STAGE,
  context: { subscriberId: "agestyles-notify-order-stage" },
};
